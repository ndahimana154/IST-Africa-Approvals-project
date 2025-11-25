
import axios from 'axios';
// 401 handler: logout and redirect
const STORAGE_KEY = 'p2p_auth';
function logoutAndRedirect() {
  localStorage.removeItem(STORAGE_KEY);
  // Use window.location to force reload and redirect
  window.location.href = '/login';
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';


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

  // Don't force Content-Type for FormData - let the browser/axios handle it
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  return config;
});

// Add a response interceptor to handle 401 errors (token expired/invalid)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      logoutAndRedirect();
    }
    return Promise.reject(error);
  }
);

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

  console.log('[CLOUDINARY DEBUG] Starting upload for:', file.name, 'Size:', file.size, 'Type:', file.type);

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
          const url = json.secure_url || json.url;
          console.log('[CLOUDINARY DEBUG] Upload successful, URL:', url);
          resolve(url);
        } catch (err) {
          console.error('[CLOUDINARY ERROR] JSON parse error:', err);
          reject(err);
        }
      } else {
        console.error('[CLOUDINARY ERROR] Upload failed with status:', xhr.status);
        console.error('[CLOUDINARY ERROR] Response:', xhr.responseText);
        reject(new Error(xhr.responseText || 'Cloudinary upload failed'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(fd);
  });
};

export const formatError = (err) => {
  const data = err.response?.data;

  if (!data) return "Something went wrong.";

  // Backend wraps everything inside { error: {...} }
  const wrapped = data.error || data;

  /**
   * POSSIBLE SHAPES:
   *
   * 1) { error: { detail: "Message" } }
   * 2) { error: { detail: { field: ["Message"] } } }
   * 3) { error: { detail: { detail: "Message" } } }  <-- Your login case
   */

  const detail = wrapped.detail;

  // Case 1: direct string
  if (typeof detail === "string") {
    return detail;
  }

  // Case 3: nested: detail.detail
  if (detail?.detail && typeof detail.detail === "string") {
    return detail.detail;
  }

  // Case 2: field error: { field: ["Message"] }
  if (typeof detail === "object") {
    const key = Object.keys(detail)[0];
    const value = detail[key];

    if (Array.isArray(value) && typeof value[0] === "string") {
      return value[0];
    }
  }

  return "Something went wrong. Please try again.";
};
