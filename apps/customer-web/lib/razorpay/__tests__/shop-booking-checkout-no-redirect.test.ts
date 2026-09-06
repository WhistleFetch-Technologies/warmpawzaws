/**
 * Pay Bill may pass callback_url + redirect. Shop and booking checkout must not.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../../..');

const shopAndBookingCheckoutFiles = [
  'lib/ecommerce/resume-shop-order-payment.ts',
  'components/customer/payment/PaymentPage.tsx',
  'components/customer/payment/EnhancedPaymentPage.tsx',
  'components/customer/payment/UniversalPaymentPage.tsx',
  'components/customer/PackageBookingPage.tsx',
];

describe('shop and booking Razorpay checkout stay handler-only', () => {
  it('does not pass callback_url or redirect: true', () => {
    for (const rel of shopAndBookingCheckoutFiles) {
      const source = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(source).not.toMatch(/callback_url/);
      expect(source).not.toMatch(/redirect:\s*true/);
    }
  });
});
