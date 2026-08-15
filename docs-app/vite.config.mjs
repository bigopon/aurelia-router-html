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
    cors: true,
    fs: {
      allow: [
        resolve(__dirname, '..'),
      ],
    },
  },
  resolve: {
    dedupe: [
      'aurelia',
      '@aurelia/expression-parser',
      '@aurelia/kernel',
      '@aurelia/metadata',
      '@aurelia/runtime',
      '@aurelia/runtime-html',
      '@aurelia/template-compiler',
    ],
  },
  build: {
    minify: false,
    target: 'es2022',
    outDir: 'dist',
  },
  esbuild: {
    target: 'es2022',
  },
  worker: {
    format: 'es',
  },
  plugins: [
    aurelia({ enableConventions: true, hmr: true }),
  ],
}));
