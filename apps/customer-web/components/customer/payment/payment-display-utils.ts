/** Premium payment UI helpers (display only — no payment logic). */

export function paymentServiceStyleIconClass(
  style?: string
): string {
  if (style === 'tele') return 'bg-violet-100 text-violet-700';
  if (style === 'at_home') return 'bg-emerald-100 text-emerald-700';
  if (style === 'at_center') return 'bg-purple-100 text-purple-700';
  return 'bg-orange-100 text-orange-700';
}

export function paymentCategoryPillLabel(category?: string): string | null {
  if (!category?.trim()) return null;
  const c = category.toLowerCase().replace(/_/g, '-');
  const map: Record<string, string> = {
    vet: 'Medical Service',
    veterinary: 'Medical Service',
    grooming: 'Grooming Service',
    training: 'Training Service',
    walker: 'Walking Service',
    boarding: 'Boarding Service',
    nutritionist: 'Nutrition Service',
    insurance: 'Insurance',
    pharmacy: 'Pharmacy',
    'pet-sitter': 'Pet Sitting',
    holiday: 'Holiday Care',
    relocation: 'Relocation',
    photography: 'Photography',
    sunset: 'Sunset Care',
  };
  for (const [key, label] of Object.entries(map)) {
    if (c.includes(key)) return label;
  }
  const words = category.replace(/[-_]/g, ' ').trim();
  if (!words) return null;
  return words.charAt(0).toUpperCase() + words.slice(1) + ' Service';
}

export function paymentServiceTypePillLabel(serviceStyle?: string): string | null {
  if (!serviceStyle) return null;
  const map: Record<string, string> = {
    tele: 'Online',
    at_home: 'Home Visit',
    at_center: 'At Center',
    at_vendor: 'At Clinic',
    ecom: 'Delivery',
    hybrid: 'Hybrid',
  };
  return map[serviceStyle] ?? null;
}

/** Avoid duplicating "for Mac" when description already mentions the pet. */
export function paymentPetServiceLine(
  serviceName: string,
  petName?: string,
  existingDescription?: string
): string | null {
  const name = petName?.trim();
  if (!name) return null;
  const desc = (existingDescription || '').toLowerCase();
  const needle = `for ${name.toLowerCase()}`;
  if (desc.includes(needle)) return null;
  return `${serviceName} for ${name}`;
}
