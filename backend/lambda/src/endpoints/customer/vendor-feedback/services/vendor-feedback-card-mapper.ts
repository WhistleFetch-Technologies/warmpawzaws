import { formatDistanceKm, haversineKm } from '../../../../lib/utils/vendor-customer-distance';
import { getVendorListingPhotoUrl } from '../../../../utils/vendor-listing-photo';
import { resolveMerchantDisplayName } from '../../../warmpawz-pay/shared/merchant/merchant-display-name.resolver';
import { resolveMerchantServiceCategory } from '../../../warmpawz-pay/shared/merchant/merchant-service-category.resolver';
import type { VendorFeedbackCandidateRow } from '../repos/vendor-feedback-prompt.repo';
import {
  resolveVendorFeedbackKind,
  vendorFeedbackTitle,
} from '../shared/vendor-feedback-kind';
import type { VendorFeedbackPromptDto, VendorFeedbackVendorDto } from '../shared/vendor-feedback.types';

const VERIFIED_STATUSES = new Set(['approved', 'active']);

export interface CustomerCoords {
  latitude: number;
  longitude: number;
  approximate?: boolean;
}

function toNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}

function toIso(raw: string | Date | null): string | null {
  if (raw == null) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function joinAddress(address: string | null, city: string | null): string | null {
  const a = String(address ?? '').trim();
  const c = String(city ?? '').trim();
  if (a && c && !a.toLowerCase().includes(c.toLowerCase())) return `${a}, ${c}`;
  return a || c || null;
}

function resolveCategoryLabel(row: VendorFeedbackCandidateRow): string {
  const meta = resolveMerchantServiceCategory({
    customerService: row.customer_service,
    roleCategory: row.role_category,
    roleConfig: row.role_config,
    legacyCategory: row.legacy_category,
    roleName: row.role_name,
    roleDisplayName: row.role_display_name,
  });
  if (meta.roleLabel && meta.roleLabel !== 'Unknown') return meta.roleLabel;
  return meta.serviceCategoryId !== 'unknown' ? meta.serviceCategory : '';
}

function resolveDistance(
  row: VendorFeedbackCandidateRow,
  coords: CustomerCoords | null
): Pick<VendorFeedbackVendorDto, 'distanceKm' | 'distanceText'> {
  const lat = toNumber(row.latitude);
  const lng = toNumber(row.longitude);
  if (!coords || lat == null || lng == null) return { distanceKm: null, distanceText: null };
  const km = haversineKm(coords.latitude, coords.longitude, lat, lng);
  if (!Number.isFinite(km)) return { distanceKm: null, distanceText: null };
  return {
    distanceKm: Math.round(km * 100) / 100,
    distanceText: formatDistanceKm(km, Boolean(coords.approximate)),
  };
}

export async function mapVendorFeedbackPrompt(
  row: VendorFeedbackCandidateRow,
  coords: CustomerCoords | null
): Promise<VendorFeedbackPromptDto> {
  const kind = resolveVendorFeedbackKind(row.source_type, row.booking_style);
  const photoUrl = await getVendorListingPhotoUrl({
    id: row.vendor_id,
    vendor_id: row.vendor_id,
    vendor_type: row.vendor_type,
    profile_photo_url: row.profile_photo_url,
    metadata: row.metadata,
  });

  return {
    sourceType: row.source_type,
    sourceId: row.source_id,
    bookingId: row.booking_id,
    paymentId: row.payment_id,
    kind,
    title: vendorFeedbackTitle(kind),
    transactionAt: toIso(row.txn_at),
    vendor: {
      vendorId: row.vendor_id,
      name: resolveMerchantDisplayName({
        businessName: row.business_name,
        ownerName: row.owner_name,
        vendorType: row.vendor_type,
        isSoloProvider: String(row.vendor_type ?? '').toLowerCase() === 'solo',
      }),
      photoUrl,
      categoryLabel: resolveCategoryLabel(row),
      isVerified: VERIFIED_STATUSES.has(String(row.vendor_status ?? '').toLowerCase()),
      ...resolveDistance(row, coords),
      address: joinAddress(row.address, row.city),
    },
  };
}
