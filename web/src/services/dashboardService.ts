import { API_ENDPOINTS } from '../config/api';
import { apiRequest } from './http';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const listProjects = async (token) => {
  const data = await apiRequest(API_ENDPOINTS.dashboard.projects, { token });
  return data.projects || data.plugins || [];
};

export const createProject = async (name, token) => {
  const data = await apiRequest(API_ENDPOINTS.dashboard.projects, {
    method: 'POST',
    token,
    headers: JSON_HEADERS,
    body: JSON.stringify({ name })
  });
  return data.project || data.plugin || null;
};

export const renameProject = (projectId, name, token) =>
  apiRequest(API_ENDPOINTS.dashboard.project(projectId), {
    method: 'PUT',
    token,
    headers: JSON_HEADERS,
    body: JSON.stringify({ name })
  });

export const deleteProject = (projectId, token) =>
  apiRequest(API_ENDPOINTS.dashboard.project(projectId), {
    method: 'DELETE',
    token
  });

export const listProjectLogs = async (projectId, token) => {
  const data = await apiRequest(API_ENDPOINTS.dashboard.logs(projectId), { token });
  return data.logs || [];
};

export const deleteLog = (logId, token) =>
  apiRequest(API_ENDPOINTS.dashboard.log(logId), {
    method: 'DELETE',
    token
  });

export const deleteLogsBatch = (ids, token) =>
  apiRequest(API_ENDPOINTS.dashboard.batchDelete, {
    method: 'DELETE',
    token,
    headers: JSON_HEADERS,
    body: JSON.stringify({ ids })
  });

export const updateLogsBatchVisibility = (ids, isPublic, token) =>
  apiRequest(API_ENDPOINTS.dashboard.batchVisibility, {
    method: 'PUT',
    token,
    headers: JSON_HEADERS,
    body: JSON.stringify({ ids, isPublic })
  });
