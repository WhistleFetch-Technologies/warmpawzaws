/**
 * Service Style Filter Component
 * 
 * Allows users to filter services by style:
 * - Center (at_center)
 * - Home (at_home)
 * - Tele (tele)
 * - Delivery (delivery)
 * - Package (package)
 * 
 * Implements WARMPAWZ design system
 */

import React from 'react';
import { MapPin, Home, Video, Truck, Package } from 'lucide-react';
import { colors } from '../shared/design-system/colors';

interface ServiceStyleFilterProps {
  selectedStyle?: 'at_center' | 'at_home' | 'tele' | 'delivery' | 'package' | 'all';
  onStyleChange: (style: 'at_center' | 'at_home' | 'tele' | 'delivery' | 'package' | 'all') => void;
  availableStyles?: ('at_center' | 'at_home' | 'tele' | 'delivery' | 'package')[];
  className?: string;
}

const styleOptions = [
  {
    value: 'all' as const,
    label: 'All',
    icon: null,
    color: colors.neutral.black,
  },
  {
    value: 'at_center' as const,
    label: 'Center',
    icon: MapPin,
    color: colors.primary.blue,
  },
  {
    value: 'at_home' as const,
    label: 'Home',
    icon: Home,
    color: colors.primary.green,
  },
  {
    value: 'tele' as const,
    label: 'Tele',
    icon: Video,
    color: colors.primary.purple,
  },
  {
    value: 'delivery' as const,
    label: 'Delivery',
    icon: Truck,
    color: colors.primary.orange,
  },
  {
    value: 'package' as const,
    label: 'Package',
    icon: Package,
    color: colors.primary.orange,
  },
];

export function ServiceStyleFilter({
  selectedStyle = 'all',
  onStyleChange,
  availableStyles = ['at_center', 'at_home', 'tele', 'delivery', 'package'],
  className = '',
}: ServiceStyleFilterProps) {
  
  // Filter options based on available styles
  const filteredOptions = styleOptions.filter(option => 
    option.value === 'all' || availableStyles.includes(option.value)
  );

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {filteredOptions.map((option) => {
        const isSelected = selectedStyle === option.value;
        const Icon = option.icon;
        
        return (
          <button
            key={option.value}
            onClick={() => onStyleChange(option.value)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
              ${isSelected 
                ? 'bg-orange-500 text-white shadow-md' 
                : 'bg-white text-gray-700 border border-gray-200 hover:border-orange-300 hover:bg-orange-50'
              }
            `}
            style={{
              fontFamily: "'Baloo 2', sans-serif",
              fontWeight: isSelected ? 600 : 500,
            }}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact horizontal filter for mobile
 */
export function ServiceStyleFilterCompact({
  selectedStyle = 'all',
  onStyleChange,
  availableStyles = ['at_center', 'at_home', 'tele', 'delivery', 'package'],
  className = '',
}: ServiceStyleFilterProps) {
  
  const filteredOptions = styleOptions.filter(option => 
    option.value === 'all' || availableStyles.includes(option.value)
  );

  return (
    <div className={`flex gap-1 overflow-x-auto pb-2 ${className}`}>
      {filteredOptions.map((option) => {
        const isSelected = selectedStyle === option.value;
        const Icon = option.icon;
        
        return (
          <button
            key={option.value}
            onClick={() => onStyleChange(option.value)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
              ${isSelected 
                ? 'bg-orange-500 text-white' 
                : 'bg-white text-gray-700 border border-gray-200'
              }
            `}
            style={{
              fontFamily: "'Baloo 2', sans-serif",
              fontWeight: isSelected ? 600 : 500,
            }}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

