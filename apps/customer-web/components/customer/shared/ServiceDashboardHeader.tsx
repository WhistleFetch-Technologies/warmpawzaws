'use client';

import { ArrowLeft, ChevronLeft, LucideIcon, CheckCircle2, X } from 'lucide-react';
import { Fragment, ReactNode, useId, useSyncExternalStore } from 'react';
import {
  isCapacitorNativePlatform,
  isNarrowMobileViewport,
  resolveServiceHeaderTopPad,
  subscribeToNarrowMobileViewport,
} from '@/lib/service-header-safe-area';

export type StatAccentColor = 'orange' | 'purple' | 'green';

export interface StatCard {
  value: string;
  label: string;
  icon?: ReactNode;
  /** Premium header: colored icon chip + bottom indicator */
  accent?: StatAccentColor;
}

export interface StepInfo {
  label: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

export interface ServiceDashboardHeaderProps {
  // Service info
  serviceName: string;
  serviceSubtitle?: string;
  serviceIcon: LucideIcon | ReactNode;
  iconColor?: string;
  
  // Stats (omit or pass [] to hide the stat row)
  stats?: StatCard[];
  
  // Step indicators (for booking flows)
  steps?: StepInfo[];
  
  // Navigation
  onBack?: () => void;
  showBackButton?: boolean;
  /** When set: X (left) = home, Back (right) = previous — same pattern as profile / address book */
  onCloseToHome?: () => void;
  
  // Custom styling
  // ✅ FIX: Standardized to match customer home header color (#FF8C42)
  headerColor?: string; // Default: orange (#FF8C42)
  headerGradient?: string; // Optional gradient
  /** Merged onto the outer wrapper (e.g. sticky top-0 z-50) */
  className?: string;
  /**
   * When true, header spans the full width of the parent (no max-w-customer).
   * Use for in-app provider/clinic profiles so wide viewports do not show a narrow “desktop web” column.
   */
  fullWidth?: boolean;
  /** When set, each stat card is a button (index 0 = first stat). Pet Sitting: Sitters → browse all, etc. */
  onStatClick?: (index: number) => void;
  /**
   * @default true — old UI used a light “collar” (gray) under the orange; we default to
   * bottom-rounded orange with no extra strip. Set to true only if a screen must keep the
   * legacy content-colored curve (rare).
   */
  useLegacyContentCollar?: boolean;
  /**
   * `wave` — U-curve SVG at bottom of orange (legacy).
   * `flat` — no curve; use with ServiceDashboardHeaderBottomWave on a hero.
   * `sheet` — home-style light panel with large top radii overlapping orange (preferred for hub screens).
   */
  bottomEdge?: 'wave' | 'flat' | 'sheet';
  /** Background for the `sheet` curve (match the screen body below). Default gray-50. */
  sheetToneClass?: string;
  /**
   * Tighter safe-area + padding and smaller stat row (e.g. full-screen payment) so the header does not dominate the viewport.
   */
  compact?: boolean;
  /** Optional faded decorative layer behind header content (e.g. service-themed icons). */
  headerBackground?: ReactNode;
  /** Optional hero image anchored to the bottom-right of the orange header (e.g. vet banner). */
  headerTrailingImage?: string;
  headerTrailingImageAlt?: string;
  /** Override the absolute wrapper around {@link headerTrailingImage}. */
  headerTrailingImageClassName?: string;
  /** Override the `<img>` element (use max-h-full + w-auto for tall portraits). */
  headerTrailingImageImgClassName?: string;
  /** Clip trailing hero to the header bounds (avoids stray page scrollbars). */
  clipHeaderTrailingImage?: boolean;
  /**
   * `premium` — layered gradient, glass hero icon, white glass stat cards, smoother sheet curve.
   * Scoped to screens that opt in (e.g. My Bookings); default layout unchanged.
   */
  headerVariant?: 'default' | 'premium';
}

/**
 * U-shaped “down” curve (center dips).
 * - `onPhoto` — `absolute` at the top of a hero so the bulge is painted *on* the image (not in the
 *   scroll gap between a flat header and the photo), matching the usual in-app “curve above the photo” look.
 * - `flow` — block row under a flat header (rare; prefer onPhoto for profiles).
 */
export function ServiceDashboardHeaderBottomWave({
  className = '',
  headerColor = 'bg-[#FF8C42]',
  headerGradient,
  variant = 'onPhoto',
}: {
  className?: string;
  headerColor?: string;
  headerGradient?: string;
  variant?: 'onPhoto' | 'flow';
}) {
  const waveGradId = useId().replace(/:/g, '');
  const waveUsesGradient = Boolean(
    headerGradient || (typeof headerColor === 'string' && headerColor.includes('gradient'))
  );
  const variantCls =
    variant === 'onPhoto'
      ? 'absolute top-0 left-0 z-[32] h-7 w-full max-h-9 min-h-6 sm:h-8 sm:min-h-7'
      : 'relative z-[1] -mb-px h-5 w-full shrink-0 sm:h-6';
  return (
    <svg
      className={`pointer-events-none block w-full ${variantCls} ${className}`.trim()}
      viewBox="0 0 1200 24"
      preserveAspectRatio="none"
      aria-hidden
    >
      {waveUsesGradient && (
        <defs>
          <linearGradient
            id={waveGradId}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
            gradientUnits="objectBoundingBox"
          >
            <stop offset="0%" stopColor="#FF8C42" />
            <stop offset="50%" stopColor="#FF7A35" />
            <stop offset="100%" stopColor="#FF6B35" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M0 0 L1200 0 L1200 4.5 Q600 24 0 4.5 L0 0 Z"
        fill={waveUsesGradient ? `url(#${waveGradId})` : '#FF8C42'}
      />
    </svg>
  );
}

export function ServiceDashboardHeader({
  serviceName,
  serviceSubtitle,
  serviceIcon: ServiceIcon,
  iconColor = 'text-white',
  stats = [],
  steps,
  onBack,
  showBackButton = true,
  onCloseToHome,
  // ✅ FIX: Standardized orange color matching customer home header
  headerColor = 'bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]',
  headerGradient,
  className = '',
  fullWidth = false,
  onStatClick,
  useLegacyContentCollar = false,
  bottomEdge = 'sheet',
  sheetToneClass = 'bg-gray-50',
  compact = false,
  headerBackground,
  headerTrailingImage,
  headerTrailingImageAlt = '',
  headerTrailingImageClassName,
  headerTrailingImageImgClassName,
  clipHeaderTrailingImage = false,
  headerVariant = 'default',
}: ServiceDashboardHeaderProps) {
  const isPremium = headerVariant === 'premium';
  const waveGradId = useId().replace(/:/g, '');
  const waveUsesGradient = Boolean(
    isPremium ||
      headerGradient ||
      (typeof headerColor === 'string' && headerColor.includes('gradient'))
  );
  const IconComponent = ServiceIcon as LucideIcon;
  const isLucideIcon = typeof IconComponent === 'function' || (IconComponent && 'render' in IconComponent);

  const premiumHeaderSurface = isPremium ? '' : headerGradient || headerColor;

  const statAccentStyles: Record<
    StatAccentColor,
    { chip: string; bar: string; iconWrap: string }
  > = {
    orange: {
      chip: 'text-white',
      bar: 'bg-[#FF7A3D]',
      iconWrap: 'bg-gradient-to-br from-[#FF9257] to-[#FF7A3D] shadow-[0_3px_10px_rgba(255,122,61,0.35)]',
    },
    purple: {
      chip: 'text-white',
      bar: 'bg-violet-500',
      iconWrap: 'bg-gradient-to-br from-violet-400 to-violet-600 shadow-[0_3px_10px_rgba(139,92,246,0.35)]',
    },
    green: {
      chip: 'text-white',
      bar: 'bg-emerald-500',
      iconWrap: 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_3px_10px_rgba(16,185,129,0.35)]',
    },
  };

  const isCapacitorNative = useSyncExternalStore(
    () => () => {},
    isCapacitorNativePlatform,
    () => false,
  );
  const isNarrowMobile = useSyncExternalStore(
    subscribeToNarrowMobileViewport,
    isNarrowMobileViewport,
    () => true,
  );

  /**
   * Top padding inside the orange header (inline style — reliable in Capacitor WebView).
   * `compact` payment summary path is unchanged. Hub screens get a browser min inset on phones only.
   */
  const topPadStyle = resolveServiceHeaderTopPad(compact, isCapacitorNative, isNarrowMobile);
  const innerBottom = compact ? 'pb-3 md:pb-4' : 'pb-4 md:pb-6';
  const titleRowMb = compact ? 'mb-2 md:mb-3' : 'mb-3 md:mb-4';
  const iconBox = compact
    ? 'h-11 w-11'
    : isPremium
      ? 'h-16 w-16 rounded-full'
      : 'h-14 w-14';
  const iconInner = compact ? 'w-6 h-6' : isPremium ? 'w-8 h-8' : 'w-7 h-7';
  const premiumGlassBtn =
    'border border-white/35 bg-white/[0.15] shadow-[0_4px_16px_rgba(0,0,0,0.12)] backdrop-blur-lg transition-all duration-200 hover:bg-white/22 active:scale-95';
  const premiumTitleClass =
    'mb-1.5 text-2xl font-extrabold tracking-[-0.5px] text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.12)] sm:text-[1.65rem]';
  const iconShellClass = isPremium
    ? `${iconBox} flex-shrink-0 flex items-center justify-center rounded-full border-[2.5px] border-white/90 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.14),0_0_28px_rgba(255,255,255,0.35)] ring-2 ring-white/20`
    : `${iconBox} flex-shrink-0 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-lg`;
  const hasStats = stats.length > 0;
  const statColClass =
    stats.length <= 1
      ? 'grid-cols-1'
      : stats.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-3';
  const statGrid = compact
    ? `mt-2 grid ${statColClass} gap-1 sm:gap-1.5`
    : isPremium
      ? `relative z-20 mt-4 mb-5 grid ${statColClass} gap-2 sm:gap-2.5 sm:mb-6`
      : `mt-4 grid ${statColClass} gap-1.5 sm:gap-2`;
  const statCard = isPremium
    ? 'relative overflow-hidden rounded-[1.25rem] border border-white/90 bg-white/[0.96] p-2.5 pb-3.5 text-center shadow-[0_14px_36px_rgba(0,0,0,0.14),0_6px_16px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-shadow duration-200 hover:shadow-[0_18px_40px_rgba(0,0,0,0.16)] sm:p-3 sm:pb-4 w-full my-bookings-fade-in'
    : compact
      ? 'rounded-xl border border-white/30 bg-white/20 p-1.5 text-center backdrop-blur-md sm:p-2 w-full transition-opacity hover:bg-white/25 active:opacity-90'
      : 'rounded-2xl border border-white/30 bg-white/20 p-2 text-center backdrop-blur-md sm:p-3 w-full transition-opacity hover:bg-white/25 active:opacity-90';
  const statValue = isPremium
    ? 'text-lg font-bold text-gray-900 tabular-nums sm:text-xl'
    : compact
      ? 'mb-0 flex items-center justify-center gap-1 text-base font-bold text-white sm:text-lg'
      : 'mb-0.5 flex items-center justify-center gap-1 text-lg font-bold text-white sm:mb-1 sm:text-xl';
  const statLabelClass = isPremium
    ? 'text-[10px] font-medium text-gray-500 sm:text-xs'
    : 'text-[10px] font-medium text-white/90 sm:text-xs';

  /** Extra orange padding below stats (overlap band for home-style white shell; gap via stat grid mb). */
  const innerShellClass =
    hasStats && (bottomEdge === 'sheet' || (isPremium && bottomEdge === 'flat'))
      ? compact
        ? 'pb-5 md:pb-6'
        : isPremium && bottomEdge === 'flat'
          ? 'pb-4 md:pb-5'
          : 'pb-6 md:pb-8'
      : bottomEdge === 'sheet' && !hasStats
        ? compact
          ? 'pb-4 md:pb-5'
          : 'pb-5 md:pb-6'
        : innerBottom;

  /** Tighter overlap when there are no stat chips so the sheet sits closer to the title block. */
  const sheetOverlapClass = !hasStats
    ? isPremium
      ? '-mt-4'
      : '-mt-3'
    : compact
      ? '-mt-2'
      : isPremium
        ? '-mt-6 sm:-mt-7'
        : '-mt-4';

  return (
    <div
      className={`relative z-10 isolate w-full ${fullWidth ? 'max-w-none' : 'mx-auto max-w-customer'} ${className}`.trim()}
    >
      {/*
        Downward curve: bottom edge of the orange is a U-shaped dip (center projects down into the
        next section) — not border-radius on bottom corners, which looks “inward” / wrong direction.
      */}
      <div
        className={`relative z-20 ${headerTrailingImage && !clipHeaderTrailingImage ? 'overflow-x-hidden overflow-y-visible' : 'overflow-hidden'} ${isPremium ? '' : premiumHeaderSurface} text-white pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] sm:pl-[max(1.5rem,env(safe-area-inset-left,0px))] sm:pr-[max(1.5rem,env(safe-area-inset-right,0px))] pb-0`}
        style={topPadStyle}
      >
        {isPremium ? (
          <>
            <div
              className="pointer-events-none absolute inset-0 z-0"
              style={{ background: 'linear-gradient(135deg, #FF6B1A 0%, #FF7F2A 35%, #FF8E42 70%, #FFA45D 100%)' }}
              aria-hidden
            />
            {/* Top-left orange glow */}
            <div
              className="pointer-events-none absolute -left-12 -top-8 z-0 h-44 w-44 rounded-full bg-[#FF6B1A]/50 blur-3xl"
              aria-hidden
            />
            {/* Center soft light glow */}
            <div
              className="pointer-events-none absolute left-1/2 top-[28%] z-0 h-52 w-64 -translate-x-1/2 rounded-full bg-white/35 blur-3xl"
              aria-hidden
            />
            {/* Bottom-right warm glow */}
            <div
              className="pointer-events-none absolute -bottom-10 -right-10 z-0 h-40 w-40 rounded-full bg-[#FF4500]/40 blur-3xl"
              aria-hidden
            />
          </>
        ) : null}
        {headerBackground ? (
          <div
            className="pointer-events-none absolute inset-0 z-[1] overflow-hidden [&_svg]:fill-none"
            style={isPremium ? undefined : { color: 'rgba(255, 255, 255, 0.13)' }}
            aria-hidden
          >
            {headerBackground}
          </div>
        ) : null}
        {headerTrailingImage ? (
          <div
            className={
              headerTrailingImageClassName ??
              'pointer-events-none absolute bottom-2 right-0 top-[3.25rem] z-[5] flex min-h-0 w-[44%] max-w-[178px] items-end justify-end pr-2 sm:bottom-2.5 sm:top-14 sm:max-w-[195px] sm:pr-3'
            }
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={headerTrailingImage}
              alt={headerTrailingImageAlt}
              className={
                headerTrailingImageImgClassName ??
                'h-auto max-h-full w-auto max-w-full object-contain object-bottom drop-shadow-md'
              }
            />
          </div>
        ) : null}
        <div className={`relative z-10 ${innerShellClass}`}>
        {/* Profile-style header: X = home, Back = previous */}
        {onCloseToHome ? (
          <>
            <div className={`relative z-20 flex items-center justify-between gap-2 ${titleRowMb}`}>
              <button
                type="button"
                onClick={onCloseToHome}
                className={`relative z-30 flex h-11 w-11 min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-full pointer-events-auto ${isPremium ? premiumGlassBtn : 'bg-white/20 backdrop-blur-sm transition-colors hover:bg-white/30'}`}
                aria-label="Close to home"
              >
                <X className="h-6 w-6 text-white" />
              </button>
              {showBackButton && onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className={`relative z-30 flex min-h-[44px] shrink-0 items-center gap-1.5 px-3 py-2 text-white pointer-events-auto ${isPremium ? `rounded-full ${premiumGlassBtn}` : 'transition-opacity active:opacity-70'}`}
                  aria-label="Go back"
                >
                  <ChevronLeft className="h-5 w-5" />
                  <span className="font-medium">Back</span>
                </button>
              )}
            </div>
            <div className={`flex items-start gap-3 ${compact ? 'mb-3' : isPremium ? 'mb-4 gap-4' : 'mb-4'}`}>
              <div className={iconShellClass}>
                {isLucideIcon ? (
                  <IconComponent
                    className={`${iconInner} ${isPremium ? 'text-[#FF7A3D] drop-shadow-[0_0_12px_rgba(255,122,61,0.45)]' : iconColor}`}
                  />
                ) : (
                  <div className={isPremium ? 'text-[#FF7A3D]' : iconColor}>{ServiceIcon as ReactNode}</div>
                )}
              </div>
              <div className={`flex-1 min-w-0 ${isPremium ? 'pt-0.5' : 'pt-1'}`}>
                <h1 className={isPremium ? premiumTitleClass : `mb-1 font-bold text-white ${compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>
                  {serviceName}
                </h1>
                {serviceSubtitle && (
                  <p
                    className={
                      isPremium
                        ? 'text-sm leading-snug text-white/95 sm:text-[0.9rem]'
                        : 'text-white/90 text-xs leading-tight sm:text-sm'
                    }
                  >
                    {serviceSubtitle}
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className={`relative z-20 flex items-center gap-3 ${titleRowMb}`}>
            {showBackButton && onBack && (
              <button
                type="button"
                onClick={onBack}
                className="relative z-30 flex h-11 w-11 min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-colors hover:bg-white/30 pointer-events-auto"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
            )}

            <div className={iconShellClass}>
              {isLucideIcon ? (
                <IconComponent
                  className={`${iconInner} ${isPremium ? 'text-[#FF7A3D] drop-shadow-[0_0_12px_rgba(255,122,61,0.45)]' : iconColor}`}
                />
              ) : (
                <div className={isPremium ? 'text-[#FF7A3D]' : iconColor}>{ServiceIcon as ReactNode}</div>
              )}
            </div>

            <div className={`min-w-0 flex-1 py-0.5 ${headerTrailingImage ? 'max-w-[52%] pr-1 sm:max-w-[54%]' : ''}`}>
              <h1 className={isPremium ? premiumTitleClass : `mb-1 font-bold text-white ${compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>
                {serviceName}
              </h1>
              {serviceSubtitle && (
                <p
                  className={
                    isPremium
                      ? 'text-sm leading-snug text-white/95 sm:text-[0.9rem]'
                      : 'text-xs leading-tight text-white/90 sm:text-sm'
                  }
                >
                  {serviceSubtitle}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Stats Cards - Frosted Effect (hidden on hubs until product re-enables) */}
        {hasStats && (
          <div className={statGrid}>
            {stats.map((stat, index) => {
              const accent = stat.accent ? statAccentStyles[stat.accent] : null;
              const inner = isPremium ? (
                <>
                  {stat.icon && accent ? (
                    <div
                      className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full ${accent.iconWrap}`}
                    >
                      <span className={accent.chip}>{stat.icon}</span>
                    </div>
                  ) : stat.icon ? (
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-orange-50">
                      <span className="text-[#FF7A3D]">{stat.icon}</span>
                    </div>
                  ) : null}
                  <div className={statValue}>
                    <span className="truncate tabular-nums">{stat.value}</span>
                  </div>
                  <div className={statLabelClass}>{stat.label}</div>
                  {accent ? (
                    <div
                      className={`absolute bottom-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full ${accent.bar}`}
                      aria-hidden
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <div className={statValue}>
                    {stat.icon && <span className="text-white">{stat.icon}</span>}
                    <span className="truncate tabular-nums">{stat.value}</span>
                  </div>
                  <div className={statLabelClass}>{stat.label}</div>
                </>
              );
              const cardClass = statCard;
              if (onStatClick) {
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onStatClick(index)}
                    className={`${cardClass} pointer-events-auto`}
                    aria-label={`${stat.label}: ${stat.value}`}
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <div key={index} className={cardClass}>
                  {inner}
                </div>
              );
            })}
          </div>
        )}

        {/* Step indicators: two rows (circles + flex connectors, then equal-width labels) so 4–5 steps fit on narrow screens */}
        {steps && steps.length > 0 && (
          <div className="mt-4 min-w-0 border-t border-white/20 pt-4">
            <div className="w-full min-w-0 px-0.5 sm:px-1">
              <div className="flex w-full min-w-0 items-center">
                {steps.map((step, index) => (
                  <Fragment key={index}>
                    {index > 0 && (
                      <div
                        className={`h-0.5 min-w-[6px] flex-1 transition-all ${
                          steps[index - 1].isCompleted ? 'bg-white' : 'bg-white/30'
                        }`}
                        aria-hidden
                      />
                    )}
                    <div
                      className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                        step.isCompleted || step.isCurrent
                          ? 'bg-white text-[#FF8C42] shadow-lg'
                          : 'bg-white/20 text-white/70'
                      }`}
                    >
                      {step.isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                  </Fragment>
                ))}
              </div>
              <div
                className="mt-2 grid w-full min-w-0 gap-x-0.5 sm:gap-x-1"
                style={{
                  gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
                }}
              >
                {steps.map((step, index) => (
                  <div
                    key={index}
                    title={step.label}
                    className={`min-w-0 truncate whitespace-nowrap rounded-lg px-0.5 py-1 text-center text-[10px] font-medium leading-tight transition-all sm:text-xs ${
                      step.isCurrent
                        ? 'bg-white font-semibold text-[#FF8C42]'
                        : step.isCompleted
                          ? 'bg-white/30 text-white'
                          : 'text-white/70'
                    }`}
                  >
                    {step.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        </div>

        {bottomEdge === 'wave' && (
          <svg
            className="pointer-events-none -mb-px block h-5 w-full shrink-0 sm:h-6"
            viewBox="0 0 1200 24"
            preserveAspectRatio="none"
            aria-hidden
          >
            {waveUsesGradient && (
              <defs>
                <linearGradient
                  id={waveGradId}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                  gradientUnits="objectBoundingBox"
                >
                  <stop offset="0%" stopColor="#FF8C42" />
                  <stop offset="50%" stopColor="#FF7A35" />
                  <stop offset="100%" stopColor="#FF6B35" />
                </linearGradient>
              </defs>
            )}
            <path
              d="M0 0 L1200 0 L1200 4.5 Q600 24 0 4.5 L0 0 Z"
              fill={waveUsesGradient ? `url(#${waveGradId})` : '#FF8C42'}
            />
          </svg>
        )}
      </div>

      {/* Premium / flat headers: rectangular orange bottom; page uses Home-style rounded white shell overlap. */}
      {bottomEdge === 'sheet' && !isPremium && (
        <div
          className={`pointer-events-none relative z-[21] ${sheetOverlapClass} w-full ${fullWidth ? '' : 'mx-auto max-w-customer'}`.trim()}
          aria-hidden
        >
          <div
            className={`pointer-events-none h-8 rounded-t-[1.75rem] shadow-[0_-10px_36px_-8px_rgba(0,0,0,0.12)] sm:h-9 sm:rounded-t-[2rem] ${sheetToneClass}`.trim()}
          />
        </div>
      )}

      {useLegacyContentCollar && (
        <div className="pointer-events-none relative -mt-4 min-h-[32px] rounded-t-[32px] bg-gray-50">
          <div
            className="pointer-events-none absolute left-0 right-0 top-0 h-8 rounded-t-[32px] bg-gray-50"
            aria-hidden
          />
        </div>
      )}
    </div>
  );
}
