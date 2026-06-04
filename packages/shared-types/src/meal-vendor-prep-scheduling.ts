import {
  MEAL_PIDGE_DELIVERY_BUFFER_MIN,
  commitmentDeliveryAtMs,
  parseScheduledDeliverySlot,
} from './meal-pidge-scheduling';

export const MEAL_VENDOR_EARLY_PREP_WARNING =
  "You're starting preparation earlier than recommended. Food may be ready too early for the scheduled delivery time.";

export type BuildVendorPrepSchedulingInput = {
  scheduledDeliveryDate: unknown;
  scheduledDeliverySlot: unknown;
  prepMinutes: number;
  bufferMinutes?: number;
  nowMs?: number;
};

export type VendorPrepSchedulingResult = {
  commitment_at_ms: number | null;
  commitment_at_iso: string | null;
  recommended_prepare_at_ms: number | null;
  recommended_prepare_at_iso: string | null;
  prep_minutes: number;
  buffer_minutes: number;
  /** True when now is before recommended_prepare_at (guidance only — do not block prep). */
  isEarlyPrep: boolean;
  /** Before prep starts: recommended_prepare_at + prep_minutes (aligns with expected_ready_at after start). */
  expected_ready_before_start_ms: number | null;
  expected_ready_before_start_iso: string | null;
};

/**
 * Vendor prep alignment: start preparing around
 * commitment_at - prep_minutes - logistics_buffer (default 30 min).
 */
export function buildVendorPrepScheduling(
  input: BuildVendorPrepSchedulingInput,
): VendorPrepSchedulingResult {
  const bufferMin = input.bufferMinutes ?? MEAL_PIDGE_DELIVERY_BUFFER_MIN;
  const prepMinutes = Math.max(0, Math.floor(Number(input.prepMinutes) || 0));
  const nowMs = input.nowMs ?? Date.now();
  const slot = parseScheduledDeliverySlot(input.scheduledDeliverySlot);
  const commitmentMs = commitmentDeliveryAtMs(input.scheduledDeliveryDate, slot);

  let recommendedMs: number | null = null;
  if (commitmentMs != null && Number.isFinite(commitmentMs)) {
    recommendedMs = commitmentMs - prepMinutes * 60_000 - bufferMin * 60_000;
  }

  const isEarlyPrep = recommendedMs != null && nowMs < recommendedMs;
  const expectedReadyBeforeStartMs =
    recommendedMs != null ? recommendedMs + prepMinutes * 60_000 : null;

  return {
    commitment_at_ms: commitmentMs,
    commitment_at_iso: commitmentMs != null ? new Date(commitmentMs).toISOString() : null,
    recommended_prepare_at_ms: recommendedMs,
    recommended_prepare_at_iso:
      recommendedMs != null ? new Date(recommendedMs).toISOString() : null,
    prep_minutes: prepMinutes,
    buffer_minutes: bufferMin,
    isEarlyPrep,
    expected_ready_before_start_ms: expectedReadyBeforeStartMs,
    expected_ready_before_start_iso:
      expectedReadyBeforeStartMs != null
        ? new Date(expectedReadyBeforeStartMs).toISOString()
        : null,
  };
}
