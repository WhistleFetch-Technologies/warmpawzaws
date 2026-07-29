import { WAPPT_APPOINTMENTS_ENV_KEY } from '../constants/wappt-catalogue';
import { dbIsVendorWapptCataloguePublished } from '../repos/wappt-catalogue.repo';
import type { CatalogueDiscoveryOptions } from './shared/catalogue-discovery-options';

const TRUTHY = new Set(['true', '1', 'yes', 'on']);

function envFlagEnabled(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return TRUTHY.has(value.trim().toLowerCase());
}

export function isWarmpawzAppointmentsDiscoveryEnabled(): boolean {
  return envFlagEnabled(process.env[WAPPT_APPOINTMENTS_ENV_KEY]);
}

export function resolveWarmpawzCatalogueDiscoveryOptions(): CatalogueDiscoveryOptions {
  if (!isWarmpawzAppointmentsDiscoveryEnabled()) {
    return {};
  }
  return {
    wapptCatalogueOnly: true,
    omitPricing: true,
    appointmentListResponse: false,
    markWarmpawzAppointments: true,
  };
}

/** @deprecated use resolveWarmpawzCatalogueDiscoveryOptions */
export function resolveWarmpawzByStyleDiscoveryOptions(): CatalogueDiscoveryOptions {
  return resolveWarmpawzCatalogueDiscoveryOptions();
}

export async function shouldOmitVendorServicePricing(vendorId: string): Promise<boolean> {
  if (!isWarmpawzAppointmentsDiscoveryEnabled()) {
    return false;
  }
  return dbIsVendorWapptCataloguePublished(vendorId);
}
