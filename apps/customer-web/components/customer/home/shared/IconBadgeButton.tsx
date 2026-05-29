'use client';

import React, { memo } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface IconBadgeButtonProps {
  icon: LucideIcon;
  onClick?: () => void;
  ariaLabel: string;
  title?: string;
  badgeCount?: number;
  className?: string;
  iconClassName?: string;
  iconStrokeWidth?: number;
}

function IconBadgeButtonComponent({
  icon: Icon,
  onClick,
  ariaLabel,
  title,
  badgeCount = 0,
  className = '',
  iconClassName = 'w-[18px] h-[18px] text-white',
  iconStrokeWidth = 2,
}: IconBadgeButtonProps) {
  const showBadge = badgeCount > 0;
  const badgeLabel = badgeCount > 99 ? '99+' : String(badgeCount);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${className}`}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
    >
      <Icon className={iconClassName} strokeWidth={iconStrokeWidth} />
      {showBadge ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
          {badgeLabel}
        </span>
      ) : null}
    </button>
  );
}

/** Circular header action button with optional unread badge. */
export const IconBadgeButton = memo(IconBadgeButtonComponent);
