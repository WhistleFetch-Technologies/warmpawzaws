import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

interface FilterState {
  size: string | null;
  ageRange: string | null;
  behavior: string[];
  vaccinated: boolean | null;
}

interface EnhancedAdoptionFiltersProps {
  onApplyFilters: (filters: FilterState) => void;
  onClearFilters: () => void;
}

export function EnhancedAdoptionFilters({ onApplyFilters, onClearFilters }: EnhancedAdoptionFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    size: null,
    ageRange: null,
    behavior: [],
    vaccinated: null
  });

  const sizeOptions = [
    { value: 'small', label: 'Small', description: 'Up to 10 kg' },
    { value: 'medium', label: 'Medium', description: '10-25 kg' },
    { value: 'large', label: 'Large', description: '25+ kg' }
  ];

  const ageRangeOptions = [
    { value: 'puppy', label: 'Puppy/Kitten', description: '0-1 year' },
    { value: 'young', label: 'Young', description: '1-3 years' },
    { value: 'adult', label: 'Adult', description: '3-7 years' },
    { value: 'senior', label: 'Senior', description: '7+ years' }
  ];

  const behaviorOptions = [
    { value: 'friendly', label: 'Friendly', icon: '😊' },
    { value: 'energetic', label: 'Energetic', icon: '⚡' },
    { value: 'calm', label: 'Calm', icon: '😌' },
    { value: 'shy', label: 'Shy', icon: '🙈' },
    { value: 'playful', label: 'Playful', icon: '🎾' },
    { value: 'gentle', label: 'Gentle', icon: '💙' }
  ];

  const handleSizeChange = (size: string) => {
    setFilters(prev => ({ ...prev, size: prev.size === size ? null : size }));
  };

  const handleAgeRangeChange = (ageRange: string) => {
    setFilters(prev => ({ ...prev, ageRange: prev.ageRange === ageRange ? null : ageRange }));
  };

  const handleBehaviorToggle = (behavior: string) => {
    setFilters(prev => ({
      ...prev,
      behavior: prev.behavior.includes(behavior)
        ? prev.behavior.filter(b => b !== behavior)
        : [...prev.behavior, behavior]
    }));
  };

  const handleApply = () => {
    onApplyFilters(filters);
    setShowFilters(false);
  };

  const handleClear = () => {
    setFilters({
      size: null,
      ageRange: null,
      behavior: [],
      vaccinated: null
    });
    onClearFilters();
    setShowFilters(false);
  };

  const activeFilterCount = [
    filters.size,
    filters.ageRange,
    filters.behavior.length > 0,
    filters.vaccinated !== null
  ].filter(Boolean).length;

  return (
    <div>
      {/* Filter Button */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full hover:bg-[#FF8C42] gray-50 transition-colors"
      >
        <Filter className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">Filters</span>
        {activeFilterCount > 0 && (
          <span className="bg-[#FF8C42] red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Filter Panel */}
      {showFilters && (
        <div className="fixed inset-0 bg-black bg-[#FF8C42] opacity-50 z-50 flex items-end sm:items-center justify-center">
          <Card className="w-full max-w-lg bg-[#FF8C42] white rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-[#FF8C42] white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Filter Pets</h2>
              <button onClick={() => setShowFilters(false)} className="p-1 hover:bg-[#FF8C42] gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Size Filter */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Size</h3>
                <div className="grid grid-cols-3 gap-2">
                  {sizeOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleSizeChange(option.value)}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        filters.size === option.value
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold text-sm text-gray-900">{option.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Age Range Filter */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Age Range</h3>
                <div className="grid grid-cols-2 gap-2">
                  {ageRangeOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleAgeRangeChange(option.value)}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        filters.ageRange === option.value
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold text-sm text-gray-900">{option.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Behavior Filter */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Behavior (Select Multiple)</h3>
                <div className="grid grid-cols-2 gap-2">
                  {behaviorOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleBehaviorToggle(option.value)}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        filters.behavior.includes(option.value)
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl">{option.icon}</span>
                      <p className="font-semibold text-sm text-gray-900 mt-1">{option.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vaccination Status */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Vaccination Status</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, vaccinated: true }))}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      filters.vaccinated === true
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-semibold text-sm text-gray-900">Vaccinated</p>
                    <p className="text-xs text-gray-500 mt-1">✓ Fully vaccinated</p>
                  </button>
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, vaccinated: null }))}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      filters.vaccinated === null
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-semibold text-sm text-gray-900">All</p>
                    <p className="text-xs text-gray-500 mt-1">Any status</p>
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 bg-[#FF8C42] white border-t border-gray-200 p-4 flex gap-3">
              <Button
                onClick={handleClear}
                variant="outline"
                className="flex-1"
              >
                Clear All
              </Button>
              <Button
                onClick={handleApply}
                className="flex-1 bg-[#FF8C42] gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white"
              >
                Apply Filters
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
