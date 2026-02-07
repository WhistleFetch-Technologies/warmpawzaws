'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';

interface IconSelectorProps {
  value?: string;
  onChange: (icon: string) => void;
  onClose?: () => void;
}

const commonIcons = [
  '🐾', '🐕', '🐈', '🐦', '🐰', '🐹', '🐢', '🐠',
  '🏥', '✂️', '🚶', '🏠', '📦', '💊', '🍽️', '🎾',
  '❤️', '⭐', '🎁', '🎉', '📱', '💻', '🌐', '📞',
  '📍', '⏰', '💰', '🎯', '✅', '❌', '⚠️', 'ℹ️'
];

export function IconSelector({ value, onChange, onClose }: IconSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredIcons = commonIcons.filter(icon => 
    icon.includes(searchQuery) || searchQuery === ''
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-full max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Select Icon</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-0 hover:bg-gray-100 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-0/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search icons..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          className="w-full pl-0 pr-4 py-0 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      <div className="grid grid-cols-8 gap-3 max-h-64 overflow-y-auto">
        {filteredIcons.map((icon) => (
          <button
            key={icon}
            onClick={() => {
              onChange(icon);
              onClose?.();
            }}
            className={`p-0 text-2xl rounded-lg hover:bg-gray-100 transition-colors ${
              value === icon ? 'bg-blue-100 border-2 border-blue-500' : 'border-2 border-transparent'
            }`}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}

