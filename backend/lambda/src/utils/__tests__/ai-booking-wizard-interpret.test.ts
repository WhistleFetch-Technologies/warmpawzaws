import { interpretActionsToPatch, parseInterpretActionsFromModelJson } from '../ai/ai-booking-wizard-interpret';

describe('ai-booking-wizard-interpret', () => {
  it('parses allowlisted actions and drops unknown types', () => {
    const raw = `{"actions":[
      {"type":"setBookingDate","bookingDate":"2026-04-20"},
      {"type":"setSlotTime","slotTime":"11:30"},
      {"type":"evil","x":1}
    ]}`;
    const actions = parseInterpretActionsFromModelJson(raw);
    expect(actions.map((a) => a.type)).toEqual(['setBookingDate', 'setSlotTime']);
  });

  it('maps actions to patch fields', () => {
    const patch = interpretActionsToPatch([
      { type: 'setCategory', category: 'grooming' },
      { type: 'setTotalDuration', totalDuration: 45 },
    ] as any);
    expect(patch.category).toBe('grooming');
    expect(patch.total_duration).toBe(45);
  });
});
