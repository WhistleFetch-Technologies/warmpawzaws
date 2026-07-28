import { WAPPT_APPOINTMENTS_ENV_KEY } from '../constants/wappt-catalogue';
import { dbIsVendorWapptCataloguePublished } from '../repos/wappt-catalogue.repo';
import type { ServicesByStyleDiscoveryOptions } from './services-by-style/discovery-options';

const TRUTHY = new Set(['true', '1', 'yes', 'on']);

function envFlagEnabled(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return TRUTHY.has(value.trim().toLowerCase());
}

export function isWarmpawzAppointmentsDiscoveryEnabled(): boolean {
  return envFlagEnabled(process.env[WAPPT_APPOINTMENTS_ENV_KEY]);
}

export function resolveWarmpawzByStyleDiscoveryOptions(): ServicesByStyleDiscoveryOptions {
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

export async function shouldOmitVendorServicePricing(vendorId: string): Promise<boolean> {
  if (!isWarmpawzAppointmentsDiscoveryEnabled()) {
    return false;
  }
  return dbIsVendorWapptCataloguePublished(vendorId);
}
