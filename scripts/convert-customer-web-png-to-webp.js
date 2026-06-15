/**
 * Convert customer-web public PNG assets to WebP (same basename, same directory).
 * Usage: node scripts/convert-customer-web-png-to-webp.js
 * Requires: npm install sharp (run from apps/customer-web or repo root with sharp available)
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(REPO_ROOT, 'apps/customer-web/public');
const WEBP_QUALITY = 82;

async function main() {
  let sharp;
  try {
    sharp = require(path.join(REPO_ROOT, 'apps/customer-web/node_modules/sharp'));
  } catch {
    sharp = require('sharp');
  }

  const converted = [];

  async function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!ent.name.toLowerCase().endsWith('.png')) continue;

      const webpPath = full.replace(/\.png$/i, '.webp');
      const before = fs.statSync(full).size;

      await sharp(full)
        .webp({ quality: WEBP_QUALITY, effort: 6, smartSubsample: true })
        .toFile(webpPath);

      const after = fs.statSync(webpPath).size;
      fs.unlinkSync(full);
      converted.push({
        rel: path.relative(REPO_ROOT, full),
        webp: path.relative(REPO_ROOT, webpPath),
        before,
        after,
        savedPct: before ? Math.round((1 - after / before) * 100) : 0,
      });
    }
  }

  await walk(PUBLIC_DIR);

  console.log(`Converted ${converted.length} PNG files under apps/customer-web/public`);
  const totalBefore = converted.reduce((s, c) => s + c.before, 0);
  const totalAfter = converted.reduce((s, c) => s + c.after, 0);
  console.log(
    `Size: ${(totalBefore / 1024 / 1024).toFixed(2)} MB -> ${(totalAfter / 1024 / 1024).toFixed(2)} MB (${totalBefore ? Math.round((1 - totalAfter / totalBefore) * 100) : 0}% saved)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
