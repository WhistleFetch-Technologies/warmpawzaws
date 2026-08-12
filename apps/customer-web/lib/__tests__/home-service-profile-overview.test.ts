import { resolveHomeServiceProfileOverviewFields } from '../home-service-profile-overview';

describe('resolveHomeServiceProfileOverviewFields', () => {
  it('reads solo walker fields from customer vendor row', () => {
    const result = resolveHomeServiceProfileOverviewFields({
      merged: { description: 'Bio' },
      customerVendorRow: {
        qualifications: 'Certified dog walker',
        experienceYears: 4,
        specializations: ['30 Min Walk', 'Group Walk'],
      },
    });
    expect(result.qualifications).toBe('Certified dog walker');
    expect(result.experienceYears).toBe(4);
    expect(result.specializations).toEqual(['30 Min Walk', 'Group Walk']);
  });

  it('prefers merged facility specializations when present', () => {
    const result = resolveHomeServiceProfileOverviewFields({
      merged: { specializations: ['Park Visit'] },
      customerVendorRow: { specializations: ['30 Min Walk'] },
    });
    expect(result.specializations).toEqual(['Park Visit']);
  });

  it('maps experience_years snake_case from merged payload', () => {
    const result = resolveHomeServiceProfileOverviewFields({
      merged: { experience_years: 7 },
      customerVendorRow: null,
    });
    expect(result.experienceYears).toBe(7);
  });
});
