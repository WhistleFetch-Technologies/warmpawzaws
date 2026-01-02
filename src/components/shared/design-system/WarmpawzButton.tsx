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
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string; // ✅ ADD: Required for icon-only buttons
  'aria-describedby'?: string; // ✅ ADD: For additional context
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
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: WarmpawzButtonProps) {
  // ✅ VALIDATION: Require aria-label for icon-only buttons
  if (variant === 'icon' && !ariaLabel && !children) {
    console.warn('WarmpawzButton: aria-label is required for icon-only buttons (variant="icon")');
  }
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
      onClick={disabled ? undefined : (e) => onClick?.(e)}
      disabled={disabled}
      className={className}
      style={{ ...baseStyles, ...style }}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      onMouseEnter={(e) => {
        if (!disabled && 'hover' in styles && styles.hover) {
          e.currentTarget.style.background = styles.hover;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = styles.background || 'transparent';
        }
      }}
      onMouseDown={(e) => {
        if (!disabled && 'active' in styles && styles.active) {
          e.currentTarget.style.background = styles.active;
        }
      }}
      onMouseUp={(e) => {
        if (!disabled && 'hover' in styles && styles.hover) {
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

