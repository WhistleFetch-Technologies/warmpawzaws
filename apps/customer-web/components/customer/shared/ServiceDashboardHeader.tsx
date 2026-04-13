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
}: ServiceDashboardHeaderProps) {
  const IconComponent = ServiceIcon as LucideIcon;
  const isLucideIcon = typeof IconComponent === 'function' || (IconComponent && 'render' in IconComponent);
  
  return (
    <div className={`relative z-10 isolate mx-auto w-full max-w-customer ${className}`.trim()}>
      {/* Orange Header Background */}
      <div
        className={`${headerGradient || headerColor} cw-header-safe-top cw-header-safe-x text-white pb-4 md:pb-6 sm:pl-[max(1.5rem,env(safe-area-inset-left,0px))] sm:pr-[max(1.5rem,env(safe-area-inset-right,0px))]`}
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
                <h1 className="text-2xl font-bold text-white mb-1">{serviceName}</h1>
                {serviceSubtitle && (
                  <p className="text-white/90 text-sm leading-tight">{serviceSubtitle}</p>
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
              <h1 className="mb-1 text-2xl font-bold text-white">{serviceName}</h1>
              {serviceSubtitle && (
                <p className="text-sm leading-tight text-white/90">{serviceSubtitle}</p>
              )}
            </div>
          </div>
        )}

        {/* Stats Cards - Frosted Effect */}
        {stats.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="bg-white/20 backdrop-blur-md rounded-2xl p-3 border border-white/30 text-center"
              >
                <div className="text-xl font-bold text-white mb-1 flex items-center justify-center gap-1">
                  {stat.icon && <span className="text-white">{stat.icon}</span>}
                  <span>{stat.value}</span>
                </div>
                <div className="text-white/90 text-xs font-medium">{stat.label}</div>
              </div>
            ))}
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

      {/* Inward Curving White Content Area */}
      <div className="relative -mt-4 bg-white rounded-t-[32px] min-h-[40px]">
        {/* This creates the inward curve effect */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-white rounded-t-[32px]"></div>
      </div>
    </div>
  );
}
