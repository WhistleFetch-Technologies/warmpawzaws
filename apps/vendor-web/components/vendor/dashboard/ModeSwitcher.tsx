'use client';

import React from 'react';
import { Building2, User } from 'lucide-react';

export type VendorMode = 'CENTER' | 'STAFF';

interface ModeSwitcherProps {
  currentMode: VendorMode;
  isSoloProvider: boolean;
  onSwitch: (mode: VendorMode) => void;
}

export function ModeSwitcher({ currentMode, isSoloProvider, onSwitch }: ModeSwitcherProps) {
  if (!isSoloProvider) {
    return null; // Only show for solo providers
  }

  return (
    <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-0">
      <button
        onClick={() => onSwitch('CENTER')}
        className={`px-0 py-0.5 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${
          currentMode === 'CENTER'
            ? 'bg-white text-orange-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <Building2 className="w-4 h-4" />
        Center
      </button>
      <button
        onClick={() => onSwitch('STAFF')}
        className={`px-0 py-0.5 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${
          currentMode === 'STAFF'
            ? 'bg-white text-orange-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <User className="w-4 h-4" />
        Staff
      </button>
    </div>
  );
}

