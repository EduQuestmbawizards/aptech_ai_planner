import axios from 'axios';

const rawEnvUrl = import.meta.env.VITE_API_URL;
let resolvedBaseUrl = '/api';

if (rawEnvUrl && typeof rawEnvUrl === 'string' && rawEnvUrl.trim()) {
  const trimmed = rawEnvUrl.trim().replace(/\/+$/, '');
  resolvedBaseUrl = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export const api = axios.create({
  baseURL: resolvedBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer token if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('aptech_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401s
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthEndpoint =
        error.config.url?.includes('/auth/login') ||
        error.config.url?.includes('/auth/activate');
      if (!isAuthEndpoint && window.location.pathname !== '/login') {
        localStorage.removeItem('aptech_token');
        localStorage.removeItem('aptech_user');
      }
    }
    return Promise.reject(error);
  }
);
