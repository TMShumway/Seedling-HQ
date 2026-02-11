import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: resolve(__dirname, '../../'),
  define: {
    // amazon-cognito-identity-js references `global` (Node.js global)
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
});
