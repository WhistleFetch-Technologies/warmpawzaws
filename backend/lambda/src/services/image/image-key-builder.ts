/**
 * Versioned S3 keys — never overwrite immutable CDN objects.
 */

import { randomBytes } from 'crypto';
import type { AssetType } from './image-types';

export function generateVersionSuffix(): string {
  const timePart = Date.now().toString(36);
  const randomPart = randomBytes(4).toString('hex');
  return `${timePart}${randomPart}`;
}

export function buildDisplayWebpKey(opts: {
  assetType: AssetType;
  ownerId: string;
  vendorId?: string;
  bannerId?: string;
  suffix?: string;
}): string {
  const suffix = opts.suffix ?? generateVersionSuffix();
  const { assetType, ownerId, vendorId, bannerId } = opts;

  switch (assetType) {
    case 'profile':
      return `media/customer/${sanitizeId(ownerId)}/profile_${suffix}.webp`;
    case 'pet':
      return `media/pet/${sanitizeId(ownerId)}/avatar_${suffix}.webp`;
    case 'product':
      return `products/${sanitizeId(vendorId || ownerId)}/${suffix}.webp`;
    case 'facility':
      return `media/vendor/${sanitizeId(vendorId || ownerId)}/facility/${suffix}.webp`;
    case 'banner':
      return `admin/banners/${sanitizeId(bannerId || ownerId)}_${suffix}.webp`;
    case 'staff':
      return `media/staff/${sanitizeId(vendorId || ownerId)}/${suffix}.webp`;
    default:
      return `media/misc/${sanitizeId(ownerId)}/${suffix}.webp`;
  }
}

export function buildThumbWebpKey(displayKey: string): string {
  if (displayKey.endsWith('.webp')) {
    return displayKey.replace(/\.webp$/, '.thumb.webp');
  }
  return `${displayKey}.thumb.webp`;
}

export function buildCleanupKey(previousKey: string): string {
  const base = previousKey.replace(/^\/+/, '');
  return `cleanup/${base}`;
}

export function buildLegacyKey(previousKey: string): string {
  const base = previousKey.replace(/^\/+/, '');
  return `legacy/${base}`;
}

export function isWebpKey(key: string | null | undefined): boolean {
  return Boolean(key && /\.webp$/i.test(String(key).trim()));
}

function sanitizeId(id: string): string {
  return String(id)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 128);
}

/** Vendor profile uses media/vendor path (not customer). */
export function buildVendorProfileWebpKey(vendorId: string, suffix?: string): string {
  const s = suffix ?? generateVersionSuffix();
  return `media/vendor/${sanitizeId(vendorId)}/profile_${s}.webp`;
}
