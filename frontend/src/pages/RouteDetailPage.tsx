import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Mountain, Car, Download, Share2 } from 'lucide-react';
import { routesAPI } from '../lib/api';
import { useRouteStore } from '../store/routes';
import { formatDistance, formatDuration, formatElevation, getDifficultyColor, getDifficultyLabel, getPOIIcon, haversineDistance } from '../lib/utils';
import { offlineDB } from '../lib/offline';
import MapEngine from '../components/MapEngine';
import ElevationProfile from '../components/ElevationProfile';

const RouteDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentRoute, setCurrentRoute, isLoading, setLoading, setError } = useRouteStore();
  const [mapType, setMapType] = useState<'satellite' | 'terrain' | 'street'>('street');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchRoute(id);
    }
  }, [id]);

  const fetchRoute = async (routeId: string) => {
    setLoading(true);
    try {
      const response = await routesAPI.getById(routeId);
      setCurrentRoute(response.data);
    } catch (error) {
      setError('Failed to fetch route details');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadOffline = async () => {
    if (!currentRoute) return;

    setDownloading(true);
    try {
      await offlineDB.saveRoute({
        id: currentRoute.id,
        data: currentRoute,
        cachedAt: Date.now(),
      });
      alert('路线已缓存到本地，可在离线时查看');
    } catch (error) {
      alert('下载失败，请检查网络连接');
    } finally {
      setDownloading(false);
    }
  };

  const generateElevationData = () => {
    if (!currentRoute || !currentRoute.tracks) return [];

    const data: Array<{ distance: number; elevation: number }> = [];
    let totalDistance = 0;

    currentRoute.tracks.forEach(track => {
      if (track.track_data?.geometry?.coordinates) {
        track.track_data.geometry.coordinates.forEach((coord: number[], index: number) => {
          if (index > 0) {
            const prevCoord = track.track_data.geometry.coordinates[index - 1];
            const lat1 = prevCoord[1];
            const lon1 = prevCoord[0];
            const lat2 = coord[1];
            const lon2 = coord[0];

            totalDistance += haversineDistance(lat1, lon1, lat2, lon2);
          }

          data.push({
            distance: totalDistance,
            elevation: coord[2] || 0,
          });
        });
      }
    });

    return data;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!currentRoute) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg">路线不存在</p>
        <Link to="/" className="btn-primary mt-4 inline-block">
          返回首页
        </Link>
      </div>
    );
  }

  const elevationData = generateElevationData();
  const maxElevation = Math.max(...elevationData.map(d => d.elevation), currentRoute.max_elevation);
  const minElevation = Math.min(...elevationData.map(d => d.elevation), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center text-gray-600 hover:text-primary-600 transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" />
          返回列表
        </Link>
        <div className="flex space-x-2">
          <button
            onClick={handleDownloadOffline}
            disabled={downloading}
            className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4 mr-2" />
            {downloading ? '下载中...' : '离线下载'}
          </button>
          <button className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
            <Share2 className="w-4 h-4 mr-2" />
            分享
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{currentRoute.title}</h1>
            <p className="text-gray-600">{currentRoute.description}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(currentRoute.difficulty)} text-white`}>
            {getDifficultyLabel(currentRoute.difficulty)}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-primary-600" />
            <div>
              <p className="text-xs text-gray-500">总里程</p>
              <p className="font-semibold">{formatDistance(currentRoute.total_distance)}</p>
            </div>
          </div>
          <div className="flex items-center">
            <Clock className="w-5 h-5 mr-2 text-primary-600" />
            <div>
              <p className="text-xs text-gray-500">预估耗时</p>
              <p className="font-semibold">{formatDuration(currentRoute.estimated_duration)}</p>
            </div>
          </div>
          <div className="flex items-center">
            <Mountain className="w-5 h-5 mr-2 text-primary-600" />
            <div>
              <p className="text-xs text-gray-500">最高海拔</p>
              <p className="font-semibold">{formatElevation(currentRoute.max_elevation)}</p>
            </div>
          </div>
          <div className="flex items-center">
            <Car className="w-5 h-5 mr-2 text-primary-600" />
            <div>
              <p className="text-xs text-gray-500">推荐车型</p>
              <p className="font-semibold">{currentRoute.vehicle_type || '不限'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="map-container">
          <MapEngine
            tracks={currentRoute.tracks || []}
            pois={currentRoute.pois || []}
            mapType={mapType}
            onMapTypeChange={setMapType}
          />
        </div>
      </div>

      {elevationData.length > 0 && (
        <ElevationProfile
          data={elevationData}
          maxElevation={maxElevation}
          minElevation={minElevation}
        />
      )}

      {currentRoute.pois && currentRoute.pois.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">关键航点</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentRoute.pois.map((poi, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">{getPOIIcon(poi.type)}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{poi.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{poi.description}</p>
                    {poi.elevation && (
                      <p className="text-xs text-gray-500 mt-2">海拔: {poi.elevation}m</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentRoute.images && currentRoute.images.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">路线相册</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentRoute.images.map((image, index) => (
              <div key={index} className="relative group">
                <img
                  src={image.image_url}
                  alt={image.caption || `Image ${index + 1}`}
                  className="w-full h-48 object-cover rounded-lg"
                />
                {image.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-sm">{image.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteDetailPage;
