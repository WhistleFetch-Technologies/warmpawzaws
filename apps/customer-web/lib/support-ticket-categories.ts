/** Linked booking / meal-order ticket categories (shown on track-order help flow). */
export const LINKED_SUPPORT_TICKET_CATEGORIES = [
  { value: 'billing', label: 'Payment or refund' },
  { value: 'cancellation', label: 'Cancellation / reschedule' },
  { value: 'delivery', label: 'Delivery or appointment issue' },
  { value: 'wrong_items', label: 'Wrong or missing items' },
  { value: 'quality', label: 'Quality issue' },
  { value: 'other', label: 'Other' },
] as const;

export type LinkedSupportTicketCategory =
  (typeof LINKED_SUPPORT_TICKET_CATEGORIES)[number]['value'];

export const DEFAULT_LINKED_SUPPORT_CATEGORY: LinkedSupportTicketCategory = 'billing';

/** General help center ticket (no linked booking/order). */
export const GENERAL_SUPPORT_TICKET_CATEGORIES = [
  { value: 'general', label: 'General query' },
  { value: 'account', label: 'Account' },
] as const;

/** Labels for legacy general categories (existing tickets only). */
const LEGACY_GENERAL_CATEGORY_LABELS: Record<string, string> = {
  billing: 'Payment or refund',
  service: 'Booking / service issue',
  other: 'Order / other issue',
  technical: 'Technical support',
};

const LINKED_LABELS: Record<string, string> = Object.fromEntries(
  LINKED_SUPPORT_TICKET_CATEGORIES.map((c) => [c.value, c.label]),
);

const GENERAL_LABELS: Record<string, string> = {
  ...Object.fromEntries(GENERAL_SUPPORT_TICKET_CATEGORIES.map((c) => [c.value, c.label])),
  ...LEGACY_GENERAL_CATEGORY_LABELS,
};

export function supportTicketCategoryLabel(category?: string | null): string {
  const key = (category || '').trim().toLowerCase();
  if (!key) return 'General';
  return LINKED_LABELS[key] || GENERAL_LABELS[key] || key.replace(/_/g, ' ');
}
