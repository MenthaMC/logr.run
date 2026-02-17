import { API_ENDPOINTS, buildApiUrl } from '../config/api';
import { apiRequest } from './http';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const uploadLogFile = (file, { reason = 'MANUAL' } = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('reason', reason);

  return apiRequest(API_ENDPOINTS.logs.create, {
    method: 'POST',
    body: formData
  });
};

export const uploadLogContent = (content, { reason = 'MANUAL' } = {}) =>
  apiRequest(API_ENDPOINTS.logs.create, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ content, reason })
  });

export const getLogDetail = (id, token) =>
  apiRequest(API_ENDPOINTS.logs.detail(id), {
    token
  });

export const updateLogVisibility = (id, isPublic, token) =>
  apiRequest(API_ENDPOINTS.logs.detail(id), {
    method: 'PUT',
    token,
    headers: JSON_HEADERS,
    body: JSON.stringify({ isPublic })
  });

export const getRawLogText = (id, token) =>
  apiRequest(API_ENDPOINTS.logs.raw(id), {
    token,
    parseAs: 'text'
  });

export const buildRawLogUrl = (id) => buildApiUrl(API_ENDPOINTS.logs.raw(id));
