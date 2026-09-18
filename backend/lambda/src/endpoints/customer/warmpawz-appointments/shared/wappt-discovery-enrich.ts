import { acceptableStylesForService } from '../../../../lib/search-discovery-parity';
import { DistanceResolver } from '../../../../lib/utils/vendor-customer-distance';
import { getNextAvailableSlot } from '../../discovery/repos/legacy-helpers.repo';
import { mapWithConcurrency } from '../../../../services/image';
import { DISCOVERY_LIST_SLOT_TIMEOUT_MS } from '../../../../utils/discovery-list-enrich';
import { getVendorListingPhotoUrl } from '../../../../utils/vendor-listing-photo';

const CLINIC_HOME_STYLES = ['at_center', 'at_vendor', 'at_clinic', 'at_home', 'home_visit'];
const TELE_STYLES = ['tele', 'online', 'video_consultation'];

export type WapptDiscoveryEnrichStyle = 'all' | 'at_center' | 'at_home' | 'tele';

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

export function wapptAcceptableStyles(serviceStyle: WapptDiscoveryEnrichStyle): string[] {
  if (serviceStyle === 'tele') return TELE_STYLES;
  if (serviceStyle === 'all') return CLINIC_HOME_STYLES;
  return acceptableStylesForService(serviceStyle);
}

export async function enrichWapptDiscoveryCards(
  cards: Record<string, unknown>[],
  serviceStyle: WapptDiscoveryEnrichStyle,
  distanceOpts?: { customerLat: number | null; customerLng: number | null },
): Promise<Record<string, unknown>[]> {
  const styles = wapptAcceptableStyles(serviceStyle);
  const distResolver = new DistanceResolver(
    distanceOpts?.customerLat ?? null,
    distanceOpts?.customerLng ?? null,
    false,
    false,
  );
  return mapWithConcurrency(cards, 3, async (card) => {
    const vendorId = String(card.vendorId ?? card.id ?? '');
    if (!vendorId) return card;
    const slot = await withTimeout(
      getNextAvailableSlot(vendorId, '', styles),
      DISCOVERY_LIST_SLOT_TIMEOUT_MS,
    );
    const display = slot?.display?.trim() || 'Tap to view availability';
    let photoUrl: string | null = (typeof card.photoUrl === 'string' && card.photoUrl.trim())
      ? String(card.photoUrl)
      : null;
    try {
      photoUrl = await getVendorListingPhotoUrl({
        id: vendorId,
        vendor_id: vendorId,
        vendor_type: card.vendorType,
        profile_photo_url: card.profile_photo_url,
        profile_image: card.profile_image ?? card.photoUrl,
        metadata: card.metadata,
      });
    } catch {
      /* keep mapped photoUrl */
    }
    let distanceKm: number | null = null;
    let distanceText: string | null = null;
    try {
      const dist = await distResolver.resolve({
        id: vendorId,
        latitude: card.latitude,
        longitude: card.longitude,
        pincode: card.pincode,
        address: card.address,
        city: card.city,
        state: card.state,
      });
      if (dist) {
        distanceKm = dist.km;
        distanceText = dist.distanceText;
      }
    } catch {
      /* leave distance empty when geocode/haversine fails */
    }
    return {
      ...card,
      photoUrl,
      nextAvailable: slot ?? { display },
      availabilityText: display,
      nextAvailableSlot: display,
      distanceKm,
      distanceText,
    };
  });
}
