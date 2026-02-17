const DEFAULT_API_BASE_URL = 'http://115.190.212.236:4000';

const stripTrailingSlash = (value) => value.replace(/\/+$/, '');

export const API_BASE_URL = stripTrailingSlash(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL);
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAACMfhNy4dpEna30X';

export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register'
  },
  logs: {
    create: '/logs',
    detail: (id) => `/logs/${encodeURIComponent(id)}`,
    raw: (id) => `/logs/${encodeURIComponent(id)}/raw`
  },
  dashboard: {
    projects: '/dashboard/projects',
    project: (id) => `/dashboard/projects/${encodeURIComponent(id)}`,
    logs: (projectId) => `/dashboard/logs/${encodeURIComponent(projectId)}`,
    log: (id) => `/dashboard/logs/${encodeURIComponent(id)}`,
    batchDelete: '/dashboard/logs/batch',
    batchVisibility: '/dashboard/logs/batch/visibility'
  }
};

export const buildApiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
