import { useState, useEffect } from 'react';
import { Search, Filter, ChevronDown, X, Star, Heart, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authenticatedGet } from '../../utils/authenticatedFetch';
import { projectId } from '../../utils/supabase/info';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  category: string;
  sellerId: string;
  sellerName: string;
  inStock: boolean;
  tags: string[];
}

interface Filters {
  categories: string[];
  priceRange: { min: number; max: number };
  rating: number;
  inStock: boolean;
}

export function ProductBrowsing() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'popular' | 'price-low' | 'price-high' | 'rating'>('popular');
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<Filters>({
    categories: [],
    priceRange: { min: 0, max: 10000 },
    rating: 0,
    inStock: false
  });

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000 });
  const [minRating, setMinRating] = useState(0);
  const [showInStockOnly, setShowInStockOnly] = useState(false);

  const categories = [
    'Pet Food',
    'Pet Toys',
    'Pet Accessories',
    'Pet Grooming',
    'Pet Health',
    'Pet Clothing',
    'Pet Beds',
    'Pet Carriers'
  ];

  useEffect(() => {
    fetchProducts();
    fetchWishlist();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [products, searchQuery, selectedCategories, priceRange, minRating, showInStockOnly, sortBy]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await authenticatedGet(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/products`,
        false // Public endpoint
      );
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWishlist = async () => {
    try {
      const data = await authenticatedGet(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/wishlist`,
        true // Requires auth
      );
      setWishlist(new Set(data.productIds || []));
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...products];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(p => selectedCategories.includes(p.category));
    }

    // Price filter
    filtered = filtered.filter(p => p.price >= priceRange.min && p.price <= priceRange.max);

    // Rating filter
    if (minRating > 0) {
      filtered = filtered.filter(p => p.rating >= minRating);
    }

    // Stock filter
    if (showInStockOnly) {
      filtered = filtered.filter(p => p.inStock);
    }

    // Sort
    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'popular':
      default:
        filtered.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
    }

    setFilteredProducts(filtered);
  };

  const toggleWishlist = async (productId: string) => {
    try {
      const isInWishlist = wishlist.has(productId);
      const newWishlist = new Set(wishlist);

      if (isInWishlist) {
        newWishlist.delete(productId);
      } else {
        newWishlist.add(productId);
      }

      setWishlist(newWishlist);

      // Update backend
      await authenticatedGet(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/wishlist/${productId}/${isInWishlist ? 'remove' : 'add'}`,
        true
      );
    } catch (error) {
      console.error('Error updating wishlist:', error);
    }
  };

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setPriceRange({ min: 0, max: 10000 });
    setMinRating(0);
    setShowInStockOnly(false);
    setSearchQuery('');
  };

  const activeFilterCount = selectedCategories.length + 
    (priceRange.min > 0 || priceRange.max < 10000 ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (showInStockOnly ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for pet products..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#FF8C42]"
            />
          </div>

          {/* Filter and Sort */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-[#FF8C42] text-white text-xs px-2 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="flex-1" />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
            >
              <option value="popular">Most Popular</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Filters</h3>
              <button
                onClick={clearFilters}
                className="text-sm text-[#FF8C42] hover:text-[#FF7A2F]"
              >
                Clear All
              </button>
            </div>

            {/* Categories */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`px-4 py-2 rounded-full text-sm transition-colors ${
                      selectedCategories.includes(category)
                        ? 'bg-[#FF8C42] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Price Range</h4>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange({ ...priceRange, min: parseInt(e.target.value) || 0 })}
                  placeholder="Min"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="number"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange({ ...priceRange, max: parseInt(e.target.value) || 10000 })}
                  placeholder="Max"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                />
              </div>
            </div>

            {/* Rating */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Minimum Rating</h4>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4].map(rating => (
                  <button
                    key={rating}
                    onClick={() => setMinRating(rating)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      minRating === rating
                        ? 'bg-[#FF8C42] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {rating === 0 ? 'All' : `${rating}+ ⭐`}
                  </button>
                ))}
              </div>
            </div>

            {/* In Stock Only */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInStockOnly}
                onChange={(e) => setShowInStockOnly(e.target.checked)}
                className="w-4 h-4 text-[#FF8C42] border-gray-300 rounded focus:ring-[#FF8C42]"
              />
              <span className="text-sm text-gray-700">Show in-stock items only</span>
            </label>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <p className="text-sm text-gray-600 mb-4">
          Showing {filteredProducts.length} of {products.length} products
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-600">No products found</p>
            <button
              onClick={clearFilters}
              className="mt-4 text-[#FF8C42] hover:text-[#FF7A2F]"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div
                  onClick={() => navigate(`/shop/product/${product.id}`)}
                  className="relative"
                >
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full aspect-square object-cover"
                  />
                  {!product.inStock && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm">
                        Out of Stock
                      </span>
                    </div>
                  )}
                  {product.originalPrice && product.originalPrice > product.price && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-lg text-xs">
                      {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWishlist(product.id);
                    }}
                    className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50"
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        wishlist.has(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-600'
                      }`}
                    />
                  </button>
                </div>

                <div
                  onClick={() => navigate(`/shop/product/${product.id}`)}
                  className="p-3"
                >
                  <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2">{product.name}</h3>
                  <p className="text-xs text-gray-500 mb-2">{product.sellerName}</p>

                  <div className="flex items-center gap-1 mb-2">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-semibold">{product.rating.toFixed(1)}</span>
                    <span className="text-xs text-gray-500">({product.reviewCount})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">₹{product.price}</span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="text-xs text-gray-500 line-through">₹{product.originalPrice}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
