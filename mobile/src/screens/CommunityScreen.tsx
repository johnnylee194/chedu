import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  RefreshControl,
  Share,
  Image,
} from 'react-native';
import { RouteDetail, getServerUrl, setCopiedRedeemCode } from '../services/syncService';

const LOCAL_SEED_IMAGES: Record<string, any> = {
  '/uploads/abei_1_elevation.png': require('../../assets/abei_1_elevation.png'),
  '/uploads/abei_2_track.png': require('../../assets/abei_2_track.png'),
  '/uploads/abei_3_sunset.png': require('../../assets/abei_3_sunset.png'),
  '/uploads/zizhujun_1_track.png': require('../../assets/zizhujun_1_track.png'),
};

interface CommunityScreenProps {
  routes: RouteDetail[];
  redeemedCount: number;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenToolbox: (prefillCode?: string) => void;
}

export default function CommunityScreen({
  routes,
  redeemedCount,
  refreshing,
  onRefresh,
  onOpenToolbox,
}: CommunityScreenProps) {
  const [activeRoute, setActiveRoute] = useState<RouteDetail | null>(null);
  const [copiedBanner, setCopiedBanner] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string>('https://chedu.januslab.cn');

  useEffect(() => {
    getServerUrl().then(setServerUrl);
  }, []);

  const handleCopyCode = async (code: string, jumpToToolbox = false) => {
    setCopiedRedeemCode(code);
    setCopiedBanner(`已复制口令 ${code}`);
    setTimeout(() => {
      setCopiedBanner(null);
    }, 3000);

    if (jumpToToolbox) {
      setActiveRoute(null);
      onOpenToolbox(code);
    }
  };

  const handleSystemShareCode = async (route: RouteDetail) => {
    setCopiedRedeemCode(route.redeem_code);
    try {
      await Share.share({
        message: `【Chedu 越野路书】${route.title}\n配套离线轨迹提取口令：${route.redeem_code}`,
      });
    } catch {
      // ignore
    }
  };

  const getImageSource = (path: string) => {
    if (!path) return { uri: '' };
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (LOCAL_SEED_IMAGES[cleanPath]) {
      return LOCAL_SEED_IMAGES[cleanPath];
    }
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return { uri: path };
    }
    const cleanBase = serverUrl.replace(/\/+$/, '');
    return { uri: `${cleanBase}${cleanPath}` };
  };

  // ============================================================================
  // BBS POST DETAIL VIEW
  // ============================================================================
  if (activeRoute) {
    const images = activeRoute.images || [];
    const dateStr = (activeRoute.created_at || '2026-11').slice(0, 10);

    return (
      <SafeAreaView style={styles.detailSafeArea}>
        {/* Floating Reader Bar */}
        <View style={styles.readerHeader}>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
            onPress={() => setActiveRoute(null)}
          >
            <Text style={styles.backButtonText}>← 返回帖子列表</Text>
          </Pressable>
          <Text style={styles.readerHeaderTitle} numberOfLines={1}>
            路书帖子 · #{activeRoute.redeem_code}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.headerToolboxMini, pressed && { opacity: 0.8 }]}
            onPress={() => {
              setActiveRoute(null);
              onOpenToolbox();
            }}
          >
            <Text style={styles.headerToolboxMiniText}>工具箱 ({redeemedCount})</Text>
          </Pressable>
        </View>

        {copiedBanner && (
          <View style={styles.toastBanner}>
            <Text style={styles.toastBannerText}>✓ {copiedBanner}，可前往离线工具箱核销提取</Text>
          </View>
        )}

        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={styles.detailScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Post Header Card */}
          <View style={styles.postDetailHeader}>
            <Text style={styles.postDetailTitle}>{activeRoute.title}</Text>
            <View style={styles.postMetaRow}>
              <Text style={styles.postAuthorText}>车都勘路官</Text>
              <Text style={styles.postDateText}>发布于 {dateStr}</Text>
              <View style={styles.postBadge}>
                <Text style={styles.postBadgeText}>
                  {Number(activeRoute.total_distance || 0).toFixed(1)} km 穿越段
                </Text>
              </View>
            </View>

            {/* Quick Metrics Bar */}
            <View style={styles.quickMetricsStrip}>
              <View style={styles.metricItem}>
                <Text style={styles.metricItemLabel}>里程</Text>
                <Text style={styles.metricItemVal}>
                  {Number(activeRoute.total_distance || 0).toFixed(1)} km
                </Text>
              </View>
              <View style={styles.metricItemDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricItemLabel}>爬升</Text>
                <Text style={styles.metricItemVal}>
                  {Number(activeRoute.total_ascent || 0)} m
                </Text>
              </View>
              <View style={styles.metricItemDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricItemLabel}>配图</Text>
                <Text style={styles.metricItemVal}>{images.length} 张</Text>
              </View>
            </View>
          </View>

          {/* Post Body Text */}
          <View style={styles.postContentCard}>
            <Text style={styles.postContentHeader}>路书详述与路况说明</Text>
            <Text style={styles.postBodyText} selectable>
              {activeRoute.description && activeRoute.description.trim() !== ''
                ? activeRoute.description
                : '作者暂未填写详细文字描述。请查看下方路书图片与离线轨迹附件。'}
            </Text>
          </View>

          {/* Post Images Gallery (Vertical Stream) */}
          {images.length > 0 && (
            <View style={styles.imagesSection}>
              <Text style={styles.imagesSectionTitle}>路书附图与实拍 ({images.length})</Text>
              {images.map((img, idx) => (
                <View key={idx} style={styles.imageCard}>
                  <Image
                    source={getImageSource(img.image_url)}
                    style={styles.fullImage}
                    resizeMode="cover"
                  />
                  {!!img.caption && <Text style={styles.imageCaption}>{img.caption}</Text>}
                </View>
              ))}
            </View>
          )}

          {/* Bottom CDK Code Box Attachment */}
          <View style={styles.cdkAttachmentCard}>
            <View style={styles.cdkHeaderBadgeRow}>
              <Text style={styles.cdkAttachmentTag}>帖子附件 · 离线轨迹与卫星包提取</Text>
              <Pressable onPress={() => handleSystemShareCode(activeRoute)}>
                <Text style={styles.cdkShareLink}>分享口令</Text>
              </Pressable>
            </View>
            <Text style={styles.cdkAttachmentTitle}>
              获取「{activeRoute.title}」离线轨迹包
            </Text>
            <Text style={styles.cdkAttachmentDesc}>
              为保障无网络区安全导航，作者已为本帖生成专属兑换码。复制下方口令前往「离线工具箱」即可解锁离线轨迹及天地图卫星包：
            </Text>

            <View style={styles.cdkCodeBox}>
              <View>
                <Text style={styles.cdkCodeLabel}>专属提取口令 (CDK)</Text>
                <Text style={styles.cdkCodeValue} selectable>
                  {activeRoute.redeem_code}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.copyCodeBtn, pressed && { opacity: 0.8 }]}
                onPress={() => handleCopyCode(activeRoute.redeem_code, false)}
              >
                <Text style={styles.copyCodeBtnText}>复制口令</Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.jumpToolboxBtn, pressed && { opacity: 0.85 }]}
              onPress={() => handleCopyCode(activeRoute.redeem_code, true)}
            >
              <Text style={styles.jumpToolboxBtnText}>
                复制口令并前往「离线工具箱」提取 →
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // BBS FEED LIST VIEW
  // ============================================================================
  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.brandRow}>
            <Text style={styles.brandTitle}>CHEDU</Text>
            <View style={styles.brandDot} />
            <Text style={styles.brandSub}>越野路书志</Text>
          </View>
          <Text style={styles.brandCaption}>路书图文分享与离线轨迹口令中心</Text>
        </View>

        {/* Deep Entry to Offline Toolbox */}
        <Pressable
          style={({ pressed }) => [styles.toolboxEntryBtn, pressed && { opacity: 0.85 }]}
          onPress={() => onOpenToolbox()}
        >
          <View style={styles.toolboxRadarDot} />
          <Text style={styles.toolboxEntryText}>离线工具箱</Text>
          {redeemedCount > 0 && (
            <View style={styles.toolboxCountBadge}>
              <Text style={styles.toolboxCountText}>{redeemedCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Feed List */}
      <ScrollView
        style={styles.feedScroll}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D94E1F" />
        }
      >
        {/* Notice Banner */}
        <View style={styles.editorialNotice}>
          <Text style={styles.editorialNoticeTitle}>荒野无网穿越 · 纯离线轨迹阅读</Text>
          <Text style={styles.editorialNoticeSub}>
            点击查看路书图文攻略与实拍路况，在帖子末尾获取专属口令，前往「离线工具箱」核销下载
          </Text>
        </View>

        {routes.map((route) => {
          const images = route.images || [];
          const dateStr = (route.created_at || '2026-11').slice(0, 10);

          return (
            <Pressable
              key={route.id}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
              onPress={() => setActiveRoute(route)}
            >
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {route.title}
                  </Text>
                  <View style={styles.cardMetaRow}>
                    <Text style={styles.cardDate}>{dateStr}</Text>
                    <View style={styles.cardDistBadge}>
                      <Text style={styles.cardDistText}>
                        {Number(route.total_distance || 0).toFixed(1)} km
                      </Text>
                    </View>
                    {Number(route.total_ascent || 0) > 0 && (
                      <Text style={styles.cardAscent}>
                        爬升 {Number(route.total_ascent || 0)}m
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Text Description Snippet */}
              <Text style={styles.cardDesc} numberOfLines={2}>
                {route.description && route.description.trim() !== ''
                  ? route.description
                  : '作者上传了路书图文与离线轨迹附件，点击查看详情。'}
              </Text>

              {/* Images Preview Strip */}
              {images.length > 0 && (
                <View style={styles.thumbStrip}>
                  {images.slice(0, 3).map((img, i) => (
                    <Image
                      key={i}
                      source={getImageSource(img.image_url)}
                      style={styles.thumbImage}
                      resizeMode="cover"
                    />
                  ))}
                  {images.length > 3 && (
                    <View style={styles.thumbMoreBadge}>
                      <Text style={styles.thumbMoreText}>+{images.length - 3}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Card Footer: CDK Hint */}
              <View style={styles.cardFooter}>
                <Text style={styles.cardCodeLabel}>附件口令</Text>
                <Text style={styles.cardCodeValue}>#{route.redeem_code}</Text>
                <Text style={styles.cardArrow}>查看详情与口令 →</Text>
              </View>
            </Pressable>
          );
        })}

        {routes.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>暂无路书帖子</Text>
            <Text style={styles.emptySub}>下拉刷新同步，或在 Web 控制台上传并发布新路书</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F3EE',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F3EE',
    borderBottomWidth: 1,
    borderBottomColor: '#E6E2D8',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#18181B',
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D94E1F',
    marginHorizontal: 8,
  },
  brandSub: {
    fontSize: 15,
    fontWeight: '700',
    color: '#27272A',
  },
  brandCaption: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
  toolboxEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141923',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  toolboxRadarDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  toolboxEntryText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  toolboxCountBadge: {
    marginLeft: 6,
    backgroundColor: '#D94E1F',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  toolboxCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  feedScroll: {
    flex: 1,
  },
  feedContent: {
    padding: 16,
    paddingBottom: 40,
  },
  editorialNotice: {
    backgroundColor: '#EBE6DC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#D94E1F',
  },
  editorialNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#27272A',
    marginBottom: 2,
  },
  editorialNoticeSub: {
    fontSize: 11,
    color: '#52525B',
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E0D5',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 6,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#18181B',
    lineHeight: 22,
    marginBottom: 4,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardDate: {
    fontSize: 11,
    color: '#71717A',
  },
  cardDistBadge: {
    backgroundColor: '#FEF2EE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardDistText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D94E1F',
    fontFamily: 'monospace',
  },
  cardAscent: {
    fontSize: 11,
    color: '#71717A',
  },
  cardDesc: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
    marginBottom: 10,
  },
  thumbStrip: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  thumbImage: {
    flex: 1,
    height: 74,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  thumbMoreBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  thumbMoreText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cardCodeLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginRight: 4,
  },
  cardCodeValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D94E1F',
    fontFamily: 'monospace',
    flex: 1,
  },
  cardArrow: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  // Detail View Styles
  detailSafeArea: {
    flex: 1,
    backgroundColor: '#F5F3EE',
  },
  readerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F5F3EE',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E0D5',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#EAE6DD',
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#18181B',
  },
  readerHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#52525B',
    marginHorizontal: 8,
    fontFamily: 'monospace',
  },
  headerToolboxMini: {
    backgroundColor: '#141923',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  headerToolboxMiniText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  toastBanner: {
    backgroundColor: '#10B981',
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  toastBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  detailScroll: {
    flex: 1,
  },
  detailScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  postDetailHeader: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E0D5',
  },
  postDetailTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#18181B',
    lineHeight: 28,
    marginBottom: 8,
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  postAuthorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#27272A',
  },
  postDateText: {
    fontSize: 12,
    color: '#71717A',
  },
  postBadge: {
    backgroundColor: '#FEF2EE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  postBadgeText: {
    color: '#D94E1F',
    fontSize: 11,
    fontWeight: '700',
  },
  quickMetricsStrip: {
    flexDirection: 'row',
    backgroundColor: '#F8F6F1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricItemDivider: {
    width: 1,
    backgroundColor: '#E5E0D5',
  },
  metricItemLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  metricItemVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#18181B',
    fontFamily: 'monospace',
  },
  postContentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E0D5',
  },
  postContentHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#18181B',
    marginBottom: 10,
  },
  postBodyText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 24,
  },
  imagesSection: {
    marginBottom: 14,
  },
  imagesSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#18181B',
    marginBottom: 10,
  },
  imageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E0D5',
  },
  fullImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#E5E7EB',
  },
  imageCaption: {
    padding: 10,
    fontSize: 12,
    color: '#4B5563',
  },
  cdkAttachmentCard: {
    backgroundColor: '#141923',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  cdkHeaderBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cdkAttachmentTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
  },
  cdkShareLink: {
    fontSize: 12,
    color: '#94A3B8',
    textDecorationLine: 'underline',
  },
  cdkAttachmentTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  cdkAttachmentDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 14,
  },
  cdkCodeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0B0F17',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  cdkCodeLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 2,
  },
  cdkCodeValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F59E0B',
    fontFamily: 'monospace',
    letterSpacing: 1.5,
  },
  copyCodeBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  copyCodeBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  jumpToolboxBtn: {
    backgroundColor: '#D94E1F',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  jumpToolboxBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
