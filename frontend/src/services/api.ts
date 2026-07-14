import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

// Module-level token getter injected by AuthContext on mount.
// This allows the Axios interceptor to call Clerk's async getToken()
// without importing React hooks directly (which would violate hook rules).
let clerkTokenGetter: (() => Promise<string | null>) | null = null;

export function setClerkTokenGetter(getter: () => Promise<string | null>) {
  clerkTokenGetter = getter;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically attach the Clerk session token to all requests
api.interceptors.request.use(
  async (config) => {
    const token = clerkTokenGetter ? await clerkTokenGetter() : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 responses — redirect to /login (Clerk sign-in page)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRequest =
      error.config?.url?.includes('/auth/login') ||
      error.config?.url?.includes('/auth/register');
    if (error.response?.status === 401 && !isAuthRequest) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
