import {
  pickCustomerVendorAccountId,
  pickVetPractitionerProfileEntityId,
  pickWalkerVendorId,
} from '@warmpawz/shared-types';
import {
  WAPPT_VENDOR_PROFILE_SCREEN,
  buildWarmpawzAppointmentsProfileNav,
} from '@/lib/warmpawz-appointments-customer';

export type WebCustomerVendorStyleListingVertical = 'vet' | 'grooming';

export interface WebStyleListingVendorLike {
  id: string;
  name?: string;
  type?: string;
  vendorId?: string;
  vendorName?: string;
  vendorData?: unknown;
}

function listingVendorToRow(v: WebStyleListingVendorLike): Record<string, unknown> {
  const raw =
    v.vendorData && typeof v.vendorData === 'object' && v.vendorData !== null
      ? (v.vendorData as Record<string, unknown>)
      : {};
  return {
    ...raw,
    id: v.id,
    vendorId: v.vendorId ?? raw.vendorId,
    vendor_id: raw.vendor_id,
    type: v.type ?? raw.type ?? raw.providerType,
    providerType: raw.providerType,
    providerId: raw.providerId ?? raw.provider_id,
    provider_id: raw.provider_id,
  };
}

/**
 * Maps vet/grooming “by style” listing rows to the same screens {@link CustomerHomeWrapper}
 * already handles (`vet-clinic-profile`, `vet-doctor-details`, `vet-services-by-style`,
 * `grooming-vendor-profile` → wrapper opens grooming_center / grooming_home).
 */
export function getWebCustomerVendorStyleListingNavTarget(input: {
  vertical: WebCustomerVendorStyleListingVertical;
  serviceStyle: string;
  category?: string;
  serviceTypeName?: string;
  vendor: WebStyleListingVendorLike;
}): { screen: string; data: Record<string, unknown> } {
  const row = listingVendorToRow(input.vendor);
  const style = String(input.serviceStyle || '').toLowerCase();
  const accountId = pickCustomerVendorAccountId(row);
  const vType = String(input.vendor.type || (row.type as string) || 'vendor').toLowerCase();

  if (input.vertical === 'grooming') {
    return {
      screen: 'grooming-vendor-profile',
      data: {
        vendorId: accountId,
        vendorType: input.vendor.type || 'vendor',
        serviceStyle: input.serviceStyle,
        category: input.category || 'grooming',
        vendorName: input.vendor.name,
        vendorData: input.vendor.vendorData,
      },
    };
  }

  if (vType === 'staff' || vType === 'individual') {
    const doctorId = pickVetPractitionerProfileEntityId(row);
    return {
      screen: 'vet-doctor-details',
      data: {
        doctorId,
        doctorProfileBackScreen: 'vet-services-by-style',
      },
    };
  }

  if (style === 'at_center' && vType === 'vendor') {
    return {
      screen: 'vet-clinic-profile',
      data: {
        id: accountId,
        clinicProfileBackScreen: 'vet-services-by-style',
      },
    };
  }

  return {
    screen: 'vet-services-by-style',
    data: {
      vendorId: accountId,
      serviceStyle: String(input.serviceStyle),
      serviceTypeName: input.serviceTypeName || 'Veterinary Services',
      category: input.category || 'vet',
    },
  };
}

/** VetServicesByStyle / UniversalServicesByStyle chevron: same routing rules as style listings. */
export function getWebVetDiscoveryChevronNavTarget(input: {
  serviceStyle: string;
  serviceTypeName?: string;
  category?: string;
  provider: Record<string, unknown>;
  /** e.g. `vet` when opened from main vet hub vs style browser */
  doctorProfileBackScreen?: string;
  /**
   * When set (e.g. `problem_grid_flow`), used as doctor back, clinic profile back,
   * and `returnScreen` on vet-services-by-style drill-in so nested screens return correctly.
   */
  profileBackScreen?: string;
}): { screen: string; data: Record<string, unknown> } {
  const pt = String(input.provider.providerType ?? input.provider.type ?? 'vendor').toLowerCase();
  const row = { ...input.provider, type: pt === 'staff' ? 'staff' : pt === 'individual' ? 'individual' : 'vendor' };
  const accountId = pickCustomerVendorAccountId(row);
  const embedBack = input.profileBackScreen;
  const doctorBack = embedBack ?? input.doctorProfileBackScreen ?? 'vet-services-by-style';

  if (pt === 'staff' || pt === 'individual') {
    const doctorId = pickVetPractitionerProfileEntityId(input.provider);
    return {
      screen: 'vet-doctor-details',
      data: {
        doctorId,
        doctorProfileBackScreen: doctorBack,
      },
    };
  }

  const style = String(input.serviceStyle || '').toLowerCase();
  if (style === 'at_center') {
    return {
      screen: 'vet-clinic-profile',
      data: {
        id: accountId,
        clinicProfileBackScreen: embedBack ?? 'vet-services-by-style',
      },
    };
  }

  const vid = String(
    input.provider.vendorId ?? input.provider.vendor_id ?? input.provider.providerId ?? ''
  );
  return {
    screen: 'vet-services-by-style',
    data: {
      vendorId: vid || accountId,
      serviceStyle: String(input.serviceStyle),
      serviceTypeName: input.serviceTypeName || 'Veterinary Services',
      category: input.category || 'vet',
      ...(embedBack ? { returnScreen: embedBack } : {}),
    },
  };
}

export function getWebGroomingTrainingEmbedVendorId(provider: Record<string, unknown>): string {
  return pickCustomerVendorAccountId(provider);
}

/** Walker problem-grid / UniversalServicesByStyle chevron → {@link HomeServiceProviderProfile}. */
export function getWebWalkerDiscoveryChevronNavTarget(input: {
  provider: Record<string, unknown>;
  providerDisplayName?: string;
  serviceStyle: string;
  profileBackScreen?: string;
  specialization?: string;
}): { screen: string; data: Record<string, unknown> } | null {
  const row = input.provider;
  const vendorId =
    pickWalkerVendorId(row) || pickCustomerVendorAccountId(row) || '';
  if (!String(vendorId).trim()) {
    return null;
  }
  const displayName =
    input.providerDisplayName?.trim() ||
    String(row.name || row.businessName || row.business_name || 'Walker').trim() ||
    'Walker';
  return buildWalkerProviderProfileNavPayload({
    vendorId: String(vendorId).trim(),
    displayName,
    serviceStyle: input.serviceStyle,
    profileBackScreen: input.profileBackScreen,
    specialization: input.specialization,
    walkerSeed: row,
  });
}

/** Available Walkers hub (WAPPT) → {@link WarmpawzAppointmentsVendorProfile}. */
export function buildWalkerWapptProfileNavFromRow(input: {
  walker: Record<string, unknown>;
  profileBackScreen?: string;
  serviceStyle?: string;
}): { screen: string; data: Record<string, unknown> } | null {
  const row = input.walker;
  const vendorId = pickWalkerVendorId(row) || pickCustomerVendorAccountId(row) || '';
  if (!String(vendorId).trim()) {
    return null;
  }
  const vendorName =
    String(row.name || row.businessName || row.business_name || '').trim() || undefined;
  return {
    screen: WAPPT_VENDOR_PROFILE_SCREEN,
    data: buildWarmpawzAppointmentsProfileNav({
      vendorId: String(vendorId).trim(),
      vendorName,
      category: 'walker',
      serviceStyle: String(input.serviceStyle ?? 'at_home'),
      profileBackScreen: input.profileBackScreen ?? 'walker',
    }),
  };
}

/** UniversalServicesByStyle vendorId embed must redirect to HomeServiceProviderProfile, not vet-style profile UI. */
export function buildWalkerProviderProfileNavPayload(input: {
  vendorId: string;
  displayName?: string;
  serviceStyle: string;
  profileBackScreen?: string;
  specialization?: string;
  walkerSeed?: Record<string, unknown>;
}): { screen: string; data: Record<string, unknown> } {
  const displayName = input.displayName?.trim() || 'Walker';
  return {
    screen: 'walker-provider-profile',
    data: {
      vendorId: input.vendorId,
      walker: { name: displayName, vendorId: input.vendorId, ...(input.walkerSeed ?? {}) },
      serviceType: 'walking',
      serviceStyle: String(input.serviceStyle),
      ...(input.profileBackScreen ? { walkerProfileBackScreen: input.profileBackScreen } : {}),
      ...(input.specialization ? { specialization: input.specialization } : {}),
    },
  };
}

/** Legacy `vet-vendor-profile` payloads from older navigators. */
export function normalizeLegacyVetVendorProfilePayload(data: Record<string, unknown>): WebStyleListingVendorLike {
  const vd = data.vendorData;
  const base =
    vd && typeof vd === 'object' && vd !== null ? (vd as Record<string, unknown>) : {};
  return {
    id: String(data.vendorId ?? data.id ?? ''),
    name: (data.vendorName as string) || (base.name as string),
    type: String(data.vendorType ?? base.type ?? 'vendor'),
    vendorId: data.vendorId != null ? String(data.vendorId) : undefined,
    vendorName: data.vendorName as string | undefined,
    vendorData: vd,
  };
}
