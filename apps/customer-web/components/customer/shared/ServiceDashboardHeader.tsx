'use client';

import { ArrowLeft, ChevronLeft, LucideIcon, CheckCircle2, X } from 'lucide-react';
import { ReactNode } from 'react';

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
}: ServiceDashboardHeaderProps) {
  const IconComponent = ServiceIcon as LucideIcon;
  const isLucideIcon = typeof IconComponent === 'function' || (IconComponent && 'render' in IconComponent);
  
  return (
    <div
      className={`relative z-10 isolate w-full ${fullWidth ? 'max-w-none' : 'mx-auto max-w-customer'} ${className}`.trim()}
    >
      {/* Orange Header Background */}
      <div
        className={`${headerGradient || headerColor} text-white pb-4 md:pb-6 pt-[max(3.25rem,calc(env(safe-area-inset-top,0px)+0.75rem))] md:pt-[max(0.75rem,calc(env(safe-area-inset-top,0px)+0.35rem))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] sm:pl-[max(1.5rem,env(safe-area-inset-left,0px))] sm:pr-[max(1.5rem,env(safe-area-inset-right,0px))]`}
      >
        {/* Profile-style header: X = home, Back = previous */}
        {onCloseToHome ? (
          <>
            <div className="relative z-20 mb-3 flex items-center justify-between gap-2 md:mb-4">
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
            <div className="flex items-start gap-3 mb-4">
              <div className="w-14 h-14 flex-shrink-0 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-lg">
                {isLucideIcon ? (
                  <IconComponent className={`w-7 h-7 ${iconColor}`} />
                ) : (
                  <div className={iconColor}>{ServiceIcon as ReactNode}</div>
                )}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h1 className="text-xl font-bold text-white mb-1 sm:text-2xl">{serviceName}</h1>
                {serviceSubtitle && (
                  <p className="text-white/90 text-xs leading-tight sm:text-sm">{serviceSubtitle}</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="relative z-20 mb-3 flex items-center gap-3 md:mb-4">
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

            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white/20 shadow-lg backdrop-blur-md">
              {isLucideIcon ? (
                <IconComponent className={`w-7 h-7 ${iconColor}`} />
              ) : (
                <div className={iconColor}>{ServiceIcon as ReactNode}</div>
              )}
            </div>

            <div className="min-w-0 flex-1 py-0.5">
              <h1 className="mb-1 text-xl font-bold text-white sm:text-2xl">{serviceName}</h1>
              {serviceSubtitle && (
                <p className="text-xs leading-tight text-white/90 sm:text-sm">{serviceSubtitle}</p>
              )}
            </div>
          </div>
        )}

        {/* Stats Cards - Frosted Effect */}
        {stats.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
            {stats.map((stat, index) => {
              const inner = (
                <>
                  <div className="mb-0.5 flex items-center justify-center gap-1 text-lg font-bold text-white sm:mb-1 sm:text-xl">
                    {stat.icon && <span className="text-white">{stat.icon}</span>}
                    <span className="truncate tabular-nums">{stat.value}</span>
                  </div>
                  <div className="text-[10px] font-medium text-white/90 sm:text-xs">{stat.label}</div>
                </>
              );
              const cardClass =
                'rounded-2xl border border-white/30 bg-white/20 p-2 text-center backdrop-blur-md sm:p-3 w-full transition-opacity hover:bg-white/25 active:opacity-90';
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

        {/* ✅ FIX: Step Indicators in Orange Header Area */}
        {steps && steps.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="flex items-center justify-center gap-2">
              {steps.map((step, index) => (
                <div key={index} className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    step.isCompleted || step.isCurrent 
                      ? 'bg-white text-[#FF8C42] shadow-lg' 
                      : 'bg-white/20 text-white/70'
                  }`}>
                    {step.isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                    step.isCurrent 
                      ? 'bg-white text-[#FF8C42] font-semibold' 
                      : step.isCompleted
                      ? 'bg-white/30 text-white'
                      : 'text-white/70'
                  }`}>
                    {step.label}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-6 h-0.5 mx-1 transition-all ${
                      step.isCompleted ? 'bg-white' : 'bg-white/30'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inward curve — decorative only; must not sit above main content and steal taps (Pet Sitting hub, etc.). */}
      <div className="pointer-events-none relative -mt-4 min-h-[40px] rounded-t-[32px] bg-white">
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-8 rounded-t-[32px] bg-white" aria-hidden />
      </div>
    </div>
  );
}
