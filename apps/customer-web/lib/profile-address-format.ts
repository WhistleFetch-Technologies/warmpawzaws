/**
 * Single-field profile address: "Area, Locality, City, State, Country"
 * (same pattern as account-style profile screens).
 */
export const PROFILE_ADDRESS_FORMAT_PLACEHOLDER =
  'e.g. Area, Locality, City, State, Country';

/** Best-effort city/state from trailing comma-separated segments (for API columns). */
export function inferCityStateFromCommaAddress(full: string): { city?: string; state?: string } {
  const parts = full
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return {
      city: parts[parts.length - 3],
      state: parts[parts.length - 2],
    };
  }
  return {};
}

/** Street/locality line only (house & flat stay in separate inputs, same as signup). */
export function mergeStreetAddressLineOnly(p: {
  address?: string;
  city?: string;
  state?: string;
}): string {
  return mergeProfilePartsForAddressLine({ ...p, houseNo: '', floor: '' });
}

/** Prefill editor when API still stores address, city, state, house separately. */
export function mergeProfilePartsForAddressLine(p: {
  address?: string;
  city?: string;
  state?: string;
  houseNo?: string;
  floor?: string;
}): string {
  const segments: string[] = [];
  const house = [p.houseNo, p.floor].map((s) => (s || '').trim()).filter(Boolean).join(', ');
  const addr = (p.address || '').trim();
  const city = (p.city || '').trim();
  const state = (p.state || '').trim();

  if (house) segments.push(house);
  if (addr) segments.push(addr);

  let line = segments.join(', ');
  const lower = line.toLowerCase();
  if (city && !lower.includes(city.toLowerCase())) {
    line = line ? `${line}, ${city}` : city;
  }
  const lower2 = line.toLowerCase();
  if (state && !lower2.includes(state.toLowerCase())) {
    line = line ? `${line}, ${state}` : state;
  }
  return line;
}
