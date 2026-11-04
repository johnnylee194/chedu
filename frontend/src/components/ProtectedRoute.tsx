import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ requireAdmin = false }: ProtectedRouteProps) {
  const userToken = useAuthStore(state => state.userToken);
  const userData = useAuthStore(state => state.userData);

  const adminToken = useAuthStore(state => state.adminToken);
  const adminData = useAuthStore(state => state.adminData);

  if (requireAdmin) {
    if (!adminToken || !adminData || adminData.role !== 'admin') {
      return <Navigate to="/admin/login" replace />;
    }
    return <Outlet />;
  } else {
    if (!userToken || !userData) {
      return <Navigate to="/login" replace />;
    }
    return <Outlet />;
  }
}
