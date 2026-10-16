// Browser-only build: the whole app, server logic and an in-browser SQLite
// included, in one script so it can be published as a single HTML page.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.VITE_STANDALONE': JSON.stringify('1') },
  build: {
    outDir: 'dist-standalone',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: { format: 'iife', inlineDynamicImports: true },
    },
  },
});
