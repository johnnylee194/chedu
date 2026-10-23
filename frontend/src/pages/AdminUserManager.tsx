import { useState, useEffect } from 'react';
import api from '../api/axios';
import { KeyRound, Map, X, Plus } from 'lucide-react';

export default function AdminUserManager() {
  const [users, setUsers] = useState<any[]>([]);
  const [allRoutes, setAllRoutes] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    fetchUsers();
    fetchAllRoutes();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAllRoutes = async () => {
    try {
      const res = await api.get('/routes');
      setAllRoutes(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetPassword = async (userId: number, username: string) => {
    if (!window.confirm(`确定要重置用户 "${username}" 的密码吗？`)) return;

    try {
      const res = await api.post(`/admin/users/${userId}/reset`);
      alert(`密码已重置！\n\n新密码: ${res.data.newPassword}\n\n请将此密码告知用户。`);
    } catch (e) {
      console.error(e);
      alert('密码重置失败');
    }
  };

  const openManageRoutes = (user: any) => {
    setSelectedUser(user);
    // Since we don't have a direct GET /admin/users/:id/routes endpoint in Phase 1,
    // we can filter allRoutes by what the user has access to?
    // Wait, the backend doesn't provide a way for admin to see exactly which routes a SPECIFIC user has if they don't have an endpoint for it.
    // The Phase 1 requirement was: POST /assign, DELETE /remove.
    // Actually, Phase 1 didn't specify a GET specific user routes for admin.
    // I will mock this by just providing the assign/revoke UI and assuming they keep track, or we fetch /routes acting as that user? No, backend blocks that.
    // Wait, Phase 1 GET /admin/users returns `route_count`.
    // To make this functional without adding a new backend endpoint, I'll allow assigning any route from the list.

    // For a robust UI, let's just show all routes and let the admin click "Assign".
    // If it's already assigned, the backend handles it gracefully (INSERT OR IGNORE).
    // If they want to revoke, they can click "Revoke".
  };

  const handleAssignRoute = async (routeId: number) => {
    if (!selectedUser) return;
    try {
      await api.post(`/admin/users/${selectedUser.id}/routes/${routeId}`);
      alert('分配成功');
      fetchUsers(); // Update count
    } catch (e) {
      console.error(e);
      alert('分配失败');
    }
  };

  const handleRevokeRoute = async (routeId: number) => {
    if (!selectedUser) return;
    try {
      await api.delete(`/admin/users/${selectedUser.id}/routes/${routeId}`);
      alert('移除成功');
      fetchUsers(); // Update count
    } catch (e) {
      console.error(e);
      alert('移除失败');
    }
  };

  return (
    <div className="flex-1 p-8 bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">用户管理</h2>

        <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户名</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">已分配路线</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {users.map(user => (
                        <tr key={user.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.id}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.route_count} 条</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                    onClick={() => handleResetPassword(user.id, user.username)}
                                    className="text-yellow-600 hover:text-yellow-900 mr-4"
                                    title="重置密码"
                                >
                                    <KeyRound size={18} />
                                </button>
                                {user.role !== 'admin' && (
                                    <button
                                        onClick={() => openManageRoutes(user)}
                                        className="text-blue-600 hover:text-blue-900"
                                        title="管理路线"
                                    >
                                        <Map size={18} />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* Manage Routes Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h3 className="text-lg font-bold">管理用户路线: {selectedUser.username}</h3>
                    <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-gray-700">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                    <p className="text-sm text-gray-500 mb-4">注意：由于当前版本未提供查询特定用户路线的接口，点击分配/移除会直接发送请求。重复分配将被忽略。</p>
                    <ul className="space-y-2">
                        {allRoutes.map(route => (
                            <li key={route.id} className="flex justify-between items-center p-3 border rounded hover:bg-gray-50">
                                <div>
                                    <div className="font-medium text-sm">{route.title}</div>
                                    <div className="text-xs text-gray-500">{route.total_distance} km</div>
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => handleAssignRoute(route.id)}
                                        className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200 flex items-center"
                                    >
                                        <Plus size={14} className="mr-1" /> 分配
                                    </button>
                                    <button
                                        onClick={() => handleRevokeRoute(route.id)}
                                        className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 flex items-center"
                                    >
                                        <X size={14} className="mr-1" /> 移除
                                    </button>
                                </div>
                            </li>
                        ))}
                        {allRoutes.length === 0 && <div className="text-center text-gray-500 text-sm">暂无任何路线</div>}
                    </ul>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
