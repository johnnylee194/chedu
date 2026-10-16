import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Modal, TextInput, ActivityIndicator, SafeAreaView, Vibration } from 'react-native';
import * as MapLibreGLNamespace from '@maplibre/maplibre-react-native';
import { syncRoutes, getCachedRoutes, RouteDetail, getServerUrl, saveServerUrl } from '../services/syncService';
import { isMBTilesDownloaded, downloadMBTiles, deleteMBTiles, getMBTilesUri } from '../services/offlinePackageManager';
import UserLocationLayer from '../components/UserLocationLayer';
import LocationHUD from '../components/LocationHUD';
import { useLocation } from '../context/LocationContext';
import { calculateRouteMetrics } from '../utils/geoMath';

const MapLibreGL: any = (MapLibreGLNamespace as any).default ?? MapLibreGLNamespace;
const MapView = MapLibreGL.MapView ?? (MapLibreGLNamespace as any).MapView;
const Camera = MapLibreGL.Camera ?? (MapLibreGLNamespace as any).Camera;
const ShapeSource = MapLibreGL.ShapeSource ?? (MapLibreGLNamespace as any).ShapeSource;
const LineLayer = MapLibreGL.LineLayer ?? (MapLibreGLNamespace as any).LineLayer;

try {
  if (MapLibreGL.setAccessToken) {
    MapLibreGL.setAccessToken(null);
  } else if ((MapLibreGLNamespace as any).setAccessToken) {
    (MapLibreGLNamespace as any).setAccessToken(null);
  }
} catch (e) {
  console.error('Failed to set MapLibre access token:', e);
}

MapLibreGL.Logger.setLogCallback((log: any) => {
  if (log.level === 'error' || log.level === 'warning') {
    console.error(`[MapLibre Native] ${log.message}`);
  }
  return true;
});
MapLibreGL.Logger.setLogLevel('Verbose');

const mapStyle = JSON.stringify({
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      maxzoom: 18,
    },
  },
  layers: [
    {
      id: 'esri-layer',
      type: 'raster',
      source: 'esri',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
});

const MAP_IMAGES = { 'arrow-up': require('../../assets/icon.png') };

export default function MapScreen() {
  const [routes, setRoutes] = useState<RouteDetail[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState('');

  // Tracking & Metrics States
  const [isTracking, setIsTracking] = useState(false);
  const [cameraFollow, setCameraFollow] = useState(false);
  const { coords } = useLocation();

  // Offline Map States
  const [offlineMapMode, setOfflineMapMode] = useState(false);
  const [downloadedRoutes, setDownloadedRoutes] = useState<Set<number>>(new Set());
  const [downloadingRoutes, setDownloadingRoutes] = useState<Record<number, number>>({}); // routeId -> progress (0-1)

  const cameraRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

  const metrics = useMemo(() => {
    if (!isTracking || !selectedRoute?.geojson || !coords) return null;
    return calculateRouteMetrics([coords.longitude, coords.latitude], selectedRoute.geojson);
  }, [isTracking, selectedRoute, coords]);

  const deviation = metrics ? Math.round(metrics.distance) : null;
  const snappedCoord = metrics ? metrics.snappedCoord : null;
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

  useEffect(() => {
    if (offlineMapMode && selectedRoute) {
      console.log(`[Offline Source] Mounting MBTiles: ${getMBTilesUri(selectedRoute.id)}`);
    }
  }, [offlineMapMode, selectedRoute]);

  useEffect(() => {
    if (isTracking) {
      setCameraFollow(true);
    } else {
      setCameraFollow(false);
    }
  }, [isTracking]);

  useEffect(() => {
    if (cameraFollow && coords && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [coords.longitude, coords.latitude],
        zoomLevel: 15,
        animationDuration: 500,
      });
    }
  }, [coords, cameraFollow]);

  useEffect(() => {
    // Offline-first startup flow
    const init = async () => {
      // 1. Read cached routes
      const cached = await getCachedRoutes();
      setRoutes(cached);
      if (cached.length > 0) {
        handleRouteSelect(cached[0]);
      }

      // 2. Load settings
      const url = await getServerUrl();
      setServerUrlInput(url);

      // 3. Try syncing
      handleSync();
    };

    init();
  }, []);

  // Update downloaded routes status when routes change
  useEffect(() => {
    const checkDownloadedRoutes = async () => {
      const downloaded = new Set<number>();
      for (const route of routes) {
        if (route.tile_status === 'completed') {
          const isDownloaded = await isMBTilesDownloaded(route.id);
          if (isDownloaded) {
            downloaded.add(route.id);
          }
        }
      }
      setDownloadedRoutes(downloaded);
    };

    if (routes.length > 0) {
      checkDownloadedRoutes();
    }
  }, [routes]);

  const handleSync = async () => {
    if (loading) return;
    setLoading(true);
    setSyncStatus('同步中...');
    try {
      const synced = await syncRoutes();
      setRoutes(synced);
      setSyncStatus('同步成功。');
      if (!selectedRoute && synced.length > 0) {
        handleRouteSelect(synced[0]);
      }
    } catch (e) {
      setSyncStatus('离线或同步失败，使用缓存路线。');
    } finally {
      setLoading(false);
    }
  };

  const handleRouteSelect = (route: RouteDetail) => {
    setSelectedRoute(route);
    if (route.bbox && cameraRef.current) {
      const [minLng, minLat, maxLng, maxLat] = route.bbox;
      cameraRef.current.fitBounds(
        [maxLng, maxLat],
        [minLng, minLat],
        50, // padding
        1000 // duration
      );
    }
  };

  const handleCenterRoute = () => {
    if (selectedRoute?.bbox && cameraRef.current) {
      const [minLng, minLat, maxLng, maxLat] = selectedRoute.bbox;
      cameraRef.current.fitBounds(
        [maxLng, maxLat],
        [minLng, minLat],
        50,
        1000
      );
    }
  };

  const saveSettings = async () => {
    await saveServerUrl(serverUrlInput);
    setSettingsVisible(false);
    handleSync();
  };

  const handleDownload = async (routeId: number) => {
    if (downloadingRoutes[routeId] !== undefined) return;

    setDownloadingRoutes(prev => ({ ...prev, [routeId]: 0 }));
    const serverUrl = await getServerUrl();

    const success = await downloadMBTiles(serverUrl, routeId, (progress) => {
      setDownloadingRoutes(prev => ({ ...prev, [routeId]: progress }));
    });

    setDownloadingRoutes(prev => {
      const next = { ...prev };
      delete next[routeId];
      return next;
    });

    if (success) {
      setDownloadedRoutes(prev => new Set(prev).add(routeId));
    }
  };

  const handleDelete = async (routeId: number) => {
    const success = await deleteMBTiles(routeId);
    if (success) {
      setDownloadedRoutes(prev => {
        const next = new Set(prev);
        next.delete(routeId);
        return next;
      });
      if (selectedRoute?.id === routeId && offlineMapMode) {
        setOfflineMapMode(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          mapStyle={mapStyle}
          logoEnabled={false}
          attributionEnabled={false}
          onRegionWillChange={(e: any) => {
            if (e.properties.isUserInteraction) {
              setCameraFollow(false);
            }
          }}
          onRegionDidChange={async (e: any) => {
            console.log(`[Map View] Current Zoom: ${e.properties.zoomLevel.toFixed(2)}`);
            try {
              if (mapRef.current) {
                const style = await mapRef.current.getStyle();
                if (style && style.layers) {
                  const layerIds = style.layers.map((l: any) => l.id);
                  const offlineIdx = layerIds.indexOf('offline-mbtiles-layer');
                  const routeIdx = layerIds.indexOf('routeLayer');
                  console.log(`[Map Layers] offline-mbtiles-layer Index: ${offlineIdx}, routeLayer Index: ${routeIdx}`);
                }
              }
            } catch (err) {
              console.log('[Map Layers] Failed to get style');
            }
          }}
          onDidFailLoadingMap={(e: any) => console.error('[Map View] Failed to load map:', e)}
          onDidFinishLoadingMap={() => console.log('[Map View] Map loaded successfully')}
        >
          <Camera ref={cameraRef} />

          <MapLibreGL.Images images={MAP_IMAGES} />

          {/* Offline MBTiles Raster Layer */}
          {offlineMapMode && selectedRoute && downloadedRoutes.has(selectedRoute.id) && (
            <MapLibreGL.RasterSource
              id="offline-mbtiles"
              url={getMBTilesUri(selectedRoute.id)}
              tileSize={256}
              minZoomLevel={8}
              maxZoomLevel={16}
            >
              <MapLibreGL.RasterLayer
                id="offline-mbtiles-layer"
                style={{ rasterOpacity: 1 }}
		belowLayerID="routeLayer"
              />
            </MapLibreGL.RasterSource>
          )}

          {/* Route Polyline */}
          {selectedRoute?.geojson && (
            <ShapeSource id="routeSource" shape={selectedRoute.geojson} maxZoomLevel={22}>
              <LineLayer
                id="routeLayer"
                style={{
                  lineColor: '#FF5722',
                  lineWidth: 4,
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
              />
            </ShapeSource>
          )}

          {/* Deviation Warning Polyline */}
          {deviationLineGeoJSON && (
            <ShapeSource id="deviationSource" shape={deviationLineGeoJSON as any}>
              <LineLayer
                id="deviationLayer"
                aboveLayerID="routeLayer"
                style={{
                  lineColor: '#FFD60A',
                  lineWidth: 3,
                  lineDasharray: [2, 2],
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
              />
            </ShapeSource>
          )}

          {/* Real-time Vehicle Marker */}
          <UserLocationLayer />
        </MapView>

        <Pressable
          style={({ pressed }) => [styles.settingsButton, pressed && { opacity: 0.7 }]}
          onPress={() => setSettingsVisible(true)}
        >
          <Text style={styles.settingsButtonText}>⚙️ 设置</Text>
        </Pressable>

        {/* Resume Follow Button */}
        {isTracking && !cameraFollow && (
          <Pressable
            style={styles.resumeFollowButton}
            onPress={() => setCameraFollow(true)}
          >
            <Text style={styles.resumeFollowButtonText}>📍 恢复跟随</Text>
          </Pressable>
        )}

        {/* Off-Road Driving HUD */}
        <LocationHUD isTracking={isTracking} deviation={deviation} />
      </View>

      {/* Bottom Drawer UI */}
      <View style={[styles.drawer, isTracking && styles.drawerCollapsed]}>
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>路线列表</Text>
          <View style={styles.syncContainer}>
            <Text style={styles.syncStatus}>{syncStatus}</Text>
            <Pressable
              style={({ pressed }) => [styles.syncButton, pressed && { opacity: 0.7 }]}
              onPress={handleSync}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.syncButtonText}>同步</Text>}
            </Pressable>
          </View>
        </View>

        <FlatList
          data={routes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => {
            const isDownloaded = downloadedRoutes.has(item.id);
            const isDownloading = downloadingRoutes[item.id] !== undefined;
            const progress = downloadingRoutes[item.id] || 0;

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.routeItem,
                  selectedRoute?.id === item.id && styles.selectedRouteItem,
                  pressed && { opacity: 0.7 }
                ]}
                onPress={() => handleRouteSelect(item)}
              >
                <View style={styles.routeInfo}>
                  <Text style={styles.routeName}>{item.title || '未命名路线'}</Text>
                  <Text style={styles.routeDetails}>
                    {item.total_distance !== undefined && item.total_distance !== null ? Number(item.total_distance).toFixed(1) + ' km' : '0.0 km'}
                  </Text>
                  {selectedRoute?.id === item.id && (
                     <View style={styles.selectedRouteActions}>
                       <Pressable
                         style={styles.centerRouteButton}
                         onPress={handleCenterRoute}
                       >
                         <Text style={styles.centerRouteButtonText}>🎯 居中路线</Text>
                       </Pressable>
                       {isDownloaded && (
                         <Pressable
                           style={styles.offlineToggle}
                           onPress={() => setOfflineMapMode(!offlineMapMode)}
                         >
                           <Text style={styles.offlineToggleText}>
                             {offlineMapMode ? '✅ 离线地图' : '🔄 离线地图'}
                           </Text>
                         </Pressable>
                       )}
                       <Pressable
                         style={[styles.trackingToggle, isTracking && styles.trackingToggleActive]}
                         onPress={() => setIsTracking(!isTracking)}
                       >
                         <Text style={[styles.trackingToggleText, isTracking && styles.trackingToggleTextActive]}>
                           {isTracking ? '⏹️ 结束' : '🚀 开始循迹'}
                         </Text>
                       </Pressable>
                     </View>
                  )}
                </View>

                {item.tile_status === 'completed' && (
                  <View style={styles.downloadSection}>
                    {isDownloaded ? (
                      <Pressable
                        style={[styles.downloadButton, styles.deleteButton]}
                        onPress={() => handleDelete(item.id)}
                      >
                        <Text style={styles.downloadButtonText}>删除</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={[styles.downloadButton, isDownloading && styles.downloadingButton]}
                        onPress={() => handleDownload(item.id)}
                        disabled={isDownloading}
                      >
                        <Text style={styles.downloadButtonText}>
                          {isDownloading ? `${(progress * 100).toFixed(0)}%` : '下载'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>未找到路线。</Text>}
          style={isTracking ? { display: 'none' } : {}}
        />
      </View>

      {/* 设置 Modal */}
      <Modal visible={settingsVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>设置</Text>
            <Text style={styles.inputLabel}>服务器地址</Text>
            <TextInput
              style={styles.input}
              value={serverUrlInput}
              onChangeText={setServerUrlInput}
              autoCapitalize="none"
              keyboardType="url"
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [styles.modalButton, styles.cancelButton, pressed && { opacity: 0.7 }]}
                onPress={() => setSettingsVisible(false)}
              >
                <Text style={styles.buttonText}>取消</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalButton, pressed && { opacity: 0.7 }]}
                onPress={saveSettings}
              >
                <Text style={styles.buttonText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 2,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  settingsButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
  },
  settingsButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  drawer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -2 },
    elevation: 5,
  },
  drawerCollapsed: {
    flex: 0,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  syncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncStatus: {
    marginRight: 10,
    fontSize: 12,
    color: '#666',
  },
  syncButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  routeItem: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeInfo: {
    flex: 1,
  },
  downloadSection: {
    marginLeft: 10,
    justifyContent: 'center',
  },
  downloadButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  downloadingButton: {
    backgroundColor: '#FF9500',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  downloadButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  offlineToggle: {
    marginTop: 8,
    padding: 6,
    backgroundColor: '#e6f2ff',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  offlineToggleText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  trackingToggle: {
    marginTop: 8,
    padding: 6,
    backgroundColor: '#34C759',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  trackingToggleActive: {
    backgroundColor: '#FF3B30',
  },
  trackingToggleText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  trackingToggleTextActive: {
    color: '#fff',
  },
  resumeFollowButton: {
    position: 'absolute',
    bottom: 80,
    right: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  resumeFollowButtonText: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  selectedRouteItem: {
    borderColor: '#007AFF',
    backgroundColor: '#e6f2ff',
  },
  routeName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  routeDetails: {
    fontSize: 14,
    color: '#555',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#888',
  },
  selectedRouteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  centerRouteButton: {
    padding: 6,
    backgroundColor: '#e6f2ff',
    borderRadius: 4,
  },
  centerRouteButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#888',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
