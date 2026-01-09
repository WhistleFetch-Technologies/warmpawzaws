/**
 * ========================================
 * SEARCH RESULTS GRID
 * ========================================
 * 
 * Display search results with:
 * - Responsive card layout
 * - Loading skeletons
 * - Empty states
 * - Pagination
 * - Result count
 * - Active filters display
 * 
 * Usage:
 * <SearchResultsGrid 
 *   results={results} 
 *   loading={loading}
 *   renderCard={(result) => <VendorCard {...result} />}
 * />
 */

import { Search, MapPin, Star, Loader2, Filter, X } from 'lucide-react';
import { SearchFilters } from './AdvancedFiltersPanel';

interface SearchResultsGridProps<T> {
  results: T[];
  loading?: boolean;
  totalResults?: number;
  query?: string;
  filters?: SearchFilters;
  renderCard: (result: T, index: number) => React.ReactNode;
  onRemoveFilter?: (key: keyof SearchFilters) => void;
  emptyTitle?: string;
  emptyMessage?: string;
  className?: string;
  gridClassName?: string;
}

export function SearchResultsGrid<T>({
  results,
  loading = false,
  totalResults,
  query,
  filters,
  renderCard,
  onRemoveFilter,
  emptyTitle = 'No results found',
  emptyMessage = 'Try adjusting your search or filters',
  className = '',
  gridClassName = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
}: SearchResultsGridProps<T>) {

  // Get active filters for display
  const getActiveFilters = () => {
    if (!filters) return [];
    
    const active: Array<{ key: keyof SearchFilters; label: string; value: string }> = [];
    
    if (filters.serviceType) {
      active.push({
        key: 'serviceType',
        label: 'Service',
        value: filters.serviceType
      });
    }
    
    if (filters.radius && filters.radius !== 10) {
      active.push({
        key: 'radius',
        label: 'Distance',
        value: `${filters.radius}km`
      });
    }
    
    if (filters.minRating) {
      active.push({
        key: 'minRating',
        label: 'Rating',
        value: `${filters.minRating}+ stars`
      });
    }
    
    if (filters.priceRange) {
      active.push({
        key: 'priceRange',
        label: 'Price',
        value: filters.priceRange
      });
    }
    
    if (filters.serviceStyle) {
      active.push({
        key: 'serviceStyle',
        label: 'Style',
        value: filters.serviceStyle.replace('_', ' ')
      });
    }
    
    return active;
  };

  const activeFilters = getActiveFilters();

  // Loading State
  if (loading) {
    return (
      <div className={className}>
        {/* Loading Header */}
        <div className="mb-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Loading Grid */}
        <div className={gridClassName}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="h-48 bg-gray-200 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-6 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty State
  if (!loading && results.length === 0) {
    return (
      <div className={`${className} text-center py-16`}>
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-gray-400" />
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {emptyTitle}
          </h3>
          
          <p className="text-gray-600 mb-6">
            {emptyMessage}
          </p>

          {/* Show what was searched */}
          {query && (
            <div className="text-sm text-gray-500 mb-4">
              No results for <span className="font-medium text-gray-700">"{query}"</span>
            </div>
          )}

          {/* Active Filters (to help user understand why no results) */}
          {activeFilters.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-2">Active filters:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {activeFilters.map((filter) => (
                  <span
                    key={filter.key}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full text-sm border border-gray-200"
                  >
                    <span className="text-gray-500">{filter.label}:</span>
                    <span className="font-medium">{filter.value}</span>
                    {onRemoveFilter && (
                      <button
                        onClick={() => onRemoveFilter(filter.key)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 text-sm text-gray-500">
            <p>Try:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Using different keywords</li>
              <li>Removing some filters</li>
              <li>Checking your spelling</li>
              <li>Using more general terms</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Results Display
  return (
    <div className={className}>
      {/* Results Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              {totalResults !== undefined
                ? `${totalResults.toLocaleString()} results`
                : `${results.length} results`}
            </h2>
            {query && (
              <p className="text-gray-600 mt-1">
                for "<span className="font-medium">{query}</span>"
              </p>
            )}
          </div>
        </div>

        {/* Active Filters Pills */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            {activeFilters.map((filter) => (
              <span
                key={filter.key}
                className="inline-flex items-center gap-2 px-3 py-1 bg-orange-50 text-[#FF8C42] rounded-full text-sm border border-orange-200"
              >
                <span className="opacity-75">{filter.label}:</span>
                <span className="font-medium">{filter.value}</span>
                {onRemoveFilter && (
                  <button
                    onClick={() => onRemoveFilter(filter.key)}
                    className="hover:bg-orange-100 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Results Grid */}
      <div className={gridClassName}>
        {results.map((result, index) => (
          <div key={index}>
            {renderCard(result, index)}
          </div>
        ))}
      </div>

      {/* Load More / Pagination could go here */}
    </div>
  );
}

// Vendor Result Card Component
interface VendorResultCardProps {
  id: string;
  businessName: string;
  description?: string;
  rating?: number;
  totalReviews?: number;
  services?: string[];
  serviceStyle?: string;
  priceRange?: string;
  distance?: number;
  photos?: string[];
  isVerified?: boolean;
  responseTime?: string;
  onClick?: () => void;
}

export function VendorResultCard({
  businessName,
  description,
  rating = 0,
  totalReviews = 0,
  services = [],
  serviceStyle,
  priceRange,
  distance,
  photos = [],
  isVerified = false,
  responseTime,
  onClick
}: VendorResultCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-200 overflow-hidden text-left group"
    >
      {/* Image */}
      <div className="relative h-48 bg-gray-100">
        {photos[0] ? (
          <img
            src={photos[0]}
            alt={businessName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Building2 className="w-16 h-16" />
          </div>
        )}
        
        {isVerified && (
          <div className="absolute top-3 right-3 bg-blue-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            ✓ Verified
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">
          {businessName}
        </h3>
        
        {description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {description}
          </p>
        )}

        {/* Rating & Reviews */}
        <div className="flex items-center gap-3 mb-3">
          {rating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium text-gray-900">{rating.toFixed(1)}</span>
              <span className="text-sm text-gray-500">({totalReviews})</span>
            </div>
          )}
          
          {distance !== undefined && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span>{distance.toFixed(1)} km</span>
            </div>
          )}
        </div>

        {/* Services */}
        {services.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {services.slice(0, 3).map((service, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
              >
                {service}
              </span>
            ))}
            {services.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                +{services.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-sm">
          {priceRange && (
            <span className="text-gray-600 capitalize">{priceRange}</span>
          )}
          {responseTime && (
            <span className="text-green-600">↻ {responseTime}</span>
          )}
        </div>
      </div>
    </button>
  );
}
