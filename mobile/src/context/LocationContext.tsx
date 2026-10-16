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
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationState({ coords: null, error: 'Permission to access location was denied' });
          return;
        }

        // Location tracking (WGS-84, Altitude, Speed, Accuracy)
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 2, // Every 2 meters
          },
          (location) => {
            setLocationState({
              coords: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                altitude: location.coords.altitude,
                accuracy: location.coords.accuracy,
                speed: location.coords.speed,
                heading: location.coords.heading, // Often unreliable on some devices, using watchHeadingAsync below as fallback/primary for compass
              },
              error: null,
            });
          }
        );

        // Heading tracking (Compass bearing)
        headingSubscription = await Location.watchHeadingAsync((headingData) => {
          setHeading(headingData.trueHeading !== -1 ? headingData.trueHeading : headingData.magHeading);
        });

      } catch (e) {
        console.error('Error starting location tracking', e);
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
