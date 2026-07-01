import { describe, expect, test } from '@jest/globals';
import {
  enrichTemplateDataWithIstDisplay,
  formatIstBookingWhen,
  formatIstDateDisplay,
  formatIstTimeDisplay,
} from '../notification-display-format';

describe('notification-display-format', () => {
  test('formatIstDateDisplay formats YYYY-MM-DD', () => {
    expect(formatIstDateDisplay('2026-06-19')).toMatch(/19.*Jun.*2026/);
  });

  test('formatIstTimeDisplay formats 24h to 12h PM', () => {
    expect(formatIstTimeDisplay('18:30')).toBe('6:30 PM');
  });

  test('formatIstTimeDisplay formats morning AM', () => {
    expect(formatIstTimeDisplay('09:15')).toBe('9:15 AM');
  });

  test('formatIstBookingWhen combines date and time', () => {
    const out = formatIstBookingWhen('2026-06-19', '18:30');
    expect(out).toContain('6:30 PM');
    expect(out).toContain(' at ');
  });

  test('enrichTemplateDataWithIstDisplay formats template keys', () => {
    const enriched = enrichTemplateDataWithIstDisplay({
      date: '2026-06-19',
      time: '18:30',
      vendorName: 'Test Vet',
    });
    expect(enriched.date).toMatch(/Jun/);
    expect(enriched.time).toBe('6:30 PM');
    expect(String(enriched.bookingDateTime)).toContain('6:30 PM');
    expect(enriched.date_raw).toBe('2026-06-19');
  });
});
