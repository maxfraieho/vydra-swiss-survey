import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Relative asset paths for reverse proxy subpath (Sign-off S3)
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
