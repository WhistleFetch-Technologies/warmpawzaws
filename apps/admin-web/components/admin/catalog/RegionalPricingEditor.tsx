'use client';

import { useState } from 'react';
import { DollarSign, Info, TrendingUp, AlertCircle } from 'lucide-react';

interface Region {
  regionId: string;
  regionName: string;
  regionCode: string;
  isActive: boolean;
  currency: {
    code: string;
    symbol: string;
    symbolPosition: 'before' | 'after';
  };
  business: {
    taxRate: number;
    taxName: string;
  };
}

interface RegionalPricing {
  regionId: string;
  basePrice: number;
  currency: string;
  symbol: string;
  taxRate?: number;
  customTaxName?: string;
}

interface RegionalPricingEditorProps {
  value: RegionalPricing[];
  onChange: (value: RegionalPricing[]) => void;
  selectedRegions: string[];
  allRegions: Region[];
  availabilityMode: 'all' | 'specific' | 'exclude';
  className?: string;
}

const REGION_FLAGS: Record<string, string> = {
  'IN': '🇮🇳',
  'US': '🇺🇸',
  'AE': '🇦🇪',
  'SG': '🇸🇬',
  'GB': '🇬🇧',
  'AU': '🇦🇺',
  'CA': '🇨🇦',
};

export function RegionalPricingEditor({
  value,
  onChange,
  selectedRegions,
  allRegions,
  availabilityMode,
  className = '',
}: RegionalPricingEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({});

  const getRequiredRegions = (): Region[] => {
    const activeRegions = allRegions.filter(r => r.isActive);

    if (availabilityMode === 'all') {
      return activeRegions;
    } else if (availabilityMode === 'specific') {
      return activeRegions.filter(r => selectedRegions.includes(r.regionId));
    } else if (availabilityMode === 'exclude') {
      return activeRegions.filter(r => !selectedRegions.includes(r.regionId));
    }

    return [];
  };

  const requiredRegions = getRequiredRegions();

  const getPricingForRegion = (regionId: string): RegionalPricing => {
    const existing = value.find(p => p.regionId === regionId);
    if (existing) return existing;

    const region = allRegions.find(r => r.regionId === regionId);
    return {
      regionId,
      basePrice: 0,
      currency: region?.currency.code || 'USD',
      symbol: region?.currency.symbol || '$',
      taxRate: region?.business.taxRate,
    };
  };

  const updatePricing = (regionId: string, updates: Partial<RegionalPricing>) => {
    const existing = value.find(p => p.regionId === regionId);

    if (existing) {
      onChange(
        value.map(p =>
          p.regionId === regionId ? { ...p, ...updates } : p
        )
      );
    } else {
      const region = allRegions.find(r => r.regionId === regionId);
      onChange([
        ...value,
        {
          regionId,
          basePrice: 0,
          currency: region?.currency.code || 'USD',
          symbol: region?.currency.symbol || '$',
          taxRate: region?.business.taxRate,
          ...updates,
        },
      ]);
    }
  };

  const calculateFinalPrice = (pricing: RegionalPricing, region: Region): number => {
    const taxRate = pricing.taxRate !== undefined ? pricing.taxRate : region.business.taxRate;
    const taxAmount = (pricing.basePrice * taxRate) / 100;
    return pricing.basePrice + taxAmount;
  };

  const formatPrice = (amount: number, region: Region): string => {
    const formatted = amount.toFixed(region.currency.symbolPosition === 'before' ? 2 : 0);
    return region.currency.symbolPosition === 'before'
      ? `${region.currency.symbol}${formatted}`
      : `${formatted}${region.currency.symbol}`;
  };

  const autoFillPricing = () => {
    if (requiredRegions.length === 0) return;

    const firstRegion = requiredRegions[0];
    const firstPricing = getPricingForRegion(firstRegion.regionId);

    if (firstPricing.basePrice === 0) {
      alert('Please set a price for the first region before auto-filling');
      return;
    }

    const newPricing = requiredRegions.map(region => {
      const existing = getPricingForRegion(region.regionId);
      if (existing.basePrice > 0) return existing;

      return {
        regionId: region.regionId,
        basePrice: firstPricing.basePrice,
        currency: region.currency.code,
        symbol: region.currency.symbol,
        taxRate: region.business.taxRate,
      };
    });

    onChange(newPricing);
  };

  if (requiredRegions.length === 0) {
    return (
      <div className={`p-4 border-2 border-gray-200 rounded-lg bg-white ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="w-5 h-5 text-orange-600" />
          <label className="text-base font-medium text-gray-900">Regional Pricing</label>
        </div>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <Info className="w-4 h-4 inline mr-2" />
          Select regional availability first to configure pricing
        </div>
      </div>
    );
  }

  const missingPricing = requiredRegions.filter(r => {
    const pricing = getPricingForRegion(r.regionId);
    return !pricing.basePrice || pricing.basePrice <= 0;
  });

  return (
    <div className={`p-4 border-2 border-gray-200 rounded-lg bg-white ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-orange-600" />
          <label className="text-base font-medium text-gray-900">Regional Pricing</label>
          <span className="text-sm text-gray-500">
            ({requiredRegions.length} {requiredRegions.length === 1 ? 'region' : 'regions'})
          </span>
        </div>
        {requiredRegions.length > 1 && (
          <button
            type="button"
            onClick={autoFillPricing}
            className="text-xs text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-3"
          >
            <TrendingUp className="w-3 h-3" />
            Auto-fill from first region
          </button>
        )}
      </div>

      {missingPricing.length > 0 && (
        <div className="mb-4 p-0 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 inline mr-2" />
          Missing pricing for: {missingPricing.map(r => r.regionName).join(', ')}
        </div>
      )}

      <div className="space-y-4">
        {requiredRegions.map((region) => {
          const pricing = getPricingForRegion(region.regionId);
          const flag = REGION_FLAGS[region.regionCode] || '🌍';
          const finalPrice = calculateFinalPrice(pricing, region);
          const taxRate = pricing.taxRate !== undefined ? pricing.taxRate : region.business.taxRate;
          const taxAmount = (pricing.basePrice * taxRate) / 100;
          const taxName = pricing.customTaxName || region.business.taxName;

          return (
            <div
              key={region.regionId}
              className="border-2 border-gray-200 rounded-lg p-4 hover:border-orange-300 transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{flag}</span>
                <div className="flex-1">
                  <div className="font-medium text-lg">{region.regionName}</div>
                  <div className="text-sm text-gray-600">
                    Currency: {region.currency.code} ({region.currency.symbol})
                  </div>
                </div>
                {pricing.basePrice > 0 && (
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Final Price</div>
                    <div className="text-lg font-bold text-green-600">
                      {formatPrice(finalPrice, region)}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">
                    Base Price ({region.currency.symbol})
                  </label>
                  <div className="relative">
                    {region.currency.symbolPosition === 'before' && (
                      <span className="absolute left-3 top-0/2 -translate-y-1/2 text-gray-500">
                        {region.currency.symbol}
                      </span>
                    )}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricing.basePrice || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updatePricing(region.regionId, {
                          basePrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                      className={`w-full px-0 py-0 border border-gray-300 rounded-lg text-sm ${
                        region.currency.symbolPosition === 'before' ? 'pl-8' : 'pr-8'
                      }`}
                    />
                    {region.currency.symbolPosition === 'after' && (
                      <span className="absolute right-3 top-0/2 -translate-y-1/2 text-gray-500">
                        {region.currency.symbol}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">
                    Tax Rate (%)
                    <span className="text-gray-500 ml-2">
                      (Default: {region.business.taxRate}%)
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRate || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updatePricing(region.regionId, {
                        taxRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder={region.business.taxRate.toString()}
                    className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {pricing.basePrice > 0 && (
                <div className="mt-4 p-0 bg-gray-50 border border-gray-300 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">Base Price</div>
                      <div className="font-medium">
                        {formatPrice(pricing.basePrice, region)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">
                        {taxName} ({taxRate}%)
                      </div>
                      <div className="font-medium">
                        +{formatPrice(taxAmount, region)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">Final Price</div>
                      <div className="font-bold text-green-600">
                        {formatPrice(finalPrice, region)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-0">
                <button
                  type="button"
                  onClick={() =>
                    setShowAdvanced({
                      ...showAdvanced,
                      [region.regionId]: !showAdvanced[region.regionId],
                    })
                  }
                  className="text-xs text-gray-600 hover:text-gray-700 hover:underline"
                >
                  {showAdvanced[region.regionId] ? '− Hide' : '+ Show'} advanced options
                </button>

                {showAdvanced[region.regionId] && (
                  <div className="mt-0 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-0">
                        Custom Tax Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={pricing.customTaxName || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updatePricing(region.regionId, {
                            customTaxName: e.target.value,
                          })
                        }
                        placeholder={region.business.taxName}
                        className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-0">
                        Leave empty to use region default: {region.business.taxName}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {requiredRegions.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm">
            <div className="font-medium text-blue-900 mb-0">Pricing Summary</div>
            <div className="grid grid-cols-2 gap-3">
              {requiredRegions.map((region) => {
                const pricing = getPricingForRegion(region.regionId);
                const finalPrice = calculateFinalPrice(pricing, region);
                const flag = REGION_FLAGS[region.regionCode] || '🌍';

                return (
                  <div
                    key={region.regionId}
                    className="flex items-center justify-between p-0 bg-white rounded"
                  >
                    <span className="flex items-center gap-3">
                      <span>{flag}</span>
                      <span>{region.regionName}</span>
                    </span>
                    <span className="font-medium">
                      {pricing.basePrice > 0
                        ? formatPrice(finalPrice, region)
                        : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

