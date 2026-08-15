import { defineConfig } from 'vite';
import aurelia from '@aurelia/vite-plugin';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => ({
  define: {
    __DEV__: JSON.stringify(command === 'serve'),
  },
  server: {
    port: Number(process.env.APP_PORT ?? 9027),
    fs: {
      allow: [
        resolve(__dirname, '..'),
      ],
    },
  },
  build: {
    minify: false,
    target: 'es2022',
    outDir: 'dist',
  },
  esbuild: {
    target: 'es2022',
  },
  plugins: [
    aurelia({ enableConventions: true, hmr: true }),
  ],
}));
