'use client';

import { Check } from 'lucide-react';

interface VendorType {
  id: string;
  emoji: string;
  label: string;
  description: string;
}

const VENDOR_TYPES: VendorType[] = [
  { id: 'veterinary', emoji: '🏥', label: 'Veterinary', description: 'Medical services' },
  { id: 'grooming', emoji: '✂️', label: 'Grooming & Day-care', description: 'Styling & care' },
  { id: 'walking', emoji: '🚶', label: 'Walking & Sitters', description: 'Exercise & care' },
  { id: 'boarding', emoji: '🏠', label: 'Boarding & Kennels', description: 'Overnight stay' },
  { id: 'training', emoji: '🎓', label: 'Training & Behavior', description: 'Obedience & skills' },
  { id: 'retail', emoji: '🛒', label: 'Retail & Products', description: 'Pet supplies' },
  { id: 'cafe', emoji: '☕', label: 'Pet-Friendly Cafes', description: 'Dining spots' },
  { id: 'adoption', emoji: '🐾', label: 'Adoption Services', description: 'Find homes' },
  { id: 'insurance', emoji: '🛡️', label: 'Insurance Providers', description: 'Pet protection' },
  { id: 'mating', emoji: '💕', label: 'Mating & Dating', description: 'Breeding services' },
];

interface VendorTypeSelectorProps {
  selectedType: string;
  onSelect: (typeId: string) => void;
}

export function VendorTypeSelector({ selectedType, onSelect }: VendorTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-0">
      {VENDOR_TYPES.map((type) => (
        <button
          key={type.id}
          type="button"
          onClick={() => onSelect(type.id)}
          className={`
            relative p-0.5 rounded-lg border-2 transition-all text-left
            ${selectedType === type.id
              ? 'border-primary bg-primary/10'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }
          `}
        >
          {selectedType === type.id && (
            <div className="absolute top-0 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-white" />
            </div>
          )}
          <div className="flex items-start gap-0">
            <div className="text-lg">{type.emoji}</div>
            <div className="flex-1">
              <div className="text-xs mb-0.5">{type.label}</div>
              <div className="text-[10px] text-gray-500 leading-tight">{type.description}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

