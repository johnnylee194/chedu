import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, Mountain, Star, ArrowRight, Download } from 'lucide-react';
import { routesAPI } from '../lib/api';
import { useRouteStore } from '../store/routes';
import { formatDistance, formatDuration, formatElevation, getDifficultyColor, getDifficultyLabel } from '../lib/utils';
import { offlineDB } from '../lib/offline';

const HomePage: React.FC = () => {
  const { routes, setRoutes, isLoading, setLoading, setError } = useRouteStore();
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const response = await routesAPI.getAll();
      setRoutes(response.data);
    } catch (error) {
      setError('Failed to fetch routes');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadOffline = async (routeId: number) => {
    setDownloading(routeId);
    try {
      const response = await routesAPI.getById(routeId.toString());
      await offlineDB.saveRoute({
        id: routeId,
        data: response.data,
        cachedAt: Date.now(),
      });
      alert('路线已缓存到本地，可在离线时查看');
    } catch (error) {
      alert('下载失败，请检查网络连接');
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">越野路线图</h1>
        <p className="text-gray-600">专业的越野自驾路线，支持离线使用</p>
      </div>

      {routes.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 text-lg">暂无路线数据</p>
          <p className="text-gray-500 text-sm mt-2">请联系管理员添加路线</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {routes.map((route) => (
            <div key={route.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900 line-clamp-2">{route.title}</h2>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(route.difficulty)} text-white`}>
                  {getDifficultyLabel(route.difficulty)}
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-4 line-clamp-3">{route.description}</p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center text-sm text-gray-700">
                  <MapPin className="w-4 h-4 mr-1 text-primary-600" />
                  <span>{formatDistance(route.total_distance)}</span>
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <Clock className="w-4 h-4 mr-1 text-primary-600" />
                  <span>{formatDuration(route.estimated_duration)}</span>
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <Mountain className="w-4 h-4 mr-1 text-primary-600" />
                  <span>最高 {formatElevation(route.max_elevation)}</span>
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <Star className="w-4 h-4 mr-1 text-yellow-500" />
                  <span>难度 {route.difficulty}/5</span>
                </div>
              </div>

              <div className="flex space-x-2">
                <Link
                  to={`/route/${route.id}`}
                  className="flex-1 btn-primary text-center flex items-center justify-center"
                >
                  查看详情
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
                <button
                  onClick={() => handleDownloadOffline(route.id)}
                  disabled={downloading === route.id}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                  title="下载离线数据"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HomePage;
