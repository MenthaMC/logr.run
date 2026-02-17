import { API_ENDPOINTS } from '../config/api';
import { apiRequest } from './http';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const register = (payload) =>
  apiRequest(API_ENDPOINTS.auth.register, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload)
  });

export const login = (payload) =>
  apiRequest(API_ENDPOINTS.auth.login, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload)
  });
