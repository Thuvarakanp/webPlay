import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// Strips `crossorigin` from built HTML — harmless for HTTP, required for Electron.
function removeElectronCrossOrigin(): Plugin {
  return {
    name: 'remove-electron-crossorigin',
    transformIndexHtml(html: string) {
      return html.replace(/\s+crossorigin(?:="[^"]*")?/gi, '');
    },
  };
}

export default defineConfig({
  plugins: [react(), removeElectronCrossOrigin()],
  base: '/',
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist-web',
    modulePreload: { polyfill: true },
  },
});
