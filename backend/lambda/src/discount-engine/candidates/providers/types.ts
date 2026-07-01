import type { DiscountDomain } from '../../enums/discount-domain';
import type { DiscountSource } from '../../enums/discount-source';
import type { DiscountTrigger } from '../../enums/discount-trigger';

/** Input for candidate providers (Phase 4 resolver). */
export interface CandidateLoadContext {
  domain?: DiscountDomain;
  vendorId?: string;
  customerId?: string;
  trigger?: DiscountTrigger;
  code?: string;
  serviceIds?: string[];
  serviceCategory?: string;
  serviceStyle?: string;
  amount?: number;
  /** When set, providers return these rows without querying (tests / preloaded handlers). */
  preloadedRows?: unknown[];
}

/**
 * Loads raw entities from a single discount source.
 * No eligibility, benefit math, or normalization.
 */
export interface CandidateProvider {
  readonly source: DiscountSource;
  load(context: CandidateLoadContext): Promise<unknown[]>;
}
