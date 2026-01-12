/**
 * ========================================
 * ENHANCED PRODUCT SEARCH PAGE
 * ========================================
 * 
 * E-commerce product search with:
 * - Category filters
 * - Brand filters
 * - Price range
 * - Rating filter
 * - Sort options
 * - Grid/List view
 * 
 * Usage:
 * <ProductSearchEnhanced />
 */

import { useState, useEffect } from 'react';
import { ShoppingCart, Heart, Star, Grid, List as ListIcon, Filter, Package } from 'lucide-react';
import { UniversalSearchBar } from '../ui/UniversalSearchBar';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface ProductResult {
  id: string;
  name: string;
  description?: string;
  price: number;
  rating?: number;
  totalReviews?: number;
  category?: string;
  brand?: string;
  inStock?: boolean;
  images?: string[];
  soldCount?: number;
}

interface ProductFilters {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
  sortBy?: 'relevance' | 'price_low' | 'price_high' | 'rating' | 'popular';
}

export function ProductSearchEnhanced() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ProductFilters>({
    inStock: true,
    sortBy: 'relevance'
  });
  const [results, setResults] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Available categories and brands (would come from API in production)
  const categories = ['Food', 'Toys', 'Accessories', 'Healthcare', 'Grooming'];
  const brands = ['Pedigree', 'Whiskas', 'Royal Canin', 'Drools', 'Purepet'];

  // Search products
  const searchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/advanced-search/products`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            ...filters,
            limit: 50
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
      }
    } catch (error) {
      console.error('Product search error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [query, filters]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <UniversalSearchBar
            onNavigate={(type, id) => {
              if (type === 'product' && id) {
                window.location.href = `/product/${id}`;
              } else if (type === 'search') {
                setQuery(id || '');
              }
            }}
            placeholder="Search for pet food, toys, accessories..."
          />

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="relevance">Most Relevant</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
                <option value="popular">Most Popular</option>
              </select>

              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${
                    viewMode === 'grid' ? 'bg-white shadow-sm' : ''
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${
                    viewMode === 'list' ? 'bg-white shadow-sm' : ''
                  }`}
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Filters Sidebar */}
          {showFilters && (
            <div className="w-64 flex-shrink-0">
              <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-32">
                <h3 className="font-semibold mb-4">Filters</h3>

                {/* Category */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Category</label>
                  {categories.map(cat => (
                    <label key={cat} className="flex items-center gap-2 py-1">
                      <input
                        type="radio"
                        checked={filters.category === cat}
                        onChange={() => setFilters({ ...filters, category: cat })}
                        className="text-[#FF8C42]"
                      />
                      <span className="text-sm">{cat}</span>
                    </label>
                  ))}
                </div>

                {/* Brand */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Brand</label>
                  {brands.map(brand => (
                    <label key={brand} className="flex items-center gap-2 py-1">
                      <input
                        type="radio"
                        checked={filters.brand === brand}
                        onChange={() => setFilters({ ...filters, brand })}
                        className="text-[#FF8C42]"
                      />
                      <span className="text-sm">{brand}</span>
                    </label>
                  ))}
                </div>

                {/* Price Range */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Price Range</label>
                  <div className="space-y-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.minPrice || ''}
                      onChange={(e) => setFilters({ ...filters, minPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.maxPrice || ''}
                      onChange={(e) => setFilters({ ...filters, maxPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                </div>

                {/* Rating */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Minimum Rating</label>
                  {[4, 3, 2].map(rating => (
                    <button
                      key={rating}
                      onClick={() => setFilters({ ...filters, minRating: rating })}
                      className={`w-full flex items-center gap-2 py-2 px-3 rounded mb-1 ${
                        filters.minRating === rating ? 'bg-orange-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      {Array.from({ length: rating }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                      <span className="text-sm">& up</span>
                    </button>
                  ))}
                </div>

                <Button
                  onClick={() => setFilters({ inStock: true, sortBy: 'relevance' })}
                  variant="outline"
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}

          {/* Results */}
          <div className="flex-1">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border animate-pulse">
                    <div className="h-48 bg-gray-200" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-gray-200 rounded" />
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No products found</h3>
                <p className="text-gray-600">Try different search terms or filters</p>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-3 gap-6' : 'space-y-4'}>
                {results.map(product => (
                  <ProductCard key={product.id} product={product} viewMode={viewMode} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product, viewMode }: { product: ProductResult; viewMode: 'grid' | 'list' }) {
  return (
    <div className={`bg-white rounded-xl border hover:shadow-lg transition-all ${
      viewMode === 'list' ? 'flex gap-4' : ''
    }`}>
      <div className={viewMode === 'list' ? 'w-32 h-32' : 'h-48'}>
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover rounded-t-xl" />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <Package className="w-12 h-12 text-gray-300" />
          </div>
        )}
      </div>
      <div className="p-4 flex-1">
        <h3 className="font-semibold mb-1 line-clamp-2">{product.name}</h3>
        {product.brand && <p className="text-sm text-gray-500 mb-2">{product.brand}</p>}
        <div className="flex items-center gap-2 mb-2">
          {product.rating && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{product.rating.toFixed(1)}</span>
              {product.totalReviews && (
                <span className="text-sm text-gray-500">({product.totalReviews})</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-[#FF8C42]">₹{product.price}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              <Heart className="w-4 h-4" />
            </Button>
            <Button size="sm" className="bg-[#FF8C42] hover:bg-[#FF7029]">
              <ShoppingCart className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
