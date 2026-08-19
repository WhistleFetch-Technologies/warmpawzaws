import { isSelectedSlotStillAvailable, retainValidRestoredSlot } from '../guest-slot-revalidate';

describe('guest-slot-revalidate', () => {
  const slots = [
    { time: '17:00', available: true },
    { time: '18:00', available: false },
  ];

  it('keeps a still-available restored slot', () => {
    expect(isSelectedSlotStillAvailable('17:00', slots)).toBe(true);
    expect(retainValidRestoredSlot('17:00', slots)).toBe('17:00');
  });

  it('drops an unavailable or missing slot', () => {
    expect(isSelectedSlotStillAvailable('18:00', slots)).toBe(false);
    expect(retainValidRestoredSlot('18:00', slots)).toBe('');
    expect(retainValidRestoredSlot('21:00', slots)).toBe('');
  });
});
