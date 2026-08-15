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
    aurelia({ enableConventions: true, hmr: true }),
  ],
}));
