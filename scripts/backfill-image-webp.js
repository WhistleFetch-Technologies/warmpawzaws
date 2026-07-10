#!/usr/bin/env node
/**
 * Phase 3: backfill legacy image keys to WebP (run after migration 1067 + Lambda deploy).
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/backfill-image-webp.js --dry-run
 *   ENVIRONMENT=dev node scripts/backfill-image-webp.js --limit 100
 *
 * Requires: AWS credentials, RDS access (same as run-migration-rds-node.js).
 */

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit'));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1] || process.argv[process.argv.indexOf('--limit') + 1], 10) : 500;

async function main() {
  console.log(`[backfill-image-webp] dryRun=${DRY_RUN} limit=${LIMIT}`);
  console.log(
    'Not yet wired to ImageMigrator — deploy Lambda with image pipeline first, then extend this script.',
  );
  console.log('Tables/columns to scan: customers.profile_photo_url, pets.profile_photo_url,');
  console.log('products.images, vendors.metadata.facility_photos, banners.image_url');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
