import { toDatetimeLocalIst } from '../promo-engine/datetime';

describe('toDatetimeLocalIst', () => {
  it('converts UTC ISO Z to an IST datetime-local clock time', () => {
    expect(toDatetimeLocalIst('2026-09-17T11:59:00.000Z')).toBe('2026-09-17T17:29');
  });

  it('keeps a picker value that is already local', () => {
    expect(toDatetimeLocalIst('2026-09-17T17:29')).toBe('2026-09-17T17:29');
  });

  it('returns empty for blank so a cleared field stays empty', () => {
    expect(toDatetimeLocalIst('')).toBe('');
    expect(toDatetimeLocalIst(null)).toBe('');
  });
});
