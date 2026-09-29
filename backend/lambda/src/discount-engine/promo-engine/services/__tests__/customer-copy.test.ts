import { parseCustomerCopy, renderCustomerCopy, validateCustomerCopy } from '../../customer-copy';
import { buildCashbackCreditedMessage } from '../cashback-notification.service';

describe('promo customer copy', () => {
  it('parses known keys only and trims values', () => {
    expect(
      parseCustomerCopy({
        customerCopy: { earnLine: '  Get ₹{amount} back  ', junk: 'x', termsLine: '' },
      }),
    ).toEqual({ earnLine: 'Get ₹{amount} back' });
  });

  it('returns null when nothing configured', () => {
    expect(parseCustomerCopy({})).toBeNull();
    expect(parseCustomerCopy({ customerCopy: { earnLine: '   ' } })).toBeNull();
  });

  it('rejects unknown placeholders', () => {
    expect(validateCustomerCopy({ earnLine: 'Earn {amount} for {petName}' })).toEqual([
      'earnLine uses unknown placeholder {petName}',
    ]);
    expect(validateCustomerCopy({ earnLine: 'Earn ₹{amount}', redeemLine: 'Use {redeemLabel}' })).toEqual([]);
  });

  it('renders placeholders and drops missing ones cleanly', () => {
    expect(renderCustomerCopy('Earn ₹{amount} · valid {expiryDays} days', { amount: 150, expiryDays: 30 })).toBe(
      'Earn ₹150 · valid 30 days',
    );
    expect(renderCustomerCopy('Use it {redeemLabel} now', {})).toBe('Use it now');
  });
});

describe('buildCashbackCreditedMessage', () => {
  it('uses default wording with IST expiry date', () => {
    const msg = buildCashbackCreditedMessage({ amount: 150, expiresAt: '2026-10-29T10:00:00Z' });
    expect(msg.title).toBe('₹150 cashback credited!');
    expect(msg.message).toContain('Added to your Warmpawz Wallet');
    expect(msg.message).toContain('29 Oct 2026');
  });

  it('falls back to no-expiry wording', () => {
    const msg = buildCashbackCreditedMessage({ amount: 99.5 });
    expect(msg.title).toBe('₹99.50 cashback credited!');
    expect(msg.message).toBe('Added to your Warmpawz Wallet. Use it on your next payment.');
  });

  it('honours admin-configured copy', () => {
    const msg = buildCashbackCreditedMessage({
      amount: 200,
      expiryDays: 15,
      copy: { creditedTitle: 'Paw-some! ₹{amount} is yours', creditedBody: 'Spend within {expiryDays} days' },
    });
    expect(msg).toEqual({ title: 'Paw-some! ₹200 is yours', message: 'Spend within 15 days' });
  });
});
