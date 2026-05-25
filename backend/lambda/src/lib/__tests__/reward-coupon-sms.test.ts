import {
  buildRewardCouponSmsMessage,
  isValidHttpUrl,
  isValidIndianMobile,
} from '../reward-coupon-sms';

describe('buildRewardCouponSmsMessage', () => {
  it('includes customer first name, reward name, and link', () => {
    const msg = buildRewardCouponSmsMessage({
      customerName: 'Bindushree Kumar',
      rewardName: 'Amazon Coupon',
      link: 'https://amazon.in/redeem/abc',
    });
    expect(msg).toContain('Warmpawz: Hi Bindushree');
    expect(msg).toContain('Amazon Coupon');
    expect(msg).toContain('https://amazon.in/redeem/abc');
  });

  it('uses fallback name when customer name missing', () => {
    const msg = buildRewardCouponSmsMessage({
      rewardName: 'Amazon Coupon',
      link: 'https://example.com/c',
    });
    expect(msg.startsWith('Warmpawz: Hi there,')).toBe(true);
  });
});

describe('isValidHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isValidHttpUrl('https://a.com/x')).toBe(true);
    expect(isValidHttpUrl('http://a.com/x')).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(isValidHttpUrl('not-a-url')).toBe(false);
  });
});

describe('isValidIndianMobile', () => {
  it('accepts 10-digit and +91 numbers', () => {
    expect(isValidIndianMobile('9876543210')).toBe(true);
    expect(isValidIndianMobile('+919876543210')).toBe(true);
  });

  it('rejects too short numbers', () => {
    expect(isValidIndianMobile('12345')).toBe(false);
  });
});
