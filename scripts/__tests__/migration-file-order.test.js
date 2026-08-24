const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compareMigrationFilenames, sortMigrationFilenames } = require('../migration-file-order');

test('orders by numeric prefix then filename', () => {
  assert.ok(compareMigrationFilenames('1083_z.sql', '1083_a.sql') > 0);
  assert.deepEqual(
    sortMigrationFilenames([
      '1091_wappt_backfill_commerce_mode.sql',
      '1083_warmpawz_pay_phase1_schema.sql',
      '1083_add_search_taxonomy_walk_nutrition_keywords.sql',
      '1091_gst_walking_package_category_and_legacy_vs_unpublish.sql',
    ]),
    [
      '1083_add_search_taxonomy_walk_nutrition_keywords.sql',
      '1083_warmpawz_pay_phase1_schema.sql',
      '1091_gst_walking_package_category_and_legacy_vs_unpublish.sql',
      '1091_wappt_backfill_commerce_mode.sql',
    ],
  );
});
