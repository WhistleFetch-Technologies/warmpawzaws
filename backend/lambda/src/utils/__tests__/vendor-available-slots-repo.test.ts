import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, test } from '@jest/globals';

const read = (rel: string) => readFileSync(join(__dirname, '../../endpoints/customer/discovery', rel), 'utf8');

describe('vendor-available-slots repo', () => {
  test('existing booking queries go through shared slot occupancy', () => {
    const source = read('repos/vendor-available-slots.repo.ts');
    expect(source).toContain('loadOccupyingBookings');
    expect(source).toContain('dbVendorAvailableSlots16');
    expect(source).toContain('dbVendorAvailableSlots28');
  });

  test('staff slot SQL lives in the repo, not the service', () => {
    const repo = read('repos/vendor-available-slots.repo.ts');
    const service = read('services/vendor-available-slots.service.ts');
    expect(repo).toContain('export async function dbStaffSlotsForDate');
    expect(repo).toContain('FROM staff_availability_slots sas');
    expect(service).not.toMatch(/FROM\s+staff_availability_slots/);
    expect(service).not.toContain('dbVendorAvailableSlots15');
  });

  test('missing serviceStyle defaults to clinic, not home visit', () => {
    const service = read('services/vendor-available-slots.service.ts');
    expect(service).not.toMatch(/query\('serviceStyle'\)\s*\|\|\s*'at_home'/);
    expect(service).toMatch(/:\s*'at_center';/);
  });
});
