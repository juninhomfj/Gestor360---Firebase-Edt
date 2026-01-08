
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {},
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 800, // Ajustado para 800kB após otimizações
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Chunk para Firebase (Grande e crítico)
          if (id.includes('firebase')) {
            return 'vendor-firebase';
          }
          // Chunk para Gráficos e D3
          if (id.includes('recharts') || id.includes('d3')) {
            return 'vendor-charts';
          }
          // Chunk para processamento de planilhas
          if (id.includes('xlsx')) {
            return 'vendor-xlsx';
          }
          // Chunk para ícones e UI
          if (id.includes('lucide-react')) {
            return 'vendor-ui';
          }
          // Outras dependências comuns
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true,
  }
});
