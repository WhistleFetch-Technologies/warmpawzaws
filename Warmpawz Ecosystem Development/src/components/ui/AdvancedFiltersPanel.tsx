/**
 * ========================================
 * ADVANCED FILTERS PANEL
 * ========================================
 * 
 * Comprehensive filtering sidebar for search results:
 * - Service type selection
 * - Location radius
 * - Price range slider
 * - Rating filter
 * - Availability calendar
 * - Service style (At Home/At Center)
 * - Sort options
 * 
 * Usage:
 * <AdvancedFiltersPanel filters={filters} onChange={setFilters} />
 */

import { useState } from 'react';
import { Sliders, MapPin, Star, Calendar, Home, Building2, DollarSign, TrendingUp, X } from 'lucide-react';
import { Button } from './button';
import { Slider } from './slider';

export interface SearchFilters {
  serviceType?: string;
  location?: { lat: number; lng: number };
  radius?: number;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  priceRange?: 'budget' | 'moderate' | 'premium';
  serviceStyle?: 'at_home' | 'at_center' | 'both';
  availability?: string;
  sortBy?: 'relevance' | 'rating' | 'distance' | 'price' | 'reviews';
}

interface AdvancedFiltersPanelProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onApply?: () => void;
  onReset?: () => void;
  className?: string;
  showLocationFilter?: boolean;
  showPriceFilter?: boolean;
  showServiceTypeFilter?: boolean;
}

const SERVICE_TYPES = [
  { value: 'veterinary', label: 'Veterinary', icon: '🏥' },
  { value: 'grooming', label: 'Grooming', icon: '✂️' },
  { value: 'training', label: 'Training', icon: '🎓' },
  { value: 'boarding', label: 'Boarding', icon: '🏠' },
  { value: 'walking', label: 'Walking', icon: '🚶' },
  { value: 'daycare', label: 'Daycare', icon: '🌞' },
  { value: 'sitting', label: 'Pet Sitting', icon: '🛋️' },
  { value: 'nutrition', label: 'Nutrition', icon: '🥗' }
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most Relevant', icon: TrendingUp },
  { value: 'rating', label: 'Highest Rated', icon: Star },
  { value: 'distance', label: 'Nearest', icon: MapPin },
  { value: 'price', label: 'Lowest Price', icon: DollarSign }
];

export function AdvancedFiltersPanel({
  filters,
  onChange,
  onApply,
  onReset,
  className = '',
  showLocationFilter = true,
  showPriceFilter = true,
  showServiceTypeFilter = true
}: AdvancedFiltersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const handleReset = () => {
    onChange({});
    if (onReset) onReset();
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.serviceType) count++;
    if (filters.radius && filters.radius !== 10) count++;
    if (filters.minRating && filters.minRating > 0) count++;
    if (filters.priceRange) count++;
    if (filters.serviceStyle) count++;
    return count;
  };

  const activeCount = getActiveFiltersCount();

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-gray-700" />
            <h3 className="font-semibold text-gray-900">Filters</h3>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 bg-[#FF8C42] text-white text-xs rounded-full">
                {activeCount}
              </span>
            )}
          </div>
          {activeCount > 0 && (
            <button
              onClick={handleReset}
              className="text-sm text-[#FF8C42] hover:text-[#FF7029] transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
        
        {/* Service Type Filter */}
        {showServiceTypeFilter && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Service Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => updateFilter('serviceType', 
                    filters.serviceType === type.value ? undefined : type.value
                  )}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    filters.serviceType === type.value
                      ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <span className="text-lg">{type.icon}</span>
                  <span className="text-sm font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Location Radius */}
        {showLocationFilter && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <MapPin className="w-4 h-4 inline mr-1" />
              Distance Range
            </label>
            <div className="space-y-2">
              <Slider
                value={[filters.radius || 10]}
                onValueChange={([value]) => updateFilter('radius', value)}
                min={1}
                max={50}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600">
                <span>1 km</span>
                <span className="font-medium text-[#FF8C42]">
                  {filters.radius || 10} km
                </span>
                <span>50 km</span>
              </div>
            </div>
          </div>
        )}

        {/* Price Range */}
        {showPriceFilter && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Price Range
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'budget', label: 'Budget', icon: '₹' },
                { value: 'moderate', label: 'Moderate', icon: '₹₹' },
                { value: 'premium', label: 'Premium', icon: '₹₹₹' }
              ].map((range) => (
                <button
                  key={range.value}
                  onClick={() => updateFilter('priceRange',
                    filters.priceRange === range.value ? undefined : range.value
                  )}
                  className={`px-3 py-2 rounded-lg border transition-all ${
                    filters.priceRange === range.value
                      ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="text-xs font-medium">{range.label}</div>
                  <div className="text-sm">{range.icon}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Rating Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            <Star className="w-4 h-4 inline mr-1" />
            Minimum Rating
          </label>
          <div className="space-y-2">
            {[
              { value: 4.5, label: '4.5+', stars: 5 },
              { value: 4.0, label: '4.0+', stars: 4 },
              { value: 3.5, label: '3.5+', stars: 4 },
              { value: 3.0, label: '3.0+', stars: 3 }
            ].map((rating) => (
              <button
                key={rating.value}
                onClick={() => updateFilter('minRating',
                  filters.minRating === rating.value ? undefined : rating.value
                )}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${
                  filters.minRating === rating.value
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {Array.from({ length: rating.stars }).map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium">{rating.label}</span>
                </div>
                {filters.minRating === rating.value && (
                  <div className="w-2 h-2 rounded-full bg-[#FF8C42]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Service Style */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Service Style
          </label>
          <div className="space-y-2">
            {[
              { value: 'at_home', label: 'At Home', icon: Home },
              { value: 'at_center', label: 'At Center', icon: Building2 },
              { value: 'both', label: 'Both Options', icon: Sliders }
            ].map((style) => (
              <button
                key={style.value}
                onClick={() => updateFilter('serviceStyle',
                  filters.serviceStyle === style.value ? undefined : style.value
                )}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
                  filters.serviceStyle === style.value
                    ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <style.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{style.label}</span>
                {filters.serviceStyle === style.value && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-[#FF8C42]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Sort By */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Sort By
          </label>
          <div className="space-y-2">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => updateFilter('sortBy', option.value)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
                  (filters.sortBy || 'relevance') === option.value
                    ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <option.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{option.label}</span>
                {(filters.sortBy || 'relevance') === option.value && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-[#FF8C42]" />
                )}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Apply Button */}
      {onApply && (
        <div className="p-4 border-t border-gray-200">
          <Button
            onClick={onApply}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7029] text-white"
          >
            Apply Filters
            {activeCount > 0 && ` (${activeCount})`}
          </Button>
        </div>
      )}
    </div>
  );
}
