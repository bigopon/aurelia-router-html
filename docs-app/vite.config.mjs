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
    {
      name: 'browser-routing-test-harnesses',
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url?.startsWith('/__adapter-test__')) {
            request.url = '/url-adapter.html';
          } else if (request.url?.startsWith('/__redirect-test__')) {
            request.url = '/redirect-harness.html';
          }
          next();
        });
      },
    },
    aurelia({ enableConventions: true, hmr: true }),
  ],
}));
