import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Modal, FlatList, SafeAreaView } from 'react-native';
import MapboxGL from '@maplibre/maplibre-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { RouteParserService } from './src/services/RouteParserService';
import { RouteStorageService, RouteIndexEntry } from './src/services/RouteStorageService';
import { FeatureCollection, LineString } from 'geojson';
import bbox from '@turf/bbox';

MapboxGL.setAccessToken(null);

const App = () => {
  const [activeRoute, setActiveRoute] = useState<FeatureCollection<LineString> | null>(null);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<RouteIndexEntry[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);

  useEffect(() => {
    loadSavedRoutes();
  }, []);

  const loadSavedRoutes = async () => {
    const routes = await RouteStorageService.getIndex();
    setSavedRoutes(routes);
  };

  const handleImportRoute = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      if (!file.name.toLowerCase().endsWith('.gpx') && !file.name.toLowerCase().endsWith('.kml')) {
        Alert.alert('Error', 'Please select a valid .gpx or .kml file');
        return;
      }

      const content = await FileSystem.readAsStringAsync(file.uri);
      const featureCollection = RouteParserService.parseContent(content, file.name);

      if (featureCollection && featureCollection.features.length > 0) {
        const routeName = featureCollection.features[0]?.properties?.name || file.name;
        const savedEntry = await RouteStorageService.saveRoute(featureCollection, routeName);
        await loadSavedRoutes();
        await loadActiveRoute(savedEntry);
        Alert.alert('Success', 'Route imported successfully');
      } else {
        Alert.alert('Error', 'Could not parse the route file');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'An error occurred while importing the route');
    }
  };

  const loadActiveRoute = async (routeEntry: RouteIndexEntry) => {
    const routeData = await RouteStorageService.loadRoute(routeEntry.id);
    if (routeData) {
      setActiveRoute(routeData);
      setActiveRouteId(routeEntry.id);
      setModalVisible(false);

      if (routeEntry.bbox && cameraRef.current) {
        const [minLng, minLat, maxLng, maxLat] = routeEntry.bbox;
        cameraRef.current.fitBounds([maxLng, maxLat], [minLng, minLat], [50, 50, 50, 50], 1000);
      } else {
        try {
          const routeBbox = bbox(routeData as any);
          if (routeBbox && cameraRef.current) {
            const [minLng, minLat, maxLng, maxLat] = routeBbox;
            cameraRef.current.fitBounds([maxLng, maxLat], [minLng, minLat], [50, 50, 50, 50], 1000);
          }
        } catch (e) {
          console.warn('Failed to calculate bounds for fitting', e);
        }
      }
    } else {
      Alert.alert('Error', 'Failed to load route data');
    }
  };

  const deleteRoute = async (id: string) => {
    await RouteStorageService.deleteRoute(id);
    if (activeRouteId === id) {
      setActiveRoute(null);
      setActiveRouteId(null);
    }
    await loadSavedRoutes();
  };

  const renderRouteItem = ({ item }: { item: RouteIndexEntry }) => (
    <View style={styles.routeItem}>
      <TouchableOpacity style={styles.routeItemTextContainer} onPress={() => loadActiveRoute(item)}>
        <Text style={styles.routeItemText}>{item.name}</Text>
        <Text style={styles.routeItemDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteButton} onPress={() => deleteRoute(item.id)}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleJSON={JSON.stringify(require('./src/utils/esri-style.json'))}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [0, 0],
            zoomLevel: 2,
          }}
        />

        {activeRoute && (
          <MapboxGL.ShapeSource id="routeSource" shape={activeRoute}>
            <MapboxGL.LineLayer
              id="routeLayer"
              style={{
                lineColor: '#FF5722',
                lineWidth: 4,
                lineJoin: 'round',
                lineCap: 'round',
              }}
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity style={styles.button} onPress={handleImportRoute}>
          <Text style={styles.buttonText}>Import Route</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => setModalVisible(true)}>
          <Text style={styles.buttonText}>Saved Routes</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={isModalVisible} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Saved Routes</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
          </View>
          {savedRoutes.length === 0 ? (
            <Text style={styles.emptyText}>No saved routes found.</Text>
          ) : (
            <FlatList
              data={savedRoutes}
              keyExtractor={(item) => item.id}
              renderItem={renderRouteItem}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  buttonsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    flex: 0.48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666',
  },
  routeItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    alignItems: 'center',
  },
  routeItemTextContainer: {
    flex: 1,
  },
  routeItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  routeItemDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    padding: 8,
    borderRadius: 5,
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 14,
  },
});

export default App;
