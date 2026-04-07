'use client';

import { ChevronLeft, X } from 'lucide-react';

export interface ProfileAccountScreenHeaderProps {
  /** Left: close profile flow and go to app home */
  onCloseToHome: () => void;
  /** Right: go to previous screen (optional — omit on root-only views) */
  onBack?: () => void;
  title?: string;
  subtitle?: string;
  className?: string;
}

/**
 * Matches Address Book: X (left) = home, Back (right) = previous screen.
 */
export function ProfileAccountScreenHeader({
  onCloseToHome,
  onBack,
  title,
  subtitle,
  className = '',
}: ProfileAccountScreenHeaderProps) {
  return (
    <div
      className={`bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(2.75rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-4 rounded-b-2xl shadow-md ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={onCloseToHome}
          className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm active:scale-95 transition-transform shrink-0"
          aria-label="Close to home"
        >
          <X className="w-6 h-6 text-white" />
        </button>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-white flex items-center gap-2 active:opacity-70 transition-opacity shrink-0"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
        ) : (
          <span className="w-11 shrink-0" aria-hidden />
        )}
      </div>
      {(title || subtitle) && (
        <div>
          {title && <h1 className="text-xl font-bold text-white">{title}</h1>}
          {subtitle && <p className="text-sm text-white/90 mt-0.5">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
