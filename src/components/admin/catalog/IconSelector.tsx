import { Check } from 'lucide-react';

interface Icon {
  id: string;
  emoji: string;
  label: string;
}

const CATEGORY_ICONS: Icon[] = [
  { id: 'healthcare', emoji: '🏥', label: 'Healthcare' },
  { id: 'grooming', emoji: '✂️', label: 'Grooming' },
  { id: 'walking', emoji: '🚶', label: 'Walking' },
  { id: 'boarding', emoji: '🏠', label: 'Boarding' },
  { id: 'training', emoji: '🎓', label: 'Training' },
  { id: 'Package', emoji: '📦', label: 'Package/Product' },
  { id: 'cafe', emoji: '☕', label: 'Cafe' },
  { id: 'adoption', emoji: '🐾', label: 'Adoption' },
  { id: 'insurance', emoji: '🛡️', label: 'Insurance' },
  { id: 'mating', emoji: '💕', label: 'Mating' },
  { id: 'sunset', emoji: '🌅', label: 'General' },
  { id: 'paw', emoji: '🐕', label: 'Pet Care' },
];

interface IconSelectorProps {
  selectedIcon: string;
  onSelect: (iconId: string) => void;
}

export function IconSelector({ selectedIcon, onSelect }: IconSelectorProps) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {CATEGORY_ICONS.map((icon) => (
        <button
          key={icon.id}
          type="button"
          onClick={() => onSelect(icon.id)}
          className={`
            relative p-2 rounded-lg border-2 transition-all text-center
            ${selectedIcon === icon.id
              ? 'border-[#FF8C42] bg-orange-50'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }
          `}
        >
          {selectedIcon === icon.id && (
            <div className="absolute top-1 right-1 w-4 h-4 bg-[#FF8C42] rounded-full flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-white" />
            </div>
          )}
          <div className="text-xl mb-0.5">{icon.emoji}</div>
          <div className="text-[10px] text-gray-600 leading-tight">{icon.label}</div>
        </button>
      ))}
    </div>
  );
}