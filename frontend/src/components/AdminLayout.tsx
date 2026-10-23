import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Database, Users, LogOut, Map } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function AdminLayout() {
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Admin Sidebar Navigation */}
      <div className="w-64 bg-gray-900 text-white flex flex-col z-20">
        <div className="p-4 bg-gray-950 flex items-center justify-between">
            <h1 className="text-xl font-bold flex items-center"><Database className="mr-2" /> 管理后台</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
            <NavLink
                to="/admin/routes"
                className={({ isActive }) => `flex items-center p-3 rounded transition ${isActive ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
            >
                <Map size={20} className="mr-3" />
                路线管理
            </NavLink>
            <NavLink
                to="/admin/users"
                className={({ isActive }) => `flex items-center p-3 rounded transition ${isActive ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
            >
                <Users size={20} className="mr-3" />
                用户管理
            </NavLink>
        </nav>

        <div className="p-4 border-t border-gray-800">
            <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center p-2 rounded bg-red-600 hover:bg-red-700 transition"
            >
                <LogOut size={18} className="mr-2" />
                退出登录
            </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
         <Outlet />
      </div>
    </div>
  );
}
