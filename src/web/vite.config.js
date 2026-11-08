import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' permite servir el build desde cualquier carpeta (FastAPI static, Nginx, etc.)
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, open: false },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700,
  },
});
