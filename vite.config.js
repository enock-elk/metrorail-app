import { defineConfig } from 'vite';

export default defineConfig({
  base: './', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // Force the Javascript to be named 'app.js' in the 'js' folder
        entryFileNames: 'js/app.js',
        chunkFileNames: 'js/[name].js',
        // Force the CSS to be named 'style.css' in the 'css' folder
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'css/style.css';
          return 'assets/[name][extname]';
        }
      }
    }
  }
});