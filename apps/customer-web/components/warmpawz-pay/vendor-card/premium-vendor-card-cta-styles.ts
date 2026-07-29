/**
 * Design tokens for Warmpawz Pay premium vendor card CTAs.
 * Final visual polish — matched to marketplace reference.
 */

/** CTA band — pale cream footer */
export const PREMIUM_VENDOR_CARD_CTA_SECTION_CLASS =
  'border-t border-[#F0E6DC]/70 bg-[#FFF9F2] px-3 pb-3 pt-2.5';

/** Two equal columns, 8px gutter (reference spacing) */
export const PREMIUM_VENDOR_CARD_CTA_GRID_CLASS = 'grid grid-cols-2 gap-2';

/**
 * Premium action card — reference height with tight vertical padding.
 */
export const PREMIUM_VENDOR_CARD_CTA_CARD_BASE_CLASS =
  'flex h-[64px] w-full cursor-pointer select-none appearance-none items-center justify-start border-0 px-2.5 py-2 text-left text-white transition-opacity disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

/** Reference corner radius (~11px) */
export const PREMIUM_VENDOR_CARD_CTA_RADIUS_CLASS = 'rounded-[11px]';

/** Orange — darker left, lighter right (reference balance) */
export const PREMIUM_VENDOR_CARD_CTA_PRIMARY_CLASS =
  'bg-gradient-to-r from-[#FF6520] via-[#FF8C42] to-[#FFBA58] shadow-[0_2px_5px_rgba(255,101,32,0.2)] focus-visible:outline-[#FF8C42]';

/** Green — darker left, lighter right (reference balance) */
export const PREMIUM_VENDOR_CARD_CTA_SECONDARY_CLASS =
  'bg-gradient-to-r from-[#1A7D52] via-[#28A066] to-[#4FD092] shadow-[0_2px_5px_rgba(26,125,82,0.2)] focus-visible:outline-[#2E9B52]';

/** Reserved icon slot — fixed width keeps text baselines aligned */
export const PREMIUM_VENDOR_CARD_CTA_ICON_SLOT_CLASS =
  'flex h-8 w-8 shrink-0 items-center justify-center';

/** Reference outline icon size */
export const PREMIUM_VENDOR_CARD_CTA_ICON_CLASS = 'h-[22px] w-[22px] text-white';

/** Reference icon stroke weight */
export const PREMIUM_VENDOR_CARD_CTA_ICON_STROKE = 1.75;

/** Icon ↔ text gap (reference ~8px) */
export const PREMIUM_VENDOR_CARD_CTA_CONTENT_ROW_CLASS =
  'inline-flex min-w-0 max-w-full items-center gap-2';

/** Title baseline — 13px bold */
export const PREMIUM_VENDOR_CARD_CTA_LABEL_CLASS =
  'block whitespace-normal text-[13px] font-bold leading-[1.1] text-white';

/** Subtitle baseline — 10px @ 72% white */
export const PREMIUM_VENDOR_CARD_CTA_SUBTITLE_CLASS =
  'mt-[2px] block whitespace-normal text-[10px] font-normal leading-[1.15] text-white/[0.72]';

export const PREMIUM_VENDOR_CARD_CTA_TEXT_STACK_CLASS =
  'flex min-w-0 flex-col justify-center';

export const PREMIUM_VENDOR_CARD_CTA_TONE_CLASS = {
  primary: PREMIUM_VENDOR_CARD_CTA_PRIMARY_CLASS,
  secondary: PREMIUM_VENDOR_CARD_CTA_SECONDARY_CLASS,
} as const;

export type PremiumVendorCardCtaTone = keyof typeof PREMIUM_VENDOR_CARD_CTA_TONE_CLASS;

/** @deprecated — use PREMIUM_VENDOR_CARD_CTA_CARD_BASE_CLASS */
export const PREMIUM_VENDOR_CARD_CTA_BUTTON_BASE_CLASS = PREMIUM_VENDOR_CARD_CTA_CARD_BASE_CLASS;

/** @deprecated — use PREMIUM_VENDOR_CARD_CTA_ICON_SLOT_CLASS */
export const PREMIUM_VENDOR_CARD_CTA_ICON_WRAP_CLASS = PREMIUM_VENDOR_CARD_CTA_ICON_SLOT_CLASS;
