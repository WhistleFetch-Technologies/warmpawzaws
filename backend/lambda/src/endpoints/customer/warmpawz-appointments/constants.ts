import type { ServicesByStyleDiscoveryOptions } from '../../discovery/services/services-by-style/discovery-options';

/** Warmpawz Appointments discovery: catalogue-gated list, no pricing on cards. */
export const WAPPT_BY_STYLE_DISCOVERY_OPTIONS: ServicesByStyleDiscoveryOptions = {
  wapptCatalogueOnly: true,
  omitPricing: true,
  appointmentListResponse: true,
};
