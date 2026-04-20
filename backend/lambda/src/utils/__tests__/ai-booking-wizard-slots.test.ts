import {
  extractSlotsFromApiPayload,
  isSlotTimeAvailable,
  normalizeSlotTime,
  parseSlotsSnapshotJson,
} from '../ai-booking-wizard-slots';

describe('ai-booking-wizard-slots', () => {
  it('normalizes slot times for comparison', () => {
    expect(normalizeSlotTime('9:05')).toBe('09:05');
    expect(normalizeSlotTime('09:05:00')).toBe('09:05:00');
  });

  it('extracts slots array from API payload', () => {
    const slots = extractSlotsFromApiPayload({
      success: true,
      slots: [
        { time: '10:00', available: true },
        { time: '10:30', available: false },
      ],
    });
    expect(slots).toHaveLength(2);
  });

  it('detects available slot by normalized time', () => {
    const ok = isSlotTimeAvailable('10:00', [{ time: '10:00:00', available: true }]);
    expect(ok).toBe(true);
    const bad = isSlotTimeAvailable('11:00', [{ time: '10:00', available: true }]);
    expect(bad).toBe(false);
  });

  it('parses snapshot JSON string', () => {
    const s = JSON.stringify({ slots: [{ time: '14:00', available: true }] });
    const rows = parseSlotsSnapshotJson(s);
    expect(isSlotTimeAvailable('14:00', rows)).toBe(true);
  });
});
