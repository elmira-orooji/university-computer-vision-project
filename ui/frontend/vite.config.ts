import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: '../dist', emptyOutDir: true },
  server: { proxy: Object.fromEntries(['/api', '/fonts', '/favicon.svg'].map(path => [path, {
    target: 'http://127.0.0.1:8766', changeOrigin: true, headers: { Origin: 'http://127.0.0.1:8766' }
  }])) }
});
