import {
  pickCustomerVendorAccountId,
  pickVetPractitionerProfileEntityId,
} from '@warmpawz/shared-types';

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
}): { screen: string; data: Record<string, unknown> } {
  const pt = String(input.provider.providerType ?? input.provider.type ?? 'vendor').toLowerCase();
  const row = { ...input.provider, type: pt === 'staff' ? 'staff' : pt === 'individual' ? 'individual' : 'vendor' };
  const accountId = pickCustomerVendorAccountId(row);
  const doctorBack = input.doctorProfileBackScreen ?? 'vet-services-by-style';

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
        clinicProfileBackScreen: 'vet-services-by-style',
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
    },
  };
}

export function getWebGroomingTrainingEmbedVendorId(provider: Record<string, unknown>): string {
  return pickCustomerVendorAccountId(provider);
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
