import { describe, expect, test } from '@jest/globals';
import {
  CUSTOMER_CANCEL_STATUSES,
  mapRazorpayRefundEventStatus,
  VENDOR_CANCEL_STATUSES,
} from '../refund-status';

describe('refund-status helpers', () => {
  test('mapRazorpayRefundEventStatus maps processed to completed', () => {
    expect(mapRazorpayRefundEventStatus('processed')).toBe('completed');
  });

  test('mapRazorpayRefundEventStatus never returns processed', () => {
    expect(mapRazorpayRefundEventStatus('created')).toBe('processing');
    expect(mapRazorpayRefundEventStatus('failed')).toBe('failed');
  });

  test('CUSTOMER_CANCEL_STATUSES excludes processing', () => {
    expect(CUSTOMER_CANCEL_STATUSES).toEqual(['pending', 'confirmed']);
    expect(CUSTOMER_CANCEL_STATUSES).not.toContain('processing');
  });

  test('VENDOR_CANCEL_STATUSES includes processing', () => {
    expect(VENDOR_CANCEL_STATUSES).toContain('processing');
  });
});
