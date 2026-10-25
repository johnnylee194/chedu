import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as turf from '@turf/turf';
import { useAuthStore } from '../store/authStore';

interface RouteMapProps {
  selectedRoute: any;
  showBuffer: boolean;
  useOfflineTiles: boolean;
}

export default function RouteMap({ selectedRoute, showBuffer, useOfflineTiles }: RouteMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const token = useAuthStore(state => state.userToken) || useAuthStore(state => state.adminToken);

  useEffect(() => {
    if (!map.current && mapContainer.current) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        transformRequest: (url) => {
          if (url.includes('/api/') && token) {
            return {
              url,
              headers: { Authorization: `Bearer ${token}` }
            };
          }
          return { url };
        },
        style: {
          version: 8,
          sources: {
            'online-esri': {
              type: 'raster',
              tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
              tileSize: 256,
              attribution: '&copy; Esri'
            }
          },
          layers: [
            {
              id: 'online-basemap',
              type: 'raster',
              source: 'online-esri',
              minzoom: 0,
              maxzoom: 18
            }
          ]
        },
        center: [104.195397, 35.86166], // China center
        zoom: 4
      });
    }
  }, [token]);

  useEffect(() => {
      if (selectedRoute && map.current) {
          renderRouteOnMap(selectedRoute);
      } else if (!selectedRoute && map.current) {
          if (map.current.getSource('route')) {
              map.current.removeLayer('route-line');
              if (map.current.getLayer('route-buffer')) map.current.removeLayer('route-buffer');
              map.current.removeSource('route');
          }
          if (map.current.getLayer('offline-basemap')) map.current.removeLayer('offline-basemap');
          if (map.current.getSource('offline-mbtiles')) map.current.removeSource('offline-mbtiles');
      }
  }, [selectedRoute]);

  const renderRouteOnMap = (route: any) => {
      if (!map.current || !route.geojson) return;

      const m = map.current;

      if (m.getSource('route')) {
          m.removeLayer('route-line');
          if (m.getLayer('route-buffer')) m.removeLayer('route-buffer');
          m.removeSource('route');
      }

      m.addSource('route', {
          type: 'geojson',
          data: route.geojson
      });

      const simplified = turf.simplify(route.geojson, { tolerance: 0.0008, highQuality: false });
      const buffered = turf.buffer(simplified, 1, { units: 'kilometers', steps: 4 });

      if (buffered) {
          m.addLayer({
              id: 'route-buffer',
              type: 'fill',
              source: {
                  type: 'geojson',
                  data: buffered as any
              },
              paint: {
                  'fill-color': '#088',
                  'fill-opacity': showBuffer ? 0.3 : 0
              }
          });
      }

      m.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: {
              'line-color': '#ff0000',
              'line-width': 4
          }
      });

      const bbox = turf.bbox(route.geojson) as [number, number, number, number];
      m.fitBounds(bbox, { padding: 50, duration: 800 });

      updateTilesLayer(route.id, useOfflineTiles);
  };

  useEffect(() => {
      if (map.current && map.current.getLayer('route-buffer')) {
          map.current.setPaintProperty('route-buffer', 'fill-opacity', showBuffer ? 0.3 : 0);
      }
  }, [showBuffer]);

  useEffect(() => {
      if (selectedRoute) {
          updateTilesLayer(selectedRoute.id, useOfflineTiles);
      }
  }, [useOfflineTiles, selectedRoute]);

  const updateTilesLayer = (routeId: number, offline: boolean) => {
      const m = map.current;
      if (!m) return;

      if (m.getLayer('offline-basemap')) m.removeLayer('offline-basemap');
      if (m.getSource('offline-mbtiles')) m.removeSource('offline-mbtiles');

      if (offline) {
          m.setLayoutProperty('online-basemap', 'visibility', 'none');
          m.addSource('offline-mbtiles', {
              type: 'raster',
              tiles: [`/api/routes/${routeId}/tiles/{z}/{x}/{y}`], // Vite proxy handles /api
              tileSize: 256,
              minzoom: 8,
              maxzoom: 16
          });
          m.addLayer({
              id: 'offline-basemap',
              type: 'raster',
              source: 'offline-mbtiles',
              minzoom: 8,
              maxzoom: 16
          }, m.getLayer('route-buffer') ? 'route-buffer' : 'route-line');
      } else {
          m.setLayoutProperty('online-basemap', 'visibility', 'visible');
      }
  };

  return (
    <div className="flex-1 relative">
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
}
