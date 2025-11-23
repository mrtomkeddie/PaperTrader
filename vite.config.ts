import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'child_process';

// https://vitejs.dev/config/
const runCryptoBot = () => {
  let proc: any;
  return {
    name: 'run-crypto-bot',
    configureServer(server) {
      if (proc) return;
      const cmd = process.platform === 'win32' ? 'npm' : 'npm';
      proc = spawn(cmd, ['run', 'crypto-bot'], { stdio: 'inherit', shell: true });
      const stop = () => { try { proc.kill(); } catch {} proc = undefined; };
      server.httpServer?.once('close', stop);
      if (proc && typeof proc.on === 'function') {
        proc.on('exit', () => {
          proc = undefined;
          setTimeout(() => {
            if (!proc && server.httpServer) {
              proc = spawn(cmd, ['run', 'crypto-bot'], { stdio: 'inherit', shell: true });
              if (proc && typeof proc.on === 'function') proc.on('exit', () => { proc = undefined; });
            }
          }, 2000);
        });
      }
    }
  };
};

export default defineConfig({
  plugins: [react(), runCryptoBot()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/api/, '')
      },
      '/crypto': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/crypto/, '')
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