/**
 * Date/Time Selector Component
 * Matches high-fidelity design (Today, Week, Month)
 */

import React from 'react';
import { DATE_SELECTOR_STYLES, WARM_ORANGE, WHITE } from '../../../assets/design-tokens';

interface DateSelectorProps {
  options: string[];
  selected: string;
  onSelect: (option: string) => void;
  className?: string;
}

export function DateSelector({
  options,
  selected,
  onSelect,
  className = '',
}: DateSelectorProps) {
  return (
    <div
      className={className}
      style={{
        ...DATE_SELECTOR_STYLES.container,
      }}
    >
      {options.map((option) => {
        const isActive = option === selected;
        const buttonStyles = isActive
          ? DATE_SELECTOR_STYLES.button.active
          : DATE_SELECTOR_STYLES.button.default;

        return (
          <button
            key={option}
            onClick={() => onSelect(option)}
            style={{
              ...buttonStyles,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              fontWeight: isActive ? 600 : 400,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = WARM_ORANGE;
                e.currentTarget.style.color = WARM_ORANGE;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = '#E5E7EB';
                e.currentTarget.style.color = '#6B7280';
              }
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

