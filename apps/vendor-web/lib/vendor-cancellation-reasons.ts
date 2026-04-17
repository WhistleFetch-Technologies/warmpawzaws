/**
 * Provider cancellation reasons — must match Admin → Finance → Refund tiers
 * (`vendor_cancellation_reason`: emergency | operational | technical).
 */
export type VendorCancellationReasonSlug = 'emergency' | 'operational' | 'technical';

export const VENDOR_CANCELLATION_REASON_OPTIONS: { value: VendorCancellationReasonSlug; label: string }[] = [
  { value: 'emergency', label: 'Emergency cancellation' },
  { value: 'operational', label: 'Operational issue' },
  { value: 'technical', label: 'Technical failure' },
];
