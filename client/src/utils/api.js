import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(err);
  }
);

export const captchaAPI = {
  get: () => api.get('/auth/captcha'),
  verify: (token, captcha) => api.post('/auth/verify-captcha', { token, captcha }),
};

export const authAPI = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  register: (username, password, captchaToken, captcha, inviteCode, email, emailCode) =>
    api.post('/auth/register', { username, password, captchaToken, captcha, inviteCode, email, emailCode }),
  sendEmailCode: (email) => api.post('/auth/send-email-code', { email }),
  me: () => api.get('/auth/me'),
  changePassword: (oldPassword, newPassword) =>
    api.post('/auth/change-password', { oldPassword, newPassword }),
};

export const animeAPI = {
  search: (keyword, page = 1) => api.get('/anime/search', { params: { keyword, page } }),
  info: (vodId, categoryId) => api.get('/anime/info/' + vodId + (categoryId ? '/' + categoryId : '')),
  episodes: (vodId, categoryId) => api.get('/anime/episodes/' + vodId + (categoryId ? '/' + categoryId : '')),
};

export const roomAPI = {
  list: () => api.get('/rooms'),
  get: (id) => api.get('/rooms/' + id),
  create: (data) => api.post('/rooms', data),
  delete: (id) => api.delete('/rooms/' + id),
  update: (id, data) => api.patch('/rooms/' + id, data),
  ban: (id, userId) => api.post('/rooms/' + id + '/ban', { userId }),
  unban: (id, userId) => api.post('/rooms/' + id + '/unban', { userId }),
  mute: (id, userId) => api.post('/rooms/' + id + '/mute', { userId }),
  unmute: (id, userId) => api.post('/rooms/' + id + '/unmute', { userId }),
  permissions: (id, data) => api.patch('/rooms/' + id + '/permissions', data),
};

export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  uploadImage: (formData) => api.post('/settings/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const videoAPI = {
  list: () => api.get('/videos'),
  public: () => api.get('/videos/public'),
  get: (id) => api.get('/videos/' + id),
  upload: (formData, onProgress) => api.post('/videos/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  }),
  saveUrl: (data) => api.post('/videos/url', data),
  delete: (id) => api.delete('/videos/' + id),
};

export const adminAPI = {
  stats: () => api.get('/admin/stats'),
  users: () => api.get('/admin/users'),
  banUser: (id, reason) => api.post('/admin/users/' + id + '/ban', { reason }),
  unbanUser: (id) => api.post('/admin/users/' + id + '/unban'),
  deleteUser: (id) => api.delete('/admin/users/' + id),
  rooms: () => api.get('/admin/rooms'),
  deleteRoom: (id) => api.delete('/admin/rooms/' + id),
  messages: (roomId) => api.get('/admin/rooms/' + roomId + '/messages'),
  changeUserPassword: (id, password) => api.post('/admin/users/' + id + '/password', { password }),
  generateInvites: (count) => api.post('/admin/invites/generate', { count }),
  invites: () => api.get('/admin/invites'),
  deleteInvite: (id) => api.delete('/admin/invites/' + id),
};

export default api;
