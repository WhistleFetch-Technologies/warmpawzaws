import { isPetProfileComplete } from '../pet-profile-completeness';

const completePet = {
  name: 'Bruno',
  species: 'dog',
  breed: 'Indie',
  gender: 'male',
  profile_photo_url: 'https://example.com/bruno.jpg',
  medical_history: { dob: '2022-01-15' },
};

describe('isPetProfileComplete', () => {
  it('returns true for a full required profile', () => {
    expect(isPetProfileComplete(completePet)).toBe(true);
  });

  it('returns false for null or empty', () => {
    expect(isPetProfileComplete(null)).toBe(false);
    expect(isPetProfileComplete(undefined)).toBe(false);
    expect(isPetProfileComplete({})).toBe(false);
  });

  it('rejects onboarding placeholder name', () => {
    expect(isPetProfileComplete({ ...completePet, name: 'My Pet' })).toBe(false);
  });

  it('rejects missing photo', () => {
    expect(
      isPetProfileComplete({ ...completePet, profile_photo_url: null })
    ).toBe(false);
  });

  it('rejects missing breed', () => {
    expect(isPetProfileComplete({ ...completePet, breed: '' })).toBe(false);
  });

  it('rejects missing gender', () => {
    expect(isPetProfileComplete({ ...completePet, gender: null })).toBe(false);
  });

  it('rejects missing dob and age', () => {
    expect(
      isPetProfileComplete({ ...completePet, medical_history: {} })
    ).toBe(false);
  });

  it('accepts age_years when dob is missing', () => {
    expect(
      isPetProfileComplete({
        ...completePet,
        medical_history: {},
        age_years: 2,
      })
    ).toBe(true);
  });

  it('accepts photo field alias', () => {
    const { profile_photo_url: _omit, ...rest } = completePet;
    expect(isPetProfileComplete({ ...rest, photo: 'https://cdn/p.jpg' })).toBe(
      true
    );
  });

  it('does not require vaccinations', () => {
    expect(
      isPetProfileComplete({
        ...completePet,
        medical_history: { dob: '2022-01-15', vaccinations: [] },
      })
    ).toBe(true);
  });
});
