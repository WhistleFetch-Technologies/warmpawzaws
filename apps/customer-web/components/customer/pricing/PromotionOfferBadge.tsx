'use client';

export type PromotionOfferBadgeProps = {
  variant: 'percent' | 'flat' | 'bogo' | 'bundle';
  value?: number;
  size?: 'sm' | 'md';
  className?: string;
};

export function PromotionOfferBadge({
  variant,
  value,
  size = 'sm',
  className = '',
}: PromotionOfferBadgeProps) {
  const sizeClass = size === 'md' ? 'text-xs px-2 py-0.5' : 'text-[10px] px-1.5 py-0.5';

  let label = 'OFFER';
  switch (variant) {
    case 'percent':
      label = value != null && value > 0 ? `${value}% OFF` : 'OFF';
      break;
    case 'flat':
      label = value != null && value > 0 ? `₹${value} OFF` : 'OFF';
      break;
    case 'bogo':
      label = 'BOGO';
      break;
    case 'bundle':
      label = 'Bundle offer';
      break;
  }

  return (
    <span
      className={`inline-flex items-center rounded-md bg-[#FF8C42] font-bold uppercase tracking-wide text-white ${sizeClass} ${className}`}
    >
      {label}
    </span>
  );
}
