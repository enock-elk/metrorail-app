import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // This forces the CSS to be named 'style.css' so your HTML finds it
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return 'css/style.css';
          }
          return 'assets/[name][extname]';
        },
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name].js',
      }
    }
  },
  css: {
    // This tells Vite: "Use the config from Step 2"
    postcss: './postcss.config.js',
  }
});