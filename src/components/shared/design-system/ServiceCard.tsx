/**
 * Service/Role Selection Card Component
 * Matches high-fidelity design system
 */

import React from 'react';
import { SERVICE_CARD_STYLES, WARM_ORANGE } from '../../../assets/design-tokens';
import { LucideIcon } from 'lucide-react';

interface ServiceCardProps {
  title: string;
  description?: string;
  selected?: boolean;
  icon?: LucideIcon;
  onClick?: () => void;
  className?: string;
}

export function ServiceCard({
  title,
  description,
  selected = false,
  icon: Icon,
  onClick,
  className = '',
}: ServiceCardProps) {
  const styles = selected ? SERVICE_CARD_STYLES.selected : SERVICE_CARD_STYLES.default;

  const cardStyles: React.CSSProperties = {
    ...styles,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  };

  return (
    <div
      onClick={onClick}
      className={className}
      style={cardStyles}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Selection Indicator Circle */}
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          border: `2px solid ${styles.indicator}`,
          backgroundColor: selected ? styles.indicator : 'transparent',
          flexShrink: 0,
          marginTop: '2px',
        }}
      />

      {/* Content */}
      <div style={{ flex: 1 }}>
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 500,
            color: '#111827',
            marginBottom: description ? '4px' : '0',
          }}
        >
          {title}
        </h3>
        {description && (
          <p
            style={{
              fontSize: '14px',
              color: '#6B7280',
              margin: 0,
            }}
          >
            {description}
          </p>
        )}
      </div>

      {/* Icon (if provided) */}
      {Icon && (
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: selected ? `${WARM_ORANGE}20` : '#F3F4F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon
            size={14}
            color={selected ? WARM_ORANGE : '#6B7280'}
          />
        </div>
      )}
    </div>
  );
}

