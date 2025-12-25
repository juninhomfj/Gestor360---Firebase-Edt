import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Define a raiz do projeto como o diretório atual (onde está o index.html e package.json)
  root: '.',
  publicDir: 'public',
  resolve: {
    // Removed @ alias to avoid resolution errors in flat structures
    alias: {},
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
  }
});