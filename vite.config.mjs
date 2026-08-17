import { defineConfig } from 'vite';
import aurelia from '@aurelia/vite-plugin';

export default defineConfig(({ command }) => ({
  define: {
    __DEV__: JSON.stringify(command === 'serve'),
  },
  server: {
    port: Number(process.env.APP_PORT ?? 5173),
  },
  build: {
    minify: false,
    target: 'es2022',
  },
  esbuild: {
    target: 'es2022',
  },
  plugins: [
    {
      name: 'base-path-browser-fixture',
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url != null && /^\/base-app(?:\/|$)/.test(new URL(request.url, 'http://localhost').pathname)) {
            request.url = '/base-path.html';
          }
          next();
        });
      },
    },
    aurelia({ enableConventions: true, hmr: true }),
  ],
}));
