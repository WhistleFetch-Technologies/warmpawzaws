import {
  CUSTOM_VACCINE_KEY_PREFIX,
  mergeVaccinationArrayForUpdate,
  sanitizeVaccinationsForCreate,
  stripVaccinationImagesFromHistory,
  stripVaccinationImagesFromValue,
} from '../pet-vaccination-image';

describe('sanitizeVaccinationsForCreate', () => {
  it('keeps catalogue keys and a single imageKey, dropping imageUrl', () => {
    const rows = sanitizeVaccinationsForCreate([
      {
        name: 'Rabies Vaccine',
        date: '2025-06-03',
        vaccineKey: 'dog:rabies',
        imageKey: 'media/pet/abc-vax-1/avatar_1.webp',
        imageUrl: 'https://bucket.s3.amazonaws.com/media/pet/abc-vax-1/avatar_1.webp?X-Amz-Algorithm=AWS4',
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].vaccineKey).toBe('dog:rabies');
    expect(rows[0].imageKey).toBe('media/pet/abc-vax-1/avatar_1.webp');
    expect(rows[0].imageUrl).toBeUndefined();
    expect(rows[0].id).toEqual(expect.stringMatching(/^vax_/));
  });

  it('assigns a custom key when the client sends Other without a key', () => {
    const rows = sanitizeVaccinationsForCreate([{ name: 'Kennel cough booster', date: '2025-05-01' }]);
    expect(rows[0].name).toBe('Kennel cough booster');
    expect(String(rows[0].vaccineKey)).toMatch(new RegExp(`^${CUSTOM_VACCINE_KEY_PREFIX}`));
  });
});

describe('mergeVaccinationArrayForUpdate', () => {
  const existing = [
    {
      id: 'vax_saved',
      name: 'Rabies Vaccine',
      date: '2024-01-01',
      vaccineKey: 'dog:rabies',
      imageKey: 'media/pet/p1-vax-saved/avatar.webp',
    },
  ];

  it('updates dates on saved rows and appends newly added vaccines', () => {
    const merged = mergeVaccinationArrayForUpdate(existing, [
      { id: 'vax_saved', name: 'Rabies Vaccine', date: '2025-06-03', vaccineKey: 'dog:rabies' },
      { name: 'Leptospirosis Vaccine', date: '2025-08-15', vaccineKey: 'dog:leptospirosis' },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].date).toBe('2025-06-03');
    expect(merged[0].imageKey).toBe('media/pet/p1-vax-saved/avatar.webp');
    expect(merged[1].vaccineKey).toBe('dog:leptospirosis');
    expect(merged[1].date).toBe('2025-08-15');
  });

  it('clears a certificate when imageKey is sent empty', () => {
    const merged = mergeVaccinationArrayForUpdate(existing, [
      { id: 'vax_saved', name: 'Rabies Vaccine', date: '2024-01-01', vaccineKey: 'dog:rabies', imageKey: '' },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].imageKey).toBeUndefined();
  });

  it('replaces a certificate when a new imageKey is sent', () => {
    const merged = mergeVaccinationArrayForUpdate(existing, [
      {
        id: 'vax_saved',
        name: 'Rabies Vaccine',
        date: '2024-01-01',
        vaccineKey: 'dog:rabies',
        imageKey: 'media/pet/p1-vax-saved/avatar_new.webp',
      },
    ]);
    expect(merged[0].imageKey).toBe('media/pet/p1-vax-saved/avatar_new.webp');
  });
});

describe('stripVaccinationImagesFromHistory', () => {
  it('removes imageKey and imageUrl from nested vaccinations', () => {
    const stripped = stripVaccinationImagesFromHistory({
      dob: '2024-01-01',
      vaccinations: [
        {
          name: 'Rabies Vaccine',
          date: '2025-06-03',
          imageKey: 'media/pet/secret.webp',
          imageUrl: 'https://example.com/secret.webp',
        },
      ],
    });
    const row = (stripped.vaccinations as Record<string, unknown>[])[0];
    expect(stripped.dob).toBe('2024-01-01');
    expect(row.name).toBe('Rabies Vaccine');
    expect(row.imageKey).toBeUndefined();
    expect(row.imageUrl).toBeUndefined();
  });
});

describe('stripVaccinationImagesFromValue', () => {
  it('strips image fields from admin list arrays', () => {
    const stripped = stripVaccinationImagesFromValue([
      { name: 'Rabies', date: '2025-01-01', imageKey: 'secret' },
    ]) as Record<string, unknown>[];
    expect(stripped[0].name).toBe('Rabies');
    expect(stripped[0].imageKey).toBeUndefined();
  });
});
