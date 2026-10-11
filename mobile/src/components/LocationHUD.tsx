import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocationService } from '../services/locationService';

export default function LocationHUD() {
  const { coords } = useLocationService();

  return (
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
  );
}

const styles = StyleSheet.create({
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
});
