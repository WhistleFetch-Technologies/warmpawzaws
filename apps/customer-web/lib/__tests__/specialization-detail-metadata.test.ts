jest.mock('../specialization-hub-image-registry', () => ({
  resolveSpecializationHeroImage: (id: string, category: string) => {
    if (id === 'advanced_training') return '/images/home/Training/advance-training.webp';
    if (category === 'grooming') return '/images/home/Grooming/banner-img.webp';
    return '/images/home/Training/header.webp';
  },
  resolveSpecializationCardImage: (id: string) => {
    if (id === 'advanced_training') return '/images/home/Training/advance-training.webp';
    return undefined;
  },
}));

import { resolveSpecializationDetail, getSpecializationDetail } from '../specialization-detail';

describe('resolveSpecializationDetail', () => {
  it('returns advanced training metadata content', () => {
    const detail = resolveSpecializationDetail('advanced_training');

    expect(detail.title).toBe('Advanced Training');
    expect(detail.highlightChips).toContain('Expert Trainers');
    expect(detail.whatsIncluded).toHaveLength(6);
    expect(detail.benefits).toHaveLength(4);
    expect(detail.heroImage).toContain('/images/home/Training/');
  });

  it('resolves aliases to canonical content', () => {
    const detail = resolveSpecializationDetail('potty_training');
    expect(detail.id).toBe('house_training');
    expect(detail.title).toBe('House Training');
  });

  it('falls back for unknown specialization', () => {
    const detail = resolveSpecializationDetail('custom_admin_spec', {
      displayName: 'Hair Trimming Plus',
      category: 'grooming',
    });

    expect(detail.title).toBe('Hair Trimming Plus');
    expect(detail.whatsIncluded.length).toBeGreaterThan(0);
    expect(detail.highlightChips.length).toBe(3);
  });

  it('uses apiDescription in fallback when provided', () => {
    const detail = resolveSpecializationDetail('unknown_vet_thing', {
      displayName: 'Eye Care',
      apiDescription: 'Specialized ophthalmology consultations for pets.',
      category: 'vet',
    });

    expect(detail.description).toBe('Specialized ophthalmology consultations for pets.');
  });

  it('returns registry content for daily_walk by id', () => {
    const detail = resolveSpecializationDetail('daily_walk');
    expect(detail.description.length).toBeGreaterThan(20);
    expect(detail.description).toContain('walk');
  });

  it('registry covers all 47 specializations', () => {
    const ids = [
      'basic_obedience', 'house_training', 'leash_walking', 'socialization', 'advanced_training', 'aggression',
      'separation_anxiety', 'excessive_barking', 'fear_phobia', 'destructive', 'resource_guarding',
      'daily_walk', 'puppy_walk', 'multiple_dogs', 'senior_walk', 'long_walk',
      'bath_only', 'full_grooming', 'nail_care', 'haircut_styling', 'deshedding', 'spa_treatment', 'hair_trim',
      'daycare', 'short_stay', 'long_stay', 'luxury_boarding', 'medical_boarding',
      'lab_diagnostics', 'palliative', 'reproductive', 'medicine', 'vaccination', 'dermatology',
      'dentistry', 'ophthalmology', 'cardiology', 'surgery', 'emergency', 'orthopedics', 'neurology',
      'diet_plan', 'puppy_nutrition', 'senior_nutrition', 'weight_management', 'allergies', 'special_diet',
    ];
    for (const id of ids) {
      expect(getSpecializationDetail(id)).toBeDefined();
    }
  });
});
