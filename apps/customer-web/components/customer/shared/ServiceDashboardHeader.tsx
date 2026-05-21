'use client';

import { ArrowLeft, ChevronLeft, LucideIcon, CheckCircle2, X } from 'lucide-react';
import { Fragment, ReactNode, useId } from 'react';

export interface StatCard {
  value: string;
  label: string;
  icon?: ReactNode;
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
}: ServiceDashboardHeaderProps) {
  const waveGradId = useId().replace(/:/g, '');
  const waveUsesGradient = Boolean(
    headerGradient || (typeof headerColor === 'string' && headerColor.includes('gradient'))
  );
  const IconComponent = ServiceIcon as LucideIcon;
  const isLucideIcon = typeof IconComponent === 'function' || (IconComponent && 'render' in IconComponent);

  /**
   * Top padding inside the orange header.
   *
   * IMPORTANT: applied via inline `style={{ paddingTop }}`, NOT a Tailwind
   * arbitrary-value class. On Capacitor Android, Tailwind JIT classes for
   * complex arbitrary values (with nested commas in `max(... , calc(...))`)
   * have been observed to be missed by the JIT scanner or to lose to a
   * cached CSS bundle in the WebView, leaving the back button under the
   * status bar / camera punch-hole. An inline style sidesteps both issues:
   * the paddingTop value is baked directly into the rendered HTML, so it
   * cannot be cache-stripped and does not depend on Tailwind generating a
   * matching class. Non-compact headers use env-only top pad (home / service hubs).
   * `compact` is used on payment / Razorpay flows — keep legacy min padding unchanged.
   */
  const topPadStyle: React.CSSProperties = compact
    ? { paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 8px))' }
    : { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' };
  const innerBottom = compact ? 'pb-3 md:pb-4' : 'pb-4 md:pb-6';
  const titleRowMb = compact ? 'mb-2 md:mb-3' : 'mb-3 md:mb-4';
  const iconBox = compact ? 'h-11 w-11' : 'h-14 w-14';
  const iconInner = compact ? 'w-6 h-6' : 'w-7 h-7';
  const hasStats = stats.length > 0;
  const statColClass =
    stats.length <= 1
      ? 'grid-cols-1'
      : stats.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-3';
  const statGrid = compact
    ? `mt-2 grid ${statColClass} gap-1 sm:gap-1.5`
    : `mt-4 grid ${statColClass} gap-1.5 sm:gap-2`;
  const statCard = compact
    ? 'rounded-xl border border-white/30 bg-white/20 p-1.5 text-center backdrop-blur-md sm:p-2 w-full transition-opacity hover:bg-white/25 active:opacity-90'
    : 'rounded-2xl border border-white/30 bg-white/20 p-2 text-center backdrop-blur-md sm:p-3 w-full transition-opacity hover:bg-white/25 active:opacity-90';
  const statValue = compact
    ? 'mb-0 flex items-center justify-center gap-1 text-base font-bold text-white sm:text-lg'
    : 'mb-0.5 flex items-center justify-center gap-1 text-lg font-bold text-white sm:mb-1 sm:text-xl';

  /** Extra orange padding below stats before the sheet so the curve does not cut into stat chips. */
  const innerShellClass =
    bottomEdge === 'sheet' && hasStats
      ? compact
        ? 'pb-5 md:pb-6'
        : 'pb-6 md:pb-8'
      : bottomEdge === 'sheet' && !hasStats
        ? compact
          ? 'pb-4 md:pb-5'
          : 'pb-5 md:pb-6'
        : innerBottom;

  /** Tighter overlap when there are no stat chips so the sheet sits closer to the title block. */
  const sheetOverlapClass = !hasStats
    ? '-mt-3'
    : compact
      ? '-mt-2'
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
        className={`relative z-20 ${headerGradient || headerColor} text-white pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] sm:pl-[max(1.5rem,env(safe-area-inset-left,0px))] sm:pr-[max(1.5rem,env(safe-area-inset-right,0px))] pb-0`}
        style={topPadStyle}
      >
        <div className={innerShellClass}>
        {/* Profile-style header: X = home, Back = previous */}
        {onCloseToHome ? (
          <>
            <div className={`relative z-20 flex items-center justify-between gap-2 ${titleRowMb}`}>
              <button
                type="button"
                onClick={onCloseToHome}
                className="relative z-30 flex h-11 w-11 min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-colors hover:bg-white/30 pointer-events-auto"
                aria-label="Close to home"
              >
                <X className="h-6 w-6 text-white" />
              </button>
              {showBackButton && onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="relative z-30 flex min-h-[44px] shrink-0 items-center gap-2 px-2 text-white transition-opacity pointer-events-auto active:opacity-70"
                  aria-label="Go back"
                >
                  <ChevronLeft className="h-5 w-5" />
                  <span className="font-medium">Back</span>
                </button>
              )}
            </div>
            <div className={`flex items-start gap-3 ${compact ? 'mb-3' : 'mb-4'}`}>
              <div
                className={`${iconBox} flex-shrink-0 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-lg`}
              >
                {isLucideIcon ? (
                  <IconComponent className={`${iconInner} ${iconColor}`} />
                ) : (
                  <div className={iconColor}>{ServiceIcon as ReactNode}</div>
                )}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h1
                  className={`font-bold text-white mb-1 ${compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}
                >
                  {serviceName}
                </h1>
                {serviceSubtitle && (
                  <p className="text-white/90 text-xs leading-tight sm:text-sm">{serviceSubtitle}</p>
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

            <div
              className={`flex ${iconBox} flex-shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white/20 shadow-lg backdrop-blur-md`}
            >
              {isLucideIcon ? (
                <IconComponent className={`${iconInner} ${iconColor}`} />
              ) : (
                <div className={iconColor}>{ServiceIcon as ReactNode}</div>
              )}
            </div>

            <div className="min-w-0 flex-1 py-0.5">
              <h1
                className={`mb-1 font-bold text-white ${compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}
              >
                {serviceName}
              </h1>
              {serviceSubtitle && (
                <p className="text-xs leading-tight text-white/90 sm:text-sm">{serviceSubtitle}</p>
              )}
            </div>
          </div>
        )}

        {/* Stats Cards - Frosted Effect (hidden on hubs until product re-enables) */}
        {hasStats && (
          <div className={statGrid}>
            {stats.map((stat, index) => {
              const inner = (
                <>
                  <div className={statValue}>
                    {stat.icon && <span className="text-white">{stat.icon}</span>}
                    <span className="truncate tabular-nums">{stat.value}</span>
                  </div>
                  <div className="text-[10px] font-medium text-white/90 sm:text-xs">{stat.label}</div>
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

      {bottomEdge === 'sheet' && (
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
