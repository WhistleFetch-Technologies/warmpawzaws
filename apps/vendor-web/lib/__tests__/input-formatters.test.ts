import { filterDecimalInput, filterIntegerInput } from '../input-formatters';

describe('filterIntegerInput', () => {
  it('preserves empty string', () => {
    expect(filterIntegerInput('')).toBe('');
  });

  it('keeps digits only', () => {
    expect(filterIntegerInput('054')).toBe('054');
    expect(filterIntegerInput('abc12x3')).toBe('123');
  });

  it('strips minus and decimal', () => {
    expect(filterIntegerInput('-10.5')).toBe('105');
  });
});

describe('filterDecimalInput', () => {
  it('preserves empty string', () => {
    expect(filterDecimalInput('')).toBe('');
  });

  it('allows one decimal point', () => {
    expect(filterDecimalInput('12.34')).toBe('12.34');
    expect(filterDecimalInput('12.34.56')).toBe('12.34');
  });

  it('respects maxDecimals default 2', () => {
    expect(filterDecimalInput('12.3456')).toBe('12.34');
  });

  it('respects custom maxDecimals', () => {
    expect(filterDecimalInput('1.2345', 3)).toBe('1.234');
    expect(filterDecimalInput('10.99', 1)).toBe('10.9');
  });

  it('strips letters and minus', () => {
    expect(filterDecimalInput('-abc12.3x4')).toBe('12.34');
  });

  it('handles paste-like long strings', () => {
    expect(filterDecimalInput('999999999999.999999')).toBe('999999999999.99');
  });
});
