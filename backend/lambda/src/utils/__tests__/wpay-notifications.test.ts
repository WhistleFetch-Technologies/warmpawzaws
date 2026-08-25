import { describe, expect, test } from '@jest/globals';
import {
  buildWpayVendorNotifyMessage,
  type WpayVendorNotifyBreakdown,
} from '../wpay-notifications';

describe('buildWpayVendorNotifyMessage', () => {
  test('includes customer, paid amount, bill, discount, and vendor earnings', () => {
    const breakdown: WpayVendorNotifyBreakdown = {
      paymentId: 'pay-1',
      vendorId: 'vendor-1',
      customerId: 'cust-1',
      customerName: 'Ravi',
      quotedAmount: 1000,
      paidAmount: 850,
      discountAmount: 150,
      discountPercent: 15,
      platformWithholdPercent: 10,
      platformWithholdAmount: 85,
      vendorEarnings: 765,
    };

    const message = buildWpayVendorNotifyMessage(breakdown);

    expect(message).toContain('Ravi');
    expect(message).toContain('850.00');
    expect(message).toContain('1000.00');
    expect(message).toContain('15% off');
    expect(message).toContain('765.00');
  });
});

describe('wpay-notifications wiring', () => {
  test('verify service calls notifyWpayPaymentCompleted', () => {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const file = readFileSync(
      join(__dirname, '../../endpoints/customer/warmpawz-pay/services/customer_warmpawz_pay_verify_post.service.ts'),
      'utf8',
    );
    expect(file).toContain('notifyWpayPaymentCompleted');
    expect(file).toContain('tryNotifyWpayVendor');
  });
});
