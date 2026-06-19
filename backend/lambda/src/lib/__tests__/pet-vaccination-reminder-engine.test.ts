import {
  collectVaccinationRemindersDueTomorrow,
  getIstCalendarDateIso,
  getIstTomorrowDateIso,
} from '../pet-vaccination-reminder-collect';

describe('pet-vaccination-reminder-engine', () => {
  const refDate = new Date('2026-06-18T12:00:00.000Z');

  it('computes IST tomorrow from ref date', () => {
    expect(getIstCalendarDateIso(refDate)).toBe('2026-06-18');
    expect(getIstTomorrowDateIso(refDate)).toBe('2026-06-19');
  });

  it('collects juvenile due tomorrow for puppy approaching 10-week combo dose', () => {
    const candidates = collectVaccinationRemindersDueTomorrow(
      {
        id: 'pet-1',
        name: 'Bruno',
        species: 'Dog',
        medical_history: { dob: '2026-04-10', vaccinations: [] },
      },
      refDate
    );

    expect(candidates.some((c) => c.vaccineKey === 'dog:juvenile:combo-deworm-1')).toBe(true);
    expect(candidates.every((c) => c.dueDate === '2026-06-19')).toBe(true);
  });

  it('collects adult booster due tomorrow from last rabies date', () => {
    const candidates = collectVaccinationRemindersDueTomorrow(
      {
        id: 'pet-2',
        name: 'Mittens',
        species: 'Cat',
        medical_history: {
          dob: '2020-01-01',
          vaccinations: [
            {
              vaccineKey: 'cat:rabies',
              name: 'Rabies Vaccine',
              lastDate: '2025-06-19',
              nextDueDate: '2026-06-19',
            },
          ],
        },
      },
      refDate
    );

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          vaccineKey: 'cat:rabies',
          dueDate: '2026-06-19',
          petName: 'Mittens',
        }),
      ])
    );
  });

  it('returns empty when pet has no dob and no vaccination records', () => {
    const candidates = collectVaccinationRemindersDueTomorrow(
      {
        id: 'pet-3',
        name: 'Ghost',
        species: 'Dog',
        medical_history: {},
      },
      refDate
    );
    expect(candidates).toEqual([]);
  });
});
