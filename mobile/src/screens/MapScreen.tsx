import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  Vibration,
  ScrollView,
} from 'react-native';
import * as MapLibreGLNamespace from '@maplibre/maplibre-react-native';
import { RouteDetail } from '../services/syncService';
import { getMBTilesUri } from '../services/offlinePackageManager';
import UserLocationLayer from '../components/UserLocationLayer';
import LocationHUD, { HUDCoordsOverride } from '../components/LocationHUD';
import { useLocation } from '../context/LocationContext';
import {
  calculateRouteMetrics,
  extractRouteMeta,
  generateRadarGridGeoJSON,
  RouteWaypoint,
} from '../utils/geoMath';

const MapLibreGL: any = (MapLibreGLNamespace as any).default ?? MapLibreGLNamespace;
const MapView = MapLibreGL.MapView ?? (MapLibreGLNamespace as any).MapView;
const Camera = MapLibreGL.Camera ?? (MapLibreGLNamespace as any).Camera;
const ShapeSource = MapLibreGL.ShapeSource ?? (MapLibreGLNamespace as any).ShapeSource;
const LineLayer = MapLibreGL.LineLayer ?? (MapLibreGLNamespace as any).LineLayer;
const CircleLayer = MapLibreGL.CircleLayer ?? (MapLibreGLNamespace as any).CircleLayer;

try {
  if (MapLibreGL.setAccessToken) {
    MapLibreGL.setAccessToken(null);
  } else if ((MapLibreGLNamespace as any).setAccessToken) {
    (MapLibreGLNamespace as any).setAccessToken(null);
  }
} catch (e) {
  console.error('Failed to set MapLibre access token:', e);
}

// Pure offline tactical radar style — ZERO online tile requests
const TACTICAL_RADAR_STYLE = JSON.stringify({
  version: 8,
  sources: {},
  layers: [
    {
      id: 'tactical-radar-bg',
      type: 'background',
      paint: {
        'background-color': '#080C12',
      },
    },
  ],
});

const MAP_IMAGES = { 'arrow-up': require('../../assets/nav_arrow.png') };

interface MapScreenProps {
  route: RouteDetail;
  hasLocalMBTiles: boolean;
  onBack: () => void;
}

export default function MapScreen({ route, hasLocalMBTiles, onBack }: MapScreenProps) {
  const { coords: realCoords, heading: realHeading } = useLocation();

  // Automatically light up offline satellite package when available
  const [satelliteLit, setSatelliteLit] = useState<boolean>(hasLocalMBTiles);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [cameraFollow, setCameraFollow] = useState<boolean>(false);
  const [courseUp3D, setCourseUp3D] = useState<boolean>(false);
  const [selectedWaypoint, setSelectedWaypoint] = useState<RouteWaypoint | null>(null);
  const [mapReady, setMapReady] = useState<boolean>(false);

  // Indoor / Live Demo Route Simulation State
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simOffRoute, setSimOffRoute] = useState<boolean>(false);
  const [simStepIdx, setSimStepIdx] = useState<number>(0);

  const cameraRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    setSatelliteLit(hasLocalMBTiles);
    setSimStepIdx(0);
    setSimOffRoute(false);
  }, [hasLocalMBTiles, route.id]);

  // Extract flat route coordinate sequence for simulation
  const trackPoints = useMemo(() => {
    const pts: number[][] = [];
    const features = route?.geojson?.features || [];
    for (const f of features) {
      const g = f?.geometry;
      if (!g) continue;
      if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
        for (const c of g.coordinates) {
          if (Array.isArray(c) && c.length >= 2) pts.push(c);
        }
      } else if (g.type === 'MultiLineString' && Array.isArray(g.coordinates)) {
        for (const line of g.coordinates) {
          if (Array.isArray(line)) {
            for (const c of line) {
              if (Array.isArray(c) && c.length >= 2) pts.push(c);
            }
          }
        }
      }
    }
    return pts;
  }, [route.geojson]);

  useEffect(() => {
    if (!isTracking || !isSimulating || trackPoints.length < 2) return;
    const timer = setInterval(() => {
      setSimStepIdx((prev) => (prev + 1) % trackPoints.length);
    }, 1000);
    return () => clearInterval(timer);
  }, [isTracking, isSimulating, trackPoints.length]);

  const simData = useMemo((): { coords: HUDCoordsOverride; heading: number } | null => {
    if (!isSimulating || trackPoints.length === 0) return null;
    const idx = simStepIdx % trackPoints.length;
    const nextIdx = (idx + 1) % trackPoints.length;
    const pt = trackPoints[idx];
    const nextPt = trackPoints[nextIdx];

    // Calculate bearing from pt to nextPt
    const dLon = ((nextPt[0] - pt[0]) * Math.PI) / 180;
    const lat1 = (pt[1] * Math.PI) / 180;
    const lat2 = (nextPt[1] * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

    // When simOffRoute is toggled on, offset latitude by ~0.00078 deg (~86 meters)
    const offsetLat = simOffRoute ? 0.00078 : 0;
    const offsetLng = simOffRoute ? 0.00035 : 0;

    return {
      coords: {
        longitude: pt[0] + offsetLng,
        latitude: pt[1] + offsetLat,
        altitude: pt.length >= 3 && Number.isFinite(pt[2]) ? pt[2] : 3250,
        accuracy: 3,
        speed: 12.8, // ~46.1 km/h
        heading: brng,
      },
      heading: brng,
    };
  }, [isSimulating, trackPoints, simStepIdx, simOffRoute]);

  const coords = simData ? simData.coords : realCoords;
  const heading = simData ? simData.heading : realHeading;

  // Extract waypoints, elevation, and tactical grid
  const routeMeta = useMemo(() => extractRouteMeta(route.geojson), [route.geojson]);
  const radarGridGeoJSON = useMemo(() => generateRadarGridGeoJSON(route.bbox), [route.bbox]);

  // Build GeoJSON for start/end/waypoints markers on map
  const waypointsGeoJSON = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: routeMeta.waypoints.map((wp) => ({
        type: 'Feature',
        id: wp.id,
        properties: {
          id: wp.id,
          name: wp.name,
          kind: wp.kind,
          elevation: wp.elevation,
          description: wp.description || '',
        },
        geometry: {
          type: 'Point',
          coordinates: wp.coord,
        },
      })),
    };
  }, [routeMeta.waypoints]);

  // Live route tracking metrics
  const metrics = useMemo(() => {
    if (!isTracking || !route?.geojson || !coords) return null;
    return calculateRouteMetrics([coords.longitude, coords.latitude], route.geojson);
  }, [isTracking, route, coords]);

  const deviation = metrics ? Math.round(metrics.distance) : null;
  const snappedCoord = metrics ? metrics.snappedCoord : null;
  const remainingDistanceKm = metrics ? metrics.remainingDistanceKm : null;
  const progressPercent = metrics ? metrics.progressPercent : null;

  const prevDeviationRef = useRef<number | null>(null);

  useEffect(() => {
    if (isTracking && deviation !== null) {
      const prevDeviation = prevDeviationRef.current;
      if ((prevDeviation === null || prevDeviation < 60) && deviation >= 60) {
        Vibration.vibrate([0, 400, 200, 400]);
      }
      prevDeviationRef.current = deviation;
    } else if (!isTracking) {
      prevDeviationRef.current = null;
    }
  }, [deviation, isTracking]);

  // Deviation warning guide line
  const deviationLineGeoJSON = useMemo(() => {
    if (isTracking && deviation !== null && deviation >= 60 && coords && snappedCoord) {
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [coords.longitude, coords.latitude],
                snappedCoord,
              ],
            },
            properties: {},
          },
        ],
      };
    }
    return null;
  }, [isTracking, deviation, coords, snappedCoord]);

  // Center route on initial map load
  useEffect(() => {
    if (mapReady && route.bbox && cameraRef.current) {
      const [minLng, minLat, maxLng, maxLat] = route.bbox;
      cameraRef.current.fitBounds([maxLng, maxLat], [minLng, minLat], 60, 700);
    }
  }, [mapReady, route.id]);

  // Camera follow during active tracking
  useEffect(() => {
    if (cameraFollow && coords && cameraRef.current) {
      const activeHeading =
        courseUp3D && heading !== null && heading >= 0 ? heading : 0;
      cameraRef.current.setCamera({
        centerCoordinate: [coords.longitude, coords.latitude],
        zoomLevel: 15,
        heading: activeHeading,
        pitch: courseUp3D ? 45 : 0,
        animationDuration: 500,
      });
    }
  }, [coords, cameraFollow, courseUp3D, heading]);

  const handleFitRoute = () => {
    setCameraFollow(false);
    setSelectedWaypoint(null);
    if (route.bbox && cameraRef.current) {
      const [minLng, minLat, maxLng, maxLat] = route.bbox;
      cameraRef.current.fitBounds([maxLng, maxLat], [minLng, minLat], 60, 800);
    }
  };

  const handleLocateMe = () => {
    if (coords && cameraRef.current) {
      setCameraFollow(true);
      cameraRef.current.setCamera({
        centerCoordinate: [coords.longitude, coords.latitude],
        zoomLevel: 15,
        animationDuration: 600,
      });
    }
  };

  const handleToggleOrientation = () => {
    const next3D = !courseUp3D;
    setCourseUp3D(next3D);
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        heading: next3D && heading ? heading : 0,
        pitch: next3D ? 45 : 0,
        animationDuration: 400,
      });
    }
  };

  const handleFocusWaypoint = (wp: RouteWaypoint) => {
    setCameraFollow(false);
    setSelectedWaypoint(wp);
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: wp.coord,
        zoomLevel: 14.5,
        animationDuration: 600,
      });
    }
  };

  const handleToggleTracking = () => {
    const next = !isTracking;
    setIsTracking(next);
    setCameraFollow(next);
    setSelectedWaypoint(null);
    if (next) {
      // Auto-enable simulation if indoor/far from route (>2km) or no real GPS
      if (!realCoords) {
        setIsSimulating(true);
      } else {
        const m = calculateRouteMetrics(
          [realCoords.longitude, realCoords.latitude],
          route.geojson
        );
        if (!m || m.distance > 2000) {
          setIsSimulating(true);
        }
      }
    } else {
      setSimOffRoute(false);
    }
  };

  const totalAscent = route.total_ascent || routeMeta.computedAscent || 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          mapStyle={TACTICAL_RADAR_STYLE}
          logoEnabled={false}
          attributionEnabled={false}
          compassEnabled={false}
          onRegionWillChange={(e: any) => {
            if (e?.properties?.isUserInteraction) {
              setCameraFollow(false);
            }
          }}
          onDidFinishLoadingMap={() => setMapReady(true)}
        >
          <Camera ref={cameraRef} />

          <MapLibreGL.Images images={MAP_IMAGES} />

          {/* 1. Tactical Radar Coordinate Grid (Pure Local GeoJSON) */}
          <ShapeSource id="radarGridSource" shape={radarGridGeoJSON as any}>
            <LineLayer
              id="radarGridMinorLayer"
              filter={['==', ['get', 'gridType'], 'minor']}
              style={{
                lineColor: '#111A27',
                lineWidth: 1,
                lineDasharray: [2, 3],
              }}
            />
            <LineLayer
              id="radarGridMajorLayer"
              filter={['==', ['get', 'gridType'], 'major']}
              style={{
                lineColor: '#1E2D42',
                lineWidth: 1.2,
              }}
            />
          </ShapeSource>

          {/* 2. Offline MBTiles Satellite Layer (Localized Illumination) */}
          {satelliteLit && hasLocalMBTiles && (
            <MapLibreGL.RasterSource
              id="offline-mbtiles"
              url={getMBTilesUri(route.id)}
              tileSize={256}
              minZoomLevel={8}
              maxZoomLevel={route.max_zoom || 15}
            >
              <MapLibreGL.RasterLayer
                id="offline-mbtiles-layer"
                belowLayerID="routeGlowLayer"
                style={{ rasterOpacity: 0.95 }}
              />
            </MapLibreGL.RasterSource>
          )}

          {/* 3. Dual-Layer Glowing Route Track */}
          {route?.geojson && (
            <ShapeSource id="routeSource" shape={route.geojson} maxZoomLevel={22}>
              <LineLayer
                id="routeGlowLayer"
                style={{
                  lineColor: '#FF5722',
                  lineWidth: 10,
                  lineOpacity: 0.28,
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
              />
              <LineLayer
                id="routeLayer"
                aboveLayerID="routeGlowLayer"
                style={{
                  lineColor: '#FF6B35',
                  lineWidth: 4,
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
              />
            </ShapeSource>
          )}

          {/* 4. Start / End / Waypoint Tactical Markers */}
          {waypointsGeoJSON.features.length > 0 && (
            <ShapeSource
              id="waypointsSource"
              shape={waypointsGeoJSON as any}
              onPress={(e: any) => {
                const feat = e?.features?.[0];
                if (feat?.properties?.id) {
                  const found = routeMeta.waypoints.find(
                    (w) => w.id === feat.properties.id
                  );
                  if (found) setSelectedWaypoint(found);
                }
              }}
            >
              <CircleLayer
                id="waypointsCircleLayer"
                aboveLayerID="routeLayer"
                style={{
                  circleRadius: 7,
                  circleColor: [
                    'match',
                    ['get', 'kind'],
                    'start',
                    '#10B981',
                    'end',
                    '#EF4444',
                    '#F59E0B',
                  ],
                  circleStrokeColor: '#080C12',
                  circleStrokeWidth: 2.5,
                }}
              />
            </ShapeSource>
          )}

          {/* 5. Deviation Warning Dashed Line */}
          {deviationLineGeoJSON && (
            <ShapeSource id="deviationSource" shape={deviationLineGeoJSON as any}>
              <LineLayer
                id="deviationLayer"
                aboveLayerID="routeLayer"
                style={{
                  lineColor: '#FACC15',
                  lineWidth: 3.5,
                  lineDasharray: [2, 2],
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
              />
            </ShapeSource>
          )}

          {/* 6. Real-Time Vehicle Location Marker */}
          <UserLocationLayer
            overrideCoords={simData ? simData.coords : undefined}
            overrideHeading={simData ? simData.heading : undefined}
          />
        </MapView>

        {/* ================================================================
            TOP TACTICAL HEADER BAR
           ================================================================ */}
        <View style={styles.topHeaderBar}>
          <Pressable
            style={({ pressed }) => [styles.topBackBtn, pressed && { opacity: 0.8 }]}
            onPress={onBack}
          >
            <Text style={styles.topBackBtnText}>← 工具箱</Text>
          </Pressable>

          <View style={styles.topRouteTitleBox}>
            <Text style={styles.topRouteCodeText}>RADAR · #{route.redeem_code}</Text>
            <Text style={styles.topRouteTitleText} numberOfLines={1}>
              {route.title}
            </Text>
          </View>

          {/* Satellite / Radar Grid Toggle */}
          <Pressable
            style={[
              styles.layerToggleBtn,
              satelliteLit && hasLocalMBTiles && styles.layerToggleBtnActive,
              !hasLocalMBTiles && { opacity: 0.5 },
            ]}
            onPress={() => {
              if (hasLocalMBTiles) {
                setSatelliteLit(!satelliteLit);
              }
            }}
          >
            <View
              style={[
                styles.layerToggleDot,
                {
                  backgroundColor:
                    satelliteLit && hasLocalMBTiles ? '#10B981' : '#38BDF8',
                },
              ]}
            />
            <Text style={styles.layerToggleText}>
              {!hasLocalMBTiles
                ? '纯网格'
                : satelliteLit
                ? '卫星点亮'
                : '雷达网格'}
            </Text>
          </Pressable>
        </View>

        {/* ================================================================
            WAYPOINT QUICK-JUMP STRIP & POPUP INSPECTOR
           ================================================================ */}
        {!isTracking && routeMeta.waypoints.length > 0 && (
          <View style={styles.waypointStripWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.waypointStripScroll}
            >
              {routeMeta.waypoints.map((wp, idx) => {
                const isSelected = selectedWaypoint?.id === wp.id;
                return (
                  <Pressable
                    key={wp.id}
                    style={[
                      styles.waypointPill,
                      isSelected && styles.waypointPillActive,
                    ]}
                    onPress={() => handleFocusWaypoint(wp)}
                  >
                    <View
                      style={[
                        styles.waypointPillDot,
                        wp.kind === 'start' && { backgroundColor: '#10B981' },
                        wp.kind === 'end' && { backgroundColor: '#EF4444' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.waypointPillText,
                        isSelected && styles.waypointPillTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {wp.kind === 'start'
                        ? '起点'
                        : wp.kind === 'end'
                        ? '终点'
                        : `航点${idx}: ${wp.name}`}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Selected Waypoint Inspector Card */}
        {selectedWaypoint && (
          <View style={styles.waypointPopupCard}>
            <View style={styles.waypointPopupHeader}>
              <Text style={styles.waypointPopupTitle}>{selectedWaypoint.name}</Text>
              <Pressable onPress={() => setSelectedWaypoint(null)}>
                <Text style={styles.waypointPopupClose}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.waypointPopupCoords}>
              坐标: {selectedWaypoint.coord[1].toFixed(5)}°N,{' '}
              {selectedWaypoint.coord[0].toFixed(5)}°E
              {selectedWaypoint.elevation !== undefined
                ? ` · 海拔 ${selectedWaypoint.elevation}m`
                : ''}
            </Text>
            {!!selectedWaypoint.description && (
              <Text style={styles.waypointPopupDesc}>
                {selectedWaypoint.description}
              </Text>
            )}
          </View>
        )}

        {/* ================================================================
            RIGHT FLOATING TACTICAL CONTROLS
           ================================================================ */}
        <View style={styles.rightControlsPod}>
          <Pressable
            style={({ pressed }) => [styles.tacticalCtrlBtn, pressed && { opacity: 0.8 }]}
            onPress={handleFitRoute}
          >
            <Text style={styles.tacticalCtrlIcon}>[ ]</Text>
            <Text style={styles.tacticalCtrlLabel}>全览</Text>
          </Pressable>

          <View style={styles.ctrlDivider} />

          <Pressable
            style={({ pressed }) => [styles.tacticalCtrlBtn, pressed && { opacity: 0.8 }]}
            onPress={handleLocateMe}
          >
            <Text style={styles.tacticalCtrlIcon}>◎</Text>
            <Text style={styles.tacticalCtrlLabel}>定位</Text>
          </Pressable>

          <View style={styles.ctrlDivider} />

          <Pressable
            style={({ pressed }) => [
              styles.tacticalCtrlBtn,
              courseUp3D && styles.tacticalCtrlBtnActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleToggleOrientation}
          >
            <Text
              style={[
                styles.tacticalCtrlIcon,
                courseUp3D && { color: '#FF5722' },
              ]}
            >
              {courseUp3D ? '3D' : 'N▲'}
            </Text>
            <Text style={styles.tacticalCtrlLabel}>
              {courseUp3D ? '车头' : '正北'}
            </Text>
          </Pressable>
        </View>

        {/* Resume Camera Follow Pill during Tracking */}
        {isTracking && !cameraFollow && (
          <Pressable
            style={styles.resumeFollowPill}
            onPress={() => setCameraFollow(true)}
          >
            <Text style={styles.resumeFollowPillText}>◎ 恢复视角跟随</Text>
          </Pressable>
        )}

        {/* ================================================================
            BOTTOM OFF-ROAD DRIVING COCKPIT HUD
           ================================================================ */}
        <LocationHUD
          isTracking={isTracking}
          deviation={deviation}
          remainingDistanceKm={remainingDistanceKm}
          progressPercent={progressPercent}
          totalDistanceKm={Number(route.total_distance || 0)}
          totalAscentM={totalAscent}
          waypointCount={routeMeta.waypoints.length}
          satelliteLit={satelliteLit && hasLocalMBTiles}
          hasLocalMBTiles={hasLocalMBTiles}
          onToggleTracking={handleToggleTracking}
          overrideCoords={simData ? simData.coords : undefined}
          overrideHeading={simData ? simData.heading : undefined}
          isSimulating={isSimulating}
          simOffRoute={simOffRoute}
          onToggleSimulating={() => {
            setIsSimulating((prev) => !prev);
            setSimOffRoute(false);
          }}
          onToggleSimOffRoute={() => setSimOffRoute((prev) => !prev)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C12',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  topHeaderBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(11, 15, 23, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  topBackBtn: {
    backgroundColor: '#151E2E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#293548',
  },
  topBackBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  topRouteTitleBox: {
    flex: 1,
    marginHorizontal: 10,
    alignItems: 'center',
  },
  topRouteCodeText: {
    color: '#F59E0B',
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 1,
  },
  topRouteTitleText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 1,
  },
  layerToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151E2E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#293548',
  },
  layerToggleBtnActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  layerToggleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  layerToggleText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  waypointStripWrapper: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
  },
  waypointStripScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  waypointPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 36, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#263347',
    marginRight: 8,
  },
  waypointPillActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
  },
  waypointPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
    marginRight: 6,
  },
  waypointPillText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 130,
  },
  waypointPillTextActive: {
    color: '#FDE68A',
    fontWeight: '800',
  },
  waypointPopupCard: {
    position: 'absolute',
    top: 112,
    left: 12,
    right: 72,
    backgroundColor: 'rgba(15, 23, 36, 0.95)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  waypointPopupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  waypointPopupTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  waypointPopupClose: {
    color: '#94A3B8',
    fontSize: 14,
    paddingHorizontal: 4,
  },
  waypointPopupCoords: {
    color: '#FBBF24',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  waypointPopupDesc: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
  rightControlsPod: {
    position: 'absolute',
    right: 12,
    top: '36%',
    backgroundColor: 'rgba(11, 15, 23, 0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#263347',
    overflow: 'hidden',
  },
  tacticalCtrlBtn: {
    width: 52,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tacticalCtrlBtnActive: {
    backgroundColor: 'rgba(255, 87, 34, 0.15)',
  },
  ctrlDivider: {
    height: 1,
    backgroundColor: '#1E293B',
  },
  tacticalCtrlIcon: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  tacticalCtrlLabel: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  resumeFollowPill: {
    position: 'absolute',
    bottom: 220,
    alignSelf: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#60A5FA',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  resumeFollowPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
