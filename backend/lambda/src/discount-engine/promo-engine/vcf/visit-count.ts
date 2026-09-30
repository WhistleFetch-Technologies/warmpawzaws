import { scopeIds } from './parse-config';
import {
  COUNT_CHANNELS,
  GENERAL_COUNT_CHANNELS,
  type CountChannel,
  type PromoVcfConfig,
  type VisitProfile,
} from './types';

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
  return [...GENERAL_COUNT_CHANNELS];
}

/**
 * Visit count for **this** promotion only.
 * General = tele + appointment + paybill in that V/C/F scope. Ecommerce counts only when
 * listed as a specific channel.
 * V/C lists are pooled: visits across every listed vendor/category add up as one group.
 */
export function visitCountForPromo(profile: VisitProfile, source: PromoVcfConfig['visitSource']): number {
  const channels = channelsForSource(source);
  if (source.letter === 'F') return cellCount(profile.platform, channels);
  const cells = source.letter === 'V' ? profile.vendors : profile.categories;
  return scopeIds(source).reduce((sum, id) => sum + cellCount(cells[id], channels), 0);
}
