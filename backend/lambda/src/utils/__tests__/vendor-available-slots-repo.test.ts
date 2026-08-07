import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, test } from '@jest/globals';

describe('vendor-available-slots repo', () => {
  test('uses SQL_BOOKING_BLOCKS_SLOT for existing booking queries', () => {
    const repoPath = join(
      __dirname,
      '../../endpoints/customer/discovery/repos/vendor-available-slots.repo.ts'
    );
    const source = readFileSync(repoPath, 'utf8');
    expect(source).toContain('SQL_BOOKING_BLOCKS_SLOT');
    expect(source).toContain('dbVendorAvailableSlots16');
    expect(source).toContain('dbVendorAvailableSlots28');
  });
});
