import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import AdminRouteManager from './pages/AdminRouteManager';
import AdminUserManager from './pages/AdminUserManager';
import { useAuthStore } from './store/authStore';

export default function App() {
  const userToken = useAuthStore(state => state.userToken);
  const adminToken = useAuthStore(state => state.adminToken);

  return (
    <BrowserRouter>
      <Routes>
        {/* User Auth Routes */}
        <Route path="/login" element={userToken ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={userToken ? <Navigate to="/" replace /> : <Register />} />

        {/* Admin Auth Route */}
        <Route path="/admin/login" element={adminToken ? <Navigate to="/admin/routes" replace /> : <AdminLogin />} />

        {/* User Protected Routes */}
        <Route element={<ProtectedRoute requireAdmin={false} />}>
          <Route path="/" element={<UserDashboard />} />
        </Route>

        {/* Admin Protected Routes */}
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
