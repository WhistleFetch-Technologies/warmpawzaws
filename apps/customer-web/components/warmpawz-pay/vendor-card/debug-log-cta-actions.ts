/**
 * Temporary runtime debug helper — serializes CTA action props for console inspection.
 * Logs icon as component displayName/name (functions are not JSON-serializable).
 */
import type { WarmpawzPayVendorCardAction } from '@/components/warmpawz-pay/vendor-card/types';

export const WPAY_VENDOR_CARD_CTA_DEBUG_PREFIX = '[WPayVendorCardCtaDebug]';

function serializeAction(action: WarmpawzPayVendorCardAction | undefined, slot: string) {
  if (!action) {
    return { slot, present: false };
  }
  const icon = action.icon;
  const iconIsComponent =
    typeof icon === 'function' ||
    (typeof icon === 'object' && icon !== null && '$$typeof' in icon);
  return {
    slot,
    present: true,
    label: action.label,
    subtitle: action.subtitle ?? null,
    subtitleDefined: action.subtitle !== undefined && action.subtitle !== null && action.subtitle !== '',
    iconDefined: icon !== undefined && icon !== null,
    iconIsComponent,
    iconType: typeof icon,
    iconName:
      typeof icon === 'function'
        ? icon.displayName || icon.name || 'LucideIcon'
        : iconIsComponent
          ? 'LucideForwardRef'
          : null,
    variant: action.variant ?? null,
    hasOnClick: typeof action.onClick === 'function',
    className: action.className ?? null,
  };
}

export function logWpayVendorCardCtaActions(source: string, opts: {
  vendorName?: string;
  primaryAction?: WarmpawzPayVendorCardAction;
  secondaryAction?: WarmpawzPayVendorCardAction;
}) {
  const payload = {
    source,
    vendorName: opts.vendorName ?? null,
    primaryAction: serializeAction(opts.primaryAction, 'primaryAction'),
    secondaryAction: serializeAction(opts.secondaryAction, 'secondaryAction'),
  };
  console.info(WPAY_VENDOR_CARD_CTA_DEBUG_PREFIX, JSON.stringify(payload));
  return payload;
}
