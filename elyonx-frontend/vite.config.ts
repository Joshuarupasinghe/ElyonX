import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@': path.resolve(__dirname, 'src'),
    },
    extensions: ['.web.tsx', '.tsx', '.web.js', '.js', '.web.ts', '.ts']
  },
  server: {
    port: 3000,
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: ['.web.js', '.js', '.ts', '.web.ts', '.tsx', '.web.tsx'],
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
