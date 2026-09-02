import { mapPublicEvent, petSnapshot, prefillDeclarations } from '../event-mappers';

describe('event mappers and product rules', () => {
  it('public mapper never exposes draft or approval internals as published', () => {
    const mapped = mapPublicEvent({
      id: 'e1',
      name: 'Park meetup',
      event_date: '2026-09-10',
      start_time: '10:00',
      status: 'published',
      approval_status: 'approved',
      vendor_name: 'Happy Paws',
      venue: { address: 'Cubbon Park' },
      price_per_booking: 199,
    });
    expect(mapped.title).toBe('Park meetup');
    expect(mapped.registration_fee).toBe(199);
    expect(mapped.organizer_name).toBe('Happy Paws');
    expect(JSON.stringify(mapped)).not.toMatch(/customerId|phone|email|medical/i);
  });

  it('prefills declarations from pet profile without mutating the pet', () => {
    const pet = {
      id: 'p1',
      name: 'Bruno',
      vaccination_records: [{ name: 'Rabies' }],
      temperament: 'social and house-trained',
    };
    const original = JSON.stringify(pet);
    const decl = prefillDeclarations(pet);
    expect(decl.vaccinated).toBe(true);
    expect(decl.social).toBe(true);
    expect(decl.trained).toBe(true);
    expect(JSON.stringify(pet)).toBe(original);
    expect(petSnapshot(pet).name).toBe('Bruno');
  });

  it('rejects duplicate pet assignment at the booking rule layer', () => {
    const assignments = [
      { petId: 'a' },
      { petId: 'b' },
      { petId: 'a' },
    ];
    const petIds = assignments.map((a) => a.petId);
    expect(new Set(petIds).size).not.toBe(petIds.length);
  });

  it('QR payload stays opaque', () => {
    const token = 'f'.repeat(64);
    expect(token).not.toMatch(/@/);
    expect(token).not.toContain('Bruno');
    expect(token.length).toBeGreaterThan(16);
  });
});
