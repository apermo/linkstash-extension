import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };
import pkg from './package.json' with { type: 'json' };

// Single source of truth for the version is package.json — keeps the dev
// console listing, the GitHub release tag, and the manifest in lockstep.
const versioned = { ...manifest, version: pkg.version };

export default defineConfig({
  plugins: [crx({ manifest: versioned })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'chrome116',
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5174,
    },
  },
});
