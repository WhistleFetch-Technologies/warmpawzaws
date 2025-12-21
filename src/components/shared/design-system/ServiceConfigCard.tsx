/**
 * Service Configuration Card Component
 * Matches high-fidelity design with toggles, inputs, and badges
 */

import React, { useState } from 'react';
import { SERVICE_CONFIG_STYLES, WARM_ORANGE, WHITE } from '../../../assets/design-tokens';

interface ServiceConfigCardProps {
  serviceName: string;
  suggestedPrice: string;
  isActive: boolean;
  onToggleActive: (active: boolean) => void;
  price?: string;
  onPriceChange?: (price: string) => void;
  timeDuration?: string;
  onTimeDurationChange?: (duration: string) => void;
  locationOptions?: {
    atClinic: boolean;
    atHome: boolean;
    onToggleClinic: (enabled: boolean) => void;
    onToggleHome: (enabled: boolean) => void;
  };
  onCallOption?: {
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
  };
  className?: string;
}

export function ServiceConfigCard({
  serviceName,
  suggestedPrice,
  isActive,
  onToggleActive,
  price,
  onPriceChange,
  timeDuration,
  onTimeDurationChange,
  locationOptions,
  onCallOption,
  className = '',
}: ServiceConfigCardProps) {
  const styles = isActive ? {
    ...SERVICE_CONFIG_STYLES,
    border: SERVICE_CONFIG_STYLES.activeBorder,
  } : SERVICE_CONFIG_STYLES;

  const cardStyles: React.CSSProperties = {
    ...styles,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  return (
    <div className={className} style={cardStyles}>
      {/* Header with Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: 0 }}>
              {serviceName}
            </h3>
            {isActive && (
              <span
                style={{
                  ...SERVICE_CONFIG_STYLES.badge,
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                Active Service
              </span>
            )}
          </div>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
            Suggested {suggestedPrice}
          </p>
        </div>
        <ToggleSwitch
          checked={isActive}
          onChange={onToggleActive}
        />
      </div>

      {isActive && (
        <>
          {/* Price Input */}
          {onPriceChange && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '8px',
                }}
              >
                Set your Price (₹)
              </label>
              <input
                type="text"
                value={price || ''}
                onChange={(e) => onPriceChange(e.target.value)}
                placeholder="500"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
              <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px', marginBottom: 0 }}>
                Competitive rates help attract more customers
              </p>
            </div>
          )}

          {/* Time Duration */}
          {onTimeDurationChange && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '8px',
                }}
              >
                Time Duration
              </label>
              <select
                value={timeDuration || ''}
                onChange={(e) => onTimeDurationChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <option value="30">30 Minutes</option>
                <option value="45">45 Minutes</option>
                <option value="60">60 Minutes</option>
              </select>
              <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px', marginBottom: 0 }}>
                Excludes waiting, travel
              </p>
            </div>
          )}

          {/* Location Options */}
          {locationOptions && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>At your clinic</span>
                  <ToggleSwitch
                    checked={locationOptions.atClinic}
                    onChange={locationOptions.onToggleClinic}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>At customer home</span>
                  <ToggleSwitch
                    checked={locationOptions.atHome}
                    onChange={locationOptions.onToggleHome}
                  />
                </div>
              </div>
            </div>
          )}

          {/* On Call Option */}
          {onCallOption && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#374151' }}>On Call</span>
              <ToggleSwitch
                checked={onCallOption.enabled}
                onChange={onCallOption.onToggle}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Toggle Switch Component
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        border: 'none',
        background: checked ? WARM_ORANGE : '#D1D5DB',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        padding: 0,
      }}
    >
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: WHITE,
          position: 'absolute',
          top: '2px',
          left: checked ? '22px' : '2px',
          transition: 'left 0.2s ease',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        }}
      />
    </button>
  );
}

