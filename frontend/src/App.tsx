import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import RouteDetailPage from './pages/RouteDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminPage from './pages/AdminPage';

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
      <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/" />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="route/:id" element={<RouteDetailPage />} />
        <Route path="admin" element={isAuthenticated ? <AdminPage /> : <Navigate to="/login" />} />
      </Route>
    </Routes>
  );
}

export default App;
