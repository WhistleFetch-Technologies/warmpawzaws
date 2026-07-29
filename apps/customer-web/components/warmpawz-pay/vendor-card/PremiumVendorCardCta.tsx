'use client';

import { cn } from '@/components/ui/utils';
import type { WarmpawzPayVendorCardAction } from './types';
import { logWpayVendorCardCtaActions } from './debug-log-cta-actions';
import {
  PREMIUM_VENDOR_CARD_CTA_CARD_BASE_CLASS,
  PREMIUM_VENDOR_CARD_CTA_CONTENT_ROW_CLASS,
  PREMIUM_VENDOR_CARD_CTA_GRID_CLASS,
  PREMIUM_VENDOR_CARD_CTA_ICON_CLASS,
  PREMIUM_VENDOR_CARD_CTA_ICON_SLOT_CLASS,
  PREMIUM_VENDOR_CARD_CTA_ICON_STROKE,
  PREMIUM_VENDOR_CARD_CTA_LABEL_CLASS,
  PREMIUM_VENDOR_CARD_CTA_RADIUS_CLASS,
  PREMIUM_VENDOR_CARD_CTA_SECTION_CLASS,
  PREMIUM_VENDOR_CARD_CTA_SUBTITLE_CLASS,
  PREMIUM_VENDOR_CARD_CTA_TEXT_STACK_CLASS,
  PREMIUM_VENDOR_CARD_CTA_TONE_CLASS,
  type PremiumVendorCardCtaTone,
} from './premium-vendor-card-cta-styles';

function normalizeCopy(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

type PremiumVendorCardCtaCardProps = {
  action: WarmpawzPayVendorCardAction;
  tone: PremiumVendorCardCtaTone;
};

/** Premium action card — interactive surface styled as a card, not a flat button. */
export function PremiumVendorCardCtaCard({ action, tone }: PremiumVendorCardCtaCardProps) {
  const {
    label,
    subtitle,
    icon: Icon,
    onClick,
    disabled,
    loading,
    className,
  } = action;
  const subtitleText = normalizeCopy(subtitle);

  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        PREMIUM_VENDOR_CARD_CTA_CARD_BASE_CLASS,
        PREMIUM_VENDOR_CARD_CTA_RADIUS_CLASS,
        className,
        PREMIUM_VENDOR_CARD_CTA_TONE_CLASS[tone],
      )}
      onClick={onClick}
    >
      <span className={PREMIUM_VENDOR_CARD_CTA_CONTENT_ROW_CLASS}>
        <span className={PREMIUM_VENDOR_CARD_CTA_ICON_SLOT_CLASS} aria-hidden data-slot="cta-icon-slot">
          {Icon ? (
            <Icon className={PREMIUM_VENDOR_CARD_CTA_ICON_CLASS} strokeWidth={PREMIUM_VENDOR_CARD_CTA_ICON_STROKE} />
          ) : null}
        </span>
        <span className={PREMIUM_VENDOR_CARD_CTA_TEXT_STACK_CLASS}>
          <span className={PREMIUM_VENDOR_CARD_CTA_LABEL_CLASS}>{label}</span>
          {subtitleText ? (
            <span className={PREMIUM_VENDOR_CARD_CTA_SUBTITLE_CLASS}>{subtitleText}</span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

/** @deprecated PR-15 alias */
export const PremiumVendorCardCtaButton = PremiumVendorCardCtaCard;

type PremiumVendorCardCtaSectionProps = {
  primaryAction?: WarmpawzPayVendorCardAction;
  secondaryAction?: WarmpawzPayVendorCardAction;
  footerHint?: string;
  className?: string;
};

export function PremiumVendorCardCtaSection({
  primaryAction,
  secondaryAction,
  footerHint,
  className,
}: PremiumVendorCardCtaSectionProps) {
  const hint = normalizeCopy(footerHint);
  const showActions = Boolean(primaryAction || secondaryAction);
  const actionCount = (primaryAction ? 1 : 0) + (secondaryAction ? 1 : 0);

  if (!hint && !showActions) return null;

  logWpayVendorCardCtaActions('PremiumVendorCardCtaSection.render', {
    primaryAction,
    secondaryAction,
  });

  return (
    <div className={cn(PREMIUM_VENDOR_CARD_CTA_SECTION_CLASS, className)}>
      {hint ? <p className="mb-2 text-sm text-gray-600">{hint}</p> : null}
      {showActions ? (
        <div
          className={cn(
            actionCount === 2
              ? PREMIUM_VENDOR_CARD_CTA_GRID_CLASS
              : 'grid grid-cols-1 gap-2',
          )}
        >
          {primaryAction ? (
            <PremiumVendorCardCtaCard action={primaryAction} tone="primary" />
          ) : null}
          {secondaryAction ? (
            <PremiumVendorCardCtaCard action={secondaryAction} tone="secondary" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
