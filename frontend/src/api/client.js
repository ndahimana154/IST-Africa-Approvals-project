import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const STORAGE_KEY = 'p2p_auth';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const { token } = JSON.parse(stored);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;

// helper to upload form data (files)
export const upload = async (url, formData, config = {}) => {
  return api.post(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config,
  });
};

// helper to download files as blob
export const downloadFile = async (url, config = {}) => {
  const response = await api.get(url, { responseType: 'blob', ...config });
  return response.data;
};

