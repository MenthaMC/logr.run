import { buildApiUrl } from '../config/api';

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, isNetworkError = false } = {}) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isNetworkError = isNetworkError;
  }

  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }
}

const withAuthHeaders = (headers, token) => {
  const normalized = new Headers(headers || {});
  if (token) normalized.set('Authorization', `Bearer ${token}`);
  return normalized;
};

const parseErrorPayload = async (response) => {
  const text = await response.text().catch(() => '');
  if (!text) return { text: '', data: null };

  try {
    return { text, data: JSON.parse(text) };
  } catch {
    return { text, data: null };
  }
};

const extractErrorMessage = ({ status, data, text }) => {
  if (data && typeof data === 'object') {
    if (typeof data.error === 'string' && data.error.trim()) return data.error;
    if (typeof data.message === 'string' && data.message.trim()) return data.message;
  }
  if (typeof text === 'string' && text.trim()) return text;
  return `HTTP ${status}`;
};

export const apiRequestRaw = async (path, options = {}) => {
  const { token, headers, ...rest } = options;
  const requestOptions = {
    ...rest,
    headers: withAuthHeaders(headers, token)
  };

  let response;
  try {
    response = await fetch(buildApiUrl(path), requestOptions);
  } catch (error) {
    throw new ApiError(error?.message || 'Network error', { isNetworkError: true });
  }

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    throw new ApiError(extractErrorMessage({ status: response.status, ...payload }), {
      status: response.status,
      data: payload.data
    });
  }

  return response;
};

export const apiRequest = async (path, options = {}) => {
  const { parseAs = 'json' } = options;
  const response = await apiRequestRaw(path, options);

  if (parseAs === 'text') {
    return response.text();
  }

  if (parseAs === 'response') {
    return response;
  }

  return response.json();
};
