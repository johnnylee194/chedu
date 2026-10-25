import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api/axios';
import { useAuthStore } from '../store/authStore';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const adminLogin = useAuthStore(state => state.adminLogin);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await adminApi.post('/auth/login', { username, password });

      if (res.data.user.role !== 'admin') {
        setError('权限不足：需管理员账号登录');
        setLoading(false);
        return;
      }

      adminLogin(res.data.token, res.data.user);
      navigate('/admin/routes');
    } catch (err: any) {
      setError(err.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-2xl p-8 border border-gray-700">
        <h2 className="text-2xl font-bold text-center text-white mb-8">Chedu 管理后台 - 安全验证</h2>

        {error && (
          <div className="bg-red-900 text-red-200 p-3 rounded mb-4 text-sm border border-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">管理员账号</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">密码</label>
            <input
              type="password"
              required
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? '验证中...' : '安全登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
