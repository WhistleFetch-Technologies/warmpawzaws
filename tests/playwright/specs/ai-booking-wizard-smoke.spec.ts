/**
 * In-chat booking wizard — full E2E needs auth, migration 724, and seeded vendors.
 * Enable when running a dedicated env: set RUN_AI_BOOKING_E2E=1.
 */
import { test, expect } from '@playwright/test';

const run = process.env.RUN_AI_BOOKING_E2E === '1';

test.describe('AI booking wizard', () => {
  test.skip(!run, 'Set RUN_AI_BOOKING_E2E=1 to run (requires fixtures)');

  test('customer web home loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});
