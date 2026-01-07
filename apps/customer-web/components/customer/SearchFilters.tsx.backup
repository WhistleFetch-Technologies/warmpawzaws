'use client';

import React, { useState, useEffect } from 'react';
import { Filter, X, Star, MapPin, DollarSign, Briefcase } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

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

      const response = await apiClient.get<{ facets: Facets }>(`/search/facets?${params}`);
      if (response.facets) {
        setFacets(response.facets);
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
    <div className={className}>
      {/* Filter Toggle Button */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-primary text-white rounded-full text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-primary hover:text-primary-dark text-sm font-medium"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.city && (
            <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center gap-2">
              <MapPin className="w-3 h-3" />
              {filters.city}
              <button
                onClick={() => clearFilter('city')}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.specialization && (
            <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center gap-2">
              <Briefcase className="w-3 h-3" />
              {filters.specialization}
              <button
                onClick={() => clearFilter('specialization')}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.serviceType && (
            <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center gap-2">
              {filters.serviceType}
              <button
                onClick={() => clearFilter('serviceType')}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.minRating && (
            <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center gap-2">
              <Star className="w-3 h-3" />
              {filters.minRating}+ Stars
              <button
                onClick={() => clearFilter('minRating')}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.priceRange && (
            <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center gap-2">
              <DollarSign className="w-3 h-3" />
              ₹{filters.priceRange.min || 0} - ₹{filters.priceRange.max || '∞'}
              <button
                onClick={() => clearFilter('priceRange')}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Filter Panel */}
      {isOpen && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-lg mb-4">
          <h3 className="font-bold text-gray-900 mb-4">Filter Results</h3>
          
          <div className="space-y-4">
            {/* City Filter */}
            {facets?.cities && facets.cities.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                <select
                  value={filters.city || ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFilterChange('city', e.target.value || undefined)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                >
                  <option value="">All Cities</option>
                  {facets.cities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Specialization Filter */}
            {facets?.specializations && facets.specializations.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Specialization</label>
                <select
                  value={filters.specialization || ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFilterChange('specialization', e.target.value || undefined)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                >
                  <option value="">All Specializations</option>
                  {facets.specializations.map((spec) => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Rating Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Minimum Rating</label>
              <select
                value={filters.minRating || ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFilterChange('minRating', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
              >
                <option value="">All Ratings</option>
                <option value="4">4+ Stars</option>
                <option value="4.5">4.5+ Stars</option>
                <option value="5">5 Stars</option>
              </select>
            </div>

            {/* Price Range Filter */}
            {facets?.priceRange && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Price Range</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.priceRange?.min || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange('priceRange', {
                      ...filters.priceRange,
                      min: e.target.value ? parseFloat(e.target.value) : undefined
                    })}
                    className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.priceRange?.max || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange('priceRange', {
                      ...filters.priceRange,
                      max: e.target.value ? parseFloat(e.target.value) : undefined
                    })}
                    className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

