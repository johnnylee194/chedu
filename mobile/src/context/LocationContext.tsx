import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as Location from 'expo-location';
import Geolocation from 'react-native-geolocation-service';

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
    let watchId: number | null = null;
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

        console.log('[LocationContext] Starting Geolocation.watchPosition...');
        watchId = Geolocation.watchPosition(
          (position) => {
            console.log('[LocationContext] Coords received:', position.coords.latitude, position.coords.longitude, 'Acc:', position.coords.accuracy);
            setLocationState({
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                altitude: position.coords.altitude,
                accuracy: position.coords.accuracy,
                speed: position.coords.speed,
                heading: position.coords.heading,
              },
              error: null,
            });
          },
          (error) => {
            console.error('[LocationContext] Geolocation Error:', error);
            setLocationState({ coords: null, error: error.message });
          },
          {
            enableHighAccuracy: true,
            distanceFilter: 2,
            interval: 2000,
            fastestInterval: 1000,
            forceLocationManager: true
          }
        );
        console.log('[LocationContext] watchPosition started successfully with id', watchId);

        headingSubscription = await Location.watchHeadingAsync((headingData) => {
          setHeading(headingData.trueHeading !== -1 ? headingData.trueHeading : headingData.magHeading);
        });
      } catch (e) {
        console.error('[LocationContext] Watch Error:', e);
        setLocationState({ coords: null, error: 'Error starting location tracking' });
      }
    };

    startLocationTracking();

    return () => {
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
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
