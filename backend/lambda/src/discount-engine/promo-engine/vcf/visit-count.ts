import { COUNT_CHANNELS, type CountChannel, type PromoVcfConfig, type VisitProfile } from './types';

function cellCount(
  cells: Record<CountChannel, { count: number }> | undefined,
  channels: CountChannel[]
): number {
  if (!cells) return 0;
  let n = 0;
  for (const ch of channels) {
    n += Number(cells[ch]?.count || 0);
  }
  return n;
}

function channelsForSource(source: PromoVcfConfig['visitSource']): CountChannel[] {
  if (source.width === 'specific' && source.channels?.length) {
    return source.channels.filter((c) => COUNT_CHANNELS.includes(c));
  }
  return [...COUNT_CHANNELS];
}

/**
 * Visit count for **this** promotion only.
 * Ecommerce is never included. General = tele + appointment + paybill in that V/C/F scope.
 */
export function visitCountForPromo(profile: VisitProfile, source: PromoVcfConfig['visitSource']): number {
  const channels = channelsForSource(source);
  if (source.letter === 'V') {
    const vendorId = String(source.vendorId || '');
    return vendorId ? cellCount(profile.vendors[vendorId], channels) : 0;
  }
  if (source.letter === 'C') {
    const categoryId = String(source.categoryId || '');
    return categoryId ? cellCount(profile.categories[categoryId], channels) : 0;
  }
  return cellCount(profile.platform, channels);
}
