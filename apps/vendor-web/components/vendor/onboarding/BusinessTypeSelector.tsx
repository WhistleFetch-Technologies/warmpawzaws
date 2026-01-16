'use client';

import { useState } from 'react';
import { Building2, Store, Home, Briefcase } from 'lucide-react';

interface BusinessType {
  id: string;
  name: string;
  description: string;
  icon: 'building' | 'store' | 'home' | 'briefcase';
}

interface BusinessTypeSelectorProps {
  selectedType: string;
  onSelect: (type: string) => void;
}

const businessTypes: BusinessType[] = [
  {
    id: 'clinic',
    name: 'Clinic / Center',
    description: 'Physical location with facilities',
    icon: 'building'
  },
  {
    id: 'store',
    name: 'Store / Shop',
    description: 'Retail location for products',
    icon: 'store'
  },
  {
    id: 'home',
    name: 'Home-Based',
    description: 'Service from your home',
    icon: 'home'
  },
  {
    id: 'mobile',
    name: 'Mobile Service',
    description: 'Travel to customer locations',
    icon: 'briefcase'
  }
];

const iconMap = {
  building: Building2,
  store: Store,
  home: Home,
  briefcase: Briefcase
};

export function BusinessTypeSelector({ selectedType, onSelect }: BusinessTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-0">Select Business Type</h3>
        <p className="text-sm text-gray-600">Choose the type that best describes your business</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {businessTypes.map((type) => {
          const Icon = iconMap[type.icon];
          const isSelected = selectedType === type.id;
          
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onSelect(type.id)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? 'border-primary bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isSelected ? 'bg-primary' : 'bg-gray-100'
                }`}>
                  <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{type.name}</div>
                  <div className="text-xs text-gray-500 mt-0">{type.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
