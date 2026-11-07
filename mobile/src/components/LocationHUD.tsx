import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocation } from '../context/LocationContext';
import { formatCompassHeading } from '../utils/geoMath';

export interface HUDCoordsOverride {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
}

interface LocationHUDProps {
  isTracking: boolean;
  deviation: number | null;
  remainingDistanceKm: number | null;
  progressPercent: number | null;
  totalDistanceKm: number;
  totalAscentM: number;
  waypointCount: number;
  satelliteLit: boolean;
  hasLocalMBTiles: boolean;
  onToggleTracking: () => void;
  overrideCoords?: HUDCoordsOverride | null;
  overrideHeading?: number | null;
  isSimulating?: boolean;
  simOffRoute?: boolean;
  onToggleSimulating?: () => void;
  onToggleSimOffRoute?: () => void;
}

export default function LocationHUD({
  isTracking,
  deviation,
  remainingDistanceKm,
  progressPercent,
  totalDistanceKm,
  totalAscentM,
  waypointCount,
  satelliteLit,
  hasLocalMBTiles,
  onToggleTracking,
  overrideCoords,
  overrideHeading,
  isSimulating,
  simOffRoute,
  onToggleSimulating,
  onToggleSimOffRoute,
}: LocationHUDProps) {
  const loc = useLocation();
  const coords = overrideCoords ?? loc.coords;
  const heading = overrideHeading !== undefined ? overrideHeading : loc.heading;

  const speedVal =
    coords?.speed !== null && coords?.speed !== undefined && coords.speed >= 0
      ? (coords.speed * 3.6).toFixed(1)
      : '0.0';
  const altVal =
    coords?.altitude !== null && coords?.altitude !== undefined
      ? `${Math.round(coords.altitude)}`
      : '--';
  const accVal =
    coords?.accuracy !== null && coords?.accuracy !== undefined
      ? `±${Math.round(coords.accuracy)}m`
      : '搜索中';

  const effectiveHeading =
    heading !== null && heading !== undefined ? heading : coords?.heading ?? null;
  const compass = formatCompassHeading(effectiveHeading);

  const isOffRoute = isTracking && deviation !== null && deviation >= 60;

  // ============================================================================
  // STANDBY / ROUTE PREVIEW COCKPIT
  // ============================================================================
  if (!isTracking) {
    return (
      <View style={styles.cockpitContainer}>
        {/* Top Status Strip */}
        <View style={styles.standbyStatusRow}>
          <View style={styles.standbyStatusLeft}>
            <View
              style={[
                styles.modeDot,
                { backgroundColor: satelliteLit ? '#10B981' : '#38BDF8' },
              ]}
            />
            <Text style={styles.standbyModeText}>
              {satelliteLit
                ? '局部高清卫星包已点亮'
                : hasLocalMBTiles
                ? '纯离线雷达网格（可切换卫星）'
                : '纯离线战术雷达网格模式'}
            </Text>
          </View>
          <Text style={styles.gpsBadgeText}>GPS 精度 {accVal}</Text>
        </View>

        {/* Route Summary Telemetry */}
        <View style={styles.previewStatsRow}>
          <View style={styles.previewStatItem}>
            <Text style={styles.previewStatLabel}>总里程</Text>
            <Text style={styles.previewStatValue}>
              {totalDistanceKm.toFixed(1)} <Text style={styles.previewStatUnit}>km</Text>
            </Text>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewStatItem}>
            <Text style={styles.previewStatLabel}>累计爬升</Text>
            <Text style={styles.previewStatValue}>
              {totalAscentM} <Text style={styles.previewStatUnit}>m</Text>
            </Text>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewStatItem}>
            <Text style={styles.previewStatLabel}>战术航点</Text>
            <Text style={styles.previewStatValue}>
              {waypointCount} <Text style={styles.previewStatUnit}>处</Text>
            </Text>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewStatItem}>
            <Text style={styles.previewStatLabel}>当前海拔</Text>
            <Text style={styles.previewStatValue}>
              {altVal} <Text style={styles.previewStatUnit}>m</Text>
            </Text>
          </View>
        </View>

        {/* Launch Tracking Button */}
        <Pressable
          style={({ pressed }) => [
            styles.startTrackingBtn,
            pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
          ]}
          onPress={onToggleTracking}
        >
          <Text style={styles.startTrackingBtnText}>开启战术循迹导航</Text>
        </Pressable>
      </View>
    );
  }

  // ============================================================================
  // ACTIVE DRIVING COCKPIT HUD
  // ============================================================================
  const remKm =
    remainingDistanceKm !== null ? remainingDistanceKm.toFixed(1) : totalDistanceKm.toFixed(1);

  return (
    <View style={[styles.cockpitContainer, isOffRoute && styles.cockpitAlertBorder]}>
      {/* Tracking Deviation Alert / Status Banner */}
      <View
        style={[
          styles.trackingBanner,
          !coords
            ? styles.bannerWaiting
            : isOffRoute
            ? styles.bannerOffRoute
            : styles.bannerOnRoute,
        ]}
      >
        {!coords ? (
          <Text style={styles.bannerText}>正在锁定荒野 GPS 卫星信号...</Text>
        ) : isOffRoute ? (
          <Text style={styles.bannerText}>
            ▲ 偏航警报 · 偏离轨迹 {deviation}m（请沿黄线回归）
          </Text>
        ) : (
          <View style={styles.bannerRowBetween}>
            <Text style={styles.bannerText}>
              ● 在轨巡航 · 轨迹偏差 {deviation ?? 0}m
            </Text>
            <Text style={styles.bannerProgressText}>
              行程进度 {Math.round(progressPercent ?? 0)}%
            </Text>
          </View>
        )}
      </View>

      {/* 4-Column Digital Gauges */}
      <View style={styles.gaugesGrid}>
        <View style={styles.gaugeBox}>
          <Text style={styles.gaugeLabel}>SPD 车速</Text>
          <Text style={styles.gaugeBigNumber}>{speedVal}</Text>
          <Text style={styles.gaugeUnit}>km/h</Text>
        </View>

        <View style={styles.gaugeDivider} />

        <View style={styles.gaugeBox}>
          <Text style={styles.gaugeLabel}>ALT 海拔</Text>
          <Text style={styles.gaugeBigNumber}>{altVal}</Text>
          <Text style={styles.gaugeUnit}>米 (m)</Text>
        </View>

        <View style={styles.gaugeDivider} />

        <View style={styles.gaugeBox}>
          <Text style={styles.gaugeLabel}>HDG 航向</Text>
          <Text style={[styles.gaugeBigNumber, { fontSize: 20 }]}>{compass.degreeText}</Text>
          <Text style={styles.gaugeUnit}>{compass.cardinal}</Text>
        </View>

        <View style={styles.gaugeDivider} />

        <View style={styles.gaugeBox}>
          <Text style={styles.gaugeLabel}>REM 剩余</Text>
          <Text style={styles.gaugeBigNumber}>{remKm}</Text>
          <Text style={styles.gaugeUnit}>km</Text>
        </View>
      </View>

      {/* Bottom Telemetry Bar + Demo Sim Controls + Stop Button */}
      <View style={styles.cockpitBottomBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.coordMonospace}>
            {coords
              ? `${coords.latitude.toFixed(5)}°N  ${coords.longitude.toFixed(5)}°E`
              : '等待定位坐标...'}
          </Text>
          <Text style={styles.accSubText}>
            {isSimulating ? '演播室模拟巡航信号 (±3m)' : `卫星定位精度 ${accVal}`}
          </Text>
        </View>

        {onToggleSimulating && (
          <Pressable
            style={[
              styles.simBtn,
              isSimulating && styles.simBtnActive,
            ]}
            onPress={onToggleSimulating}
          >
            <Text style={styles.simBtnText}>
              {isSimulating ? '模拟中' : '模拟巡航'}
            </Text>
          </Pressable>
        )}

        {isSimulating && onToggleSimOffRoute && (
          <Pressable
            style={[
              styles.simBtn,
              simOffRoute ? styles.simOffRouteActive : styles.simOffRouteIdle,
            ]}
            onPress={onToggleSimOffRoute}
          >
            <Text style={styles.simBtnText}>
              {simOffRoute ? '恢复在轨' : '模拟偏航'}
            </Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.stopTrackingBtn, pressed && { opacity: 0.8 }]}
          onPress={onToggleTracking}
        >
          <Text style={styles.stopTrackingBtnText}>结束循迹</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cockpitContainer: {
    position: 'absolute',
    bottom: 14,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(11, 15, 23, 0.94)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#263347',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 8,
  },
  cockpitAlertBorder: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  standbyStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  standbyStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  standbyModeText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  gpsBadgeText: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  previewStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  previewStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  previewDivider: {
    width: 1,
    backgroundColor: '#1E293B',
    marginVertical: 2,
  },
  previewStatLabel: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 3,
  },
  previewStatValue: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  previewStatUnit: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  startTrackingBtn: {
    backgroundColor: '#FF5722',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  startTrackingBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Active Tracking Styles
  trackingBanner: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  bannerWaiting: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  bannerOnRoute: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  bannerOffRoute: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
  },
  bannerRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  bannerProgressText: {
    color: '#6EE7B7',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  gaugesGrid: {
    flexDirection: 'row',
    backgroundColor: '#070A10',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12,
  },
  gaugeBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeDivider: {
    width: 1,
    backgroundColor: '#1E293B',
    marginVertical: 4,
  },
  gaugeLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  gaugeBigNumber: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  gaugeUnit: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  cockpitBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coordMonospace: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  accSubText: {
    color: '#475569',
    fontSize: 10,
    marginTop: 1,
  },
  stopTrackingBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  stopTrackingBtnText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
  },
  simBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 6,
  },
  simBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  simOffRouteIdle: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: '#F59E0B',
  },
  simOffRouteActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
    borderColor: '#EF4444',
  },
  simBtnText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
});
