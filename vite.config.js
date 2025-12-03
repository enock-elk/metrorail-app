import { defineConfig } from 'vite';

export default defineConfig({
  base: './', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // We removed 'minify: terser' to use the default (esbuild)
    // It is faster and doesn't require extra installations.
  }
});