/*
  Prepare a CodeCanyon-ready folder without secrets, build artifacts, or VCS.
  Usage: node scripts/prepare-codecanyon.js
*/

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'dist', 'codecanyon', 'sharkszone');
const INCLUDE = [
  'src',
  'public',
  'docs',
  'SQL _CODE',
  'next.config.js',
  'next.config.mjs',
  'package.json',
  'README.BUYER.md',
  '.env.example',
  'vercel.json'
];
const EXCLUDE = new Set([
  'node_modules', '.next', '.git', '.github', 'dist', 'coverage',
  '.env.local', '.env', '.env.production', '.DS_Store', 'pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'
]);

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function copyItem(srcPath, destPath) {
  const stat = await fsp.lstat(srcPath);
  if (stat.isDirectory()) {
    if (EXCLUDE.has(path.basename(srcPath))) return;
    await ensureDir(destPath);
    const items = await fsp.readdir(srcPath);
    for (const item of items) {
      if (EXCLUDE.has(item)) continue;
      await copyItem(path.join(srcPath, item), path.join(destPath, item));
    }
  } else if (stat.isFile()) {
    await ensureDir(path.dirname(destPath));
    await fsp.copyFile(srcPath, destPath);
  }
}

async function main() {
  await ensureDir(OUT_DIR);
  for (const item of INCLUDE) {
    const src = path.join(ROOT, item);
    if (!fs.existsSync(src)) continue;
    const destName = item === 'SQL _CODE' ? 'sql' : item; // rename folder
    const dest = path.join(OUT_DIR, destName);
    await copyItem(src, dest);
  }
  console.log(`[prepare-codecanyon] Done -> ${OUT_DIR}`);
  console.log('Zip the folder manually to upload to CodeCanyon.');
}

main().catch((e) => {
  console.error('[prepare-codecanyon] Failed:', e);
  process.exit(1);
});
