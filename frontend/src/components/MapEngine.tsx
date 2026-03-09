import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getPOIIcon } from '../lib/utils';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MapController: React.FC<{ bounds?: L.LatLngBoundsExpression }> = ({ bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);

  return null;
};

const POIMarker: React.FC<{ poi: any }> = ({ poi }) => {
  const icon = L.divIcon({
    html: `<div style="font-size: 24px;">${getPOIIcon(poi.type)}</div>`,
    className: 'custom-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  return (
    <Marker position={[poi.latitude, poi.longitude]} icon={icon}>
      <Popup className="custom-popup">
        <div className="p-2">
          <h3 className="font-bold text-lg mb-1">{poi.name}</h3>
          <p className="text-sm text-gray-600 mb-2">{poi.description}</p>
          {poi.elevation && (
            <p className="text-xs text-gray-500">海拔: {poi.elevation}m</p>
          )}
        </div>
      </Popup>
    </Marker>
  );
};

interface MapEngineProps {
  tracks: Array<{
    track_data: any;
    color: string;
  }>;
  pois: Array<{
    name: string;
    type: string;
    description: string;
    latitude: number;
    longitude: number;
    elevation: number;
  }>;
  center?: [number, number];
  zoom?: number;
  mapType?: 'satellite' | 'terrain' | 'street';
  onMapTypeChange?: (type: 'satellite' | 'terrain' | 'street') => void;
}

const AMAP_URLS = {
  vec: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=2&style=8&x={x}&y={y}&z={z}',
  img: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
};

const MapEngine: React.FC<MapEngineProps> = ({
  tracks,
  pois,
  center = [39.9042, 116.4074],
  zoom = 10,
  mapType = 'street',
  onMapTypeChange,
}) => {
  const [currentMapType, setCurrentMapType] = useState(mapType);

  const getTileLayerUrl = () => {
    switch (currentMapType) {
      case 'satellite':
        return AMAP_URLS.img;
      case 'terrain':
        return AMAP_URLS.vec;
      case 'street':
      default:
        return AMAP_URLS.vec;
    }
  };

  const getAnnotationUrl = () => {
    return null;
  };

  const getTileAttribution = () => {
    return '&copy; 高德地图';
  };

  const handleMapTypeChange = (type: 'satellite' | 'terrain' | 'street') => {
    setCurrentMapType(type);
    onMapTypeChange?.(type);
  };

  const calculateBounds = () => {
    if (tracks.length === 0 && pois.length === 0) return undefined;

    const allPoints: [number, number][] = [];

    tracks.forEach(track => {
      if (track.track_data?.geometry?.coordinates) {
        track.track_data.geometry.coordinates.forEach((coord: number[]) => {
          allPoints.push([coord[1], coord[0]]);
        });
      }
    });

    pois.forEach(poi => {
      allPoints.push([poi.latitude, poi.longitude]);
    });

    if (allPoints.length > 0) {
      return L.latLngBounds(allPoints);
    }

    return undefined;
  };

  const bounds = calculateBounds();

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url={getTileLayerUrl()}
          attribution={getTileAttribution()}
          subdomains={['1', '2', '3', '4']}
          maxZoom={18}
        />
        
        {getAnnotationUrl() && (
          <TileLayer
            url={getAnnotationUrl()!}
            subdomains={['1', '2', '3', '4']}
            maxZoom={18}
          />
        )}

        {tracks.map((track, index) => (
          <Polyline
            key={index}
            positions={
              track.track_data?.geometry?.coordinates?.map((coord: number[]) => [
                coord[1],
                coord[0],
              ]) || []
            }
            color={track.color}
            weight={4}
            opacity={0.8}
          />
        ))}

        {pois.map((poi, index) => (
          <POIMarker key={index} poi={poi} />
        ))}

        <MapController bounds={bounds} />
      </MapContainer>

      <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-md p-2">
        <div className="flex space-x-2">
          <button
            onClick={() => handleMapTypeChange('street')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              currentMapType === 'street'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            街道
          </button>
          <button
            onClick={() => handleMapTypeChange('satellite')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              currentMapType === 'satellite'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            卫星
          </button>
          <button
            onClick={() => handleMapTypeChange('terrain')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              currentMapType === 'terrain'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            地形
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapEngine;
