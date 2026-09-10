/**
 * Surface adapters that stamp commerce context onto DiscountContext.
 *
 * These are not promotion engines. They do not calculate discounts, stack,
 * rank, or choose a resolver. Every surface feeds the same Discount Engine V2.
 *
 * Commerce Switch supplies the active platform model. It must never select
 * a Marketplace vs WPay vs Appointment promotion engine — those do not exist.
 */
import type { CommerceModelId } from '../../commerce-switch/contracts/commerce-model';
import { getCommerceResolver } from '../../commerce-switch/di/commerce-switch-container';
import { DiscountDomain } from '../enums/discount-domain';
import { DiscountTrigger } from '../enums/discount-trigger';
import {
  isDiscountTransactionType,
  type DiscountTransactionType,
} from '../enums/discount-transaction-type';
import type { DiscountContext } from '../models/discount-context';

export function isCommerceModelId(value: unknown): value is CommerceModelId {
  return value === 'marketplace' || value === 'warmpawz_pay';
}

export function assertCommerceModelId(value: unknown): CommerceModelId {
  if (!isCommerceModelId(value)) {
    throw new Error(`Invalid commerce model: ${String(value)}`);
  }
  return value;
}

export function assertDiscountTransactionType(value: unknown): DiscountTransactionType {
  if (!isDiscountTransactionType(value)) {
    throw new Error(`Invalid discount transaction type: ${String(value)}`);
  }
  return value;
}

/**
 * Stamps commerce model + transaction type. No eligibility, stacking, or math.
 */
export function applyDiscountCommerceContext(
  context: DiscountContext,
  commerceModel: CommerceModelId,
  transactionType: DiscountTransactionType
): DiscountContext {
  return {
    ...context,
    commerceModel: assertCommerceModelId(commerceModel),
    transactionType: assertDiscountTransactionType(transactionType),
  };
}

/** Commerce Switch is the only authority for the active model. Does not select an engine. */
export async function resolveDiscountCommerceModelFromSwitch(): Promise<CommerceModelId> {
  const resolved = await getCommerceResolver().resolveActiveModel({});
  return assertCommerceModelId(resolved.activeModelId);
}

/** Shared request shape for Warmpawz Pay surfaces. Mapper input only. */
export type WarmpawzPaySurfaceRequest = {
  vendorId?: string;
  customerId?: string;
  amount: number;
  couponCode?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Pay Bill → DiscountContext for the same engine.
 * Mapper only — no %, D < C, burnMode, or payable math.
 */
export function payBillRequestToDiscountContext(
  input: WarmpawzPaySurfaceRequest
): DiscountContext {
  const couponCode = input.couponCode?.trim() || undefined;
  return {
    domain: DiscountDomain.SERVICE,
    trigger: couponCode ? DiscountTrigger.CODE : DiscountTrigger.AUTO,
    commerceModel: 'warmpawz_pay',
    transactionType: 'pay_bill',
    vendorId: input.vendorId,
    customerId: input.customerId,
    amount: input.amount,
    couponCode,
    metadata: input.metadata,
  };
}

/** WPay quote Q → DiscountContext. Amount is quoted Q, never payNow. */
export function wpayQuoteToDiscountContext(input: {
  quotedAmount: number;
  vendorId?: string;
  customerId?: string;
  couponCode?: string;
  metadata?: Record<string, unknown>;
}): DiscountContext {
  return payBillRequestToDiscountContext({
    amount: input.quotedAmount,
    vendorId: input.vendorId,
    customerId: input.customerId,
    couponCode: input.couponCode,
    metadata: input.metadata,
  });
}

/**
 * Appointment → DiscountContext for the same engine.
 * Amount is the catalogue appointment fee. No SKU/service inventing.
 */
export function appointmentRequestToDiscountContext(
  input: WarmpawzPaySurfaceRequest
): DiscountContext {
  const couponCode = input.couponCode?.trim() || undefined;
  return {
    domain: DiscountDomain.SERVICE,
    trigger: couponCode ? DiscountTrigger.CODE : DiscountTrigger.AUTO,
    commerceModel: 'warmpawz_pay',
    transactionType: 'appointment',
    vendorId: input.vendorId,
    customerId: input.customerId,
    amount: input.amount,
    couponCode,
    metadata: input.metadata,
  };
}

/** Catalogue appointment fee → DiscountContext. Mapper only — no discount math. */
export function appointmentFeeToDiscountContext(input: {
  appointmentFee: number;
  vendorId?: string;
  customerId?: string;
  couponCode?: string;
  metadata?: Record<string, unknown>;
}): DiscountContext {
  return appointmentRequestToDiscountContext({
    amount: input.appointmentFee,
    vendorId: input.vendorId,
    customerId: input.customerId,
    couponCode: input.couponCode,
    metadata: input.metadata,
  });
}
