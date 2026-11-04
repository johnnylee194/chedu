import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi as api } from '../api/axios';
import { useAuthStore } from '../store/authStore';
import RouteMap from '../components/RouteMap';
import RouteList from '../components/RouteList';
import { Download, LogOut, KeyRound, Map } from 'lucide-react';

export default function UserDashboard() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const user = useAuthStore(state => state.userData);
  const token = useAuthStore(state => state.userToken);
  const logout = useAuthStore(state => state.userLogout);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const res = await api.get('/routes');
      setRoutes(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectRoute = async (id: number) => {
    try {
      const res = await api.get(`/routes/${id}`);
      setSelectedRoute(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    try {
      await api.put('/auth/password', { oldPassword, newPassword });
      alert('密码修改成功，请重新登录');
      setShowPasswordModal(false);
      handleLogout();
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || '修改失败');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white shadow-lg flex flex-col z-10">
        <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
            <h1 className="text-lg font-bold flex items-center"><Map className="mr-2" /> 我的路线</h1>
            <div className="flex space-x-2">
                <button onClick={() => setShowPasswordModal(true)} title="修改密码" className="p-1 hover:bg-blue-500 rounded">
                    <KeyRound size={18} />
                </button>
                <button onClick={handleLogout} title="退出登录" className="p-1 hover:bg-blue-500 rounded">
                    <LogOut size={18} />
                </button>
            </div>
        </div>

        <div className="p-2 text-xs text-gray-500 bg-gray-100 border-b text-center">
            欢迎, {user?.username}
        </div>

        <RouteList
            routes={routes}
            selectedRoute={selectedRoute}
            onSelectRoute={handleSelectRoute}
        />

        {selectedRoute && (
            <div className="p-4 bg-white shrink-0 border-t">
                <h2 className="font-bold text-gray-800 truncate mb-2">{selectedRoute.title}</h2>
                <div className="text-sm text-gray-600 mb-4 line-clamp-3">
                    {selectedRoute.description || '暂无描述'}
                </div>

                {selectedRoute.tile_status === 'completed' ? (
                     <a
                        href={`/api/routes/${selectedRoute.id}/mbtiles?token=${token}`}
                        className="w-full bg-green-600 hover:bg-green-700 text-white p-2 rounded flex items-center justify-center font-medium transition"
                        download
                    >
                        <Download size={18} className="mr-2" /> 下载地图包
                    </a>
                ) : (
                    <div className="text-sm text-yellow-600 text-center p-2 bg-yellow-50 rounded">
                        地图包未就绪，请联系管理员
                    </div>
                )}
            </div>
        )}
      </div>

      <RouteMap
        selectedRoute={selectedRoute}
        showBuffer={false}
        useOfflineTiles={false}
      />

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                <h3 className="text-lg font-bold mb-4">修改密码</h3>
                {passwordError && <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">{passwordError}</div>}
                <form onSubmit={handleChangePassword}>
                    <div className="mb-3">
                        <label className="block text-sm mb-1">旧密码</label>
                        <input type="password" required className="w-full border p-2 rounded" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm mb-1">新密码</label>
                        <input type="password" required className="w-full border p-2 rounded" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    </div>
                    <div className="flex justify-end space-x-2">
                        <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 bg-gray-200 rounded text-sm">取消</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm">确认修改</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
