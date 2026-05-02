#!/usr/bin/env node
import { createWriteStream, existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const distDir = join(repoRoot, 'dist');
const releasesDir = join(repoRoot, 'releases');

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  console.error('dist/ does not exist — run `npm run build` first.');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const version = pkg.version;
const zipName = `linkstash-extension-v${version}.zip`;
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
console.log(`\n✓ Packaged ${zipName} (${size} KB) → ${zipPath}`);
console.log('  Upload this to the Chrome Web Store dev console.');
