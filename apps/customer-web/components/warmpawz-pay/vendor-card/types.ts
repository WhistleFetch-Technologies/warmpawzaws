import type { MouseEvent } from 'react';
import type { LucideIcon } from 'lucide-react';

export type WarmpawzPayVendorCardVariant = 'compact' | 'rich';

export type WarmpawzPayVendorCardAction = {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  /** Optional presentation override from parent */
  className?: string;
  /** Rich layout — secondary line under the CTA label */
  subtitle?: string;
  /** Rich layout — leading icon */
  icon?: LucideIcon;
};

export type WarmpawzPayVendorCardBadge = {
  label: string;
  tone?: 'brand' | 'discount' | 'neutral' | 'success';
};

export type WarmpawzPayVendorCardMetaTone = 'default' | 'muted' | 'accent' | 'success';

export type WarmpawzPayVendorCardMetaItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  tone?: WarmpawzPayVendorCardMetaTone;
};

export type WarmpawzPayVendorCardRating = {
  average: number;
  reviewCount: number;
};

export type WarmpawzPayVendorCardProps = {
  name: string;
  imageUrl?: string | null;
  subtitle?: string;
  rating?: WarmpawzPayVendorCardRating | null;
  address?: string;
  metaItems?: WarmpawzPayVendorCardMetaItem[];
  badges?: WarmpawzPayVendorCardBadge[];
  primaryAction?: WarmpawzPayVendorCardAction;
  secondaryAction?: WarmpawzPayVendorCardAction;
  footerHint?: string;
  showVerified?: boolean;
  /** Screen-reader label when showVerified — supplied by parent */
  verifiedAriaLabel?: string;
  /** Profile chevron aria-label — supplied by parent */
  profileAriaLabel?: string;
  className?: string;
  /** compact = Pay Hub; rich = appointment discovery (legacy parity) */
  variant?: WarmpawzPayVendorCardVariant;
  /** Rich layout — category chip (defaults to subtitle) */
  categoryLabel?: string;
  city?: string;
  distanceText?: string | null;
  availabilityText?: string;
  onProfileClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Reserved for future list pricing — omitted when unavailable */
  priceLabel?: string;
  /** Reserved for future cover banner — omitted when unavailable */
  heroImageUrl?: string | null;
  /** Rich layout — e.g. "10 years experience" */
  experienceText?: string;
};
