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

// Upload a single file directly to Cloudinary (unsigned preset)
export const uploadToCloudinary = (file, { onProgress } = {}) => {
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const name = import.meta.env.VITE_CLOUDINARY_NAME;
  if (!preset || !name) throw new Error('Cloudinary env not configured');
  const endpoint = `https://api.cloudinary.com/v1_1/${name}/auto/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', preset);

    xhr.open('POST', endpoint);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && typeof onProgress === 'function') {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve(json.secure_url || json.url);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(xhr.responseText || 'Cloudinary upload failed'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(fd);
  });
};

