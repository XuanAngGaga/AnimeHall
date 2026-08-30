import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9178,
    watch: {
      ignored: ['**/.*.tmpdir/**', '**/node_modules/**'],
    },
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/uploads': 'http://localhost:3001',
    },
  },
});
