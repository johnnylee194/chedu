import React from 'react';
import * as MapLibreGLNamespace from '@maplibre/maplibre-react-native';
import { useLocation } from '../context/LocationContext';

const MapLibreGL: any = (MapLibreGLNamespace as any).default ?? MapLibreGLNamespace;
const ShapeSource = MapLibreGL.ShapeSource ?? (MapLibreGLNamespace as any).ShapeSource;

export default function UserLocationLayer() {
  const { coords, heading } = useLocation();

  if (!coords) return null;

  return (
    <ShapeSource
      id="userLocationSource"
      shape={{
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [coords.longitude, coords.latitude],
            },
            properties: {},
          },
        ],
      }}
    >
      {/* Accuracy Circle */}
      {coords.accuracy && (
        <MapLibreGL.CircleLayer
          id="userLocationAccuracyLayer"
          style={{
            circleRadius: coords.accuracy,
            circleRadiusTransition: { duration: 0 },
            circleColor: '#007AFF',
            circleOpacity: 0.2,
            circlePitchAlignment: 'map',
          }}
        />
      )}
      {/* Blue Dot */}
      <MapLibreGL.CircleLayer
        id="userLocationDotLayer"
        style={{
          circleRadius: 8,
          circleColor: '#007AFF',
          circleStrokeColor: '#FFFFFF',
          circleStrokeWidth: 3,
          circlePitchAlignment: 'map',
        }}
      />
      {/* Heading Indicator (Cone/Arrow) */}
      {heading !== null && (
         <MapLibreGL.SymbolLayer
           id="userLocationHeadingLayer"
           style={{
             iconImage: 'arrow-up', // Assuming default icon or can use a custom loaded image
             iconSize: 0.1,
             iconRotate: heading,
             iconRotationAlignment: 'map',
             iconPitchAlignment: 'map',
             iconOffset: [0, -15],
             iconAllowOverlap: true,
             iconIgnorePlacement: true,
           }}
         />
      )}
    </ShapeSource>
  );
}
