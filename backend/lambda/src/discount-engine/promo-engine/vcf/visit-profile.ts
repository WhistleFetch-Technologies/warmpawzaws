import {
  COUNT_CHANNELS,
  emptyChannelCells,
  emptyVisitProfile,
  type ChannelCell,
  type CountChannel,
  type VisitProfile,
} from './types';
import { isCountChannel } from './channel';
import type { PaymentChannel } from './types';

function asCell(raw: unknown): ChannelCell {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    count: Math.max(0, Math.floor(Number(row.count) || 0)),
    lastAt: row.lastAt != null ? String(row.lastAt) : null,
  };
}

function asChannelRecord(raw: unknown): Record<CountChannel, ChannelCell> {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = emptyChannelCells();
  for (const ch of COUNT_CHANNELS) {
    out[ch] = asCell(row[ch]);
  }
  return out;
}

/**
 * Visit cells live at behaviour.services.vcf so old per-category keys stay.
 */
export function parseVisitProfile(services: Record<string, unknown> | undefined): VisitProfile {
  const raw = services?.vcf;
  if (!raw || typeof raw !== 'object') return emptyVisitProfile();
  const row = raw as Record<string, unknown>;
  const profile = emptyVisitProfile();
  profile.platform = asChannelRecord(row.platform);

  const categories = row.categories && typeof row.categories === 'object'
    ? (row.categories as Record<string, unknown>)
    : {};
  for (const [id, cells] of Object.entries(categories)) {
    if (!id) continue;
    profile.categories[id] = asChannelRecord(cells);
  }

  const vendors = row.vendors && typeof row.vendors === 'object'
    ? (row.vendors as Record<string, unknown>)
    : {};
  for (const [id, value] of Object.entries(vendors)) {
    if (!id) continue;
    const v = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    profile.vendors[id] = {
      categoryId: String(v.categoryId || ''),
      roleId: String(v.roleId || ''),
      ...asChannelRecord(v),
    };
  }
  return profile;
}

export function visitProfileToServicesJson(
  services: Record<string, unknown>,
  profile: VisitProfile
): Record<string, unknown> {
  return { ...services, vcf: profile };
}

function bump(cell: ChannelCell, at: string): ChannelCell {
  return { count: cell.count + 1, lastAt: at };
}

function drop(cell: ChannelCell, at: string): ChannelCell {
  return { count: Math.max(0, cell.count - 1), lastAt: at };
}

function applyDelta(
  profile: VisitProfile,
  channel: CountChannel,
  vendorId: string | null,
  categoryId: string | null,
  roleId: string | null,
  at: string,
  delta: 1 | -1
): VisitProfile {
  const next: VisitProfile = {
    platform: { ...profile.platform, [channel]: { ...profile.platform[channel] } },
    categories: { ...profile.categories },
    vendors: { ...profile.vendors },
  };
  const op = delta === 1 ? bump : drop;
  next.platform[channel] = op(next.platform[channel], at);

  if (categoryId) {
    const current = next.categories[categoryId] || emptyChannelCells();
    next.categories[categoryId] = {
      ...current,
      [channel]: op(current[channel], at),
    };
  }

  if (vendorId) {
    const current = next.vendors[vendorId] || {
      categoryId: categoryId || '',
      roleId: roleId || '',
      ...emptyChannelCells(),
    };
    next.vendors[vendorId] = {
      ...current,
      categoryId: categoryId || current.categoryId || '',
      roleId: roleId || current.roleId || '',
      [channel]: op(current[channel], at),
    };
  }

  return next;
}

/** Ecommerce is never a visit. Returns the same profile. */
export function incrementVisitProfile(opts: {
  profile: VisitProfile;
  channel: PaymentChannel | null;
  vendorId?: string | null;
  categoryId?: string | null;
  roleId?: string | null;
  at?: string;
}): VisitProfile {
  if (!opts.channel || !isCountChannel(opts.channel)) return opts.profile;
  return applyDelta(
    opts.profile,
    opts.channel,
    opts.vendorId ? String(opts.vendorId) : null,
    opts.categoryId ? String(opts.categoryId) : null,
    opts.roleId ? String(opts.roleId) : null,
    opts.at || new Date().toISOString(),
    1
  );
}

export function decrementVisitProfile(opts: {
  profile: VisitProfile;
  channel: PaymentChannel | null;
  vendorId?: string | null;
  categoryId?: string | null;
  roleId?: string | null;
  at?: string;
}): VisitProfile {
  if (!opts.channel || !isCountChannel(opts.channel)) return opts.profile;
  return applyDelta(
    opts.profile,
    opts.channel,
    opts.vendorId ? String(opts.vendorId) : null,
    opts.categoryId ? String(opts.categoryId) : null,
    opts.roleId ? String(opts.roleId) : null,
    opts.at || new Date().toISOString(),
    -1
  );
}
