import React, { useState, useEffect } from 'react';
import { Filter, X, Star, MapPin, DollarSign, Briefcase } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
// Brand color: #FF8C42

interface SearchFiltersProps {
  query?: string;
  type?: string;
  onFilterChange: (filters: FilterValues) => void;
  className?: string;
}

export interface FilterValues {
  city?: string;
  specialization?: string;
  serviceType?: string;
  minRating?: number;
  priceRange?: { min?: number; max?: number };
}

interface Facets {
  cities: string[];
  specializations: string[];
  serviceTypes: string[];
  priceRange: { min: number; max: number } | null;
  ratings: number[];
}

export function SearchFilters({ query, type = 'all', onFilterChange, className = '' }: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({});

  // Fetch available facets
  useEffect(() => {
    fetchFacets();
  }, [query, type]);

  const fetchFacets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (type) params.append('type', type);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/search/facets?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFacets(data.data?.facets || data.facets || null);
      }
    } catch (error) {
      console.error('Error fetching facets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof FilterValues, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilter = (key: keyof FilterValues) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    setFilters({});
    onFilterChange({});
  };

  const activeFilterCount = Object.keys(filters).length;

  if (!facets && !loading) return null;

  return (
    <div className={`${className}`}>
      {/* Filter Toggle Button */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="bg-orange-500 text-white ml-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            onClick={clearAllFilters}
            className="text-orange-600 hover:text-orange-700"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.city && (
            <Badge variant="secondary" className="gap-2 px-3 py-1.5">
              <MapPin className="w-3 h-3" />
              {filters.city}
              <button
                onClick={() => clearFilter('city')}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.specialization && (
            <Badge variant="secondary" className="gap-2 px-3 py-1.5">
              <Briefcase className="w-3 h-3" />
              {filters.specialization}
              <button
                onClick={() => clearFilter('specialization')}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.serviceType && (
            <Badge variant="secondary" className="gap-2 px-3 py-1.5">
              {filters.serviceType}
              <button
                onClick={() => clearFilter('serviceType')}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.minRating && (
            <Badge variant="secondary" className="gap-2 px-3 py-1.5">
              <Star className="w-3 h-3" />
              {filters.minRating}+ stars
              <button
                onClick={() => clearFilter('minRating')}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Filter Panel */}
      {isOpen && facets && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 space-y-6">
          {/* Cities */}
          {facets.cities && facets.cities.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-orange-500" />
                <span>Location</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {facets.cities.slice(0, 12).map((city) => (
                  <button
                    key={city}
                    onClick={() => handleFilterChange('city', filters.city === city ? undefined : city)}
                    className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                      filters.city === city
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Specializations */}
          {facets.specializations && facets.specializations.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 mb-3">
                <Briefcase className="w-4 h-4 text-orange-500" />
                <span>Specialization</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {facets.specializations.slice(0, 12).map((spec) => (
                  <button
                    key={spec}
                    onClick={() => handleFilterChange('specialization', filters.specialization === spec ? undefined : spec)}
                    className={`px-3 py-2 rounded-lg border text-sm transition-colors capitalize ${
                      filters.specialization === spec
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    {spec}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Service Types */}
          {facets.serviceTypes && facets.serviceTypes.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4 text-orange-500" />
                <span>Service Type</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {facets.serviceTypes.map((serviceType) => (
                  <button
                    key={serviceType}
                    onClick={() => handleFilterChange('serviceType', filters.serviceType === serviceType ? undefined : serviceType)}
                    className={`px-3 py-2 rounded-lg border text-sm transition-colors capitalize ${
                      filters.serviceType === serviceType
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    {serviceType}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ratings */}
          {facets.ratings && facets.ratings.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-orange-500" />
                <span>Minimum Rating</span>
              </h3>
              <div className="flex gap-2">
                {[5, 4, 3].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => handleFilterChange('minRating', filters.minRating === rating ? undefined : rating)}
                    className={`px-4 py-2 rounded-lg border text-sm transition-colors flex items-center gap-1 ${
                      filters.minRating === rating
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    <Star className="w-4 h-4 fill-current text-yellow-400" />
                    {rating}+
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Price Range */}
          {facets.priceRange && (
            <div>
              <h3 className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-orange-500" />
                <span>Price Range</span>
              </h3>
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Min</label>
                  <input
                    type="number"
                    value={filters.priceRange?.min || ''}
                    onChange={(e) => handleFilterChange('priceRange', {
                      ...filters.priceRange,
                      min: e.target.value ? parseInt(e.target.value) : undefined
                    })}
                    placeholder={`₹${facets.priceRange.min}`}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <span className="text-gray-400 mt-5">-</span>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Max</label>
                  <input
                    type="number"
                    value={filters.priceRange?.max || ''}
                    onChange={(e) => handleFilterChange('priceRange', {
                      ...filters.priceRange,
                      max: e.target.value ? parseInt(e.target.value) : undefined
                    })}
                    placeholder={`₹${facets.priceRange.max}`}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
