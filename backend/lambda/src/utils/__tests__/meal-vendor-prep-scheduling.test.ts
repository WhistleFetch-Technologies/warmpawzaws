import {
  MEAL_PIDGE_DELIVERY_BUFFER_MIN,
  buildVendorPrepScheduling,
  parseScheduledDeliverySlot,
} from '@warmpawz/shared-types';

describe('buildVendorPrepScheduling', () => {
  const date = '2026-06-03';
  const slot = { start: '18:04', end: '18:04' };

  it('computes recommended_prepare_at for point slot (example: 16:49 for 45m prep + 30m buffer)', () => {
    const commitmentMs = new Date(`${date}T18:04:00`).getTime();
    const result = buildVendorPrepScheduling({
      scheduledDeliveryDate: date,
      scheduledDeliverySlot: slot,
      prepMinutes: 45,
      bufferMinutes: MEAL_PIDGE_DELIVERY_BUFFER_MIN,
      nowMs: new Date(`${date}T17:00:00`).getTime(),
    });

    expect(result.commitment_at_ms).toBe(commitmentMs);
    expect(result.prep_minutes).toBe(45);
    expect(result.buffer_minutes).toBe(30);
    expect(result.recommended_prepare_at_ms).toBe(
      commitmentMs - 45 * 60_000 - 30 * 60_000,
    );
    const recommended = new Date(result.recommended_prepare_at_ms!);
    expect(recommended.getHours()).toBe(16);
    expect(recommended.getMinutes()).toBe(49);
    expect(result.isEarlyPrep).toBe(false);
  });

  it('flags isEarlyPrep when now is before recommended_prepare_at', () => {
    const result = buildVendorPrepScheduling({
      scheduledDeliveryDate: date,
      scheduledDeliverySlot: slot,
      prepMinutes: 45,
      nowMs: new Date(`${date}T15:00:00`).getTime(),
    });
    expect(result.isEarlyPrep).toBe(true);
  });

  it('uses window slot end for commitment', () => {
    const windowSlot = { start: '09:00', end: '12:00' };
    const result = buildVendorPrepScheduling({
      scheduledDeliveryDate: date,
      scheduledDeliverySlot: windowSlot,
      prepMinutes: 30,
      nowMs: new Date(`${date}T08:00:00`).getTime(),
    });
    expect(result.commitment_at_ms).toBe(new Date(`${date}T12:00:00`).getTime());
    expect(result.recommended_prepare_at_ms).toBe(
      new Date(`${date}T12:00:00`).getTime() - 30 * 60_000 - MEAL_PIDGE_DELIVERY_BUFFER_MIN * 60_000,
    );
  });

  it('expected_ready_before_start = recommended + prep_minutes', () => {
    const result = buildVendorPrepScheduling({
      scheduledDeliveryDate: date,
      scheduledDeliverySlot: slot,
      prepMinutes: 45,
    });
    expect(result.expected_ready_before_start_ms).toBe(
      (result.recommended_prepare_at_ms ?? 0) + 45 * 60_000,
    );
  });

  it('returns null scheduling when slot missing', () => {
    const result = buildVendorPrepScheduling({
      scheduledDeliveryDate: date,
      scheduledDeliverySlot: null,
      prepMinutes: 30,
    });
    expect(result.commitment_at_ms).toBeNull();
    expect(result.recommended_prepare_at_ms).toBeNull();
    expect(result.isEarlyPrep).toBe(false);
  });
});

describe('parseScheduledDeliverySlot (shared)', () => {
  it('parses JSON string window', () => {
    expect(parseScheduledDeliverySlot('{"start":"10:30","end":"11:00"}')).toEqual({
      start: '10:30',
      end: '11:00',
    });
  });
});
