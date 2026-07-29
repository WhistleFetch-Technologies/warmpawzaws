import type { LucideIcon } from 'lucide-react';
import { CalendarCheck, Tag } from 'lucide-react';

/** Discovery appointment list — primary CTA presentation (mapper → action props). */
export const DISCOVERY_VENDOR_CARD_PRIMARY_CTA: {
  subtitle: string;
  icon: LucideIcon;
} = {
  subtitle: 'Reserve your slot',
  icon: CalendarCheck,
};

/** Discovery appointment list — secondary pay CTA presentation (mapper → action props). */
export const DISCOVERY_VENDOR_CARD_SECONDARY_CTA: {
  subtitle: string;
  icon: LucideIcon;
} = {
  subtitle: 'Get discount',
  icon: Tag,
};
