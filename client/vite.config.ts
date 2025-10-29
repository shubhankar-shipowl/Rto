import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig(({ mode }) => ({
  server: {
    host: '::',
    port: 3000,
  },
  preview: {
    host: '::',
    port: 4173,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'srv512766.hstgr.cloud',
      '.hstgr.cloud', // Allow all subdomains of hstgr.cloud
    ],
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['date-fns'],
  },
  build: {
    commonjsOptions: {
      include: [/date-fns/, /node_modules/],
    },
  },
}));
