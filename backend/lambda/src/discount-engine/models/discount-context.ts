import type { CommerceModelId } from '../../commerce-switch/contracts/commerce-model';
import type { DiscountDomain } from '../enums/discount-domain';
import type { DiscountFunding } from '../enums/discount-funding';
import type { DiscountOwner } from '../enums/discount-owner';
import type { DiscountTrigger } from '../enums/discount-trigger';
import type { DiscountTransactionType } from '../enums/discount-transaction-type';

/** Line item within a cart, order, or booking context. */
export interface DiscountContextItem {
  id: string;
  productId?: string;
  serviceId?: string;
  quantity: number;
  unitPrice: number;
  category?: string;
  categoryId?: string;
  metadata?: Record<string, unknown>;
}

export interface DiscountContextLocation {
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}

export interface DiscountContextPayment {
  method?: string;
  currency?: string;
}

export interface DiscountContextBooking {
  bookingId?: string;
  serviceIds?: string[];
  serviceCategory?: string;
  serviceStyle?: string;
}

export interface DiscountContextOrder {
  orderId?: string;
  cartId?: string;
}

/**
 * Canonical input to Discount Engine V2 — the single Promotion & Benefits Engine.
 * `commerceModel` is a context dimension, not an engine selector.
 */
export interface DiscountContext {
  domain: DiscountDomain;
  trigger: DiscountTrigger;

  /**
   * Which of the two commerce models this transaction belongs to.
   * Production mappers always stamp this. Optional on ad-hoc test fixtures.
   */
  commerceModel?: CommerceModelId;
  /**
   * Transaction surface under that model.
   * Appointment is `warmpawz_pay` + `appointment` — never a third CommerceModelId.
   */
  transactionType?: DiscountTransactionType;

  owner?: DiscountOwner;
  funding?: DiscountFunding;

  customerId?: string;
  vendorId?: string;

  items?: DiscountContextItem[];
  booking?: DiscountContextBooking;
  order?: DiscountContextOrder;

  /** Primary monetary amount (subtotal / booking base before discounts). */
  amount: number;

  payment?: DiscountContextPayment;
  location?: DiscountContextLocation;

  /** Coupon code when trigger is CODE. */
  couponCode?: string;

  /** Explicit promotion id for manual / code-based vendor promos. */
  manualPromotionId?: string;

  /** Point-in-time for eligibility (defaults to now in adapters). */
  evaluatedAt?: Date;

  /**
   * Extension bag for adapter-specific data (e.g. preloaded promotion rows).
   * Avoids duplicating DB fetch logic inside adapters in Phase 1.
   */
  metadata?: Record<string, unknown>;
}
