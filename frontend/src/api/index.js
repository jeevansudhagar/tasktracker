import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach access token ───────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: auto-refresh on 401 ─────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      const code = error.response?.data?.code;
      // Don't retry on login/refresh routes
      if (original.url?.includes('/auth/')) return Promise.reject(error);

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefresh } = data.data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefresh);

        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        return api(original);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  refresh:  (data) => api.post('/auth/refresh', data),
  logout:   ()     => api.post('/auth/logout'),
  me:       ()     => api.get('/auth/me'),
};

// ── Users ─────────────────────────────────────────────────────────────────
export const usersApi = {
  list:   (params) => api.get('/users', { params }),
  get:    (id)     => api.get(`/users/${id}`),
  update: (id, d)  => api.patch(`/users/${id}`, d),
  delete: (id)     => api.delete(`/users/${id}`),
};

// ── Projects ──────────────────────────────────────────────────────────────
export const projectsApi = {
  list:   (params) => api.get('/projects', { params }),
  get:    (id)     => api.get(`/projects/${id}`),
  create: (d)      => api.post('/projects', d),
  update: (id, d)  => api.patch(`/projects/${id}`, d),
  delete: (id)     => api.delete(`/projects/${id}`),
};

// ── Tasks ─────────────────────────────────────────────────────────────────
export const tasksApi = {
  list:         (params) => api.get('/tasks', { params }),
  get:          (id)     => api.get(`/tasks/${id}`),
  create:       (d)      => api.post('/tasks', d),
  update:       (id, d)  => api.patch(`/tasks/${id}`, d),
  updateStatus: (id, s)  => api.patch(`/tasks/${id}/status`, { status: s }),
  delete:       (id)     => api.delete(`/tasks/${id}`),
};

// ── Analytics ─────────────────────────────────────────────────────────────
export const analyticsApi = {
  overdueSummary:      () => api.get('/analytics/overdue-summary'),
  taskStatusBreakdown: () => api.get('/analytics/task-status-breakdown'),
};

export default api;
