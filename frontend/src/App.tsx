import { useState, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import axios from 'axios';
import * as turf from '@turf/turf';
import {
  Upload,
  List,
  Download,
  Database,
  Layers,
  CheckCircle2,
  AlertCircle,
  Key,
  Image as ImageIcon,
  Copy,
  Trash2,
  Save,
  Plus
} from 'lucide-react';

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

  // Settings & Tianditu TK
  const [tiandituTk, setTiandituTk] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTkInput, setSettingsTkInput] = useState('');

  // BBS Route Form State
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRedeemCode, setEditRedeemCode] = useState('');
  const [enableZ16, setEnableZ16] = useState(false);
  const [routeImages, setRouteImages] = useState<Array<{ image_url: string; caption?: string }>>([]);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [copyHint, setCopyHint] = useState(false);

  const centerRoute = () => {
    if (selectedRoute?.geojson && map.current) {
      const bbox = turf.bbox(selectedRoute.geojson) as [number, number, number, number];
      map.current.fitBounds(bbox, { padding: 50, duration: 800 });
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchRoutes();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_BASE}/routes/settings`);
      if (res.data?.tianditu_tk) {
        setTiandituTk(res.data.tianditu_tk);
        setSettingsTkInput(res.data.tianditu_tk);
      }
    } catch (e) {
      console.error('Failed to fetch settings', e);
    }
  };

  const saveSettings = async () => {
    try {
      await axios.put(`${API_BASE}/routes/settings`, { tianditu_tk: settingsTkInput.trim() });
      setTiandituTk(settingsTkInput.trim());
      setShowSettingsModal(false);
      updateBasemapSource(settingsTkInput.trim());
    } catch (e) {
      alert('保存天地图 Key 失败');
    }
  };

  const updateBasemapSource = (tk: string) => {
    const m = map.current;
    if (!m) return;

    if (m.getLayer('tianditu-img')) m.removeLayer('tianditu-img');
    if (m.getSource('tianditu-img-src')) m.removeSource('tianditu-img-src');
    if (m.getLayer('online-basemap')) m.removeLayer('online-basemap');
    if (m.getSource('online-esri')) m.removeSource('online-esri');

    if (tk) {
      m.addSource('tianditu-img-src', {
        type: 'raster',
        tiles: [
          `https://t0.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${tk}`,
          `https://t1.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${tk}`,
          `https://t2.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${tk}`,
          `https://t3.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${tk}`,
        ],
        tileSize: 256,
        attribution: '&copy; 天地图 Tianditu'
      });
      m.addLayer(
        {
          id: 'tianditu-img',
          type: 'raster',
          source: 'tianditu-img-src',
          minzoom: 0,
          maxzoom: 18
        },
        m.getLayer('route-buffer') ? 'route-buffer' : undefined
      );
    }
  };

  useEffect(() => {
    if (!map.current && mapContainer.current) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: 'background',
              type: 'background',
              paint: {
                'background-color': '#0B0F17'
              }
            }
          ]
        },
        center: [104.195397, 35.86166],
        zoom: 4
      });

      map.current.on('load', () => {
        if (tiandituTk) {
          updateBasemapSource(tiandituTk);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (tiandituTk && map.current && map.current.isStyleLoaded()) {
      updateBasemapSource(tiandituTk);
    }
  }, [tiandituTk]);

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
            fetchRoutes();
          }
        } catch (e) {
          console.error(e);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
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
        title: data.metadata.name || '新路线',
        description: data.metadata.description || '',
        total_distance: data.metadata.total_distance,
        total_ascent: data.metadata.total_ascent,
        geojson: data.geojson,
        max_zoom: 15
      };

      const createRes = await axios.post(`${API_BASE}/routes`, payload);
      await fetchRoutes();
      if (createRes.data?.routeId) {
        selectRoute(createRes.data.routeId);
      }
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
      const res = await axios.get(`${API_BASE}/routes/${routeId}`);
      const route = res.data;
      setSelectedRoute(route);
      setEditTitle(route.title || '');
      setEditDescription(route.description || '');
      setEditRedeemCode(route.redeem_code || `CHEDU-${String(route.id).padStart(4, '0')}`);
      setEnableZ16(route.max_zoom === 16);
      setRouteImages(route.images || []);

      const maxZ = route.max_zoom === 16 ? 16 : 15;
      const estRes = await axios.get(`${API_BASE}/routes/${routeId}/estimate-tiles?maxZoom=${maxZ}`);
      setEstimation(estRes.data);

      const statRes = await axios.get(`${API_BASE}/routes/${routeId}/tile-status`);
      setJobStatus(statRes.data);

      renderRouteOnMap(route);
    } catch (e) {
      console.error(e);
    }
  };

  const refreshEstimation = async (routeId: number, z16: boolean) => {
    try {
      const maxZ = z16 ? 16 : 15;
      const estRes = await axios.get(`${API_BASE}/routes/${routeId}/estimate-tiles?maxZoom=${maxZ}`);
      setEstimation(estRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  const renderRouteOnMap = (route: any) => {
    if (!map.current || !route.geojson) return;
    const m = map.current;

    if (m.getSource('route')) {
      if (m.getLayer('route-line')) m.removeLayer('route-line');
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
        'line-color': '#FF5722',
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
      if (m.getLayer('tianditu-img')) m.setLayoutProperty('tianditu-img', 'visibility', 'none');
      m.addSource('offline-mbtiles', {
        type: 'raster',
        tiles: [`${API_BASE}/routes/${routeId}/tiles/{z}/{x}/{y}`],
        tileSize: 256,
        minzoom: 8,
        maxzoom: selectedRoute?.max_zoom || 15
      });
      m.addLayer(
        {
          id: 'offline-basemap',
          type: 'raster',
          source: 'offline-mbtiles',
          minzoom: 8,
          maxzoom: selectedRoute?.max_zoom || 15
        },
        m.getLayer('route-buffer') ? 'route-buffer' : undefined
      );
    } else {
      if (m.getLayer('tianditu-img')) m.setLayoutProperty('tianditu-img', 'visibility', 'visible');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files: File[] = Array.from(e.target.files);
    const formData = new FormData();
    files.forEach((f: File) => formData.append('images', f));

    setIsUploadingImages(true);
    try {
      const res = await axios.post(`${API_BASE}/upload/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.images) {
        setRouteImages((prev: Array<{ image_url: string; caption?: string }>) => [...prev, ...res.data.images]);
      }
    } catch (err) {
      console.error(err);
      alert('上传路书图片失败');
    } finally {
      setIsUploadingImages(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setRouteImages((prev: Array<{ image_url: string; caption?: string }>) =>
      prev.filter((_: { image_url: string; caption?: string }, i: number) => i !== index)
    );
  };

  const handleSaveRoute = async () => {
    if (!selectedRoute) return;
    setIsSavingRoute(true);
    try {
      const payload = {
        ...selectedRoute,
        title: editTitle,
        description: editDescription,
        redeem_code: editRedeemCode.trim().toUpperCase(),
        max_zoom: enableZ16 ? 16 : 15,
        images: routeImages
      };

      const res = await axios.put(`${API_BASE}/routes/${selectedRoute.id}`, payload);
      await fetchRoutes();
      setSelectedRoute(payload);
      alert(`路书帖子保存成功！专属兑换码：${res.data?.redeem_code || editRedeemCode}`);
    } catch (e) {
      console.error(e);
      alert('保存路书失败');
    } finally {
      setIsSavingRoute(false);
    }
  };

  const startMBTilesBuild = async (forceRebuild = false) => {
    if (!selectedRoute) return;
    if (!tiandituTk) {
      alert('请先在顶部设置中配置天地图 Key (tianditu_tk)！');
      setShowSettingsModal(true);
      return;
    }

    try {
      await axios.post(`${API_BASE}/routes/${selectedRoute.id}/build-mbtiles`, {
        maxZoom: enableZ16 ? 16 : 15,
        forceRebuild
      });
      setJobStatus({ status: 'downloading', downloaded: 0, total: estimation?.totalTiles || 100 });
    } catch (e: any) {
      console.error(e);
      alert(`构建启动失败: ${e.response?.data?.error || e.message}`);
    }
  };

  const handleDeleteRoute = async () => {
    if (!selectedRoute) return;
    const confirmDelete = window.confirm('确定要删除这条路线吗？相关离线包也会被移除。');
    if (!confirmDelete) return;

    try {
      await axios.delete(`${API_BASE}/routes/${selectedRoute.id}`);
      setSelectedRoute(null);
      await fetchRoutes();
    } catch (e) {
      console.error(e);
      alert('删除路线失败');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-800">
      {/* Sidebar: BBS Console */}
      <div className="w-[430px] bg-white shadow-xl flex flex-col z-10 border-r border-gray-200">
        {/* Top Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shadow">
          <div>
            <h1 className="text-lg font-black tracking-wide flex items-center">
              <Database className="mr-2 text-orange-500" size={18} /> Chedu 后厂控制台
            </h1>
            <div className="text-xs text-slate-400 mt-0.5">合规天地图 + BBS 路书发帖管理</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="bg-slate-800 hover:bg-slate-700 text-xs px-2.5 py-1.5 rounded flex items-center border border-slate-700 text-slate-200 transition"
              title="配置天地图 API Key"
            >
              <Key size={13} className="mr-1 text-yellow-400" />
              {tiandituTk ? 'Key 已配' : '配 Key'}
            </button>
            <label className="cursor-pointer bg-orange-600 hover:bg-orange-500 text-white px-2.5 py-1.5 rounded text-xs font-bold flex items-center transition">
              <Upload size={13} className="mr-1" />
              {isUploading ? '上传中...' : '传轨迹'}
              <input
                type="file"
                accept=".kml,.kmz,.gpx"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </label>
          </div>
        </div>

        {/* Route Selector List */}
        <div className="h-44 overflow-y-auto border-b border-gray-200 bg-slate-50 shrink-0">
          <div className="p-2 bg-slate-100 font-bold text-xs text-slate-600 flex items-center justify-between sticky top-0 z-10 border-b border-slate-200">
            <span className="flex items-center">
              <List size={13} className="mr-1" /> 已保存路线列表 ({routes.length})
            </span>
          </div>
          <ul className="divide-y divide-gray-100">
            {routes.map(r => (
              <li
                key={r.id}
                onClick={() => selectRoute(r.id)}
                className={`p-2.5 cursor-pointer hover:bg-orange-50 transition text-xs ${
                  selectedRoute?.id === r.id ? 'bg-orange-100/60 border-l-4 border-orange-600' : ''
                }`}
              >
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-bold text-slate-800 truncate">{r.title}</span>
                  <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1 py-0.5 rounded">
                    #{r.redeem_code || `CHEDU-${String(r.id).padStart(4, '0')}`}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex justify-between items-center">
                  <span>{Number(r.total_distance || 0).toFixed(1)} km</span>
                  {r.tile_status === 'completed' && (
                    <span className="text-emerald-600 flex items-center font-medium">
                      <CheckCircle2 size={11} className="mr-0.5" /> 瓦片就绪 ({Number(r.file_size_mb || 0).toFixed(1)}M)
                    </span>
                  )}
                  {r.tile_status === 'downloading' && (
                    <span className="text-amber-600 font-medium animate-pulse">4req/s 打包中...</span>
                  )}
                  {r.tile_status === 'failed' && (
                    <span className="text-rose-500 font-medium">构建中断</span>
                  )}
                </div>
              </li>
            ))}
            {routes.length === 0 && (
              <div className="p-4 text-slate-400 text-xs text-center">暂无路线，点击右上角上传 GPX/KML 开始。</div>
            )}
          </ul>
        </div>

        {/* Selected Route BBS Post Form */}
        {selectedRoute ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Header + Action Row */}
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                BBS 路书帖子编辑
              </div>
              <div className="flex gap-2">
                <button
                  onClick={centerRoute}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-1 px-2 rounded font-medium transition"
                >
                  🎯 居中
                </button>
                <button
                  onClick={handleDeleteRoute}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs py-1 px-2 rounded font-medium transition"
                >
                  <Trash2 size={12} className="inline mr-0.5" /> 删除
                </button>
              </div>
            </div>

            {/* Post Title & Redeem Code */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">路书标题</label>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs font-bold focus:border-orange-500 focus:outline-none"
                placeholder="输入路书标题，如：阿北线太行山脊穿越"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700">专属兑换码 (CDK)</label>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(editRedeemCode);
                    setCopyHint(true);
                    setTimeout(() => setCopyHint(false), 2000);
                  }}
                  className="text-[11px] text-orange-600 hover:underline flex items-center"
                >
                  <Copy size={11} className="mr-0.5" /> {copyHint ? '已复制！' : '复制口令'}
                </button>
              </div>
              <input
                type="text"
                value={editRedeemCode}
                onChange={e => setEditRedeemCode(e.target.value.toUpperCase())}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold tracking-wider text-orange-600 uppercase focus:border-orange-500 focus:outline-none"
                placeholder="CHEDU-0001"
              />
              <div className="text-[10px] text-slate-400 mt-0.5">
                App 端用户在离线工具箱中输入此口令即可提取该路线与离线瓦片
              </div>
            </div>

            {/* Post Text Body */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">路书正文描述</label>
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded p-2 text-xs leading-relaxed focus:border-orange-500 focus:outline-none resize-none"
                placeholder="输入路书攻略正文、路况警示、加油点、营地推荐等内容..."
              />
            </div>

            {/* Post Images Gallery */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center">
                  <ImageIcon size={13} className="mr-1 text-slate-500" /> 路书实拍与手绘长图 ({routeImages.length})
                </label>
                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium flex items-center transition">
                  <Plus size={11} className="mr-0.5" /> {isUploadingImages ? '上传中...' : '添加图片'}
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isUploadingImages}
                  />
                </label>
              </div>

              {routeImages.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded border border-slate-200 max-h-36 overflow-y-auto">
                  {routeImages.map((img, idx) => (
                    <div key={idx} className="relative group rounded overflow-hidden border border-slate-300 aspect-video bg-black">
                      <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 transition"
                        title="删除此图"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-gray-200 rounded p-3 text-center text-slate-400 text-[11px]">
                  暂未上传图片，点击上方「添加图片」上传路书实拍图
                </div>
              )}
            </div>

            {/* Save BBS Post Button */}
            <button
              onClick={handleSaveRoute}
              disabled={isSavingRoute}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded text-xs font-bold flex items-center justify-center transition shadow-sm"
            >
              <Save size={13} className="mr-1" />
              {isSavingRoute ? '保存中...' : '💾 保存 BBS 路书帖子与兑换码'}
            </button>

            {/* Tianditu Offline Packaging Section */}
            <div className="pt-3 border-t border-gray-200 space-y-2">
              <div className="text-xs font-bold text-slate-700 flex justify-between items-center">
                <span>天地图合规离线包 (Z8-{enableZ16 ? '16' : '15'})</span>
                <label className="flex items-center text-[11px] font-normal cursor-pointer text-slate-600">
                  <input
                    type="checkbox"
                    checked={enableZ16}
                    onChange={e => {
                      setEnableZ16(e.target.checked);
                      if (selectedRoute) refreshEstimation(selectedRoute.id, e.target.checked);
                    }}
                    className="mr-1 h-3.5 w-3.5 text-orange-600 rounded"
                  />
                  开启 Z16 困难点特权
                </label>
              </div>

              {estimation && (
                <div className="bg-slate-50 p-2.5 rounded text-[11px] border border-slate-200 flex justify-between text-slate-600 font-mono">
                  <span>总瓦片: {estimation.totalTiles} 张</span>
                  <span>预估体积: ~{estimation.estimatedMB.toFixed(1)} MB</span>
                </div>
              )}

              {/* Build Button State */}
              {jobStatus?.status === 'downloading' ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-amber-700 font-medium">
                    <span>4 req/s 断点平滑打包中...</span>
                    <span className="font-mono">{jobStatus.downloaded} / {jobStatus.total}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.round((jobStatus.downloaded / (jobStatus.total || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : jobStatus?.status === 'failed' ? (
                <div className="space-y-1.5">
                  <div className="p-2 bg-rose-50 text-rose-700 rounded text-[11px] flex items-start border border-rose-200">
                    <AlertCircle size={13} className="mr-1 shrink-0 mt-0.5" />
                    <span>打包中断: {jobStatus.errorMessage || '网络异常'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startMBTilesBuild(false)}
                      className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-1.5 rounded text-xs font-bold transition"
                    >
                      ⚡ 断点续传继续
                    </button>
                    <button
                      onClick={() => startMBTilesBuild(true)}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded text-xs font-medium transition"
                    >
                      重新打包
                    </button>
                  </div>
                </div>
              ) : jobStatus?.status === 'completed' ? (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <a
                      href={`${API_BASE}/routes/${selectedRoute.id}/mbtiles`}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center transition shadow-sm"
                      download
                    >
                      <Download size={13} className="mr-1" /> 下载 .mbtiles 包
                    </a>
                    <button
                      onClick={() => startMBTilesBuild(true)}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded text-xs font-medium transition"
                    >
                      重新构建
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => startMBTilesBuild(false)}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white py-2 rounded text-xs font-bold transition shadow-sm"
                >
                  构建天地图离线包 (Z8-{enableZ16 ? '16' : '15'})
                </button>
              )}

              {/* Toggles */}
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center text-[11px] cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={showBuffer}
                    onChange={e => setShowBuffer(e.target.checked)}
                    className="mr-1 h-3.5 w-3.5 text-orange-600 rounded"
                  />
                  显示 1km 缓冲带
                </label>
                <label className={`flex items-center text-[11px] cursor-pointer ${jobStatus?.status !== 'completed' ? 'opacity-40' : 'text-slate-700'}`}>
                  <input
                    type="checkbox"
                    checked={useOfflineTiles}
                    onChange={e => setUseOfflineTiles(e.target.checked)}
                    disabled={jobStatus?.status !== 'completed'}
                    className="mr-1 h-3.5 w-3.5 text-orange-600 rounded"
                  />
                  <Layers size={11} className="mr-1 inline" /> 预览本地 MBTiles
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-400 text-xs text-center">
            <List size={28} className="mb-2 text-slate-300" />
            <span>请在上方选择一条路线进行 BBS 路书编辑与离线包打包</span>
          </div>
        )}
      </div>

      {/* Main Map View */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />
        {!tiandituTk && (
          <div className="absolute top-4 left-4 bg-slate-900/90 text-amber-300 border border-amber-500/40 px-3 py-2 rounded shadow-lg text-xs flex items-center">
            <AlertCircle size={14} className="mr-1.5 text-amber-400" />
            <span>未配置天地图 API Key，底图处于纯黑网格预览。点击左上角「配 Key」配置合规底图。</span>
          </div>
        )}
      </div>

      {/* Settings Modal (Tianditu TK) */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-base font-bold text-slate-800 flex items-center">
                <Key size={16} className="mr-1.5 text-yellow-500" /> 天地图 API Key 配置
              </h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed">
              天地图由国家自然资源部背书，具备合法审图号。企业/个人开发者可免费获取 Key（每日约 300 万次配额）。
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">tianditu_tk</label>
              <input
                type="text"
                value={settingsTkInput}
                onChange={e => setSettingsTkInput(e.target.value)}
                placeholder="在此粘贴天地图应用 Key (tk)"
                className="w-full border border-gray-300 rounded px-3 py-2 text-xs font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-3 py-1.5 rounded text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                取消
              </button>
              <button
                onClick={saveSettings}
                className="px-4 py-1.5 rounded text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white transition shadow"
              >
                保存并生效
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
