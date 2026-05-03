import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };
import pkg from './package.json' with { type: 'json' };
import { applyBrowserOverlay, isBrowser, outDirFor } from './scripts/manifest-overlay';

const requested = process.env.BROWSER ?? 'chrome';
if (!isBrowser(requested)) {
  throw new Error(`BROWSER must be "chrome" or "firefox" (got "${requested}")`);
}
const browser = requested;

// Single source of truth for the version is package.json — keeps the dev
// console listing, the GitHub release tag, and the manifest in lockstep.
const versioned = applyBrowserOverlay({ ...manifest, version: pkg.version }, browser);

export default defineConfig({
  // CRXJS infers the manifest type from the imported JSON; the overlay returns
  // a plain Record, so cast at the boundary rather than threading generics.
  plugins: [crx({ manifest: versioned as typeof manifest })],
  build: {
    outDir: outDirFor(browser),
    emptyOutDir: true,
    sourcemap: true,
    target: browser === 'firefox' ? 'firefox121' : 'chrome116',
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5174,
    },
  },
});
