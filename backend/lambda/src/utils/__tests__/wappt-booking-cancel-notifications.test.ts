import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const lambdaRoot = join(__dirname, '../../..');

function read(relativeFromLambdaRoot: string): string {
  return readFileSync(join(lambdaRoot, relativeFromLambdaRoot), 'utf8');
}

describe('WAPPT cancel notification wiring', () => {
  test('customer WAPPT cancel calls notifyBookingCancelled', () => {
    const file = read('src/endpoints/warmpawz-appointments/shared/wappt-booking-cancel.service.ts');
    expect(file).toContain('notifyBookingCancelled');
    expect(file).toContain('resolveBookingNotificationServiceName');
  });

  test('vendor WAPPT cancel calls notifyBookingCancelledByVendor', () => {
    const file = read('src/endpoints/vendor/endpoints/vendor-wappt-appointments.ts');
    expect(file).toContain('notifyBookingCancelledByVendor');
  });
});
