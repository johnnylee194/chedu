import React, { Component, ErrorInfo, ReactNode, useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView, Pressable, SafeAreaView, ActivityIndicator } from 'react-native';
import MapScreen from './src/screens/MapScreen';
import LoginScreen from './src/screens/LoginScreen';
import { LocationProvider } from './src/context/LocationContext';
import { getToken, removeToken, setOnLogoutCallback } from './src/services/authService';

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
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.errorContainer}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <Text style={styles.errorTitle}>Something went wrong!</Text>
            <Text style={styles.errorMessage}>{this.state.error?.toString()}</Text>
            {this.state.error?.stack && (
              <Text style={styles.errorStack}>{this.state.error.stack}</Text>
            )}
            {this.state.errorInfo?.componentStack && (
              <Text style={styles.errorStack}>{this.state.errorInfo.componentStack}</Text>
            )}
            <Pressable
              style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.7 }]}
              onPress={this.handleRetry}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

// Global error handler for uncaught errors
if (typeof (global as any).ErrorUtils !== 'undefined') {
  (global as any).ErrorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
    console.error('Uncaught error:', error, isFatal);
  });
}

function MainApp() {
  return (
    <View style={styles.container}>
      <MapScreen />
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await getToken();
        if (token) {
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error('Auth check failed', e);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Subscribe to global 401 logouts
    setOnLogoutCallback(async () => {
      await removeToken();
      setIsAuthenticated(false);
    });
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />
      </ErrorBoundary>
    );
  }

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
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: 'red',
  },
  errorMessage: {
    fontSize: 16,
    color: 'black',
    marginBottom: 10,
    textAlign: 'left',
    width: '100%',
  },
  errorStack: {
    fontSize: 12,
    color: 'gray',
    marginBottom: 20,
    textAlign: 'left',
    width: '100%',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
