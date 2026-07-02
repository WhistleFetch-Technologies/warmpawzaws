/** Unified marketplace model — customer-web UI only */

export type MarketplaceDomain = 'service' | 'package' | 'meal' | 'product';

export type MarketplaceLifecycleStage =
  | 'discovery'
  | 'detail'
  | 'checkout'
  | 'confirmation'
  | 'history'
  | 'tracking'
  | 'cancellation'
  | 'review';

export type MarketplaceAvailability = 'available' | 'limited' | 'unavailable' | 'scheduled';

export type MarketplaceCardData = {
  domain: MarketplaceDomain;
  id: string;
  imageUrl?: string;
  imageFallback?: string;
  title: string;
  vendorName?: string;
  rating?: number;
  reviewCount?: number;
  originalPrice?: number;
  currentPrice: number;
  savingsAmount?: number;
  promotionLabel?: string;
  availability?: MarketplaceAvailability;
  availabilityLabel?: string;
  subtitle?: string;
  meta?: string[];
};

export type MarketplaceHistoryItem = {
  domain: MarketplaceDomain;
  id: string;
  displayId?: string;
  title: string;
  vendorName?: string;
  statusLabel: string;
  statusTone?: 'default' | 'success' | 'warning' | 'danger' | 'muted';
  imageUrl?: string;
  imageFallback?: string;
  originalPrice?: number;
  paidAmount: number;
  savingsAmount?: number;
  promotionLabel?: string;
  dateLabel?: string;
  timeLabel?: string;
  subtitle?: string;
};

export type MarketplaceTimelineStep = {
  id: string;
  label: string;
  description?: string;
  completed: boolean;
  current?: boolean;
};

export type MarketplaceConfirmationData = {
  domain: MarketplaceDomain;
  orderNumber: string;
  title: string;
  vendorName?: string;
  paidAmount: number;
  savingsAmount?: number;
  promotionLabel?: string;
  summaryLines?: { label: string; value: string }[];
};

export type MarketplaceAction = {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'outline';
  onClick: () => void;
  disabled?: boolean;
};

export const DOMAIN_LABELS: Record<MarketplaceDomain, string> = {
  service: 'Service',
  package: 'Package',
  meal: 'Meal plan',
  product: 'Product',
};

export const MARKETPLACE_SHELL_CLASS =
  'mx-auto w-full max-w-customer min-h-[100dvh] bg-[#F2F4F7]';

export const MARKETPLACE_CARD_CLASS =
  'rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.06)]';
