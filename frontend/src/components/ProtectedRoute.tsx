import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ requireAdmin = false }: ProtectedRouteProps) {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
