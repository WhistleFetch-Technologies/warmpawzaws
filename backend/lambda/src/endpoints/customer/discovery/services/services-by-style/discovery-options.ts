/** Optional filters for by-style discovery (default path unchanged when omitted). */
export type ServicesByStyleDiscoveryOptions = {
  /** Restrict to admin-published Warmpawz Appointments catalogue vendors. */
  wapptCatalogueOnly?: boolean;
  /** Skip price aggregates and omit price fields from cards. */
  omitPricing?: boolean;
  /** Use appointment card DTO (no priceMin) in the JSON envelope. */
  appointmentListResponse?: boolean;
  /** Tag vendor cards with warmpawzAppointments: true in the list DTO. */
  markWarmpawzAppointments?: boolean;
};
