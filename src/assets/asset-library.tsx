/**
 * WARMPAWZ ASSET LIBRARY
 * Centralized asset management and AI-generated assets
 */

import React, { useState, useEffect } from 'react';
import { 
  LOGO_CIRCULAR_ORANGE, 
  WARM_ORANGE, 
  WHITE, 
  BLACK,
  BUTTON_VARIANTS,
  SERVICE_CARD_STYLES,
  NAV_BAR_STYLES,
  SERVICE_CONFIG_STYLES,
  MAP_STYLES,
} from './design-tokens';

// ==================== LOGO ASSETS ====================
export const LOGO_ASSETS = {
  circularOrange: LOGO_CIRCULAR_ORANGE,
  welcomeText: 'Welcome to WARMPAWZ!',
};

// ==================== AI-GENERATED ASSET COMPONENTS ====================

/**
 * Logo Component
 */
export function WarmpawzLogo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src={LOGO_CIRCULAR_ORANGE}
      alt="Warmpawz Logo"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: '50%' }}
    />
  );
}

/**
 * Color Palette Component
 */
export function ColorPalette() {
  const colors = [
    { name: 'Warm Orange', value: WARM_ORANGE },
    { name: 'White', value: WHITE },
    { name: 'Black', value: BLACK },
    { name: 'Dark Orange Gold', value: '#E67A2E' },
  ];

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {colors.map((color) => (
        <div
          key={color.name}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '8px',
            backgroundColor: color.value,
            border: color.value === WHITE ? '1px solid #E5E7EB' : 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 500,
              color: color.value === WHITE || color.value === WARM_ORANGE ? BLACK : WHITE,
              textAlign: 'center',
              padding: '0 4px',
            }}
          >
            {color.name}
          </div>
          <div
            style={{
              fontSize: '9px',
              color: color.value === WHITE || color.value === WARM_ORANGE ? '#6B7280' : WHITE,
              textAlign: 'center',
            }}
          >
            {color.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ==================== ASSET LIBRARY MANAGER ====================

interface Asset {
  id: string;
  name: string;
  type: 'logo' | 'color' | 'component' | 'icon' | 'illustration';
  category: string;
  preview: React.ReactNode;
  code: string;
  usage: string[];
}

export function AssetLibraryManager() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Initialize with default assets
    const defaultAssets: Asset[] = [
      {
        id: 'logo-circular-orange',
        name: 'Circular Orange Logo',
        type: 'logo',
        category: 'branding',
        preview: <WarmpawzLogo size={80} />,
        code: `import { WarmpawzLogo } from '@/assets/asset-library';\n\n<WarmpawzLogo size={40} />`,
        usage: ['Header', 'Auth Pages', 'Loading States'],
      },
      {
        id: 'color-palette',
        name: 'Color Palette',
        type: 'color',
        category: 'branding',
        preview: <ColorPalette />,
        code: `import { WARM_ORANGE, WHITE, BLACK } from '@/assets/design-tokens';\n\nconst color = WARM_ORANGE;`,
        usage: ['Buttons', 'Cards', 'Borders'],
      },
      {
        id: 'button-solid',
        name: 'Solid Orange Button',
        type: 'component',
        category: 'buttons',
        preview: (
          <button
            style={{
              ...BUTTON_VARIANTS.solid,
              padding: '12px 24px',
            }}
          >
            Get started
          </button>
        ),
        code: `import { WarmpawzButton } from '@/components/shared/design-system/WarmpawzButton';\n\n<WarmpawzButton variant="solid">Get started</WarmpawzButton>`,
        usage: ['Primary Actions', 'CTAs'],
      },
      {
        id: 'button-outlined',
        name: 'Outlined Orange Button',
        type: 'component',
        category: 'buttons',
        preview: (
          <button
            style={{
              ...BUTTON_VARIANTS.outlined,
              padding: '12px 24px',
            }}
          >
            Get started
          </button>
        ),
        code: `import { WarmpawzButton } from '@/components/shared/design-system/WarmpawzButton';\n\n<WarmpawzButton variant="outlined">Get started</WarmpawzButton>`,
        usage: ['Secondary Actions'],
      },
      {
        id: 'service-card',
        name: 'Service Selection Card',
        type: 'component',
        category: 'cards',
        preview: (
          <div style={{ ...SERVICE_CARD_STYLES.default, padding: '16px', width: '200px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: '2px solid #9CA3AF',
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: '16px', fontWeight: 500 }}>Veterinarian</div>
                <div style={{ fontSize: '14px', color: '#6B7280' }}>Medical care for pets</div>
              </div>
            </div>
          </div>
        ),
        code: `import { ServiceCard } from '@/components/shared/design-system/ServiceCard';\n\n<ServiceCard\n  title="Veterinarian"\n  description="Medical care for pets"\n  selected={false}\n/>`,
        usage: ['Role Selection', 'Service Selection'],
      },
    ];

    setAssets(defaultAssets);
  }, []);

  const filteredAssets = assets.filter((asset) => {
    if (selectedCategory !== 'all' && asset.category !== selectedCategory) return false;
    if (searchQuery && !asset.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const categories = ['all', ...Array.from(new Set(assets.map((a) => a.category)))];

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>
        Warmpawz Asset Library
      </h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search assets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '12px 16px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            fontSize: '14px',
          }}
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            padding: '12px 16px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            fontSize: '14px',
            minWidth: '150px',
          }}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Assets Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '24px',
        }}
      >
        {filteredAssets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </div>
    </div>
  );
}

function AssetCard({ asset }: { asset: Asset }) {
  const [showCode, setShowCode] = useState(false);

  return (
    <div
      style={{
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        padding: '16px',
        backgroundColor: WHITE,
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
          {asset.name}
        </h3>
        <div
          style={{
            display: 'inline-block',
            padding: '4px 8px',
            backgroundColor: '#F3F4F6',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#6B7280',
          }}
        >
          {asset.type}
        </div>
      </div>

      {/* Preview */}
      <div
        style={{
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          padding: '24px',
          backgroundColor: '#F9FAFB',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '120px',
        }}
      >
        {asset.preview}
      </div>

      {/* Usage */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Used in:</div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {asset.usage.map((use, idx) => (
            <span
              key={idx}
              style={{
                padding: '2px 8px',
                backgroundColor: '#F3F4F6',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#374151',
              }}
            >
              {use}
            </span>
          ))}
        </div>
      </div>

      {/* Code Toggle */}
      <button
        onClick={() => setShowCode(!showCode)}
        style={{
          width: '100%',
          padding: '8px',
          border: '1px solid #D1D5DB',
          borderRadius: '6px',
          backgroundColor: WHITE,
          cursor: 'pointer',
          fontSize: '12px',
          color: WARM_ORANGE,
        }}
      >
        {showCode ? 'Hide' : 'Show'} Code
      </button>

      {showCode && (
        <pre
          style={{
            marginTop: '8px',
            padding: '12px',
            backgroundColor: '#1F2937',
            color: '#F9FAFB',
            borderRadius: '6px',
            fontSize: '11px',
            overflow: 'auto',
          }}
        >
          {asset.code}
        </pre>
      )}
    </div>
  );
}

// Export all assets
export default {
  LOGO_ASSETS,
  WarmpawzLogo,
  ColorPalette,
  AssetLibraryManager,
};

