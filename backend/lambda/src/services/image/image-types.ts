/**
 * Lean Asset Pipeline — shared types for display image processing.
 */

export type AssetType =
  | 'profile'
  | 'pet'
  | 'product'
  | 'facility'
  | 'banner'
  | 'staff';

export type ImageDto = {
  imageKey: string;
  thumbKey: string | null;
  width: number;
  height: number;
  thumbWidth: number | null;
  thumbHeight: number | null;
  size: number;
  thumbSize: number | null;
  contentType: 'image/webp';
  url: string;
  thumbUrl: string | null;
  dedupHit?: boolean;
};

export type ProcessedVariant = {
  buffer: Buffer;
  width: number;
  height: number;
  byteSize: number;
};

export type ProcessedImageResult = {
  display: ProcessedVariant;
  thumb: ProcessedVariant | null;
  detectedMime: string;
  originalBytes: number;
};

export type ImageUploadInput = {
  buffer: Buffer;
  declaredContentType?: string;
  assetType: AssetType;
  ownerId: string;
  vendorId?: string;
  bannerId?: string;
  /** When replacing a profile/banner, move previous key to cleanup/ */
  previousImageKey?: string | null;
};

export const BYTE_BUDGETS: Record<
  AssetType,
  { targetBytes: number; maxEdgePx: number; thumbTargetBytes: number; thumbMaxEdgePx: number }
> = {
  profile: { targetBytes: 150 * 1024, maxEdgePx: 2048, thumbTargetBytes: 0, thumbMaxEdgePx: 0 },
  pet: { targetBytes: 150 * 1024, maxEdgePx: 2048, thumbTargetBytes: 0, thumbMaxEdgePx: 0 },
  product: {
    targetBytes: 250 * 1024,
    maxEdgePx: 2048,
    thumbTargetBytes: 20 * 1024,
    thumbMaxEdgePx: 400,
  },
  facility: {
    targetBytes: 300 * 1024,
    maxEdgePx: 2048,
    thumbTargetBytes: 20 * 1024,
    thumbMaxEdgePx: 400,
  },
  banner: { targetBytes: 350 * 1024, maxEdgePx: 2560, thumbTargetBytes: 0, thumbMaxEdgePx: 0 },
  staff: { targetBytes: 150 * 1024, maxEdgePx: 2048, thumbTargetBytes: 0, thumbMaxEdgePx: 0 },
};

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 20_000;

export const PRODUCT_MAX_IMAGES = 8;
export const FACILITY_MAX_PHOTOS = 20;

/** Dedup applies only to these asset types (never cross-user profile reuse). */
export const DEDUP_ASSET_TYPES = new Set<AssetType>(['product', 'facility', 'banner']);

export function assetTypeNeedsThumb(assetType: AssetType): boolean {
  return assetType === 'product' || assetType === 'facility';
}
