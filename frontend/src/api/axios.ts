import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const userApi = axios.create({
  baseURL: '/api', // Vite proxy handles this in dev, or it maps relative in prod
});

// Request interceptor to attach JWT token
userApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().userToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to handle 401 Unauthorized
userApi.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && error.response.status === 401) {
    // Only log out if it's an API route and not just a failed login attempt
    if (!error.config.url?.includes('/auth/login')) {
      useAuthStore.getState().userLogout();
      window.location.href = '/login';
    }
  }
  return Promise.reject(error);
});

const adminApi = axios.create({
  baseURL: '/api',
});

// Request interceptor to attach JWT token
adminApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().adminToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to handle 401 Unauthorized
adminApi.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && error.response.status === 401) {
    // Only log out if it's an API route and not just a failed login attempt
    if (!error.config.url?.includes('/auth/login')) {
      useAuthStore.getState().adminLogout();
      window.location.href = '/admin/login';
    }
  }
  return Promise.reject(error);
});

// To be compatible with non-dual token updates while we refactor incrementally
export default userApi;
export { userApi, adminApi };
