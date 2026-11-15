import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'long-march';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? `/${repo}/` : '/',
  plugins: [react()],
  server: { port: 8173, host: true },
  preview: { port: 8173, host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1400 },
});