/**
 * Colored icon chips for service hub tiles (Pet Sitter “Sitting options”, Pet Boarding options, etc.).
 * Keep in sync across boarding / sitting flows.
 */
export const HUB_SERVICE_ICON_WRAP = {
  /** Moon / overnight */
  overnightMoon: 'bg-indigo-100 text-indigo-600',
  /** Sun / full day, day visits */
  sunDaytime: 'bg-amber-100 text-amber-600',
  /** Clock / half day, drop-ins */
  clockFlexible: 'bg-rose-100 text-rose-600',
  /** Calendar range / weekend */
  calendarWeekend: 'bg-purple-100 text-purple-600',
  /** Single calendar / weekly or extended multi-day */
  calendarWeekly: 'bg-orange-100 text-[#FF8C42]',
} as const;

/** Maps booking-router `color` keys to Tailwind chip classes */
const COLOR_CHIP: Record<string, string> = {
  indigo: HUB_SERVICE_ICON_WRAP.overnightMoon,
  amber: HUB_SERVICE_ICON_WRAP.sunDaytime,
  rose: HUB_SERVICE_ICON_WRAP.clockFlexible,
  purple: HUB_SERVICE_ICON_WRAP.calendarWeekend,
  orange: HUB_SERVICE_ICON_WRAP.calendarWeekly,
};

export function serviceOptionColorChipClass(color: string | undefined): string {
  if (!color) return COLOR_CHIP.orange;
  return COLOR_CHIP[color] ?? COLOR_CHIP.orange;
}
