'use client';

import React, { forwardRef, HTMLAttributes } from 'react';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Material Symbols icon names
export type IconName =
  | 'home'
  | 'search'
  | 'person'
  | 'settings'
  | 'notifications'
  | 'favorite'
  | 'favorite_border'
  | 'star'
  | 'star_border'
  | 'check'
  | 'close'
  | 'add'
  | 'remove'
  | 'edit'
  | 'delete'
  | 'visibility'
  | 'visibility_off'
  | 'arrow_back'
  | 'arrow_forward'
  | 'chevron_left'
  | 'chevron_right'
  | 'expand_more'
  | 'expand_less'
  | 'menu'
  | 'more_vert'
  | 'more_horiz'
  | 'local_hospital'
  | 'videocam'
  | 'content_cut'
  | 'bathtub'
  | 'school'
  | 'directions_walk'
  | 'hotel'
  | 'local_cafe'
  | 'medication'
  | 'science'
  | 'emergency'
  | 'shield'
  | 'restaurant'
  | 'inventory_2'
  | 'account_balance_wallet'
  | 'calendar_today'
  | 'analytics'
  | 'pets'
  | 'location_on'
  | 'phone'
  | 'email'
  | 'schedule'
  | 'payments'
  | 'receipt'
  | 'help'
  | 'info'
  | 'warning'
  | 'error'
  | 'check_circle'
  | 'cancel'
  | 'photo_camera'
  | 'image'
  | 'upload'
  | 'download'
  | 'share'
  | 'copy'
  | 'logout'
  | 'login'
  | string; // Allow any string for flexibility

export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  name: IconName;
  size?: IconSize;
  filled?: boolean;
}

const sizeStyles: Record<IconSize, string> = {
  xs: 'text-base', // 16px
  sm: 'text-lg',   // 18px
  md: 'text-2xl',  // 24px
  lg: 'text-3xl',  // 30px
  xl: 'text-4xl',  // 36px
};

const sizeMap: Record<IconSize, number> = {
  xs: 16,
  sm: 18,
  md: 24,
  lg: 30,
  xl: 36,
};

/**
 * Icon component using Material Symbols
 * 
 * Usage:
 * <Icon name="home" size="md" />
 * <Icon name="favorite" filled />
 * 
 * Requires Material Symbols font to be loaded in globals.css:
 * @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0');
 */
export const Icon = forwardRef<HTMLSpanElement, IconProps>(
  (
    {
      name,
      size = 'md',
      filled = false,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={`
          material-symbols-rounded
          ${sizeStyles[size]}
          inline-block align-middle select-none
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        style={{
          fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${sizeMap[size]}`,
          ...style,
        }}
        aria-hidden="true"
        {...props}
      >
        {name}
      </span>
    );
  }
);

Icon.displayName = 'Icon';

export default Icon;

