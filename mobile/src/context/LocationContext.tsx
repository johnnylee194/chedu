import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as Location from 'expo-location';

export interface LocationState {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
  } | null;
  error: string | null;
}

// Extract the types
export interface LocationContextState extends LocationState {
  heading: number | null;
}

const LocationContext = createContext<LocationContextState | undefined>(undefined);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [locationState, setLocationState] = useState<LocationState>({ coords: null, error: null });
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let headingSubscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      try {
        console.log('[LocationContext] Requesting permissions...');
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log('[LocationContext] Permission status:', status);
        
        if (status !== 'granted') {
          setLocationState({ coords: null, error: 'Permission to access location was denied' });
          return;
        }

        // --- 诊断日志 1：检查手机硬件定位开关是否真的打开了 ---
        const providerStatus = await Location.getProviderStatusAsync();
        console.log('[LocationContext] System Provider Status:', JSON.stringify(providerStatus));

        // --- 诊断日志 2：对照组，看单次低精度定位是否能成功 ---
        try {
          console.log('[LocationContext] Trying single getCurrentPositionAsync (Balanced)...');
          const singleLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          console.log('[LocationContext] Single fetch success. Lat:', singleLoc.coords.latitude, 'Lng:', singleLoc.coords.longitude);
        } catch (e) {
          console.error('[LocationContext] Single fetch failed:', e);
        }

        console.log('[LocationContext] Starting watchPositionAsync...');
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000,
            // --- 诊断日志 3：暂时注释掉 distanceInterval，看是不是被物理位移限制卡住了 ---
            // distanceInterval: 2, 
          },
          (location) => {
            console.log('[LocationContext] Coords received:', location.coords.latitude, location.coords.longitude, 'Acc:', location.coords.accuracy);
            setLocationState({
              coords: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                altitude: location.coords.altitude,
                accuracy: location.coords.accuracy,
                speed: location.coords.speed,
                heading: location.coords.heading,
              },
              error: null,
            });
          }
        );
        // --- 诊断日志 4：确认 API 没有默默挂起 ---
        console.log('[LocationContext] watchPositionAsync started successfully');

        headingSubscription = await Location.watchHeadingAsync((headingData) => {
          // 这里的日志由于频率太高可以暂时注释掉，避免干扰查看 GPS 坐标日志
          // console.log('[LocationContext] Heading received:', headingData.trueHeading);
          setHeading(headingData.trueHeading !== -1 ? headingData.trueHeading : headingData.magHeading);
        });
      } catch (e) {
        console.error('[LocationContext] Watch Error:', e);
        setLocationState({ coords: null, error: 'Error starting location tracking' });
      }
    };

    startLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (headingSubscription) {
        headingSubscription.remove();
      }
    };
  }, []);

  return (
    <LocationContext.Provider value={{ ...locationState, heading }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
