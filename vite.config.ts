import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/api/, '')
      }
    }
  },
  build: {
    // Increase the chunk size warning limit to 1600kB (1.6MB) to silence the warning
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Automatically split vendor code (node_modules) into a separate file
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
});