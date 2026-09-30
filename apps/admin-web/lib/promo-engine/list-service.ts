import {
  labelsForCatalogSlugs,
  matchCatalogSlug,
  type CatalogServiceCategory,
} from './catalog-categories';
import type { PromoEngineListItem, PromoSpendChannel } from './types';

const CHANNEL_LABELS: Record<PromoSpendChannel, string> = {
  tele: 'Tele',
  appointment: 'Appointment',
  paybill: 'Pay Bill',
  ecommerce: 'Ecommerce',
};

function categoryName(id: string, fallback: string, categories: CatalogServiceCategory[]): string {
  const row = categories.find((c) => c.id === id);
  return row?.name || fallback || id;
}

/**
 * Service column text. Legacy rows use service_categories; journey (V/C/F) rows show who the
 * offer is published to, plus the payment channels when the publish step restricted them.
 */
export function serviceLabelForRow(
  row: Pick<PromoEngineListItem, 'serviceCategories' | 'publishScope'>,
  categories: CatalogServiceCategory[],
): string {
  const legacy = labelsForCatalogSlugs(row.serviceCategories || [], categories);
  const scope = row.publishScope;
  if (!scope) return legacy;

  let who: string;
  if (scope.letter === 'F') {
    who = 'All services';
  } else if (scope.letter === 'C') {
    who = scope.ids.map((id, i) => categoryName(id, scope.names[i], categories)).join(', ');
  } else {
    const names = scope.ids.map((id, i) => scope.names[i] || id);
    who = names.length ? `Vendor: ${names.join(', ')}` : '';
  }
  if (!who) who = legacy;
  if (!who) return '';
  const channels = scope.channels.map((c) => CHANNEL_LABELS[c]).filter(Boolean);
  return channels.length ? `${who} · ${channels.join(', ')}` : who;
}

/** True when the promotion targets the catalogue service picked in the list filter. */
export function rowMatchesService(
  row: Pick<PromoEngineListItem, 'serviceCategories' | 'publishScope'>,
  service: string,
  categories: CatalogServiceCategory[],
): boolean {
  if ((row.serviceCategories || []).includes(service)) return true;
  const scope = row.publishScope;
  if (scope?.letter !== 'C') return false;
  const target = categories.find((c) => c.slug === service);
  return scope.ids.some(
    (id) => id === service || (target ? id === target.id : false) || matchCatalogSlug(id, categories) === service,
  );
}
