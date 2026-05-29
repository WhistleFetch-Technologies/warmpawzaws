import {
  buildRewardCouponSmsMessage,
  isValidHttpUrl,
  isValidIndianMobile,
} from '../reward-coupon-sms';

describe('buildRewardCouponSmsMessage', () => {
  it('matches approved Jio DLT template (name + reward, no URL)', () => {
    const msg = buildRewardCouponSmsMessage({
      customerName: 'Bindushree Kumar',
      rewardName: 'Amazon Coupon',
    });
    expect(msg).toBe(
      'Warmpawz: Hi Bindushree, your Amazon Coupon coupon is ready. View it in the Rewards and Points section of the app.'
    );
  });

  it('uses fallback name when customer name missing', () => {
    const msg = buildRewardCouponSmsMessage({
      rewardName: 'Amazon Coupon',
    });
    expect(msg).toBe(
      'Warmpawz: Hi there, your Amazon Coupon coupon is ready. View it in the Rewards and Points section of the app.'
    );
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
