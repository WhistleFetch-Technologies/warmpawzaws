import {
  acceptableAvailabilityStylesForSlot,
  normalizeAvailabilityServiceStyle,
  normalizeAvailabilityServiceStyles,
} from '../availability-service-styles';

describe('availability service style normalization', () => {
  it('normalizes home_visit aliases to at_home', () => {
    expect(normalizeAvailabilityServiceStyle('home_visit')).toBe('at_home');
    expect(normalizeAvailabilityServiceStyle('at home')).toBe('at_home');
    expect(normalizeAvailabilityServiceStyle('at_home_visit')).toBe('at_home');
  });

  it('normalizes style arrays and deduplicates aliases', () => {
    expect(normalizeAvailabilityServiceStyles(['home_visit', 'at_home', 'HOME'])).toEqual(['at_home']);
  });
});

describe('acceptable availability slot styles', () => {
  it('includes home_visit aliases for at_home filtering', () => {
    expect(acceptableAvailabilityStylesForSlot('at_home')).toEqual(
      expect.arrayContaining(['at_home', 'home_visit', 'home', 'at_home_visit'])
    );
  });

  it('keeps at_home and tele defaults backward compatible', () => {
    expect(acceptableAvailabilityStylesForSlot('at_home')).toEqual(
      expect.arrayContaining(['training', 'trainer', 'pet_training'])
    );
    expect(acceptableAvailabilityStylesForSlot('tele')).toEqual(
      expect.arrayContaining(['tele', 'online', 'video_consultation'])
    );
  });
});
