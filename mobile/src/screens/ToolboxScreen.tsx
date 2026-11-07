import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import {
  RouteDetail,
  getCopiedRedeemCode,
  setCopiedRedeemCode,
} from '../services/syncService';
import { extractRouteMeta } from '../utils/geoMath';

interface ToolboxScreenProps {
  allRoutes: RouteDetail[];
  redeemedIds: number[];
  downloadedRoutes: Set<number>;
  downloadingRoutes: Record<number, number>;
  initialCode?: string;
  syncing: boolean;
  syncStatus: string;
  serverUrl: string;
  onBack: () => void;
  onRedeemCode: (code: string) => Promise<{
    success: boolean;
    message: string;
    route?: RouteDetail;
  }>;
  onRemoveRedeemed: (routeId: number) => void;
  onClearAllRedeemed: () => void;
  onDownloadMBTiles: (routeId: number) => void;
  onDeleteMBTiles: (routeId: number) => void;
  onOpenRadarMap: (route: RouteDetail) => void;
  onSaveServerUrl: (url: string) => Promise<void>;
  onManualSync: () => Promise<void>;
}

export default function ToolboxScreen({
  allRoutes,
  redeemedIds,
  downloadedRoutes,
  downloadingRoutes,
  initialCode,
  syncing,
  syncStatus,
  serverUrl,
  onBack,
  onRedeemCode,
  onRemoveRedeemed,
  onClearAllRedeemed,
  onDownloadMBTiles,
  onDeleteMBTiles,
  onOpenRadarMap,
  onSaveServerUrl,
  onManualSync,
}: ToolboxScreenProps) {
  const [codeInput, setCodeInput] = useState(initialCode || '');
  const [clipboardCode, setClipboardCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  // Settings Modal state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [serverInput, setServerInput] = useState(serverUrl);

  useEffect(() => {
    setServerInput(serverUrl);
  }, [serverUrl]);

  useEffect(() => {
    const copied = getCopiedRedeemCode();
    if (copied) {
      setClipboardCode(copied);
      if (!codeInput) {
        setCodeInput(copied);
      }
    }
  }, [initialCode]);

  const redeemedRoutes = allRoutes.filter((r) => redeemedIds.includes(r.id));

  const executeRedeem = async (targetCode: string) => {
    if (redeeming) return;
    setRedeeming(true);
    setFeedback(null);
    try {
      const res = await onRedeemCode(targetCode);
      setFeedback({
        type: res.success ? 'ok' : 'err',
        text: res.message,
      });
      if (res.success) {
        setCodeInput('');
        setClipboardCode(null);
        setCopiedRedeemCode(null);
      }
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Tactical Top Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.75 }]}
          onPress={onBack}
        >
          <Text style={styles.backBtnText}>← 路书社区</Text>
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>离线轨迹工具箱</Text>
          <Text style={styles.headerSubtitle}>OFFLINE TRACK & MBTILES VAULT</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.75 }]}
          onPress={() => setSettingsOpen(true)}
        >
          <Text style={styles.settingsBtnText}>节点设置</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ================================================================
            MODULE 1: CDK REDEMPTION POD
           ================================================================ */}
        <View style={styles.redeemPod}>
          <View style={styles.podHeaderRow}>
            <View style={styles.podIndicatorDot} />
            <Text style={styles.podHeaderTitle}>路线激活码核销舱 (CDK)</Text>
          </View>
          <Text style={styles.podDesc}>
            输入路书文末附带的专属口令，提取离线轨迹数据并自动下载配套高清卫星瓦片包
          </Text>

          {/* Auto-detected copied code banner */}
          {clipboardCode && (
            <Pressable
              style={styles.clipboardBanner}
              onPress={() => executeRedeem(clipboardCode)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.clipboardBannerLabel}>检测到刚复制的路书口令</Text>
                <Text style={styles.clipboardBannerCode}>{clipboardCode}</Text>
              </View>
              <View style={styles.clipboardBannerAction}>
                <Text style={styles.clipboardBannerActionText}>一键提取 →</Text>
              </View>
            </Pressable>
          )}

          {/* Input + Button Row */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.codeInput}
              value={codeInput}
              onChangeText={(t) => setCodeInput(t.toUpperCase())}
              placeholder="输入口令 如 CHEDU-0001"
              placeholderTextColor="#475569"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Pressable
              style={({ pressed }) => [
                styles.redeemActionBtn,
                pressed && { opacity: 0.85 },
                redeeming && { opacity: 0.6 },
              ]}
              onPress={() => executeRedeem(codeInput)}
              disabled={redeeming}
            >
              {redeeming ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.redeemActionBtnText}>核销提取</Text>
              )}
            </Pressable>
          </View>

          {/* Quick-fill chips for available routes */}
          {allRoutes.length > 0 && (
            <View style={styles.quickCodesRow}>
              <Text style={styles.quickCodesLabel}>可用口令速填：</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {allRoutes.map((r) => {
                  const isUnlocked = redeemedIds.includes(r.id);
                  return (
                    <Pressable
                      key={r.id}
                      style={[
                        styles.quickCodeChip,
                        isUnlocked && styles.quickCodeChipUnlocked,
                      ]}
                      onPress={() => {
                        setCodeInput(r.redeem_code);
                        executeRedeem(r.redeem_code);
                      }}
                    >
                      <Text
                        style={[
                          styles.quickCodeChipText,
                          isUnlocked && styles.quickCodeChipTextUnlocked,
                        ]}
                      >
                        {r.redeem_code} ({r.title.slice(0, 6)})
                        {isUnlocked ? ' ✓' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {feedback && (
            <View
              style={[
                styles.feedbackBanner,
                feedback.type === 'ok' ? styles.feedbackOk : styles.feedbackErr,
              ]}
            >
              <Text
                style={[
                  styles.feedbackText,
                  feedback.type === 'ok' ? styles.feedbackTextOk : styles.feedbackTextErr,
                ]}
              >
                {feedback.type === 'ok' ? '● ' : '▲ '}
                {feedback.text}
              </Text>
            </View>
          )}
        </View>

        {/* ================================================================
            MODULE 2: UNLOCKED LOCAL ROUTES VAULT
           ================================================================ */}
        <View style={styles.vaultSectionHeader}>
          <View>
            <Text style={styles.vaultSectionTitle}>
              已解锁本地路线库 ({redeemedRoutes.length})
            </Text>
            <Text style={styles.vaultSectionSub}>
              点击任意已解锁路线进入「战术轨迹雷达」进行荒野循迹
            </Text>
          </View>
        </View>

        {redeemedRoutes.length === 0 ? (
          <View style={styles.emptyVaultCard}>
            <View style={styles.emptyRadarCircle}>
              <View style={styles.emptyRadarCrossH} />
              <View style={styles.emptyRadarCrossV} />
              <View style={styles.emptyRadarInnerRing} />
            </View>
            <Text style={styles.emptyVaultTitle}>本地路线仓暂无轨迹</Text>
            <Text style={styles.emptyVaultSub}>
              请从「路书社区」文末复制兑换口令，或点击上方「可用口令速填」提取离线路线包
            </Text>
          </View>
        ) : (
          redeemedRoutes.map((route) => {
            const isDownloaded = downloadedRoutes.has(route.id);
            const downloadProgress = downloadingRoutes[route.id];
            const isDownloading = downloadProgress !== undefined;
            const hasServerTiles = route.tile_status === 'completed';
            const meta = extractRouteMeta(route.geojson);
            const ascent = route.total_ascent || meta.computedAscent || 0;
            const sizeMB =
              route.file_size_mb && route.file_size_mb > 0
                ? `${Number(route.file_size_mb).toFixed(1)} MB`
                : '离线瓦片包';

            return (
              <View key={route.id} style={styles.routeCard}>
                {/* Card Top Header */}
                <View style={styles.routeCardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.routeCodeBadgeRow}>
                      <View style={styles.routeCodeBadge}>
                        <Text style={styles.routeCodeBadgeText}>#{route.redeem_code}</Text>
                      </View>
                      <Text style={styles.routeWaypointCountText}>
                        含 {meta.waypoints.length} 个战术航点
                      </Text>
                    </View>
                    <Text style={styles.routeCardTitle}>{route.title}</Text>
                  </View>

                  <Pressable
                    style={styles.removeRouteBtn}
                    onPress={() => onRemoveRedeemed(route.id)}
                  >
                    <Text style={styles.removeRouteBtnText}>移除</Text>
                  </Pressable>
                </View>

                {/* Telemetry Strip */}
                <View style={styles.routeTelemetryRow}>
                  <View style={styles.telemetryBox}>
                    <Text style={styles.telemetryLabel}>轨迹总长</Text>
                    <Text style={styles.telemetryVal}>
                      {Number(route.total_distance || 0).toFixed(1)}{' '}
                      <Text style={styles.telemetryUnit}>KM</Text>
                    </Text>
                  </View>
                  <View style={styles.telemetryBox}>
                    <Text style={styles.telemetryLabel}>累计爬升</Text>
                    <Text style={styles.telemetryVal}>
                      {ascent} <Text style={styles.telemetryUnit}>M</Text>
                    </Text>
                  </View>
                  <View style={styles.telemetryBox}>
                    <Text style={styles.telemetryLabel}>最高海拔</Text>
                    <Text style={styles.telemetryVal}>
                      {meta.maxElevation} <Text style={styles.telemetryUnit}>M</Text>
                    </Text>
                  </View>
                </View>

                {/* Offline Satellite Package Status Bar */}
                <View style={styles.mbtilesStatusBox}>
                  {isDownloading ? (
                    <View style={{ width: '100%' }}>
                      <View style={styles.progressHeaderRow}>
                        <Text style={styles.progressStatusText}>
                          正在下载卫星离线包 (.mbtiles)...
                        </Text>
                        <Text style={styles.progressPercentText}>
                          {Math.round(downloadProgress * 100)}%
                        </Text>
                      </View>
                      <View style={styles.progressBarTrack}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${Math.max(4, Math.round(downloadProgress * 100))}%` },
                          ]}
                        />
                      </View>
                    </View>
                  ) : isDownloaded ? (
                    <View style={styles.mbtilesRowInline}>
                      <View style={styles.mbtilesStatusLeft}>
                        <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                        <Text style={styles.mbtilesReadyText}>
                          高清卫星包已就绪 ({sizeMB}) · 进图自动点亮
                        </Text>
                      </View>
                      <Pressable
                        style={styles.deleteMbtilesBtn}
                        onPress={() => onDeleteMBTiles(route.id)}
                      >
                        <Text style={styles.deleteMbtilesBtnText}>清理瓦片</Text>
                      </Pressable>
                    </View>
                  ) : hasServerTiles ? (
                    <View style={styles.mbtilesRowInline}>
                      <View style={styles.mbtilesStatusLeft}>
                        <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
                        <Text style={styles.mbtilesPendingText}>
                          矢量轨迹已就绪 · 卫星离线包待下载 ({sizeMB})
                        </Text>
                      </View>
                      <Pressable
                        style={styles.downloadMbtilesBtn}
                        onPress={() => onDownloadMBTiles(route.id)}
                      >
                        <Text style={styles.downloadMbtilesBtnText}>下载卫星包</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.mbtilesRowInline}>
                      <View style={styles.mbtilesStatusLeft}>
                        <View style={[styles.statusDot, { backgroundColor: '#38BDF8' }]} />
                        <Text style={styles.mbtilesVectorOnlyText}>
                          纯离线矢量轨迹模式（支持深色雷达网格循迹）
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Primary Launch Radar CTA */}
                <Pressable
                  style={({ pressed }) => [
                    styles.launchRadarBtn,
                    pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                  ]}
                  onPress={() => onOpenRadarMap(route)}
                >
                  <View style={styles.launchRadarLeft}>
                    <View style={styles.radarPulseIcon} />
                    <Text style={styles.launchRadarBtnText}>
                      启动战术轨迹雷达 {isDownloaded ? '（卫星点亮）' : '（网格模式）'}
                    </Text>
                  </View>
                  <Text style={styles.launchRadarArrow}>→</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ================================================================
          SETTINGS & DEBUG MODAL
         ================================================================ */}
      <Modal visible={settingsOpen} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>离线节点与调试设置</Text>
            <Text style={styles.modalSubtitle}>
              配置路书与离线包分发服务器地址，或重置本地 CDK 核销状态
            </Text>

            <Text style={styles.fieldLabel}>服务器节点地址 (Server URL)</Text>
            <TextInput
              style={styles.serverInput}
              value={serverInput}
              onChangeText={setServerInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <View style={styles.syncDiagnosticRow}>
              <Text style={styles.syncStatusText}>
                当前状态：{syncStatus || '本地缓存就绪'} (共缓存 {allRoutes.length} 条)
              </Text>
              <Pressable
                style={styles.manualSyncBtn}
                onPress={onManualSync}
                disabled={syncing}
              >
                {syncing ? (
                  <ActivityIndicator color="#F8FAFC" size="small" />
                ) : (
                  <Text style={styles.manualSyncBtnText}>立即同步目录</Text>
                )}
              </Pressable>
            </View>

            <Pressable
              style={styles.resetDebugBtn}
              onPress={() => {
                onClearAllRedeemed();
                setFeedback({
                  type: 'ok',
                  text: '已清空本地兑换记录，可重新测试 CDK 口令提取流程',
                });
                setSettingsOpen(false);
              }}
            >
              <Text style={styles.resetDebugBtnText}>
                重置/清空已兑换路线列表 (用于测试兑换流程)
              </Text>
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setSettingsOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>关闭</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalSaveBtn]}
                onPress={async () => {
                  await onSaveServerUrl(serverInput);
                  setSettingsOpen(false);
                }}
              >
                <Text style={styles.modalSaveBtnText}>保存并刷新</Text>
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
    backgroundColor: '#0B0F17',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0B0F17',
  },
  backBtn: {
    backgroundColor: '#151E2E',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#293548',
  },
  backBtnText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#64748B',
    fontSize: 9,
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginTop: 1,
  },
  settingsBtn: {
    backgroundColor: '#151E2E',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#293548',
  },
  settingsBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  redeemPod: {
    backgroundColor: '#131B28',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#263347',
    marginBottom: 22,
  },
  podHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  podIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5722',
    marginRight: 8,
  },
  podHeaderTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  podDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  clipboardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  clipboardBannerLabel: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '600',
  },
  clipboardBannerCode: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  clipboardBannerAction: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  clipboardBannerActionText: {
    color: '#052E16',
    fontSize: 12,
    fontWeight: '800',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  codeInput: {
    flex: 1,
    backgroundColor: '#090D14',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  redeemActionBtn: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 96,
  },
  redeemActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  quickCodesRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickCodesLabel: {
    color: '#64748B',
    fontSize: 11,
    marginRight: 6,
  },
  quickCodeChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickCodeChipUnlocked: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  quickCodeChipText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  quickCodeChipTextUnlocked: {
    color: '#34D399',
  },
  feedbackBanner: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  feedbackOk: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  feedbackErr: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackTextOk: {
    color: '#34D399',
  },
  feedbackTextErr: {
    color: '#F87171',
  },
  vaultSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  vaultSectionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  vaultSectionSub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  emptyVaultCard: {
    backgroundColor: '#111823',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderStyle: 'dashed',
  },
  emptyRadarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    position: 'relative',
  },
  emptyRadarCrossH: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: '#1E293B',
  },
  emptyRadarCrossV: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    width: 1,
    backgroundColor: '#1E293B',
  },
  emptyRadarInnerRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#475569',
  },
  emptyVaultTitle: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyVaultSub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  routeCard: {
    backgroundColor: '#131B28',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#263347',
  },
  routeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  routeCodeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  routeCodeBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  routeCodeBadgeText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  routeWaypointCountText: {
    color: '#64748B',
    fontSize: 11,
  },
  routeCardTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  removeRouteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1E293B',
  },
  removeRouteBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  routeTelemetryRow: {
    flexDirection: 'row',
    backgroundColor: '#0B0F17',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  telemetryBox: {
    flex: 1,
  },
  telemetryLabel: {
    color: '#64748B',
    fontSize: 10,
    marginBottom: 2,
  },
  telemetryVal: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  telemetryUnit: {
    fontSize: 10,
    color: '#64748B',
  },
  mbtilesStatusBox: {
    backgroundColor: '#0E1520',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  mbtilesRowInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mbtilesStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  mbtilesReadyText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  mbtilesPendingText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '600',
  },
  mbtilesVectorOnlyText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  downloadMbtilesBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  downloadMbtilesBtnText: {
    color: '#052E16',
    fontSize: 11,
    fontWeight: '800',
  },
  deleteMbtilesBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  deleteMbtilesBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressStatusText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
  },
  progressPercentText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  launchRadarBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FF5722',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 10,
  },
  launchRadarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radarPulseIcon: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 10,
  },
  launchRadarBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  launchRadarArrow: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#131B28',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 18,
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  serverInput: {
    backgroundColor: '#090D14',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    fontFamily: 'monospace',
    marginBottom: 14,
  },
  syncDiagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0B0F17',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  syncStatusText: {
    color: '#94A3B8',
    fontSize: 11,
    flex: 1,
    marginRight: 8,
  },
  manualSyncBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  manualSyncBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  resetDebugBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 18,
  },
  resetDebugBtnText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalCancelBtn: {
    backgroundColor: '#1E293B',
  },
  modalCancelBtnText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  modalSaveBtn: {
    backgroundColor: '#FF5722',
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
