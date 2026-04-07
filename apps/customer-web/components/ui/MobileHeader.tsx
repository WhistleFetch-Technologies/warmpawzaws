'use client';

import { ArrowLeft, Bell, Menu } from 'lucide-react';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  onNotifications?: () => void;
  onMenu?: () => void;
  transparent?: boolean;
  className?: string;
}

/**
 * MobileHeader - Unified mobile header component
 * Provides consistent back navigation, title display, and action buttons
 * for a professional mobile-first UI experience.
 */
export function MobileHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
  rightAction,
  onNotifications,
  onMenu,
  transparent = false,
  className = '',
}: MobileHeaderProps) {
  return (
    <header
      className={`sticky top-0 z-40 isolate w-full ${
        transparent 
          ? 'bg-transparent' 
          : 'bg-white border-b border-gray-100 shadow-sm'
      } ${className}`}
    >
      <div className="cw-header-safe-top cw-header-safe-x flex h-auto min-h-[56px] items-center justify-between py-2">
        {/* Left Section - Back Button */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {showBack && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="relative z-30 flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
          )}
          
          {/* Title Section */}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-gray-500 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right Section - Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {onNotifications && (
            <button
              type="button"
              onClick={onNotifications}
              className="relative flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-gray-600" />
            </button>
          )}
          
          {onMenu && (
            <button
              type="button"
              onClick={onMenu}
              className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
          )}
          
          {rightAction}
        </div>
      </div>
    </header>
  );
}

export default MobileHeader;
