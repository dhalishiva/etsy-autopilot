import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // exceljs pulls in Node-isms; these shims keep the browser build happy.
  define: { global: 'globalThis' },
  optimizeDeps: { include: ['exceljs'] },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          exceljs: ['exceljs'],
          pdf: ['pdf-lib', 'pdfjs-dist'],
          vendor: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js'],
        },
      },
    },
  },
});
