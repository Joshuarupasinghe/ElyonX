import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: path.resolve(__dirname, '.env') });

const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';
const oscTargetIp = process.env.EXPO_PUBLIC_OSC_TARGET_IP ?? '192.168.1.1';

export default defineConfig({
  define: {
    'process.env.EXPO_PUBLIC_BACKEND_URL': JSON.stringify(backendUrl),
    'process.env.EXPO_PUBLIC_OSC_TARGET_IP': JSON.stringify(oscTargetIp),
  },
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
