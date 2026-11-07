import React, { Component, ErrorInfo, ReactNode, useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  SafeAreaView,
  BackHandler,
} from 'react-native';
import CommunityScreen from './src/screens/CommunityScreen';
import ToolboxScreen from './src/screens/ToolboxScreen';
import MapScreen from './src/screens/MapScreen';
import { LocationProvider } from './src/context/LocationContext';
import {
  RouteDetail,
  getCachedRoutes,
  syncRoutes,
  getServerUrl,
  saveServerUrl,
  getRedeemedRouteIds,
  redeemRouteByCode,
  removeRedeemedRoute,
  clearAllRedeemedRoutes,
} from './src/services/syncService';
import {
  isMBTilesDownloaded,
  downloadMBTiles,
  deleteMBTiles,
} from './src/services/offlinePackageManager';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.errorContainer}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <Text style={styles.errorTitle}>应用遇到异常</Text>
            <Text style={styles.errorMessage}>{this.state.error?.toString()}</Text>
            {this.state.error?.stack && (
              <Text style={styles.errorStack}>{this.state.error.stack}</Text>
            )}
            <Pressable
              style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.7 }]}
              onPress={this.handleRetry}
            >
              <Text style={styles.retryButtonText}>重试恢复</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

if (typeof (global as any).ErrorUtils !== 'undefined') {
  (global as any).ErrorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
    console.error('Uncaught error:', error, isFatal);
  });
}

type AppScreenStage = 'community' | 'toolbox' | 'radar';

function MainApp() {
  const [stage, setStage] = useState<AppScreenStage>('community');
  const [routes, setRoutes] = useState<RouteDetail[]>([]);
  const [redeemedIds, setRedeemedIds] = useState<number[]>([]);
  const [activeRadarRoute, setActiveRadarRoute] = useState<RouteDetail | null>(null);
  const [toolboxPrefillCode, setToolboxPrefillCode] = useState<string | undefined>(undefined);

  // Sync & Server states
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('初始化中...');
  const [serverUrl, setServerUrl] = useState('https://chedu.januslab.cn');

  // Offline MBTiles states
  const [downloadedRoutes, setDownloadedRoutes] = useState<Set<number>>(new Set());
  const [downloadingRoutes, setDownloadingRoutes] = useState<Record<number, number>>({});

  // Check local MBTiles files
  const refreshDownloadedStatus = useCallback(async (routeList: RouteDetail[]) => {
    const nextSet = new Set<number>();
    for (const r of routeList) {
      const exists = await isMBTilesDownloaded(r.id);
      if (exists) {
        nextSet.add(r.id);
      }
    }
    setDownloadedRoutes(nextSet);
  }, []);

  // Perform background sync of route catalog
  const handleSyncCatalog = useCallback(async () => {
    setSyncing(true);
    setSyncStatus('正在同步路书目录...');
    try {
      await syncRoutes();
      const updated = await getCachedRoutes();
      setRoutes(updated);
      await refreshDownloadedStatus(updated);
      setSyncStatus('云端路书目录已同步');
    } catch {
      const cached = await getCachedRoutes();
      setRoutes(cached);
      await refreshDownloadedStatus(cached);
      setSyncStatus('离线模式 · 使用本地路书缓存');
    } finally {
      setSyncing(false);
    }
  }, [refreshDownloadedStatus]);

  // Initial load
  useEffect(() => {
    const bootstrap = async () => {
      const [cached, savedRedeemed, savedUrl] = await Promise.all([
        getCachedRoutes(),
        getRedeemedRouteIds(),
        getServerUrl(),
      ]);
      setRoutes(cached);
      setRedeemedIds(savedRedeemed);
      setServerUrl(savedUrl);
      await refreshDownloadedStatus(cached);

      // Sync latest catalog in background
      handleSyncCatalog();
    };
    bootstrap();
  }, [handleSyncCatalog, refreshDownloadedStatus]);

  // Hardware back button navigation across the 3 layers
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stage === 'radar') {
        setStage('toolbox');
        return true;
      }
      if (stage === 'toolbox') {
        setStage('community');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stage]);

  // Download MBTiles package
  const handleDownloadMBTiles = useCallback(
    async (routeId: number) => {
      if (downloadingRoutes[routeId] !== undefined) return;
      setDownloadingRoutes((prev) => ({ ...prev, [routeId]: 0.01 }));
      const currentServerUrl = await getServerUrl();

      const ok = await downloadMBTiles(currentServerUrl, routeId, (progress) => {
        setDownloadingRoutes((prev) => ({ ...prev, [routeId]: progress }));
      });

      setDownloadingRoutes((prev) => {
        const next = { ...prev };
        delete next[routeId];
        return next;
      });

      if (ok) {
        setDownloadedRoutes((prev) => new Set(prev).add(routeId));
      }
    },
    [downloadingRoutes]
  );

  // Delete MBTiles package
  const handleDeleteMBTiles = useCallback(async (routeId: number) => {
    const ok = await deleteMBTiles(routeId);
    if (ok) {
      setDownloadedRoutes((prev) => {
        const next = new Set(prev);
        next.delete(routeId);
        return next;
      });
    }
  }, []);

  // Redeem CDK Code + Auto-trigger MBTiles download if available
  const handleRedeemCode = useCallback(
    async (code: string) => {
      const res = await redeemRouteByCode(code);
      if (res.success && res.route) {
        const latestIds = await getRedeemedRouteIds();
        const latestRoutes = await getCachedRoutes();
        setRedeemedIds(latestIds);
        setRoutes(latestRoutes);

        // Automatically start downloading offline satellite package if ready on server
        const r = res.route;
        const alreadyHasFile = await isMBTilesDownloaded(r.id);
        if (r.tile_status === 'completed' && !alreadyHasFile) {
          handleDownloadMBTiles(r.id);
        }
      }
      return res;
    },
    [handleDownloadMBTiles]
  );

  const handleRemoveRedeemed = useCallback(async (routeId: number) => {
    const nextIds = await removeRedeemedRoute(routeId);
    setRedeemedIds(nextIds);
  }, []);

  const handleClearAllRedeemed = useCallback(async () => {
    await clearAllRedeemedRoutes();
    setRedeemedIds([]);
  }, []);

  const handleSaveServerUrl = useCallback(
    async (newUrl: string) => {
      await saveServerUrl(newUrl);
      const updatedUrl = await getServerUrl();
      setServerUrl(updatedUrl);
      await handleSyncCatalog();
    },
    [handleSyncCatalog]
  );

  return (
    <View style={styles.container}>
      {stage === 'community' && (
        <CommunityScreen
          routes={routes}
          redeemedCount={redeemedIds.length}
          refreshing={syncing}
          onRefresh={handleSyncCatalog}
          onOpenToolbox={(prefillCode) => {
            setToolboxPrefillCode(prefillCode);
            setStage('toolbox');
          }}
        />
      )}

      {stage === 'toolbox' && (
        <ToolboxScreen
          allRoutes={routes}
          redeemedIds={redeemedIds}
          downloadedRoutes={downloadedRoutes}
          downloadingRoutes={downloadingRoutes}
          initialCode={toolboxPrefillCode}
          syncing={syncing}
          syncStatus={syncStatus}
          serverUrl={serverUrl}
          onBack={() => {
            setToolboxPrefillCode(undefined);
            setStage('community');
          }}
          onRedeemCode={handleRedeemCode}
          onRemoveRedeemed={handleRemoveRedeemed}
          onClearAllRedeemed={handleClearAllRedeemed}
          onDownloadMBTiles={handleDownloadMBTiles}
          onDeleteMBTiles={handleDeleteMBTiles}
          onOpenRadarMap={(route) => {
            setActiveRadarRoute(route);
            setStage('radar');
          }}
          onSaveServerUrl={handleSaveServerUrl}
          onManualSync={handleSyncCatalog}
        />
      )}

      {stage === 'radar' && activeRadarRoute && (
        <MapScreen
          route={activeRadarRoute}
          hasLocalMBTiles={downloadedRoutes.has(activeRadarRoute.id)}
          onBack={() => setStage('toolbox')}
        />
      )}

      <StatusBar style={stage === 'community' ? 'dark' : 'light'} />
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LocationProvider>
        <MainApp />
      </LocationProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  scrollContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#EF4444',
  },
  errorMessage: {
    fontSize: 15,
    color: '#F8FAFC',
    marginBottom: 10,
    textAlign: 'left',
    width: '100%',
  },
  errorStack: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 20,
    textAlign: 'left',
    width: '100%',
    fontFamily: 'monospace',
  },
  retryButton: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
