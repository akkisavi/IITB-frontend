import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const apiBase = (
    env.VITE_API_BASE_URL || env.REACT_APP_API_BASE_URL || env.API_BASE_URL || 'http://127.0.0.1:8000'
  );
  return {
    plugins: [react()],
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBase) },
    server: {
      host: process.env.HOST || '127.0.0.1',
      port: Number(process.env.PORT) || 5173,
      strictPort: true,
    },
    preview: {
      host: process.env.HOST || '127.0.0.1',
      port: Number(process.env.PORT) || 4173,
      strictPort: true,
    },
  };
});
