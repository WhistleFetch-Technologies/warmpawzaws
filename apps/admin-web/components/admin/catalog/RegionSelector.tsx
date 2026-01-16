'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { ChevronDown, Check, Globe } from 'lucide-react';

interface Region {
  regionId: string;
  regionName: string;
  regionCode: string;
  isActive: boolean;
  currency: {
    code: string;
    symbol: string;
  };
}

interface RegionSelectorProps {
  value: string | null;
  onChange: (regionId: string | null) => void;
  placeholder?: string;
  className?: string;
  multiple?: boolean;
  selectedRegions?: string[];
  onMultipleChange?: (regionIds: string[]) => void;
  filterActiveOnly?: boolean;
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

export function RegionSelector({
  value,
  onChange,
  placeholder = 'Select a region',
  className = '',
  multiple = false,
  selectedRegions = [],
  onMultipleChange,
  filterActiveOnly = true,
}: RegionSelectorProps) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/regions');
      if (response.success && response.regions) {
        let regs = response.regions;
        if (filterActiveOnly) {
          regs = regs.filter((r: Region) => r.isActive);
        }
        setRegions(regs);
      }
    } catch (error) {
      console.error('Error loading regions:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedRegion = regions.find(r => r.regionId === value);

  const handleToggleRegion = (regionId: string) => {
    if (!onMultipleChange) return;
    
    const current = selectedRegions || [];
    const isSelected = current.includes(regionId);
    
    if (isSelected) {
      onMultipleChange(current.filter(id => id !== regionId));
    } else {
      onMultipleChange([...current, regionId]);
    }
  };

  if (multiple) {
    return (
      <div className={className}>
        <div className="flex items-center gap-3 mb-0">
          <Globe className="w-5 h-5 text-orange-600" />
          <span className="font-medium text-gray-900">Select Regions</span>
          <span className="text-sm text-gray-500">({selectedRegions?.length || 0} selected)</span>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto border-2 border-gray-200 rounded-lg p-0">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading regions...</div>
          ) : regions.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No regions available</div>
          ) : (
            regions.map((region) => {
              const isSelected = selectedRegions?.includes(region.regionId);
              const flag = REGION_FLAGS[region.regionCode] || '🌍';
              
              return (
                <label
                  key={region.regionId}
                  className={`flex items-center gap-3 p-0 border-2 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-orange-50 border-orange-300'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleRegion(region.regionId)}
                    className="w-4 h-4 text-orange-600 focus:ring-orange-500 rounded"
                  />
                  <span className="text-2xl">{flag}</span>
                  <div className="flex-1">
                    <div className="font-medium">{region.regionName}</div>
                    <div className="text-sm text-gray-600">
                      {region.currency.symbol} {region.currency.code}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-5 h-5 text-orange-600" />
                  )}
                </label>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[44px] px-4 py-0.5 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-between hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          {selectedRegion ? (
            <>
              <span className="text-xl">{REGION_FLAGS[selectedRegion.regionCode] || '🌍'}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{selectedRegion.regionName}</div>
                <div className="text-xs text-gray-500">
                  {selectedRegion.currency.symbol} {selectedRegion.currency.code}
                </div>
              </div>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-0 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading regions...</div>
            ) : regions.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No regions available</div>
            ) : (
              <div className="py-0">
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-0.5 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                    value === null ? 'bg-orange-50' : ''
                  }`}
                >
                  {value === null && <Check className="w-4 h-4 text-orange-600" />}
                  <span className={value === null ? 'font-medium text-orange-600' : 'text-gray-700'}>
                    None
                  </span>
                </button>
                {regions.map((region) => {
                  const flag = REGION_FLAGS[region.regionCode] || '🌍';
                  return (
                    <button
                      key={region.regionId}
                      type="button"
                      onClick={() => {
                        onChange(region.regionId);
                        setIsOpen(false);
                      }}
                      className={`w-full px-4 py-0.5 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                        value === region.regionId ? 'bg-orange-50' : ''
                      }`}
                    >
                      {value === region.regionId && <Check className="w-4 h-4 text-orange-600" />}
                      <span className="text-xl">{flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${value === region.regionId ? 'text-orange-600' : 'text-gray-900'}`}>
                          {region.regionName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {region.currency.symbol} {region.currency.code}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

