import { isWarmpawzPayModuleCapable } from '@/lib/commerce-switch-routing/warmpawz-pay-feature';

/** Minimal commerce snapshot used to gate Walk-in (Pay) surfaces. */
export type WalkInCommerceGateInput = {
  isLoaded: boolean;
  isWarmpawzPay: boolean;
} | null | undefined;

/**
 * Walk-in home carousel and /walk-in are Warmpawz Pay surfaces.
 * Show only when Commerce Switch is loaded as warmpawz_pay and the module kill-switch allows it.
 */
export function shouldShowWalkInNearYou(
  commerce: WalkInCommerceGateInput,
  moduleCapable: boolean = isWarmpawzPayModuleCapable()
): boolean {
  if (!commerce?.isLoaded) return false;
  if (!commerce.isWarmpawzPay) return false;
  return moduleCapable;
}
