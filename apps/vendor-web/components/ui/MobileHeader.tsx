'use client';

import { ArrowLeft, Bell, Menu, Settings } from 'lucide-react';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  onNotifications?: () => void;
  onSettings?: () => void;
  onMenu?: () => void;
  transparent?: boolean;
  className?: string;
  notificationCount?: number;
}

/**
 * MobileHeader - Unified mobile header component for Vendor App
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
  onSettings,
  onMenu,
  transparent = false,
  className = '',
  notificationCount = 0,
}: MobileHeaderProps) {
  return (
    <header
      className={`sticky top-0 z-40 w-full safe-area-top ${
        transparent 
          ? 'bg-transparent' 
          : 'bg-white border-b border-gray-100 shadow-sm'
      } ${className}`}
    >
      <div className="flex items-center justify-between px-4 py-3 min-h-[56px]">
        {/* Left Section - Back Button */}
        <div className="flex items-center gap-3 flex-1">
          {showBack && onBack && (
            <button
              onClick={onBack}
              className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors -ml-2"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
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
        <div className="flex items-center gap-1">
          {onNotifications && (
            <button
              onClick={onNotifications}
              className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {notificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>
          )}
          
          {onSettings && (
            <button
              onClick={onSettings}
              className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          )}
          
          {onMenu && (
            <button
              onClick={onMenu}
              className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
          )}
          
          {rightAction}
        </div>
      </div>
    </header>
  );
}

export default MobileHeader;
