import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  plugins: [
    react(),
    {
      name: 'pokemap-host-development-entry',
      transformIndexHtml: {
        order: 'pre',
        handler(html, context) {
          if (context.path !== '/host-page.html') return html;

          return html.replace(
            '<script src="./host/reference-widget.js"></script>',
            '<script type="module" src="/src/widget.tsx"></script>',
          );
        },
      },
    },
  ],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/widget.tsx'),
      name: 'PokeMapWidgetBundle',
      formats: ['iife'],
      fileName: () => 'pokemap-widget.js',
    },
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost/' },
    },
    setupFiles: ['./tests/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
});
