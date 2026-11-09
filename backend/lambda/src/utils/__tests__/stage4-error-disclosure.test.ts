/**
 * Stage 4 — Priority 1/2 client error disclosure hygiene.
 */
import { SAFE_INTERNAL_ERROR_MESSAGE } from '../safe-hono-error';
import fs from 'fs';
import path from 'path';

const srcRoot = path.join(__dirname, '../..');

function read(rel: string) {
  return fs.readFileSync(path.join(srcRoot, rel), 'utf8');
}

const priorityFiles = [
  'endpoints/pharmacy-orders.ts',
  'endpoints/orders/endpoint/pharmacy-orders.ts',
  'endpoints/payments-enhanced.ts',
  'endpoints/storage.ts',
  'endpoints/staff.ts',
  'endpoints/vendor-schedule.ts',
  'endpoints/vendor/endpoints/vendor-schedule.ts',
  'endpoints/vendor/endpoints/vendor-profile.vendor.ts',
  'endpoints/vendor/endpoints/vendorProfile.vendor.ts',
  'endpoints/vendor-services.ts',
  'endpoints/vendor/endpoints/vendor-services.ts',
  'endpoints/vendor/endpoints/vendorServices.vendor.ts',
  'endpoints/specialized-services.ts',
  'endpoints/supportCrm/endpoint/support-crm.ts',
  'endpoints/ecommerce/endpoints/ecommerce.ts',
  'endpoints/ecommerce.ts',
  'endpoints/promotions.ts',
  'endpoints/meal-plans.ts',
  'endpoints/events.ts',
  'endpoints/push-notifications.ts',
];

describe('Stage 4 Priority modules — no raw 500 error.message to clients', () => {
  it.each(priorityFiles)('%s does not return c.json({ error: error.message }, 500)', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/return c\.json\(\{\s*error:\s*error\.message\s*\},\s*500\)/);
    expect(src).not.toMatch(
      /return c\.json\(\{\s*success:\s*false,\s*error:\s*error\.message\s*\},\s*500\)/,
    );
  });

  it('pharmacy-orders twin files import SAFE_INTERNAL_ERROR_MESSAGE', () => {
    for (const rel of [
      'endpoints/pharmacy-orders.ts',
      'endpoints/orders/endpoint/pharmacy-orders.ts',
    ]) {
      expect(read(rel)).toMatch(/SAFE_INTERNAL_ERROR_MESSAGE/);
      expect(read(rel)).toMatch(/from ['"].*safe-hono-error['"]/);
    }
  });

  it('storage preserves ImageProcessingError intentional client messages', () => {
    const src = read('endpoints/storage.ts');
    expect(src).toMatch(/if \(error instanceof ImageProcessingError\)/);
    expect(src).toMatch(
      /return c\.json\(\{\s*error:\s*error\.message\s*\},\s*error\.statusCode/,
    );
  });

  it('payments-enhanced unexpected failures use SAFE_INTERNAL_ERROR_MESSAGE', () => {
    const src = read('endpoints/payments-enhanced.ts');
    expect(src).toMatch(/this\.error\(SAFE_INTERNAL_ERROR_MESSAGE,\s*500/);
    expect(src).toMatch(/return c\.json\(\{\s*error:\s*SAFE_INTERNAL_ERROR_MESSAGE\s*\},\s*500\)/);
  });

  it('unified profile degraded path does not echo exception message', () => {
    const src = read(
      'endpoints/customer/profile/services/customer_profile_unified_identifier_get.service.ts',
    );
    expect(src).not.toMatch(/_degraded:\s*true,\s*error:\s*error\?\.message/);
    expect(src).toMatch(/Profile temporarily unavailable|Temporarily unavailable/);
    expect(src).not.toMatch(/SAFE_INTERNAL_ERROR_MESSAGE/);
  });

  it('specialized-services kitchen catches do not return raw exception msg', () => {
    const src = read('endpoints/specialized-services.ts');
    // Previous unsafe pattern: const msg = error.message; return c.json({ error: msg }, 500)
    expect(src).not.toMatch(
      /Failed to load kitchen status[\s\S]{0,80}return c\.json\(\{\s*success:\s*false,\s*error:\s*msg\s*\},\s*500\)/,
    );
    expect(src).not.toMatch(
      /Failed to update kitchen status[\s\S]{0,80}return c\.json\(\{\s*success:\s*false,\s*error:\s*msg\s*\},\s*500\)/,
    );
    expect(src).toMatch(
      /Error loading meal kitchen availability[\s\S]{0,120}SAFE_INTERNAL_ERROR_MESSAGE/,
    );
    expect(src).toMatch(
      /Error updating meal kitchen availability[\s\S]{0,120}SAFE_INTERNAL_ERROR_MESSAGE/,
    );
  });

  it('support-crm agent fallback does not return fallbackError.message', () => {
    const src = read('endpoints/supportCrm/endpoint/support-crm.ts');
    expect(src).not.toMatch(
      /fallbackError\.message\s*\|\|\s*['"]Failed to save agent['"]/,
    );
    expect(src).toMatch(
      /Error saving support agent \(fallback\)[\s\S]{0,120}SAFE_INTERNAL_ERROR_MESSAGE/,
    );
  });

  it('SAFE_INTERNAL_ERROR_MESSAGE remains generic', () => {
    expect(SAFE_INTERNAL_ERROR_MESSAGE).toBe('Internal Server Error');
    expect(SAFE_INTERNAL_ERROR_MESSAGE).not.toMatch(/SQL|relation|column|stack/i);
  });
});
