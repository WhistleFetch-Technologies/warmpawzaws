jest.mock('../specialization-hub-image-registry', () => ({
  resolveSpecializationHeroImage: (id: string, category: string) => {
    if (id === 'advanced_training') return '/images/home/Training/advance-training.webp';
    if (category === 'grooming') return '/images/home/Grooming/banner-img.webp';
    if (category === 'walking') {
      const walkingImages: Record<string, string> = {
        daily_walk: '/images/home/Walking/daily-walk.jpg',
        puppy_walk: '/images/home/Walking/puppy-walk.jpg',
        multiple_dogs: '/images/home/Walking/group-walk.jpg',
        senior_walk: '/images/home/Walking/adult-walk.jpg',
        long_walk: '/images/home/Walking/adventure-walk.jpg',
      };
      return walkingImages[id] ?? '/images/home/Walking/daily-walk.jpg';
    }
    if (category === 'nutrition') {
      const nutritionImages: Record<string, string> = {
        lab_diagnostics: '/images/home/Nutrition/lab-diagonosis.webp',
        palliative: '/images/home/Nutrition/palliative.webp',
        reproductive: '/images/home/Nutrition/productive.webp',
        diet_plan: '/images/home/Nutrition/custom-diet.webp',
        puppy_nutrition: '/images/home/Nutrition/puppy-nutrition.webp',
        senior_nutrition: '/images/home/Nutrition/senior-pet-nutrition.webp',
        weight_management: '/images/home/Nutrition/weight-measurment.webp',
        allergies: '/images/home/Nutrition/allergy-diet.webp',
        special_diet: '/images/home/Nutrition/prescription-diet.webp',
      };
      return nutritionImages[id] ?? '/images/home/Nutrition/banner-img.webp';
    }
    return '/images/home/Training/header.webp';
  },
  resolveSpecializationCardImage: (id: string) => {
    if (id === 'advanced_training') return '/images/home/Training/advance-training.webp';
    return undefined;
  },
}));

import { resolveSpecializationDetail, getSpecializationDetail, isVetSpecializationDetail } from '../specialization-detail';

describe('resolveSpecializationDetail', () => {
  it('returns advanced training metadata content', () => {
    const detail = resolveSpecializationDetail('advanced_training');
    expect(isVetSpecializationDetail(detail)).toBe(false);
    if (isVetSpecializationDetail(detail)) return;

    expect(detail.title).toBe('Advanced Training');
    expect(detail.highlightChips).toContain('Advanced Commands');
    expect(detail.whatYouLearn?.length).toBeGreaterThan(5);
    expect(detail.benefits).toHaveLength(5);
    expect(detail.heroImage).toContain('advanced-training.webp');
    expect(detail.heroImagePosition).toBe('center 40%');
    expect(detail.serviceModeInformation?.at_home?.title).toContain('Advanced Training');
    expect(detail.serviceModeInformation?.tele).toBeUndefined();
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
    expect(isVetSpecializationDetail(detail)).toBe(false);
    if (isVetSpecializationDetail(detail)) return;

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

    expect(isVetSpecializationDetail(detail)).toBe(true);
    if (isVetSpecializationDetail(detail)) {
      expect(detail.description).toBe('Specialized ophthalmology consultations for pets.');
    }
  });

  it('returns registry content for daily_walk by id', () => {
    const detail = resolveSpecializationDetail('daily_walk');
    expect(isVetSpecializationDetail(detail)).toBe(false);
    if (isVetSpecializationDetail(detail)) return;
    expect(detail.title).toBe('Daily Walking');
    expect(detail.description).toContain('consistent walking routine');
    expect(detail.overviewTitle).toBe('What is Daily Walking?');
    expect(detail.heroImage).toContain('daily-walking-detail.webp');
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

  it('returns vet layout with flexible sections for vaccination', () => {
    const detail = resolveSpecializationDetail('vaccination');
    expect(isVetSpecializationDetail(detail)).toBe(true);
    if (!isVetSpecializationDetail(detail)) return;
    expect(detail.title).toBe('Vaccination');
    expect(detail.highlightChips).toContain('Preventive Care');
    expect(detail.sections.length).toBeGreaterThan(5);
    expect(detail.sections[0]?.type).toBe('overview');
    expect(detail.sections.some((s) => s.title.includes('Vaccination Planning'))).toBe(true);
  });

  it('resolves orthopedic alias to Bone & Joint vet metadata', () => {
    expect(getSpecializationDetail('orthopedic')).toBeDefined();
    const detail = resolveSpecializationDetail('orthopedic');
    expect(isVetSpecializationDetail(detail)).toBe(true);
    if (!isVetSpecializationDetail(detail)) return;
    expect(detail.id).toBe('orthopedics');
    expect(detail.title).toBe('Bone & Joint');
    expect(detail.heroImage).toBe('/images/home/Vet/bone-joint.webp');
    expect(detail.heroImagePosition).toBe('center top');
    expect(detail.sections.length).toBeGreaterThan(5);

    const canonical = resolveSpecializationDetail('orthopedics');
    expect(isVetSpecializationDetail(canonical)).toBe(true);
    if (!isVetSpecializationDetail(canonical)) return;
    expect(canonical.title).toBe('Bone & Joint');
  });

  it('resolves lab-diagnostics alias to Lab & Diagnostics vet metadata', () => {
    expect(getSpecializationDetail('lab-diagnostics')).toBeDefined();
    const detail = resolveSpecializationDetail('lab-diagnostics');
    expect(isVetSpecializationDetail(detail)).toBe(true);
    if (!isVetSpecializationDetail(detail)) return;
    expect(detail.id).toBe('lab_diagnostics');
    expect(detail.title).toBe('Lab & Diagnostics');
    expect(detail.heroImage).toBe('/images/home/Vet/lab-diagnostics.webp');
    expect(detail.heroImagePosition).toBe('center 12%');
    expect(detail.sections.some((s) => s.title.includes('What Are Pet Diagnostics'))).toBe(true);
  });

  it('resolves lab_diagnostics by canonical id', () => {
    const detail = resolveSpecializationDetail('lab_diagnostics');
    expect(isVetSpecializationDetail(detail)).toBe(true);
    if (!isVetSpecializationDetail(detail)) return;
    expect(detail.title).toBe('Lab & Diagnostics');
    expect(detail.heroImage).toBe('/images/home/Vet/lab-diagnostics.webp');
  });

  it('uses dedicated palliative detail hero image without affecting other vet specs', () => {
    const palliative = resolveSpecializationDetail('palliative');
    expect(isVetSpecializationDetail(palliative)).toBe(true);
    if (!isVetSpecializationDetail(palliative)) return;
    expect(palliative.heroImage).toBe('/images/home/Vet/palliative-end-of-life-care.webp');

    const vaccination = resolveSpecializationDetail('vaccination');
    expect(isVetSpecializationDetail(vaccination)).toBe(true);
    if (!isVetSpecializationDetail(vaccination)) return;
    expect(vaccination.heroImage).not.toBe('/images/home/Vet/palliative-end-of-life-care.webp');
  });

  it('uses dedicated reproductive detail hero image without affecting other vet specs', () => {
    const reproductive = resolveSpecializationDetail('reproductive');
    expect(isVetSpecializationDetail(reproductive)).toBe(true);
    if (!isVetSpecializationDetail(reproductive)) return;
    expect(reproductive.title).toBe('Reproductive & Breeding');
    expect(reproductive.heroImage).toBe('/images/home/Vet/reproductive-breeding.webp');
    expect(reproductive.heroImagePosition).toBe('center top');

    const medicine = resolveSpecializationDetail('medicine');
    expect(isVetSpecializationDetail(medicine)).toBe(true);
    if (!isVetSpecializationDetail(medicine)) return;
    expect(medicine.heroImage).not.toBe('/images/home/Vet/reproductive-breeding.webp');
  });

  it('uses dedicated neurology detail hero image and positioning without affecting listing fallback', () => {
    const neurology = resolveSpecializationDetail('neurology');
    expect(isVetSpecializationDetail(neurology)).toBe(true);
    if (!isVetSpecializationDetail(neurology)) return;
    expect(neurology.title).toBe('Neurology');
    expect(neurology.heroImage).toBe('/images/home/Vet/neurology.webp');
    expect(neurology.heroImagePosition).toBe('center top');

    const surgery = resolveSpecializationDetail('surgery');
    expect(isVetSpecializationDetail(surgery)).toBe(true);
    if (!isVetSpecializationDetail(surgery)) return;
    expect(surgery.heroImage).not.toBe('/images/home/Vet/neurology.webp');
  });

  it('uses dedicated surgery detail hero image and positioning without affecting listing fallback', () => {
    const surgery = resolveSpecializationDetail('surgery');
    expect(isVetSpecializationDetail(surgery)).toBe(true);
    if (!isVetSpecializationDetail(surgery)) return;
    expect(surgery.title).toBe('Surgery');
    expect(surgery.heroImage).toBe('/images/home/Vet/surgery.webp');
    expect(surgery.heroImagePosition).toBe('center 55%');

    const heartCare = resolveSpecializationDetail('cardiology');
    expect(isVetSpecializationDetail(heartCare)).toBe(true);
    if (!isVetSpecializationDetail(heartCare)) return;
    expect(heartCare.heroImage).not.toBe('/images/home/Vet/surgery.webp');
  });

  it('uses dedicated heart care detail hero image and positioning without affecting listing fallback', () => {
    const heartCare = resolveSpecializationDetail('cardiology');
    expect(isVetSpecializationDetail(heartCare)).toBe(true);
    if (!isVetSpecializationDetail(heartCare)) return;
    expect(heartCare.title).toBe('Heart Care');
    expect(heartCare.heroImage).toBe('/images/home/Vet/heart-care.webp');
    expect(heartCare.heroImagePosition).toBe('center top');

    const eyeCare = resolveSpecializationDetail('ophthalmology');
    expect(isVetSpecializationDetail(eyeCare)).toBe(true);
    if (!isVetSpecializationDetail(eyeCare)) return;
    expect(eyeCare.heroImage).not.toBe('/images/home/Vet/heart-care.webp');
  });

  it('uses dedicated eye care detail hero image and positioning without affecting listing fallback', () => {
    const eyeCare = resolveSpecializationDetail('ophthalmology');
    expect(isVetSpecializationDetail(eyeCare)).toBe(true);
    if (!isVetSpecializationDetail(eyeCare)) return;
    expect(eyeCare.title).toBe('Eye Care');
    expect(eyeCare.heroImage).toBe('/images/home/Vet/eye-care.webp');
    expect(eyeCare.heroImagePosition).toBe('center top');

    const dental = resolveSpecializationDetail('dentistry');
    expect(isVetSpecializationDetail(dental)).toBe(true);
    if (!isVetSpecializationDetail(dental)) return;
    expect(dental.heroImage).not.toBe('/images/home/Vet/eye-care.webp');
  });

  it('uses dedicated dental detail hero image and positioning without affecting listing fallback', () => {
    const dental = resolveSpecializationDetail('dentistry');
    expect(isVetSpecializationDetail(dental)).toBe(true);
    if (!isVetSpecializationDetail(dental)) return;
    expect(dental.title).toBe('Dental');
    expect(dental.heroImage).toBe('/images/home/Vet/dental.webp');
    expect(dental.heroImagePosition).toBe('center top');

    const skinCare = resolveSpecializationDetail('dermatology');
    expect(isVetSpecializationDetail(skinCare)).toBe(true);
    if (!isVetSpecializationDetail(skinCare)) return;
    expect(skinCare.heroImage).not.toBe('/images/home/Vet/dental.webp');
  });

  it('uses dedicated skin care detail hero image and positioning without affecting listing fallback', () => {
    const skinCare = resolveSpecializationDetail('dermatology');
    expect(isVetSpecializationDetail(skinCare)).toBe(true);
    if (!isVetSpecializationDetail(skinCare)) return;
    expect(skinCare.title).toBe('Skin Care');
    expect(skinCare.heroImage).toBe('/images/home/Vet/skin-care.webp');
    expect(skinCare.heroImagePosition).toBe('center top');

    const vaccination = resolveSpecializationDetail('vaccination');
    expect(isVetSpecializationDetail(vaccination)).toBe(true);
    if (!isVetSpecializationDetail(vaccination)) return;
    expect(vaccination.heroImage).not.toBe('/images/home/Vet/skin-care.webp');
  });

  it('uses dedicated vaccination detail hero image and positioning without affecting listing fallback', () => {
    const vaccination = resolveSpecializationDetail('vaccination');
    expect(isVetSpecializationDetail(vaccination)).toBe(true);
    if (!isVetSpecializationDetail(vaccination)) return;
    expect(vaccination.title).toBe('Vaccination');
    expect(vaccination.heroImage).toBe('/images/home/Vet/vaccination.webp');
    expect(vaccination.heroImagePosition).toBe('center top');

    const general = resolveSpecializationDetail('medicine');
    expect(isVetSpecializationDetail(general)).toBe(true);
    if (!isVetSpecializationDetail(general)) return;
    expect(general.heroImage).not.toBe('/images/home/Vet/vaccination.webp');
  });

  it('uses dedicated general detail hero image and positioning without affecting other vet specs', () => {
    const general = resolveSpecializationDetail('medicine');
    expect(isVetSpecializationDetail(general)).toBe(true);
    if (!isVetSpecializationDetail(general)) return;
    expect(general.title).toBe('General');
    expect(general.heroImage).toBe('/images/home/Vet/general-veterinary-care.webp');
    expect(general.heroImagePosition).toBe('center top');

    const alias = resolveSpecializationDetail('general_consultation');
    expect(isVetSpecializationDetail(alias)).toBe(true);
    if (!isVetSpecializationDetail(alias)) return;
    expect(alias.heroImage).toBe('/images/home/Vet/general-veterinary-care.webp');

    const lab = resolveSpecializationDetail('lab_diagnostics');
    expect(isVetSpecializationDetail(lab)).toBe(true);
    if (!isVetSpecializationDetail(lab)) return;
    expect(lab.heroImage).not.toBe('/images/home/Vet/general-veterinary-care.webp');
  });

  it('returns emergency visual variant without 24/7 availability claims in highlights', () => {
    const detail = resolveSpecializationDetail('emergency');
    expect(isVetSpecializationDetail(detail)).toBe(true);
    if (!isVetSpecializationDetail(detail)) return;
    expect(detail.visualVariant).toBe('emergency');
    expect(detail.highlightChips.join(' ')).not.toMatch(/24\/7/i);
    expect(detail.sections.some((s) => s.type === 'emergency')).toBe(true);
  });

  it('falls back to vet layout for unknown vet specialization', () => {
    const detail = resolveSpecializationDetail('unknown_vet_thing', {
      displayName: 'Eye Care',
      apiDescription: 'Specialized ophthalmology consultations for pets.',
      category: 'vet',
    });
    expect(isVetSpecializationDetail(detail)).toBe(true);
    if (!isVetSpecializationDetail(detail)) return;
    expect(detail.description).toBe('Specialized ophthalmology consultations for pets.');
    expect(detail.sections.length).toBeGreaterThan(0);
  });

  it('resolves grooming specializations with dedicated metadata and service modes', () => {
    const groomingSpecs: Array<{ id: string; title: string; heroSuffix: string }> = [
      { id: 'bath_only', title: 'Bath Service', heroSuffix: 'bath-service.webp' },
      { id: 'full_grooming', title: 'Complete Grooming', heroSuffix: 'complete-grooming.webp' },
      { id: 'haircut_styling', title: 'Hair Styling', heroSuffix: 'haircut.webp' },
      { id: 'nail_care', title: 'Nail Trimming', heroSuffix: 'nail-trimming.webp' },
      { id: 'deshedding', title: 'Shedding Control', heroSuffix: 'shedding-control.webp' },
      { id: 'spa_treatment', title: 'Spa Treatment', heroSuffix: 'spa-treatment.webp' },
    ];

    for (const spec of groomingSpecs) {
      const detail = resolveSpecializationDetail(spec.id);
      expect(isVetSpecializationDetail(detail)).toBe(false);
      if (isVetSpecializationDetail(detail)) continue;
      expect(detail.title).toBe(spec.title);
      expect(detail.heroImage).toContain(spec.heroSuffix);
      expect(detail.serviceModeInformation?.at_home?.title).toBe('Grooming at your doorstep');
      expect(detail.serviceModeInformation?.at_center?.title).toBe(
        'Visit a professional grooming centre',
      );
      expect(detail.serviceModeInformation?.tele).toBeUndefined();
    }

    const bath = resolveSpecializationDetail('bath_only');
    expect(isVetSpecializationDetail(bath)).toBe(false);
    if (isVetSpecializationDetail(bath)) return;
    expect(bath.notIncluded?.length).toBeGreaterThan(3);
    expect(bath.timeline).toHaveLength(0);
    expect(bath.heroImagePosition).toBe('center top');

    const complete = resolveSpecializationDetail('full_grooming');
    expect(isVetSpecializationDetail(complete)).toBe(false);
    if (isVetSpecializationDetail(complete)) return;
    expect(complete.timelineTitle).toBe('Process');
    expect(complete.timeline).toHaveLength(5);
    expect(complete.heroImagePosition).toBe('center 45%');

    const hairTrim = resolveSpecializationDetail('hair_trim');
    expect(isVetSpecializationDetail(hairTrim)).toBe(false);
    if (isVetSpecializationDetail(hairTrim)) return;
    expect(hairTrim.title).toBe('Hair Trim');
    expect(hairTrim.heroImage).toContain('hair-trim-service.webp');
    expect(hairTrim.heroImagePosition).toBe('center top');

    const nailCare = resolveSpecializationDetail('nail_care');
    expect(isVetSpecializationDetail(nailCare)).toBe(false);
    if (isVetSpecializationDetail(nailCare)) return;
    expect(nailCare.title).toBe('Nail Trimming');
    expect(nailCare.heroImage).toContain('nail-trimming.webp');
    expect(nailCare.heroImagePosition).toBe('center top');

    const deshedding = resolveSpecializationDetail('deshedding');
    expect(isVetSpecializationDetail(deshedding)).toBe(false);
    if (isVetSpecializationDetail(deshedding)) return;
    expect(deshedding.title).toBe('Shedding Control');
    expect(deshedding.heroImage).toContain('shedding-control.webp');
    expect(deshedding.heroImagePosition).toBe('center top');

    const spaTreatment = resolveSpecializationDetail('spa_treatment');
    expect(isVetSpecializationDetail(spaTreatment)).toBe(false);
    if (isVetSpecializationDetail(spaTreatment)) return;
    expect(spaTreatment.title).toBe('Spa Treatment');
    expect(spaTreatment.heroImage).toContain('spa-treatment.webp');
    expect(spaTreatment.heroImagePosition).toBe('center 40%');
  });

  it('resolves training specializations with dedicated metadata and service modes', () => {
    const trainingSpecs: Array<{ id: string; title: string; uniqueChip: string }> = [
      { id: 'basic_obedience', title: 'Basic Obedience', uniqueChip: 'Basic Commands' },
      { id: 'aggression', title: 'Aggression Fix', uniqueChip: 'Behaviour Correction' },
      { id: 'socialization', title: 'Socialization', uniqueChip: 'Confidence Building' },
      { id: 'leash_walking', title: 'Leash Walking', uniqueChip: 'Loose Leash' },
      { id: 'advanced_training', title: 'Advanced Training', uniqueChip: 'Advanced Commands' },
      { id: 'house_training', title: 'House Training', uniqueChip: 'Toilet Training' },
    ];

    const descriptions = new Set<string>();

    for (const spec of trainingSpecs) {
      const detail = resolveSpecializationDetail(spec.id);
      expect(isVetSpecializationDetail(detail)).toBe(false);
      if (isVetSpecializationDetail(detail)) continue;
      expect(detail.title).toBe(spec.title);
      expect(detail.highlightChips).toContain(spec.uniqueChip);
      expect(detail.heroImage).toContain('/images/home/Training/');
      expect(detail.serviceModeInformation?.at_home?.title.length).toBeGreaterThan(5);
      expect(detail.serviceModeInformation?.tele).toBeUndefined();
      descriptions.add(detail.description);
    }

    expect(descriptions.size).toBe(trainingSpecs.length);

    const basic = resolveSpecializationDetail('basic_obedience');
    expect(isVetSpecializationDetail(basic)).toBe(false);
    if (isVetSpecializationDetail(basic)) return;
    expect(basic.whatYouLearn).toContain('Sit');
    expect(basic.trainerDelivers).toContain('Works directly with the pet');
    expect(basic.notIncludedFooter).toContain('Behaviour Modification');
    expect(basic.heroImage).toContain('basic-obedience-training.webp');
    expect(basic.heroImagePosition).toBe('center top');
    expect(basic.serviceModeInformation?.at_home?.details).toContain('Essential commands');

    const aggression = resolveSpecializationDetail('aggression_fix');
    expect(isVetSpecializationDetail(aggression)).toBe(false);
    if (isVetSpecializationDetail(aggression)) return;
    expect(aggression.title).toBe('Aggression Fix');
    expect(aggression.heroImage).toContain('aggression-fix-training.webp');
    expect(aggression.heroImagePosition).toBe('center 30%');
    expect(aggression.behavioursAddressed).toContain('Resource guarding');
    expect(aggression.trainerDeliversTitle).toBe('What the Behaviourist Does');

    const socialization = resolveSpecializationDetail('socialization');
    expect(isVetSpecializationDetail(socialization)).toBe(false);
    if (isVetSpecializationDetail(socialization)) return;
    expect(socialization.title).toBe('Socialization');
    expect(socialization.heroImage).toContain('socialization-training.webp');
    expect(socialization.heroImagePosition).toBe('center top');

    const leashWalking = resolveSpecializationDetail('leash_walking');
    expect(isVetSpecializationDetail(leashWalking)).toBe(false);
    if (isVetSpecializationDetail(leashWalking)) return;
    expect(leashWalking.title).toBe('Leash Walking');
    expect(leashWalking.heroImage).toContain('leash-walking-training.webp');
    expect(leashWalking.heroImagePosition).toBe('center top');

    const house = resolveSpecializationDetail('potty_training');
    expect(isVetSpecializationDetail(house)).toBe(false);
    if (isVetSpecializationDetail(house)) return;
    expect(house.id).toBe('house_training');
    expect(house.heroImage).toContain('house-training-training.webp');
    expect(house.heroImagePosition).toBe('center top');
    expect(house.whatYouLearn).toContain('Consistent toilet routines');
    expect(house.serviceModeInformation?.at_home?.title).toBe('House Training – At Home');

    const advanced = resolveSpecializationDetail('advanced_training');
    expect(isVetSpecializationDetail(advanced)).toBe(false);
    if (isVetSpecializationDetail(advanced)) return;
    expect(advanced.heroImage).toContain('advanced-training.webp');
    expect(advanced.heroImagePosition).toBe('center 40%');

    const grooming = resolveSpecializationDetail('bath_only');
    expect(isVetSpecializationDetail(grooming)).toBe(false);
    if (isVetSpecializationDetail(grooming)) return;
    expect(grooming.serviceModeInformation?.at_home?.title).toBe('Grooming at your doorstep');

    const vet = resolveSpecializationDetail('vaccination');
    expect(isVetSpecializationDetail(vet)).toBe(true);
  });

  it('resolves walking specializations with dedicated walker metadata', () => {
    const walkingSpecs: Array<{ id: string; title: string; uniqueChip: string; overviewTitle: string }> = [
      {
        id: 'daily_walk',
        title: 'Daily Walking',
        uniqueChip: 'Regular Exercise',
        overviewTitle: 'What is Daily Walking?',
      },
      {
        id: 'puppy_walk',
        title: 'Puppy Walks',
        uniqueChip: 'Puppy Care',
        overviewTitle: 'What are Puppy Walks?',
      },
      {
        id: 'multiple_dogs',
        title: 'Group Walks',
        uniqueChip: 'Pack Walking',
        overviewTitle: 'What are Group Walks?',
      },
      {
        id: 'senior_walk',
        title: 'Senior Dog Walks',
        uniqueChip: 'Low Impact',
        overviewTitle: 'What are Senior Dog Walks?',
      },
      {
        id: 'long_walk',
        title: 'Adventure Walks',
        uniqueChip: 'Parks & Trails',
        overviewTitle: 'What are Adventure Walks?',
      },
    ];

    const descriptions = new Set<string>();
    const overviewBodies = new Set<string>();

    for (const spec of walkingSpecs) {
      const detail = resolveSpecializationDetail(spec.id);
      expect(isVetSpecializationDetail(detail)).toBe(false);
      if (isVetSpecializationDetail(detail)) continue;
      expect(detail.title).toBe(spec.title);
      expect(detail.highlightChips).toContain(spec.uniqueChip);
      expect(detail.overviewTitle).toBe(spec.overviewTitle);
      expect(detail.overviewBody?.length).toBeGreaterThan(20);
      expect(detail.whatsIncluded.length).toBeGreaterThan(5);
      expect(detail.audienceTitle).toBe('Best suited for');
      expect(detail.whatsIncludedTitle).toBe('What is included');
      expect(detail.benefits).toHaveLength(0);
      expect(detail.timeline).toHaveLength(0);
      expect(detail.tips).toHaveLength(0);
      expect(detail.heroImage).toContain('/images/home/Walking/');
      expect(detail.serviceModeInformation).toBeUndefined();
      descriptions.add(detail.description);
      overviewBodies.add(detail.overviewBody ?? '');
    }

    expect(descriptions.size).toBe(walkingSpecs.length);
    expect(overviewBodies.size).toBe(walkingSpecs.length);

    const daily = resolveSpecializationDetail('daily_walk');
    expect(isVetSpecializationDetail(daily)).toBe(false);
    if (isVetSpecializationDetail(daily)) return;
    expect(daily.notIncludedTitle).toBe('Not included');
    expect(daily.notIncludedFooter).toContain('safe supervised walking');
    expect(daily.heroImage).toContain('daily-walking-detail.webp');
    expect(daily.heroImagePosition).toBe('center top');

    const puppy = resolveSpecializationDetail('puppy_walk');
    expect(isVetSpecializationDetail(puppy)).toBe(false);
    if (isVetSpecializationDetail(puppy)) return;
    expect(puppy.importantNotesTitle).toBe('Important');
    expect(puppy.importantNotes?.[0]).toContain('vaccination status');
    expect(puppy.heroImage).toContain('puppy-walking-detail.webp');
    expect(puppy.heroImagePosition).toBe('center top');

    const group = resolveSpecializationDetail('multiple_dogs');
    expect(isVetSpecializationDetail(group)).toBe(false);
    if (isVetSpecializationDetail(group)) return;
    expect(group.notIncludedTitle).toBe('Not suitable for');
    expect(group.importantNotesTitle).toBe('Safety & Compatibility');
    expect(group.heroImage).toContain('group-walking-detail.webp');
    expect(group.heroImagePosition).toBe('center top');

    const senior = resolveSpecializationDetail('senior_walk');
    expect(isVetSpecializationDetail(senior)).toBe(false);
    if (isVetSpecializationDetail(senior)) return;
    expect(senior.importantNotesTitle).toBe('Comfort & Safety');
    expect(senior.heroImage).toContain('senior-walking-detail.webp');
    expect(senior.heroImagePosition).toBe('center top');

    const adventure = resolveSpecializationDetail('adventure_walk');
    expect(isVetSpecializationDetail(adventure)).toBe(false);
    if (isVetSpecializationDetail(adventure)) return;
    expect(adventure.id).toBe('long_walk');
    expect(adventure.title).toBe('Adventure Walks');
    expect(adventure.importantNotesTitle).toBe('Safety & Route Suitability');
    expect(adventure.heroImage).toContain('adventure-walking-detail.webp');
    expect(adventure.heroImagePosition).toBe('center top');
  });

  it('resolves nutrition specializations with dedicated metadata and existing hub images', () => {
    const nutritionSpecs: Array<{ id: string; title: string; uniqueChip: string; heroSuffix: string }> = [
      {
        id: 'lab_diagnostics',
        title: 'Lab & Diagnostics',
        uniqueChip: 'Nutritional Assessment',
        heroSuffix: 'lab-diagnostics-detail.webp',
      },
      {
        id: 'palliative',
        title: 'Palliative & End-of-Life Care',
        uniqueChip: 'Comfort Nutrition',
        heroSuffix: 'palliative-end-of-life-detail.webp',
      },
      {
        id: 'reproductive',
        title: 'Reproductive & Breeding',
        uniqueChip: 'Reproductive Nutrition',
        heroSuffix: 'reproductive-breeding-detail.webp',
      },
      {
        id: 'diet_plan',
        title: 'Custom Diet Plans',
        uniqueChip: 'Personalised Diet',
        heroSuffix: 'custom-diet-plans-detail.webp',
      },
      {
        id: 'puppy_nutrition',
        title: 'Puppy Nutrition',
        uniqueChip: 'Growth Support',
        heroSuffix: 'puppy-nutrition-detail.webp',
      },
      {
        id: 'senior_nutrition',
        title: 'Senior Pet Nutrition',
        uniqueChip: 'Healthy Ageing',
        heroSuffix: 'senior-pet-nutrition-detail.webp',
      },
      {
        id: 'weight_management',
        title: 'Weight Management',
        uniqueChip: 'Healthy Weight',
        heroSuffix: 'weight-management-detail.webp',
      },
      {
        id: 'allergies',
        title: 'Allergy Diet',
        uniqueChip: 'Food Sensitivity',
        heroSuffix: 'allergy-diet-detail.webp',
      },
      {
        id: 'special_diet',
        title: 'Prescription Diet',
        uniqueChip: 'Therapeutic Nutrition',
        heroSuffix: 'prescription-diet-detail.webp',
      },
    ];

    const descriptions = new Set<string>();

    for (const spec of nutritionSpecs) {
      const detail = resolveSpecializationDetail(spec.id, { category: 'nutrition' });
      expect(isVetSpecializationDetail(detail)).toBe(false);
      if (isVetSpecializationDetail(detail)) continue;
      expect(detail.title).toBe(spec.title);
      expect(detail.highlightChips).toContain(spec.uniqueChip);
      expect(detail.heroImage).toContain(spec.heroSuffix);
      expect(detail.audienceTitle).toBe('Best suited for');
      expect(detail.whatsIncludedTitle).toBe('What is included');
      expect(detail.benefits).toHaveLength(0);
      expect(detail.timeline).toHaveLength(0);
      expect(detail.tips).toHaveLength(0);
      descriptions.add(detail.description);
    }

    expect(descriptions.size).toBe(nutritionSpecs.length);

    const nutritionLab = resolveSpecializationDetail('lab_diagnostics', { category: 'nutrition' });
    expect(isVetSpecializationDetail(nutritionLab)).toBe(false);
    if (isVetSpecializationDetail(nutritionLab)) return;
    expect(nutritionLab.importantNotes?.[0]).toContain('not a standalone laboratory service');
    expect(nutritionLab.heroImage).toContain('lab-diagnostics-detail.webp');
    expect(nutritionLab.heroImagePosition).toBe('center top');

    const nutritionPalliative = resolveSpecializationDetail('palliative', { category: 'nutrition' });
    expect(isVetSpecializationDetail(nutritionPalliative)).toBe(false);
    if (isVetSpecializationDetail(nutritionPalliative)) return;
    expect(nutritionPalliative.heroImage).toContain('palliative-end-of-life-detail.webp');
    expect(nutritionPalliative.heroImagePosition).toBe('center top');

    const nutritionReproductive = resolveSpecializationDetail('reproductive', { category: 'nutrition' });
    expect(isVetSpecializationDetail(nutritionReproductive)).toBe(false);
    if (isVetSpecializationDetail(nutritionReproductive)) return;
    expect(nutritionReproductive.heroImage).toContain('reproductive-breeding-detail.webp');
    expect(nutritionReproductive.heroImagePosition).toBe('center top');

    const vetLab = resolveSpecializationDetail('lab_diagnostics');
    expect(isVetSpecializationDetail(vetLab)).toBe(true);

    const customDiet = resolveSpecializationDetail('custom_diet', { category: 'nutrition' });
    expect(isVetSpecializationDetail(customDiet)).toBe(false);
    if (isVetSpecializationDetail(customDiet)) return;
    expect(customDiet.id).toBe('diet_plan');
    expect(customDiet.title).toBe('Custom Diet Plans');
    expect(customDiet.heroImage).toContain('custom-diet-plans-detail.webp');
    expect(customDiet.heroImagePosition).toBe('center top');

    const puppyNutrition = resolveSpecializationDetail('puppy_nutrition', { category: 'nutrition' });
    expect(isVetSpecializationDetail(puppyNutrition)).toBe(false);
    if (isVetSpecializationDetail(puppyNutrition)) return;
    expect(puppyNutrition.heroImage).toContain('puppy-nutrition-detail.webp');
    expect(puppyNutrition.heroImagePosition).toBe('center top');

    const seniorNutrition = resolveSpecializationDetail('senior_nutrition', { category: 'nutrition' });
    expect(isVetSpecializationDetail(seniorNutrition)).toBe(false);
    if (isVetSpecializationDetail(seniorNutrition)) return;
    expect(seniorNutrition.heroImage).toContain('senior-pet-nutrition-detail.webp');
    expect(seniorNutrition.heroImagePosition).toBe('center top');

    const weightManagement = resolveSpecializationDetail('weight_management', { category: 'nutrition' });
    expect(isVetSpecializationDetail(weightManagement)).toBe(false);
    if (isVetSpecializationDetail(weightManagement)) return;
    expect(weightManagement.heroImage).toContain('weight-management-detail.webp');
    expect(weightManagement.heroImagePosition).toBe('center top');

    const allergyDiet = resolveSpecializationDetail('allergies', { category: 'nutrition' });
    expect(isVetSpecializationDetail(allergyDiet)).toBe(false);
    if (isVetSpecializationDetail(allergyDiet)) return;
    expect(allergyDiet.heroImage).toContain('allergy-diet-detail.webp');
    expect(allergyDiet.heroImagePosition).toBe('center top');

    const prescription = resolveSpecializationDetail('prescription_diet', { category: 'nutrition' });
    expect(isVetSpecializationDetail(prescription)).toBe(false);
    if (isVetSpecializationDetail(prescription)) return;
    expect(prescription.id).toBe('special_diet');
    expect(prescription.heroImage).toContain('prescription-diet-detail.webp');
    expect(prescription.heroImagePosition).toBe('center top');
    expect(prescription.importantNotes?.[0]).toContain('veterinary guidance');
  });

  it('falls back for unknown training specialization', () => {
    const detail = resolveSpecializationDetail('custom_training_spec', {
      displayName: 'Custom Training Goal',
      category: 'training',
    });
    expect(isVetSpecializationDetail(detail)).toBe(false);
    if (isVetSpecializationDetail(detail)) return;
    expect(detail.title).toBe('Custom Training Goal');
    expect(detail.whatsIncluded.length).toBeGreaterThan(0);
  });
});
