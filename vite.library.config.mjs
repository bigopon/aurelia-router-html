import { defineConfig } from 'vite';

const aureliaPackages = /^@aurelia\//;

export default defineConfig(({ mode }) => ({
  define: {
    __DEV__: JSON.stringify(mode === 'development'),
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: 'router/index.ts',
      formats: ['es'],
      fileName: () => mode === 'development' ? 'index.dev.mjs' : 'index.mjs',
    },
    minify: mode === 'production',
    rollupOptions: {
      external: aureliaPackages,
    },
    sourcemap: true,
    target: 'es2022',
  },
  esbuild: {
    target: 'es2022',
  },
}));
