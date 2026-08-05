import {
  pickCustomerVendorAccountId,
  pickVetPractitionerProfileEntityId,
} from '@warmpawz/shared-types';
import {
  findBoardingListVendorByProfileKey,
  type BoardingListVendor,
  type BoardingPlanRow,
} from '@/lib/boarding-vendor-discovery-map';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
} from '@/lib/vendor-package-purchase-nav';

export type VetHubProfileBackScreen = 'vet' | 'vet-all-doctors';

export interface VetHubNavTarget {
  screen: string;
  data: Record<string, unknown>;
}

function serviceObjFromPlan(plan: BoardingPlanRow): Record<string, unknown> {
  return {
    id: plan.vendorServiceId ?? plan.rowId,
    vendorServiceId: plan.vendorServiceId,
    serviceId: plan.serviceId,
    serviceName: plan.name,
    name: plan.name,
    price: plan.price,
    duration: plan.duration,
    serviceStyle: plan.serviceStyle,
    description: plan.description,
    isPackage: plan.isPackage,
    packageDetails: plan.packageDetails,
    metadata: plan.metadata,
  };
}

/** Book plan from vet hub / all-vets list expandable cards. */
export function buildVetHubBookPlanNav(
  v: BoardingListVendor,
  plan: BoardingPlanRow,
  profileBackScreen: VetHubProfileBackScreen,
): VetHubNavTarget | null {
  const raw = (v.raw || {}) as Record<string, unknown>;
  const providerType = String(raw.providerType || raw.provider_type || '').toLowerCase();
  const serviceObj = serviceObjFromPlan(plan);

  if (providerType === 'staff' || providerType === 'individual') {
    const doctorId =
      pickVetPractitionerProfileEntityId(raw) ||
      String(raw.providerId || raw.provider_id || v.id);
    const vendorForPkg = String(raw.vendorId || raw.vendor_id || doctorId || '').trim();
    if (isVendorServicePackageRow(serviceObj) && vendorForPkg) {
      const pkgNav = buildWalkerServiceDataForVendorPackagePurchase({
        vendorId: vendorForPkg,
        vendorName: v.name,
        serviceRow: serviceObj,
        serviceTypeCategory: 'vet',
        serviceStyle: String(plan.serviceStyle || 'at_center'),
      });
      if (pkgNav) {
        return { screen: 'purchase-package', data: pkgNav };
      }
    }
    return {
      screen: 'vet-doctor-details',
      data: {
        doctorId,
        serviceId: plan.rowId,
        serviceName: plan.name,
        price: plan.price,
        doctorProfileBackScreen: profileBackScreen,
      },
    };
  }

  const vendorId = String(
    pickCustomerVendorAccountId(raw) || raw.vendorId || raw.vendor_id || v.id || ''
  ).trim();

  if (vendorId && isVendorServicePackageRow(serviceObj)) {
    const pkgNav = buildWalkerServiceDataForVendorPackagePurchase({
      vendorId,
      vendorName: v.name,
      serviceRow: serviceObj,
      serviceTypeCategory: 'vet',
      serviceStyle: String(plan.serviceStyle || 'at_center'),
    });
    if (pkgNav) {
      return { screen: 'purchase-package', data: pkgNav };
    }
  }

  return {
    screen: 'vet-booking',
    data: {
      vendorId,
      vendorName: v.name,
      serviceId: plan.rowId,
      serviceName: plan.name,
      price: plan.price,
      duration: plan.duration,
      serviceStyle: plan.serviceStyle || 'at_center',
      serviceType: 'at_center',
      service: serviceObj,
    },
  };
}

/** Chevron / Details from vet hub or all-vets list expandable cards. */
export function buildVetHubProviderProfileNav(
  vendors: BoardingListVendor[],
  profileKey: string,
  profileBackScreen: VetHubProfileBackScreen,
): VetHubNavTarget | null {
  const v = findBoardingListVendorByProfileKey(vendors, profileKey);
  if (!v) return null;

  const raw = (v.raw || {}) as Record<string, unknown>;
  const providerType = String(raw.providerType || raw.provider_type || '').toLowerCase();
  const rawVendorId = String(raw.vendorId || raw.vendor_id || '').trim();
  const rawProviderId = String(raw.providerId || raw.provider_id || '').trim();

  if (providerType === 'staff' || providerType === 'individual') {
    const doctorId =
      pickVetPractitionerProfileEntityId(raw) || rawProviderId || v.id;
    return {
      screen: 'vet-doctor-details',
      data: {
        doctorId,
        doctorProfileBackScreen: profileBackScreen,
      },
    };
  }

  const clinicVendorId =
    pickCustomerVendorAccountId(raw) || rawVendorId || v.id;
  return {
    screen: 'vet-services-by-style',
    data: {
      vendorId: clinicVendorId,
      serviceStyle: 'at_center',
      serviceTypeName: 'Vet Clinic',
      category: 'vet',
      returnScreen: profileBackScreen,
    },
  };
}
