import {
  formatIstBookingCompletedLine,
  formatIstBookingWhen,
  formatIstInstantDisplay,
} from '../ist-display-format';

describe('ist-display-format', () => {
  it('formats YYYY-MM-DD + HH:MM as IST wall clock', () => {
    expect(formatIstBookingWhen('2026-06-19', '18:30')).toBe('19 Jun 2026 at 6:30 PM');
  });

  it('formats ISO instant in Asia/Kolkata without throwing', () => {
    const out = formatIstInstantDisplay('2026-06-19T13:00:00.000Z');
    expect(out).toMatch(/Jun 2026/i);
    expect(out).not.toMatch(/GMT/i);
  });

  it('formats completed booking line', () => {
    const line = formatIstBookingCompletedLine('2026-06-19', '2026-06-19T13:00:00.000Z');
    expect(line).toContain('Completed');
    expect(line).not.toMatch(/GMT/i);
  });
});
