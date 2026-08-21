import { defineConfig } from 'vite';
import aurelia from '@aurelia/vite-plugin';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync, statSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pagefindDir = resolve(__dirname, 'dist/pagefind');

function tryServePagefindAsset(request, response) {
  const requestUrl = request.url;
  if (requestUrl == null || !requestUrl.startsWith('/pagefind/')) {
    return false;
  }

  const relativePath = requestUrl.slice('/pagefind/'.length).split('?')[0];
  const filePath = resolve(pagefindDir, relativePath);
  if (!filePath.startsWith(pagefindDir) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return false;
  }

  const extension = filePath.slice(filePath.lastIndexOf('.'));
  const contentType = extension === '.js'
    ? 'text/javascript; charset=utf-8'
    : extension === '.css'
      ? 'text/css; charset=utf-8'
      : extension === '.json'
        ? 'application/json; charset=utf-8'
        : 'application/octet-stream';

  response.statusCode = 200;
  response.setHeader('Content-Type', contentType);
  response.end(readFileSync(filePath));
  return true;
}

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
        server.middlewares.use((request, response, next) => {
          if (tryServePagefindAsset(request, response)) {
            return;
          }
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
