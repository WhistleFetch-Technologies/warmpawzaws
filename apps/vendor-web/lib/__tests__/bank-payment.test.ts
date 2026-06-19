import {
  formatAccountNumber,
  formatIFSC,
  formatUPI,
  isMaskedAccountNumber,
  isValidAccountNumber,
  isValidIFSC,
  isValidUPI,
  looksLikeIndianPhone,
} from '../bank-payment';

describe('bank-payment helpers', () => {
  it('validates IFSC format', () => {
    expect(isValidIFSC('SBIN0001234')).toBe(true);
    expect(isValidIFSC('ABC')).toBe(false);
    expect(isValidIFSC('7984887206')).toBe(false);
  });

  it('formats IFSC input', () => {
    expect(formatIFSC('sbin0001234')).toBe('SBIN0001234');
    expect(formatIFSC('SBIN00012345')).toBe('SBIN0001234');
  });

  it('validates account numbers', () => {
    expect(isValidAccountNumber('123456789')).toBe(true);
    expect(isValidAccountNumber('123')).toBe(false);
    expect(isValidAccountNumber('****1234')).toBe(false);
  });

  it('detects masked account numbers', () => {
    expect(isMaskedAccountNumber('****1234')).toBe(true);
    expect(isMaskedAccountNumber('1234567890')).toBe(false);
  });

  it('validates UPI format', () => {
    expect(isValidUPI('name@upi')).toBe(true);
    expect(isValidUPI('bad')).toBe(false);
  });

  it('formats account and UPI', () => {
    expect(formatAccountNumber('12-34-567890')).toBe('1234567890');
    expect(formatUPI('  name@upi ')).toBe('name@upi');
  });

  it('detects phone-shaped IFSC values', () => {
    expect(looksLikeIndianPhone('7984887206')).toBe(true);
    expect(looksLikeIndianPhone('SBIN0001234')).toBe(false);
  });
});
