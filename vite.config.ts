import { defineConfig } from 'vite';

// `npm run dev` serves dev/index.html (component gallery).
// `npm run build` writes one ES module to dist/ for HACS.
export default defineConfig({
  root: '.',
  server: { open: '/dev/index.html' },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'ha-glass-dashboard.js',
    },
    target: 'es2021',
  },
});
