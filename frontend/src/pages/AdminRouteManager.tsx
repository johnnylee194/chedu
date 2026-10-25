import { useState, useEffect } from 'react';
import { adminApi as api } from '../api/axios';
import RouteMap from '../components/RouteMap';
import RouteList from '../components/RouteList';
import { Upload, Download, Layers, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function AdminRouteManager() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [estimation, setEstimation] = useState<any>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showBuffer, setShowBuffer] = useState(false);
  const [useOfflineTiles, setUseOfflineTiles] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const token = useAuthStore(state => state.adminToken);

  useEffect(() => {
    fetchRoutes();
  }, []);

  // Poll for job status
  useEffect(() => {
      let interval: any;
      if (selectedRoute && jobStatus && jobStatus.status === 'downloading') {
          interval = setInterval(async () => {
              try {
                  const res = await api.get(`/routes/${selectedRoute.id}/tile-status`);
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
      const res = await api.get('/routes');
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
      const uploadRes = await api.post('/upload/kml', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = uploadRes.data.data;

      const payload = {
          title: data.metadata.name || '新路线',
          description: data.metadata.description || '',
          total_distance: data.metadata.total_distance,
          total_ascent: data.metadata.total_ascent,
          geojson: data.geojson
      };

      await api.post('/routes', payload);
      await fetchRoutes();
    } catch (err) {
      console.error('Upload failed', err);
      alert('上传失败，请查看控制台。');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const selectRoute = async (routeId: number) => {
    try {
      const res = await api.get(`/routes/${routeId}`);
      const route = res.data;
      setSelectedRoute(route);
      setEditTitle(route.title);
      setIsEditingTitle(false);

      const estRes = await api.get(`/routes/${routeId}/estimate-tiles`);
      setEstimation(estRes.data);

      const statRes = await api.get(`/routes/${routeId}/tile-status`);
      setJobStatus(statRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  const startMBTilesBuild = async () => {
      if (!selectedRoute) return;
      try {
          await api.post(`/routes/${selectedRoute.id}/build-mbtiles`, {
              sourceUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          });
          setJobStatus({ status: 'downloading', downloaded: 0, total: estimation?.totalTiles || 100 });
      } catch (e) {
          console.error(e);
          alert('构建启动失败');
      }
  };

  const handleRename = async () => {
      if (!selectedRoute) return;
      try {
          await api.put(`/routes/${selectedRoute.id}`, {
              ...selectedRoute,
              title: editTitle
          });
          setIsEditingTitle(false);
          await fetchRoutes();
          setSelectedRoute((prev: any) => ({ ...prev, title: editTitle }));
      } catch (e) {
          console.error(e);
          alert('重命名失败');
      }
  };

  const handleDeleteRoute = async () => {
      if (!selectedRoute) return;
      const confirmDelete = window.confirm('确定要删除这条路线吗？');
      if (!confirmDelete) return;

      try {
          await api.delete(`/routes/${selectedRoute.id}`);
          setSelectedRoute(null);
          await fetchRoutes();
      } catch (e) {
          console.error(e);
          alert('删除路线失败');
      }
  };

  return (
    <>
      <div className="w-96 bg-white shadow-lg flex flex-col z-10 border-r">
        <div className="p-4 bg-gray-100 border-b flex items-center justify-between">
            <h2 className="font-bold">管理路线</h2>
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm flex items-center shadow-sm">
                <Upload size={16} className="mr-1" />
                {isUploading ? '上传中...' : '上传'}
                <input type="file" accept=".kml,.kmz,.gpx" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
        </div>

        <RouteList routes={routes} selectedRoute={selectedRoute} onSelectRoute={selectRoute} />

        {/* Selected Route Actions */}
        {selectedRoute && (
            <div className="p-4 bg-white shrink-0">
                <div className="flex justify-between items-center mb-2">
                    {isEditingTitle ? (
                        <div className="flex items-center flex-1 mr-2">
                            <input
                                type="text"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                className="border rounded px-2 py-1 flex-1 text-sm mr-2"
                                autoFocus
                            />
                            <button onClick={handleRename} className="bg-green-100 hover:bg-green-200 text-green-700 text-xs py-1 px-2 rounded font-medium mr-1 shrink-0">保存</button>
                            <button onClick={() => { setIsEditingTitle(false); setEditTitle(selectedRoute.title); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs py-1 px-2 rounded font-medium shrink-0">取消</button>
                        </div>
                    ) : (
                        <div className="flex items-center flex-1 mr-2 overflow-hidden">
                            <h2 className="font-bold text-gray-800 truncate" style={{ flex: 1 }}>{selectedRoute.title}</h2>
                            <button onClick={() => { setIsEditingTitle(true); setEditTitle(selectedRoute.title); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs py-1 px-2 rounded font-medium ml-2 shrink-0">编辑</button>
                        </div>
                    )}
                    <button onClick={handleDeleteRoute} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs py-1 px-2 rounded font-medium ml-2 shrink-0">🗑️ 删除</button>
                </div>

                {estimation && (
                    <div className="bg-gray-50 p-3 rounded text-sm mb-4 border">
                        <div className="font-semibold text-gray-700 mb-1">1公里缓冲带预估：</div>
                        <div className="flex justify-between text-gray-600 mb-1">
                            <span>瓦片数 (Z8-16):</span>
                            <span className="font-mono">{estimation.totalTiles}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>预估大小:</span>
                            <span className="font-mono">{estimation.estimatedMB.toFixed(1)} MB</span>
                        </div>
                    </div>
                )}

                {jobStatus?.status === 'downloading' ? (
                    <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>正在构建离线地图包...</span>
                            <span>{jobStatus.downloaded} / {jobStatus.total}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${(jobStatus.downloaded / jobStatus.total) * 100}%` }}></div>
                        </div>
                    </div>
                ) : jobStatus?.status === 'failed' ? (
                     <div className="mb-4 p-2 bg-red-50 text-red-700 rounded text-sm flex items-start">
                         <AlertCircle size={16} className="mr-1 shrink-0 mt-0.5" />
                         <span>构建失败: {jobStatus.errorMessage || '未知错误'}</span>
                     </div>
                ) : jobStatus?.status === 'completed' ? (
                    <div className="mb-4">
                        <a href={`/api/routes/${selectedRoute.id}/mbtiles?token=${token}`} className="w-full bg-green-600 hover:bg-green-700 text-white p-2 rounded flex items-center justify-center font-medium mb-2 transition" download>
                            <Download size={18} className="mr-2" /> 下载 .mbtiles
                        </a>
                        <button onClick={startMBTilesBuild} className="w-full bg-gray-500 hover:bg-gray-600 text-white p-2 rounded font-medium transition">🔄 重新构建</button>
                    </div>
                ) : (
                    <button onClick={startMBTilesBuild} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded font-medium mb-4 transition">构建离线地图包</button>
                )}

                <div className="space-y-2">
                    <label className="flex items-center text-sm cursor-pointer text-gray-700">
                        <input type="checkbox" checked={showBuffer} onChange={e => setShowBuffer(e.target.checked)} className="mr-2 h-4 w-4 text-blue-600 rounded" />
                        显示 1 公里缓冲带
                    </label>
                    <label className={`flex items-center text-sm cursor-pointer ${jobStatus?.status !== 'completed' ? 'opacity-50' : 'text-gray-700'}`}>
                        <input type="checkbox" checked={useOfflineTiles} onChange={e => setUseOfflineTiles(e.target.checked)} disabled={jobStatus?.status !== 'completed'} className="mr-2 h-4 w-4 text-blue-600 rounded" />
                        <Layers size={14} className="mr-1 inline" />
                        预览本地离线包 (Z8-16)
                    </label>
                </div>
            </div>
        )}
      </div>

      <RouteMap selectedRoute={selectedRoute} showBuffer={showBuffer} useOfflineTiles={useOfflineTiles} />
    </>
  );
}
