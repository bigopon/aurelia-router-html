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
          if (request.url != null) {
            const pathname = new URL(request.url, 'http://localhost').pathname;
            const fixture = [
              ['/base-app', '/base-path.html'],
              ['/base-explicit', '/base-explicit.html'],
              ['/base-hash', '/base-hash.html'],
              ['/base-query', '/base-query.html'],
            ].find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
            if (fixture != null) {
              request.url = fixture[1];
            }
          }
          next();
        });
      },
    },
    aurelia({ enableConventions: true, hmr: true }),
  ],
}));
