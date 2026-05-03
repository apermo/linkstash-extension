#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const releasesDir = join(repoRoot, 'releases');

const browserArg = process.argv.find((a) => a.startsWith('--browser='));
const browser = browserArg ? browserArg.split('=')[1] : 'chrome';
if (browser !== 'chrome' && browser !== 'firefox') {
  console.error(`--browser must be "chrome" or "firefox" (got "${browser}")`);
  process.exit(1);
}

const distDir = join(repoRoot, browser === 'firefox' ? 'dist-firefox' : 'dist');

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  console.error(`${distDir} does not exist — run \`npm run build:${browser}\` first.`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const version = pkg.version;
const suffix = browser === 'firefox' ? '-firefox' : '';
const zipName = `linkstash-extension${suffix}-v${version}.zip`;
const zipPath = join(releasesDir, zipName);

await mkdir(releasesDir, { recursive: true });

await new Promise((resolvePromise, rejectPromise) => {
  // Use the system `zip` so the produced archive matches the GitHub workflow's
  // output byte-for-byte, and store paths relative to dist/ (no leading dist/).
  const child = spawn('zip', ['-r', '-X', zipPath, '.'], {
    cwd: distDir,
    stdio: 'inherit',
  });
  child.on('exit', (code) =>
    code === 0 ? resolvePromise() : rejectPromise(new Error(`zip exited with code ${code}`)),
  );
  child.on('error', rejectPromise);
});

const size = (statSync(zipPath).size / 1024).toFixed(1);
const target = browser === 'firefox' ? 'AMO (addons.mozilla.org)' : 'the Chrome Web Store dev console';
console.log(`\n✓ Packaged ${zipName} (${size} KB) → ${zipPath}`);
console.log(`  Upload this to ${target}.`);
