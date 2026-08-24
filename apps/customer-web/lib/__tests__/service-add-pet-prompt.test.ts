/**
 * @jest-environment jsdom
 */

import {
  isServiceAddPetPromptScreen,
  SERVICE_ADD_PET_PROMPT_SCREENS,
  shouldShowServiceAddPetPrompt,
} from '../service-add-pet-prompt';

describe('service-add-pet-prompt', () => {
  it('includes expected service hub screens', () => {
    expect(SERVICE_ADD_PET_PROMPT_SCREENS.has('vet')).toBe(true);
    expect(SERVICE_ADD_PET_PROMPT_SCREENS.has('grooming')).toBe(true);
    expect(SERVICE_ADD_PET_PROMPT_SCREENS.has('nutritionist')).toBe(true);
    expect(SERVICE_ADD_PET_PROMPT_SCREENS.has('home')).toBe(false);
  });

  it('shows for profile + 0 pets + vet hub', () => {
    expect(
      shouldShowServiceAddPetPrompt({
        isGuest: false,
        phone: '9876543210',
        currentScreen: 'vet',
        petsCount: 0,
        profileCompleted: true,
      })
    ).toBe(true);
    expect(isServiceAddPetPromptScreen('vet')).toBe(true);
  });

  it('does not show for guest, home, or when pets exist', () => {
    const base = {
      phone: '9876543210',
      currentScreen: 'vet',
      petsCount: 0,
      profileCompleted: true,
    };
    expect(shouldShowServiceAddPetPrompt({ ...base, isGuest: true })).toBe(false);
    expect(
      shouldShowServiceAddPetPrompt({ ...base, isGuest: false, currentScreen: 'home' })
    ).toBe(false);
    expect(
      shouldShowServiceAddPetPrompt({ ...base, isGuest: false, petsCount: 1 })
    ).toBe(false);
    expect(
      shouldShowServiceAddPetPrompt({ ...base, isGuest: false, profileCompleted: false })
    ).toBe(false);
  });

  it('remains eligible on every service hub visit until a pet exists', () => {
    const phone = '9876543210';
    const base = {
      isGuest: false,
      phone,
      petsCount: 0,
      profileCompleted: true,
    };
    expect(shouldShowServiceAddPetPrompt({ ...base, currentScreen: 'vet' })).toBe(true);
    expect(shouldShowServiceAddPetPrompt({ ...base, currentScreen: 'grooming' })).toBe(true);
    expect(shouldShowServiceAddPetPrompt({ ...base, currentScreen: 'walker' })).toBe(true);
  });

  it('does not show after pet added (petsCount > 0)', () => {
    expect(
      shouldShowServiceAddPetPrompt({
        isGuest: false,
        phone: '9876543210',
        currentScreen: 'training',
        petsCount: 2,
        profileCompleted: true,
      })
    ).toBe(false);
  });
});
