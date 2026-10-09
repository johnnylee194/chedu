import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Modal, TextInput, ActivityIndicator, SafeAreaView } from 'react-native';
import * as MapLibreGLNamespace from '@maplibre/maplibre-react-native';
import { syncRoutes, getCachedRoutes, RouteDetail, getServerUrl, saveServerUrl } from '../services/syncService';

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
        </MapView>

        <Pressable
          style={({ pressed }) => [styles.settingsButton, pressed && { opacity: 0.7 }]}
          onPress={() => setSettingsVisible(true)}
        >
          <Text style={styles.settingsButtonText}>⚙️ Settings</Text>
        </Pressable>
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
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.routeItem,
                selectedRoute?.id === item.id && styles.selectedRouteItem,
                pressed && { opacity: 0.7 }
              ]}
              onPress={() => handleRouteSelect(item)}
            >
              <Text style={styles.routeName}>{item.name}</Text>
              <Text style={styles.routeDetails}>
                {(item.distance / 1000).toFixed(2)} km • MBTiles: {item.mbtiles_ready ? 'Ready' : 'Pending'}
              </Text>
            </Pressable>
          )}
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
