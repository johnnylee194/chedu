import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocation } from '../context/LocationContext';
import { calculateRouteMetrics } from '../utils/geoMath';
import { RouteDetail } from '../services/syncService';

interface LocationHUDProps {
  selectedRoute?: RouteDetail | null;
}

export default function LocationHUD({ selectedRoute }: LocationHUDProps) {
  const { coords } = useLocation();

  const metrics = useMemo(() => {
    if (!selectedRoute?.geojson || !coords) return null;
    return calculateRouteMetrics([coords.longitude, coords.latitude], selectedRoute.geojson);
  }, [selectedRoute, coords]);

  const speedStr = coords?.speed !== null && coords?.speed !== undefined ? `${(coords.speed * 3.6).toFixed(1)} km/h` : '--';
  const altStr = coords?.altitude !== null && coords?.altitude !== undefined ? `${coords.altitude.toFixed(0)}m` : '--';

  if (selectedRoute) {
    const deviation = metrics ? Math.round(metrics.distance) : 0;
    const isOffRoute = deviation >= 60;
    const deviationText = isOffRoute ? `🔴 偏航报警 | 偏离: ${deviation}m` : `🟢 在轨 | 偏离: ${deviation}m`;

    return (
      <View style={[styles.hudContainer, isOffRoute && styles.hudContainerAlert]}>
        <View style={styles.row}>
          <Text style={[styles.hudText, styles.hudTextLarge]}>{deviationText}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.hudText}>Spd: {speedStr}</Text>
          <Text style={styles.hudText}>Alt: {altStr}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.hudContainer}>
       <Text style={styles.hudText}>
          Loc: {coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : '--'}
       </Text>
       <Text style={styles.hudText}>
          Alt: {altStr}
       </Text>
       <Text style={styles.hudText}>
          Spd: {speedStr}
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
  hudContainerAlert: {
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  hudText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginRight: 8,
  },
  hudTextLarge: {
    fontSize: 16,
  },
});
