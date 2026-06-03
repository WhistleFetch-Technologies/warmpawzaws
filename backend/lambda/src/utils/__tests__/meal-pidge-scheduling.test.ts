import {
  buildMealPidgeSchedulingFields,
  formatPidgeDeliveryDate,
  formatPidgeDeliverySlot,
  MEAL_PIDGE_DELIVERY_BUFFER_MIN,
  parseScheduledDeliverySlot,
  resolvePromisedDeliveryTimeIso,
} from '../meal-pidge-scheduling';

describe('parseScheduledDeliverySlot', () => {
  it('parses point slot JSON', () => {
    expect(parseScheduledDeliverySlot({ start: '18:04', end: '18:04' })).toEqual({
      start: '18:04',
      end: '18:04',
    });
  });

  it('parses window slot JSON', () => {
    expect(parseScheduledDeliverySlot({ start: '09:00', end: '12:00' })).toEqual({
      start: '09:00',
      end: '12:00',
    });
  });

  it('parses JSON string', () => {
    expect(parseScheduledDeliverySlot('{"start":"10:30","end":"11:00"}')).toEqual({
      start: '10:30',
      end: '11:00',
    });
  });
});

describe('formatPidgeDeliverySlot', () => {
  it('formats point slot as single time', () => {
    expect(
      formatPidgeDeliverySlot({ start: '18:04', end: '18:04' }),
    ).toBe('18:04');
  });

  it('formats window slot with separator', () => {
    expect(
      formatPidgeDeliverySlot({ start: '09:00', end: '12:00' }),
    ).toBe('09:00 - 12:00');
  });
});

describe('formatPidgeDeliveryDate', () => {
  it('maps ISO date prefix', () => {
    expect(formatPidgeDeliveryDate('2026-06-03T00:00:00.000Z')).toBe('2026-06-03');
  });

  it('maps plain YMD', () => {
    expect(formatPidgeDeliveryDate('2026-06-03')).toBe('2026-06-03');
  });
});

describe('resolvePromisedDeliveryTimeIso', () => {
  const expectedReady = '2026-06-03T14:00:00.000Z';

  it('uses operational floor when no commitment', () => {
    const out = resolvePromisedDeliveryTimeIso({ expectedReadyAtIso: expectedReady });
    const expectedMs =
      new Date(expectedReady).getTime() + MEAL_PIDGE_DELIVERY_BUFFER_MIN * 60_000;
    expect(new Date(out).getTime()).toBe(expectedMs);
  });

  it('never promises before expected_ready + buffer when commitment is earlier', () => {
    const out = resolvePromisedDeliveryTimeIso({
      expectedReadyAtIso: expectedReady,
      scheduledDeliveryDate: '2026-06-03',
      scheduledDeliverySlot: { start: '10:00', end: '10:00' },
    });
    const operationalMs =
      new Date(expectedReady).getTime() + MEAL_PIDGE_DELIVERY_BUFFER_MIN * 60_000;
    expect(new Date(out).getTime()).toBeGreaterThanOrEqual(operationalMs);
  });

  it('extends promise toward customer commitment when commitment is later', () => {
    const out = resolvePromisedDeliveryTimeIso({
      expectedReadyAtIso: '2026-06-03T10:00:00.000Z',
      scheduledDeliveryDate: '2026-06-03',
      scheduledDeliverySlot: { start: '18:04', end: '18:04' },
    });
    const commitmentMs = new Date('2026-06-03T18:04:00').getTime();
    expect(new Date(out).getTime()).toBe(commitmentMs);
  });
});

describe('buildMealPidgeSchedulingFields', () => {
  it('maps delivery_date and delivery_slot for point order', () => {
    const fields = buildMealPidgeSchedulingFields({
      expectedReadyAtIso: '2026-06-03T16:00:00.000Z',
      scheduledDeliveryDate: '2026-06-03',
      scheduledDeliverySlot: { start: '18:04', end: '18:04' },
    });
    expect(fields.delivery_date).toBe('2026-06-03');
    expect(fields.delivery_slot).toBe('18:04');
    expect(fields.promised_delivery_time).toBeTruthy();
  });

  it('maps window slot', () => {
    const fields = buildMealPidgeSchedulingFields({
      expectedReadyAtIso: '2026-06-03T08:00:00.000Z',
      scheduledDeliveryDate: '2026-06-03',
      scheduledDeliverySlot: { start: '09:00', end: '12:00' },
    });
    expect(fields.delivery_slot).toBe('09:00 - 12:00');
  });
});
