/**
 * Warmpawz Button Component
 * Matches high-fidelity design system
 */

import React from 'react';
import { BUTTON_VARIANTS, WARM_ORANGE, WHITE } from '../../../assets/design-tokens';
import { LucideIcon } from 'lucide-react';

interface WarmpawzButtonProps {
  variant?: 'solid' | 'outlined' | 'icon' | 'disabled';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function WarmpawzButton({
  variant = 'solid',
  children,
  onClick,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  style,
}: WarmpawzButtonProps) {
  const effectiveVariant = disabled ? 'disabled' : variant;
  const styles = BUTTON_VARIANTS[effectiveVariant];

  const baseStyles: React.CSSProperties = {
    ...styles,
    cursor: disabled ? 'not-allowed' : 'pointer',
    width: fullWidth ? '100%' : 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Icon ? '8px' : '0',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.2s ease',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    ...(className ? {} : {}), // Merge with style prop if provided
  };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={className}
      style={{ ...baseStyles, ...style }}
      onMouseEnter={(e) => {
        if (!disabled && styles.hover) {
          e.currentTarget.style.background = styles.hover;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = styles.background || 'transparent';
        }
      }}
      onMouseDown={(e) => {
        if (!disabled && styles.active) {
          e.currentTarget.style.background = styles.active;
        }
      }}
      onMouseUp={(e) => {
        if (!disabled && styles.hover) {
          e.currentTarget.style.background = styles.hover;
        }
      }}
    >
      {Icon && iconPosition === 'left' && <Icon size={18} />}
      {children}
      {Icon && iconPosition === 'right' && <Icon size={18} />}
    </button>
  );
}

