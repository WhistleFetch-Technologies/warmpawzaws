import { acceptableStylesForService } from '../../../../lib/search-discovery-parity';
import { getNextAvailableSlot } from '../../discovery/repos/legacy-helpers.repo';
import { mapWithConcurrency } from '../../../../services/image';
import { DISCOVERY_LIST_SLOT_TIMEOUT_MS } from '../../../../utils/discovery-list-enrich';

const CLINIC_HOME_STYLES = ['at_center', 'at_vendor', 'at_clinic', 'at_home', 'home_visit'];

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function wapptAcceptableStyles(serviceStyle: 'all' | 'at_center' | 'at_home'): string[] {
  if (serviceStyle === 'all') return CLINIC_HOME_STYLES;
  return acceptableStylesForService(serviceStyle);
}

export async function enrichWapptDiscoveryCards(
  cards: Record<string, unknown>[],
  serviceStyle: 'all' | 'at_center' | 'at_home',
): Promise<Record<string, unknown>[]> {
  const styles = wapptAcceptableStyles(serviceStyle);
  return mapWithConcurrency(cards, 3, async (card) => {
    const vendorId = String(card.vendorId ?? card.id ?? '');
    if (!vendorId) return card;
    const slot = await withTimeout(
      getNextAvailableSlot(vendorId, '', styles),
      DISCOVERY_LIST_SLOT_TIMEOUT_MS,
    );
    const display = slot?.display?.trim() || 'Tap to view availability';
    return {
      ...card,
      nextAvailable: slot ?? { display },
      availabilityText: display,
      nextAvailableSlot: display,
    };
  });
}
