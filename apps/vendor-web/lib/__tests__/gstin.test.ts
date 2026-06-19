import { formatGSTIN, isValidGSTIN } from '../gstin';

describe('gstin helpers', () => {
  it('accepts valid GSTIN format', () => {
    expect(isValidGSTIN('27ABCDE1234F1ZK')).toBe(true);
    expect(isValidGSTIN('29ABCDE1234F2Z3')).toBe(true);
  });

  it('rejects invalid GSTIN format', () => {
    expect(isValidGSTIN('ABC')).toBe(false);
    expect(isValidGSTIN('27ABCDE1234F1Z')).toBe(false);
    expect(isValidGSTIN('')).toBe(false);
  });

  it('formats GSTIN input', () => {
    expect(formatGSTIN('27 abcde1234f1zk')).toBe('27ABCDE1234F1ZK');
    expect(formatGSTIN('27ABCDE1234F1ZK-extra')).toBe('27ABCDE1234F1ZK');
  });
});
