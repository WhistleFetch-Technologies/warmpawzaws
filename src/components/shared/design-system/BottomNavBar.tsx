/**
 * Bottom Navigation Bar Component
 * Matches high-fidelity mobile design
 */

import React from 'react';
import { NAV_BAR_STYLES, WARM_ORANGE, WHITE } from '../../../assets/design-tokens';
import { LucideIcon } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface BottomNavBarProps {
  items: NavItem[];
  activeId: string;
  onItemClick: (id: string) => void;
  className?: string;
}

export function BottomNavBar({
  items,
  activeId,
  onItemClick,
  className = '',
}: BottomNavBarProps) {
  const containerStyles: React.CSSProperties = {
    ...NAV_BAR_STYLES,
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '8px 0',
    zIndex: 1000,
  };

  return (
    <nav className={className} style={containerStyles}>
      {items.map((item) => {
        const isActive = item.id === activeId;
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            onClick={() => onItemClick(item.id)}
            style={{
              ...(isActive ? NAV_BAR_STYLES.item.active : NAV_BAR_STYLES.item.default),
              border: 'none',
              background: isActive ? WARM_ORANGE : 'transparent',
              color: isActive ? WHITE : '#6B7280',
              borderRadius: isActive ? '8px' : '0',
              padding: '8px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minWidth: '60px',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = WARM_ORANGE;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = '#6B7280';
              }
            }}
          >
            <Icon size={20} />
            <span
              style={{
                fontSize: '12px',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

