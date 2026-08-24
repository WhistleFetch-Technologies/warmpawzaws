/**
 * Service-hub "Add Your Pet" promotional prompt — eligibility rules.
 * Shown on every service hub visit when profile exists but customer has no pets.
 * Only stops permanently after the customer adds at least one pet.
 */

export const SERVICE_ADD_PET_PROMPT_SCREENS = new Set<string>([
  'vet',
  'grooming',
  'training',
  'boarding',
  'boarding_facility',
  'walker',
  'pet-sitter',
  'nutritionist',
  'behaviorist',
  'sunset',
]);

function normalizePhone10(phone: string | null | undefined): string {
  return String(phone ?? '')
    .replace(/\D/g, '')
    .slice(-10);
}

export function isServiceAddPetPromptScreen(screen: string): boolean {
  return SERVICE_ADD_PET_PROMPT_SCREENS.has(screen);
}

export function shouldShowServiceAddPetPrompt(opts: {
  isGuest: boolean;
  phone: string | null | undefined;
  currentScreen: string;
  petsCount: number;
  profileCompleted: boolean;
}): boolean {
  if (opts.isGuest) return false;
  if (!opts.profileCompleted) return false;
  if (normalizePhone10(opts.phone).length < 10) return false;
  if (opts.petsCount > 0) return false;
  if (opts.currentScreen === 'home') return false;
  if (!isServiceAddPetPromptScreen(opts.currentScreen)) return false;
  return true;
}
