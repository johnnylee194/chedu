import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import AdminRouteManager from './pages/AdminRouteManager';
import AdminUserManager from './pages/AdminUserManager';
import { useAuthStore } from './store/authStore';

export default function App() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={token ? <Navigate to={user?.role === 'admin' ? '/admin/routes' : '/'} replace /> : <Login />} />
        <Route path="/register" element={token ? <Navigate to="/" replace /> : <Register />} />

        {/* User Routes (Protected) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={
            user?.role === 'admin' ? <Navigate to="/admin/routes" replace /> : <UserDashboard />
          } />
        </Route>

        {/* Admin Routes (Protected, requireAdmin) */}
        <Route element={<ProtectedRoute requireAdmin={true} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/routes" replace />} />
            <Route path="routes" element={<AdminRouteManager />} />
            <Route path="users" element={<AdminUserManager />} />
          </Route>
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
