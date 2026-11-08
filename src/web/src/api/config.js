// Configuración de la conexión con el backend (ver .env.example)
const env = import.meta.env;

export const USE_MOCKS = env.VITE_USE_MOCKS !== 'false';
export const API_URL = (env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
export const ROUTER_MODE = env.VITE_ROUTER_MODE === 'hash' ? 'hash' : 'browser';
export const TMDB_IMAGE_BASE = (env.VITE_TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p').replace(/\/$/, '');

export const TOKEN_KEY = 'cinestart.token';
