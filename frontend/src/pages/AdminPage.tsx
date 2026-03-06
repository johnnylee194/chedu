import React, { useState, useEffect } from 'react';
import { Plus, Upload, Trash2, Edit, MapPin, Clock, Mountain, Star, Car } from 'lucide-react';
import { routesAPI, uploadAPI } from '../lib/api';
import { formatDistance, formatDuration, formatElevation, getDifficultyColor, getDifficultyLabel } from '../lib/utils';

interface RouteFormData {
  title: string;
  description: string;
  total_distance: number;
  estimated_duration: number;
  total_ascent: number;
  max_elevation: number;
  difficulty: number;
  vehicle_type: string;
  tracks: any[];
  pois: any[];
  images: any[];
}

const AdminPage: React.FC = () => {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<RouteFormData>({
    title: '',
    description: '',
    total_distance: 0,
    estimated_duration: 0,
    total_ascent: 0,
    max_elevation: 0,
    difficulty: 1,
    vehicle_type: '',
    tracks: [],
    pois: [],
    images: [],
  });

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const response = await routesAPI.getAll();
      setRoutes(response.data);
    } catch (error) {
      console.error('Failed to fetch routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const response = await uploadAPI.parseKML(file);
      const data = response.data.data;

      setFormData({
        ...formData,
        title: data.metadata.name || formData.title,
        description: data.metadata.description || formData.description,
        total_distance: data.metadata.total_distance || formData.total_distance,
        tracks: data.tracks || [],
        pois: data.pois || [],
      });

      alert('文件解析成功！请完善其他信息后保存。');
    } catch (error) {
      alert('文件解析失败，请检查文件格式');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingRoute) {
        await routesAPI.update(editingRoute.id.toString(), formData);
      } else {
        await routesAPI.create(formData);
      }

      setShowForm(false);
      setEditingRoute(null);
      resetForm();
      fetchRoutes();
      alert(editingRoute ? '路线更新成功' : '路线创建成功');
    } catch (error) {
      alert('保存失败，请稍后重试');
    }
  };

  const handleEdit = (route: any) => {
    setEditingRoute(route);
    setFormData({
      title: route.title,
      description: route.description,
      total_distance: route.total_distance,
      estimated_duration: route.estimated_duration,
      total_ascent: route.total_ascent,
      max_elevation: route.max_elevation,
      difficulty: route.difficulty,
      vehicle_type: route.vehicle_type,
      tracks: route.tracks || [],
      pois: route.pois || [],
      images: route.images || [],
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条路线吗？')) return;

    try {
      await routesAPI.delete(id.toString());
      fetchRoutes();
      alert('删除成功');
    } catch (error) {
      alert('删除失败，请稍后重试');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      total_distance: 0,
      estimated_duration: 0,
      total_ascent: 0,
      max_elevation: 0,
      difficulty: 1,
      vehicle_type: '',
      tracks: [],
      pois: [],
      images: [],
    });
  };

  const handleNewRoute = () => {
    setEditingRoute(null);
    resetForm();
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {editingRoute ? '编辑路线' : '创建新路线'}
          </h1>
          <button
            onClick={() => {
              setShowForm(false);
              setEditingRoute(null);
              resetForm();
            }}
            className="btn-secondary"
          >
            取消
          </button>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold mb-4">导入奥维数据</h3>
              <div className="flex items-center space-x-4">
                <label className="btn-primary cursor-pointer">
                  <Upload className="w-4 h-4 mr-2 inline" />
                  上传 KML/GPX/OVKML 文件
                  <input
                    type="file"
                    accept=".kml,.kmz,.ovkml,.gpx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {uploading && <span className="text-gray-600">解析中...</span>}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                支持奥维互动地图浏览器导出的 KML、KMZ、OVKML 或 GPX 格式文件
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                路线标题 *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                路线描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-field"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  总里程 (km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.total_distance}
                  onChange={(e) => setFormData({ ...formData, total_distance: parseFloat(e.target.value) || 0 })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  预估耗时 (分钟)
                </label>
                <input
                  type="number"
                  value={formData.estimated_duration}
                  onChange={(e) => setFormData({ ...formData, estimated_duration: parseInt(e.target.value) || 0 })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  累计爬升 (m)
                </label>
                <input
                  type="number"
                  value={formData.total_ascent}
                  onChange={(e) => setFormData({ ...formData, total_ascent: parseFloat(e.target.value) || 0 })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最高海拔 (m)
                </label>
                <input
                  type="number"
                  value={formData.max_elevation}
                  onChange={(e) => setFormData({ ...formData, max_elevation: parseFloat(e.target.value) || 0 })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  难度 (1-5)
                </label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: parseInt(e.target.value) })}
                  className="input-field"
                >
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      {level} - {getDifficultyLabel(level)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  推荐车型
                </label>
                <input
                  type="text"
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                  className="input-field"
                  placeholder="如：硬派越野、城市SUV"
                />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">已导入数据</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">轨迹数量：</span>
                  <span className="font-medium">{formData.tracks.length}</span>
                </div>
                <div>
                  <span className="text-gray-600">航点数量：</span>
                  <span className="font-medium">{formData.pois.length}</span>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button type="submit" className="btn-primary flex-1">
                {editingRoute ? '更新路线' : '创建路线'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingRoute(null);
                  resetForm();
                }}
                className="btn-secondary"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">管理后台</h1>
        <button onClick={handleNewRoute} className="btn-primary">
          <Plus className="w-4 h-4 mr-2 inline" />
          创建新路线
        </button>
      </div>

      {routes.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 text-lg">暂无路线数据</p>
          <p className="text-gray-500 text-sm mt-2">点击"创建新路线"开始添加</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {routes.map((route) => (
            <div key={route.id} className="card">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h2 className="text-xl font-bold text-gray-900">{route.title}</h2>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(route.difficulty)} text-white`}>
                      {getDifficultyLabel(route.difficulty)}
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{route.description}</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div className="flex items-center text-gray-700">
                      <MapPin className="w-4 h-4 mr-1 text-primary-600" />
                      <span>{formatDistance(route.total_distance)}</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <Clock className="w-4 h-4 mr-1 text-primary-600" />
                      <span>{formatDuration(route.estimated_duration)}</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <Mountain className="w-4 h-4 mr-1 text-primary-600" />
                      <span>最高 {formatElevation(route.max_elevation)}</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <Star className="w-4 h-4 mr-1 text-yellow-500" />
                      <span>难度 {route.difficulty}/5</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <Car className="w-4 h-4 mr-1 text-primary-600" />
                      <span>{route.vehicle_type || '不限'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => handleEdit(route)}
                    className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(route.id)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPage;
