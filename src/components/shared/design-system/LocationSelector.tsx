/**
 * Location Selector Component
 * Matches high-fidelity design with map and location selection
 */

import React, { useState } from 'react';
import { MAP_STYLES, WARM_ORANGE, WHITE } from '../../../assets/design-tokens';
import { MapPin, CheckCircle, X } from 'lucide-react';

interface LocationSelectorProps {
  onLocationSelect?: (location: { lat: number; lng: number; address: string }) => void;
  initialLocation?: { lat: number; lng: number; address: string };
  className?: string;
}

export function LocationSelector({
  onLocationSelect,
  initialLocation,
  className = '',
}: LocationSelectorProps) {
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(initialLocation || null);
  const [showTips, setShowTips] = useState(!initialLocation);

  const handleMapClick = () => {
    // In a real implementation, this would open a map picker
    // For now, we'll simulate a location selection
    const mockLocation = {
      lat: 19.0885,
      lng: 72.883382,
      address: 'Mumbai, Maharashtra, India',
    };
    setSelectedLocation(mockLocation);
    setShowTips(false);
    onLocationSelect?.(mockLocation);
  };

  const handleClear = () => {
    setSelectedLocation(null);
    setShowTips(true);
    onLocationSelect?.(null as any);
  };

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Map Component */}
      <div
        style={{
          ...MAP_STYLES,
          position: 'relative',
          minHeight: '300px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
        onClick={handleMapClick}
      >
        {selectedLocation ? (
          <>
            {/* Map with Pin */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: MAP_STYLES.pin.color,
              }}
            >
              <MapPin size={MAP_STYLES.pin.size} />
            </div>
            {/* Grid Pattern (simulated map) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `
                  linear-gradient(#E5E7EB 1px, transparent 1px),
                  linear-gradient(90deg, #E5E7EB 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px',
                opacity: 0.3,
              }}
            />
          </>
        ) : (
          <div
            style={{
              ...MAP_STYLES.placeholder,
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <MapPin size={48} color={MAP_STYLES.placeholder.text} style={{ marginBottom: '8px' }} />
            <p style={{ color: MAP_STYLES.placeholder.text, margin: 0 }}>
              Click to pin location
            </p>
          </div>
        )}

        {/* Zoom Controls */}
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <button
            style={{
              width: '32px',
              height: '32px',
              border: '1px solid #D1D5DB',
              borderRadius: '4px',
              background: WHITE,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#374151',
            }}
          >
            +
          </button>
          <button
            style={{
              width: '32px',
              height: '32px',
              border: '1px solid #D1D5DB',
              borderRadius: '4px',
              background: WHITE,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#374151',
            }}
          >
            −
          </button>
        </div>
      </div>

      {/* Selected Location Details */}
      {selectedLocation && (
        <div
          style={{
            ...MAP_STYLES.selected,
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <CheckCircle size={24} color={MAP_STYLES.selected.checkmark} />
            <div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#111827',
                  marginBottom: '4px',
                }}
              >
                Location Selected
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: '#6B7280',
                }}
              >
                Lat: {selectedLocation.lat}, Lng: {selectedLocation.lng}
              </div>
            </div>
          </div>
          <button
            onClick={handleClear}
            style={{
              padding: '8px 16px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              background: WHITE,
              cursor: 'pointer',
              fontSize: '14px',
              color: '#374151',
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Location Tips */}
      {showTips && (
        <div
          style={{
            ...MAP_STYLES,
            padding: '16px',
          }}
        >
          <h4
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#111827',
              marginBottom: '12px',
            }}
          >
            Location Tips
          </h4>
          <ul
            style={{
              margin: 0,
              paddingLeft: '20px',
              fontSize: '14px',
              color: '#6B7280',
              lineHeight: '1.6',
            }}
          >
            <li>Search for your clinic address or area name</li>
            <li>Use current location for quick setup</li>
            <li>Click on the map to Fine-tune your location</li>
            <li>Accurate location helps patients find you easily</li>
          </ul>
        </div>
      )}
    </div>
  );
}

