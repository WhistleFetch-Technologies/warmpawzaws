/**
 * Transaction surface that produced a DiscountContext.
 * Appointment is a warmpawz_pay surface — never a CommerceModelId.
 */
export const DISCOUNT_TRANSACTION_TYPES = ['booking', 'cart', 'pay_bill', 'appointment'] as const;

export type DiscountTransactionType = (typeof DISCOUNT_TRANSACTION_TYPES)[number];

export function isDiscountTransactionType(value: unknown): value is DiscountTransactionType {
  return (
    value === 'booking' ||
    value === 'cart' ||
    value === 'pay_bill' ||
    value === 'appointment'
  );
}
