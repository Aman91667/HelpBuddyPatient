import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },

      // rewrite lucide-react/src/* -> node_modules/lucide-react/dist/esm/*
      {
        find: /^lucide-react\/src\/(.*)$/,
        replacement: path.resolve(__dirname, 'node_modules/lucide-react/dist/esm') + '/$1'
      }
    ]
  },
  // Proxy API requests to backend during development so cookies (HttpOnly)
  // set by the backend are stored by the browser without cross-site issues.
  // With this proxy, frontend can use a relative '/api' base.
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  ssr: {
    // ensure lucide-react is bundled in SSR builds so Vite doesn't treat it as external
    noExternal: ['lucide-react']
  },
  optimizeDeps: {
    include: ['lucide-react']
  }
});

