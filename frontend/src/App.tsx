import { useState, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import axios from 'axios';
import * as turf from '@turf/turf';
import { Upload, List, Download, Database, Layers, CheckCircle2, AlertCircle } from 'lucide-react';

const API_BASE = '/api';

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [estimation, setEstimation] = useState<any>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showBuffer, setShowBuffer] = useState(false);
  const [useOfflineTiles, setUseOfflineTiles] = useState(false);

  useEffect(() => {
    fetchRoutes();
  }, []);

  useEffect(() => {
    if (!map.current && mapContainer.current) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
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

    return () => {
      // Don't remove map on every render to keep state
    };
  }, []);

  // Poll for job status
  useEffect(() => {
      let interval: any;
      if (selectedRoute && jobStatus && jobStatus.status === 'downloading') {
          interval = setInterval(async () => {
              try {
                  const res = await axios.get(`${API_BASE}/routes/${selectedRoute.id}/tile-status`);
                  setJobStatus(res.data);
                  if (res.data.status !== 'downloading') {
                      clearInterval(interval);
                      fetchRoutes(); // Refresh routes list to get updated sizes
                  }
              } catch (e) {
                  console.error(e);
              }
          }, 1000);
      }
      return () => { if (interval) clearInterval(interval) };
  }, [selectedRoute, jobStatus]);

  const fetchRoutes = async () => {
    try {
      const res = await axios.get(`${API_BASE}/routes`);
      setRoutes(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      const uploadRes = await axios.post(`${API_BASE}/upload/kml`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = uploadRes.data.data;

      const payload = {
          title: data.metadata.name || 'New Route',
          description: data.metadata.description || '',
          total_distance: data.metadata.total_distance,
          total_ascent: data.metadata.total_ascent,
          geojson: data.geojson
      };

      await axios.post(`${API_BASE}/routes`, payload);
      await fetchRoutes();
    } catch (err) {
      console.error('Upload failed', err);
      alert('Upload failed. Check console.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const selectRoute = async (routeId: number) => {
    try {
      const res = await axios.get(`${API_BASE}/routes/${routeId}`);
      const route = res.data;
      setSelectedRoute(route);

      const estRes = await axios.get(`${API_BASE}/routes/${routeId}/estimate-tiles`);
      setEstimation(estRes.data);

      const statRes = await axios.get(`${API_BASE}/routes/${routeId}/tile-status`);
      setJobStatus(statRes.data);

      renderRouteOnMap(route);
    } catch (e) {
      console.error(e);
    }
  };

  const renderRouteOnMap = (route: any) => {
      if (!map.current || !route.geojson) return;

      const m = map.current;

      // Clean up old
      if (m.getSource('route')) {
          m.removeLayer('route-line');
          m.removeLayer('route-buffer');
          m.removeSource('route');
      }

      m.addSource('route', {
          type: 'geojson',
          data: route.geojson
      });

      const buffered = turf.buffer(route.geojson, 1, { units: 'kilometers' });

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
  }, [useOfflineTiles]);

  const updateTilesLayer = (routeId: number, offline: boolean) => {
      const m = map.current;
      if (!m) return;

      if (m.getLayer('offline-basemap')) m.removeLayer('offline-basemap');
      if (m.getSource('offline-mbtiles')) m.removeSource('offline-mbtiles');

      if (offline) {
          m.setLayoutProperty('online-basemap', 'visibility', 'none');
          m.addSource('offline-mbtiles', {
              type: 'raster',
              tiles: [`${API_BASE}/routes/${routeId}/tiles/{z}/{x}/{y}`],
              tileSize: 256,
              minzoom: 11,
              maxzoom: 16
          });
          m.addLayer({
              id: 'offline-basemap',
              type: 'raster',
              source: 'offline-mbtiles',
              minzoom: 11,
              maxzoom: 16
          }, 'route-buffer'); // insert below buffer
      } else {
          m.setLayoutProperty('online-basemap', 'visibility', 'visible');
      }
  };

  const startMBTilesBuild = async () => {
      if (!selectedRoute) return;
      try {
          await axios.post(`${API_BASE}/routes/${selectedRoute.id}/build-mbtiles`, {
              sourceUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          });
          setJobStatus({ status: 'downloading', downloaded: 0, total: estimation?.totalTiles || 100 });
      } catch (e) {
          console.error(e);
          alert('Failed to start build');
      }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="w-96 bg-white shadow-lg flex flex-col z-10">
        <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
            <h1 className="text-xl font-bold flex items-center"><Database className="mr-2" /> Chedu Console</h1>
            <label className="cursor-pointer bg-blue-500 hover:bg-blue-400 p-2 rounded text-sm flex items-center">
                <Upload size={16} className="mr-1" />
                {isUploading ? 'Uploading...' : 'Upload Route'}
                <input type="file" accept=".kml,.kmz,.gpx" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
        </div>

        <div className="flex-1 overflow-y-auto border-b">
            <div className="p-2 bg-gray-100 font-semibold text-sm text-gray-600 flex items-center">
                <List size={16} className="mr-1" /> Saved Routes
            </div>
            <ul>
                {routes.map(r => (
                    <li
                        key={r.id}
                        onClick={() => selectRoute(r.id)}
                        className={`p-3 border-b cursor-pointer hover:bg-blue-50 ${selectedRoute?.id === r.id ? 'bg-blue-100 border-l-4 border-blue-600' : ''}`}
                    >
                        <div className="font-medium text-gray-800 truncate">{r.title}</div>
                        <div className="text-xs text-gray-500 mt-1 flex justify-between">
                            <span>{r.total_distance} km</span>
                            {r.tile_status === 'completed' && <span className="text-green-600 flex items-center"><CheckCircle2 size={12} className="mr-1" /> Ready</span>}
                            {r.tile_status === 'downloading' && <span className="text-yellow-600">Building...</span>}
                        </div>
                    </li>
                ))}
                {routes.length === 0 && <div className="p-4 text-gray-400 text-sm text-center">No routes. Upload a GPX/KML to begin.</div>}
            </ul>
        </div>

        {/* Selected Route Actions */}
        {selectedRoute && (
            <div className="p-4 bg-white shrink-0">
                <h2 className="font-bold text-gray-800 mb-2 truncate">{selectedRoute.title}</h2>

                {estimation && (
                    <div className="bg-gray-50 p-3 rounded text-sm mb-4 border">
                        <div className="font-semibold text-gray-700 mb-1">1km Corridor Estimate:</div>
                        <div className="flex justify-between text-gray-600 mb-1">
                            <span>Tiles (Z11-16):</span>
                            <span className="font-mono">{estimation.totalTiles}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Est. Size:</span>
                            <span className="font-mono">{estimation.estimatedMB.toFixed(1)} MB</span>
                        </div>
                    </div>
                )}

                {jobStatus?.status === 'downloading' ? (
                    <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Building MBTiles...</span>
                            <span>{jobStatus.downloaded} / {jobStatus.total}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${(jobStatus.downloaded / jobStatus.total) * 100}%` }}></div>
                        </div>
                    </div>
                ) : jobStatus?.status === 'failed' ? (
                     <div className="mb-4 p-2 bg-red-50 text-red-700 rounded text-sm flex items-start">
                         <AlertCircle size={16} className="mr-1 shrink-0 mt-0.5" />
                         <span>Build failed: {jobStatus.errorMessage || 'Unknown error'}</span>
                     </div>
                ) : jobStatus?.status === 'completed' ? (
                    <a
                        href={`${API_BASE}/routes/${selectedRoute.id}/mbtiles`}
                        className="w-full bg-green-600 hover:bg-green-700 text-white p-2 rounded flex items-center justify-center font-medium mb-4 transition"
                        download
                    >
                        <Download size={18} className="mr-2" /> Download .mbtiles
                    </a>
                ) : (
                    <button
                        onClick={startMBTilesBuild}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded font-medium mb-4 transition"
                    >
                        Build Offline .mbtiles
                    </button>
                )}

                <div className="space-y-2">
                    <label className="flex items-center text-sm cursor-pointer text-gray-700">
                        <input type="checkbox" checked={showBuffer} onChange={e => setShowBuffer(e.target.checked)} className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300" />
                        Show 1.0km Corridor Overlay
                    </label>
                    <label className={`flex items-center text-sm cursor-pointer ${jobStatus?.status !== 'completed' ? 'opacity-50' : 'text-gray-700'}`}>
                        <input
                            type="checkbox"
                            checked={useOfflineTiles}
                            onChange={e => setUseOfflineTiles(e.target.checked)}
                            disabled={jobStatus?.status !== 'completed'}
                            className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300"
                        />
                        <Layers size={14} className="mr-1 inline" />
                        Preview Local .mbtiles (Z11-16)
                    </label>
                </div>
            </div>
        )}
      </div>

      {/* Main Map */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />
      </div>
    </div>
  );
}
