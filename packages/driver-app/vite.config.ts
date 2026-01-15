import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
  },
  resolve: {
    dedupe: ['firebase', 'firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions'],
  },
  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions', 'firebase/storage'],
    exclude: [],
    esbuildOptions: {
      target: 'es2020',
    },
  },
});
