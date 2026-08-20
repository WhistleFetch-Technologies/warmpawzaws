/**
 * Nutritionist / Diet discovery vs later booking pet rules.
 * Discovery/browse must not require a pet. Authenticated no-pet prompts stay at select.
 * Do not use this to disable NutritionistBookingRouter / transactionRequiresPet.
 */

export function hasNutritionCustomerPhone(phone: string | undefined | null): boolean {
  return (phone?.replace(/\D/g, '') ?? '').length >= 10;
}

export function shouldFetchNutritionCustomerPets(options: {
  isGuest: boolean;
  phone?: string | null;
}): boolean {
  if (options.isGuest) return false;
  return hasNutritionCustomerPhone(options.phone);
}

/** Block vendor/expert select only for authenticated customers who have no pets. */
export function shouldBlockNutritionDiscoveryForMissingPets(options: {
  isGuest: boolean;
  phone?: string | null;
  hasPets: boolean;
}): boolean {
  if (options.isGuest || !hasNutritionCustomerPhone(options.phone)) return false;
  return !options.hasPets;
}
