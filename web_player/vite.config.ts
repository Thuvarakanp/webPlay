import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// Strips `crossorigin` from built HTML.
// Required for Electron (file:// + null-origin = CORS block).
// Safe to leave on for web too — same-origin HTTP requests succeed either way.
function removeElectronCrossOrigin(): Plugin {
  return {
    name: 'remove-electron-crossorigin',
    transformIndexHtml(html: string) {
      return html.replace(/\s+crossorigin(?:="[^"]*")?/gi, '');
    },
  };
}

// WEB=true  → build for a web server (base '/', crossorigin kept via not applying strip)
// WEB=false → build for Electron file:// (base './', crossorigin stripped)
const isWeb = process.env.WEB === 'true';

export default defineConfig({
  plugins: [
    react(),
    // Always strip — harmless for web served over HTTP (same-origin), required for Electron
    removeElectronCrossOrigin(),
  ],
  base: isWeb ? '/' : './',
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    // Disable polyfill only for Electron — it injects crossorigin fetch calls
    modulePreload: { polyfill: isWeb },
    outDir: isWeb ? 'dist-web' : 'dist',
  },
});
