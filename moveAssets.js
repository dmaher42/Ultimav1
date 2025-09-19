// moveAssets.js
// Moves image assets from legacy locations into public/assets where the server can serve them.
//
// Sources scanned (if they exist):
//   ./assets/
//   ./ultima-lite/assets/
// Destination:
//   ./public/assets/   (subfolders preserved: sprites/, props/, backgrounds/, etc.)
//
// Usage:
//   node moveAssets.js            -> real move
//   DRY_RUN=1 node moveAssets.js  -> print what would happen, but do nothing

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const SRC_DIRS = [
  path.resolve('./assets'),
  path.resolve('./ultima-lite/assets'),
];
const DEST_ROOT = path.resolve('./public/assets');

const exts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);

let moved = 0;
let skipped = 0;
let missing = 0;

const DRY = !!process.env.DRY_RUN;

async function exists(p) {
  try { await fsp.access(p, fs.constants.F_OK); return true; }
  catch { return false; }
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function* walk(dir, baseDir) {
  // Depth-first generator that yields files with their relative path from baseDir
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(abs, baseDir);
    } else if (e.isFile()) {
      const rel = path.relative(baseDir, abs);
      yield { abs, rel };
    }
  }
}

async function moveOne(abs, rel) {
  const ext = path.extname(rel).toLowerCase();
  if (!exts.has(ext)) {
    // Non-image: skip silently
    return;
  }
  const dest = path.join(DEST_ROOT, rel); // preserve subfolders
  const destDir = path.dirname(dest);

  if (await exists(dest)) {
    console.log(`SKIP (exists): ${rel}`);
    skipped++;
    return;
  }

  if (DRY) {
    console.log(`[DRY] MOVE: ${rel}`);
    return;
  }

  await ensureDir(destDir);
  // Use rename if source and dest in same volume; fallback to copy+unlink if needed.
  try {
    await fsp.rename(abs, dest);
  } catch (e) {
    // Cross-device or other issue -> copy then unlink
    await fsp.copyFile(abs, dest);
    await fsp.unlink(abs);
  }
  console.log(`MOVED: ${rel}`);
  moved++;
}

async function run() {
  let foundAnySource = false;

  if (!(await exists(DEST_ROOT))) {
    await ensureDir(DEST_ROOT);
  }

  for (const src of SRC_DIRS) {
    if (!(await exists(src))) {
      missing++;
      continue;
    }
    foundAnySource = true;

    console.log(`\nScanning: ${path.relative(process.cwd(), src)}`);
    for await (const { abs, rel } of walk(src, src)) {
      await moveOne(abs, rel);
    }
  }

  if (!foundAnySource) {
    console.warn('\nNo source asset folders found. Checked: ./assets and ./ultima-lite/assets');
  }

  console.log('\n=== Summary ===');
  console.log(`Moved:   ${moved}`);
  console.log(`Skipped: ${skipped} (already in public/assets)`);
  console.log(`Missing source dirs: ${missing}`);
  console.log(`Destination root: ${path.relative(process.cwd(), DEST_ROOT)}`);
}

run().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
