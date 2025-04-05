import { defineConfig } from 'vite';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import { resolve } from 'path';
import { cspPlugin, copyComponentFiles } from './viteCustomPlugins';

export default defineConfig({
  root: 'src/client',
  publicDir: '../../public',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    },
    port: 5173
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/client/index.html')
      },
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  },
  plugins: [
    copyComponentFiles(),
    // Use the CSP plugin with default policies.
    // In the future you can pass an object to override or extend the defaults.
    cspPlugin({
      'default-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      'font-src': ["'self'", 'https://cdnjs.cloudflare.com']
    })
  ],
  sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,
  css: {
    devSourcemap: true,
    postcss: {
      plugins: [
        autoprefixer(),
        cssnano({
          preset: [
            'default',
            {
              discardComments: { removeAll: true }
            }
          ]
        })
      ]
    }
  },
  experimental: {
    renderBuiltUrl(filename) {
      if (filename.endsWith('.css')) {
        return { relative: true, preload: true };
      }
      return { relative: true };
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    include: ['./**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['./**/*.js'],
      exclude: ['./test/**']
    }
  }
});
