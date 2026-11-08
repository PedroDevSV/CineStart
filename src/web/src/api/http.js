import { API_URL, TOKEN_KEY } from './config.js';
import { storage } from '../lib/storage.js';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Cliente HTTP para la API FastAPI.
 * - Añade el JWT (Authorization: Bearer) si hay sesión.
 * - Convierte los errores de FastAPI ({ detail }) en ApiError con un mensaje legible.
 */
export async function http(path, { method = 'GET', body, query, signal } = {}) {
  const url = new URL(API_URL + path);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  const token = storage.get(TOKEN_KEY);
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'No se ha podido conectar con el servidor. Comprueba tu conexión.');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Token caducado o cuenta desactivada: AuthContext cierra la sesión.
    if (res.status === 401 && token) window.dispatchEvent(new Event('cinestart:unauthorized'));
    const detail = data?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg).join(' · ')
          : `Error ${res.status}`;
    throw new ApiError(res.status, message, detail);
  }
  return data;
}
