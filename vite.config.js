import { defineConfig } from 'vite';

export default defineConfig({
  // Base path for GitHub Pages
  base: './',
  build: {
    // Output to 'dist' folder
    outDir: 'dist',
    // Do not clear the directory (optional, but safer for manual builds)
    emptyOutDir: true,
    // Critical: Disable hash filenames (e.g., style-x82.css) so sw.js can find them
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return 'css/style.css';
          }
          return 'assets/[name][extname]';
        }
      }
    }
  },
  // Ensure Vite knows about the PostCSS config
  css: {
    postcss: './postcss.config.js',
  }
});