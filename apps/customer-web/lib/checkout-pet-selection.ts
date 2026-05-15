const STORAGE_KEY = 'warmpawz:checkoutPetSelection:v1';

export type CheckoutPetSelectionStored =
  | { pet: { id: string; name: string; breed?: string } }
  | { skip: true };

export function writeCheckoutPetSelectionForPayment(
  pet: { id: string; name: string; breed?: string } | null
): void {
  if (typeof window === 'undefined') return;
  if (pet == null) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ skip: true } satisfies CheckoutPetSelectionStored));
  } else {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ pet } satisfies CheckoutPetSelectionStored));
  }
}

/** Returns parsed payload and removes the key so it is only applied once. */
export function readAndConsumeCheckoutPetSelection(): CheckoutPetSelectionStored | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && 'skip' in parsed && (parsed as { skip?: boolean }).skip === true) {
      return { skip: true };
    }
    const pet = (parsed as { pet?: { id?: string; name?: string } })?.pet;
    if (pet && typeof pet.id === 'string' && pet.id.trim() && typeof pet.name === 'string') {
      return {
        pet: {
          id: pet.id.trim(),
          name: pet.name.trim(),
          breed: typeof (pet as { breed?: string }).breed === 'string' ? (pet as { breed: string }).breed : undefined,
        },
      };
    }
    return null;
  } catch {
    return null;
  }
}
