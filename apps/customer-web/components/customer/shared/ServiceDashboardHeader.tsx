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
  
  // Stats
  stats: StatCard[];
  
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
}

export function ServiceDashboardHeader({
  serviceName,
  serviceSubtitle,
  serviceIcon: ServiceIcon,
  iconColor = 'text-white',
  stats,
  steps,
  onBack,
  showBackButton = true,
  onCloseToHome,
  // ✅ FIX: Standardized orange color matching customer home header
  headerColor = 'bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]',
  headerGradient
}: ServiceDashboardHeaderProps) {
  const IconComponent = ServiceIcon as LucideIcon;
  const isLucideIcon = typeof IconComponent === 'function' || (IconComponent && 'render' in IconComponent);
  
  return (
    <div className="relative mx-auto w-full max-w-customer">
      {/* Orange Header Background */}
      <div
        className={`${headerGradient || headerColor} text-white pb-8 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] sm:pl-[max(1.5rem,env(safe-area-inset-left,0px))] sm:pr-[max(1.5rem,env(safe-area-inset-right,0px))]`}
      >
        {/* Profile-style header: X = home, Back = previous */}
        {onCloseToHome ? (
          <>
            <div className="flex items-center justify-between gap-2 mb-4">
              <button
                type="button"
                onClick={onCloseToHome}
                className="w-11 h-11 flex-shrink-0 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                aria-label="Close to home"
              >
                <X className="w-6 h-6 text-white" />
              </button>
              {showBackButton && onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="text-white flex items-center gap-2 active:opacity-70 transition-opacity shrink-0"
                  aria-label="Go back"
                >
                  <ChevronLeft className="w-5 h-5" />
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
          <div className="flex items-start gap-3 mb-4">
            {showBackButton && onBack && (
              <button
                onClick={onBack}
                className="w-9 h-9 flex-shrink-0 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors mt-1"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4 text-white" />
              </button>
            )}

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
        )}

        {/* Stats Cards - Frosted Effect */}
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
