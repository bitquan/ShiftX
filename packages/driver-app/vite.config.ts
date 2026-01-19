import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,  // Driver app
    strictPort: false,
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
