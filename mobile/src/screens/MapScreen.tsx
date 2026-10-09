import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Modal, TextInput, ActivityIndicator, SafeAreaView } from 'react-native';
import * as MapLibreGLNamespace from '@maplibre/maplibre-react-native';
import { syncRoutes, getCachedRoutes, RouteDetail, getServerUrl, saveServerUrl } from '../services/syncService';
import { useLocationService } from '../services/locationService';
import { isMBTilesDownloaded, downloadMBTiles, deleteMBTiles, getMBTilesUri } from '../services/offlinePackageManager';

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

export default function MapScreen() {
  const [routes, setRoutes] = useState<RouteDetail[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState('');

  // Offline Map States
  const [offlineMapMode, setOfflineMapMode] = useState(false);
  const [downloadedRoutes, setDownloadedRoutes] = useState<Set<number>>(new Set());
  const [downloadingRoutes, setDownloadingRoutes] = useState<Record<number, number>>({}); // routeId -> progress (0-1)

  // Location States
  const locationService = useLocationService();
  const { coords, heading } = locationService;

  const cameraRef = useRef<any>(null);

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
        if (Number(route.mbtiles_ready) === 1) {
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
    setSyncStatus('Syncing...');
    try {
      const synced = await syncRoutes();
      setRoutes(synced);
      setSyncStatus('Synced successfully.');
      if (!selectedRoute && synced.length > 0) {
        handleRouteSelect(synced[0]);
      }
    } catch (e) {
      setSyncStatus('Offline or sync failed. Using cached routes.');
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
          style={styles.map}
          mapStyle={mapStyle}
          logoEnabled={false}
          attributionEnabled={false}
        >
          <Camera ref={cameraRef} zoomLevel={10} />

          <MapLibreGL.Images images={{ 'arrow-up': require('../../assets/icon.png') }} />

          {/* Offline MBTiles Raster Layer */}
          {offlineMapMode && selectedRoute && downloadedRoutes.has(selectedRoute.id) && (
            <MapLibreGL.RasterSource
              id="offline-mbtiles"
              tileUrlTemplates={[getMBTilesUri(selectedRoute.id)]}
              tileSize={256}
              minZoomLevel={11}
              maxZoomLevel={18}
            >
              <MapLibreGL.RasterLayer
                id="offline-mbtiles-layer"
                style={{ rasterOpacity: 1 }}
              />
            </MapLibreGL.RasterSource>
          )}

          {/* Route Polyline */}
          {selectedRoute?.geojson && (
            <ShapeSource id="routeSource" shape={selectedRoute.geojson}>
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

          {/* Real-time Vehicle Marker */}
          {coords && (
            <ShapeSource
              id="userLocationSource"
              shape={{
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: [coords.longitude, coords.latitude],
                    },
                    properties: {},
                  },
                ],
              }}
            >
              {/* Accuracy Circle */}
              {coords.accuracy && (
                <MapLibreGL.CircleLayer
                  id="userLocationAccuracyLayer"
                  style={{
                    circleRadius: coords.accuracy,
                    circleRadiusTransition: { duration: 0 },
                    circleColor: '#007AFF',
                    circleOpacity: 0.2,
                    circlePitchAlignment: 'map',
                  }}
                />
              )}
              {/* Blue Dot */}
              <MapLibreGL.CircleLayer
                id="userLocationDotLayer"
                style={{
                  circleRadius: 8,
                  circleColor: '#007AFF',
                  circleStrokeColor: '#FFFFFF',
                  circleStrokeWidth: 3,
                  circlePitchAlignment: 'map',
                }}
              />
              {/* Heading Indicator (Cone/Arrow) */}
              {heading !== null && (
                 <MapLibreGL.SymbolLayer
                   id="userLocationHeadingLayer"
                   style={{
                     iconImage: 'arrow-up', // Assuming default icon or can use a custom loaded image
                     iconSize: 0.5,
                     iconRotate: heading,
                     iconRotationAlignment: 'map',
                     iconPitchAlignment: 'map',
                     iconOffset: [0, -15],
                     iconAllowOverlap: true,
                     iconIgnorePlacement: true,
                   }}
                 />
              )}
            </ShapeSource>
          )}
        </MapView>

        <Pressable
          style={({ pressed }) => [styles.settingsButton, pressed && { opacity: 0.7 }]}
          onPress={() => setSettingsVisible(true)}
        >
          <Text style={styles.settingsButtonText}>⚙️ Settings</Text>
        </Pressable>

        {/* Quick Controls */}
        <View style={styles.quickControls}>
          <Pressable
             style={({ pressed }) => [styles.controlButton, pressed && { opacity: 0.7 }]}
             onPress={() => {
               if (coords && cameraRef.current) {
                 cameraRef.current.setCamera({
                   centerCoordinate: [coords.longitude, coords.latitude],
                   zoomLevel: 14,
                   animationDuration: 1000,
                 });
               }
             }}
          >
            <Text style={styles.controlButtonText}>🎯 Center</Text>
          </Pressable>
          <Pressable
             style={({ pressed }) => [styles.controlButton, pressed && { opacity: 0.7 }]}
             onPress={() => {
               if (selectedRoute && selectedRoute.bbox && cameraRef.current) {
                 const [minLng, minLat, maxLng, maxLat] = selectedRoute.bbox;
                 cameraRef.current.fitBounds([maxLng, maxLat], [minLng, minLat], 50, 1000);
               }
             }}
          >
            <Text style={styles.controlButtonText}>🗺 Fit</Text>
          </Pressable>
        </View>

        {/* Off-Road Driving HUD */}
        <View style={styles.hudContainer}>
           <Text style={styles.hudText}>
              Loc: {coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : '--'}
           </Text>
           <Text style={styles.hudText}>
              Alt: {coords?.altitude !== null && coords?.altitude !== undefined ? `${coords.altitude.toFixed(0)}m` : '--'}
           </Text>
           <Text style={styles.hudText}>
              Spd: {coords?.speed !== null && coords?.speed !== undefined ? `${(coords.speed * 3.6).toFixed(1)} km/h` : '--'}
           </Text>
           <Text style={styles.hudText}>
              Acc: {coords?.accuracy !== null && coords?.accuracy !== undefined ? `±${coords.accuracy.toFixed(0)}m` : '--'}
           </Text>
        </View>
      </View>

      {/* Bottom Drawer UI */}
      <View style={styles.drawer}>
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Routes</Text>
          <View style={styles.syncContainer}>
            <Text style={styles.syncStatus}>{syncStatus}</Text>
            <Pressable
              style={({ pressed }) => [styles.syncButton, pressed && { opacity: 0.7 }]}
              onPress={handleSync}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.syncButtonText}>Sync</Text>}
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
                  <Text style={styles.routeName}>{item.name || 'Unnamed Route'}</Text>
                  <Text style={styles.routeDetails}>
                    {item.distance_km !== undefined && item.distance_km !== null ? Number(item.distance_km).toFixed(1) + ' km' : (item.distance !== undefined && item.distance !== null ? (item.distance / 1000).toFixed(2) + ' km' : '0.0 km')}
                  </Text>
                  {selectedRoute?.id === item.id && isDownloaded && (
                     <Pressable
                       style={styles.offlineToggle}
                       onPress={() => setOfflineMapMode(!offlineMapMode)}
                     >
                       <Text style={styles.offlineToggleText}>
                         {offlineMapMode ? '✅ Offline Map Active' : '🔄 Switch to Offline Map'}
                       </Text>
                     </Pressable>
                  )}
                </View>

                {Number(item.mbtiles_ready) === 1 && (
                  <View style={styles.downloadSection}>
                    {isDownloaded ? (
                      <Pressable
                        style={[styles.downloadButton, styles.deleteButton]}
                        onPress={() => handleDelete(item.id)}
                      >
                        <Text style={styles.downloadButtonText}>Delete</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={[styles.downloadButton, isDownloading && styles.downloadingButton]}
                        onPress={() => handleDownload(item.id)}
                        disabled={isDownloading}
                      >
                        <Text style={styles.downloadButtonText}>
                          {isDownloading ? `${(progress * 100).toFixed(0)}%` : 'Download'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>No routes found.</Text>}
        />
      </View>

      {/* Settings Modal */}
      <Modal visible={settingsVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Settings</Text>
            <Text style={styles.inputLabel}>Server URL</Text>
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
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalButton, pressed && { opacity: 0.7 }]}
                onPress={saveSettings}
              >
                <Text style={styles.buttonText}>Save</Text>
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
  quickControls: {
    position: 'absolute',
    right: 10,
    top: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
  },
  controlButton: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  controlButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  hudContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  hudText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginRight: 8,
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
