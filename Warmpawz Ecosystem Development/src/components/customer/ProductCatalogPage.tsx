/**
 * Complete Product Catalog with Filters, Search, and Categories
 * Uses MockAPI for all data
 */

import { useState, useEffect } from 'react';
import { Search, Filter, X, Heart, ShoppingCart, Star, ChevronDown, Grid, List } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { mockEcommerceAPI } from '../../lib/mockAPI';
import { EXPANDED_PRODUCTS } from '../../lib/mockDataExpanded';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  price: number;
  originalPrice?: number;
  description: string;
  imageUrl: string;
  rating: number;
  reviews: number;
  inStock: boolean;
  brand?: string;
  tags?: string[];
}

const CATEGORIES = ['Food', 'Toys', 'Accessories', 'Medicine', 'Grooming'];
const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'newest', label: 'Newest First' }
];

export function ProductCatalogPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get('category') ? [searchParams.get('category')!] : []
  );
  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000 });
  const [minRating, setMinRating] = useState(0);
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('popular');
  const [showFilters, setShowFilters] = useState(false);
  
  // Wishlist
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  
  // Cart count
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    loadProducts();
    loadWishlist();
    loadCartCount();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, searchQuery, selectedCategories, priceRange, minRating, showInStockOnly, sortBy]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      // Use expanded products directly
      setProducts(EXPANDED_PRODUCTS);
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadWishlist = () => {
    const saved = localStorage.getItem('warmpawz_wishlist');
    if (saved) {
      setWishlist(new Set(JSON.parse(saved)));
    }
  };

  const loadCartCount = () => {
    const cart = localStorage.getItem('warmpawz_cart');
    if (cart) {
      const items = JSON.parse(cart);
      setCartCount(items.length);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.brand?.toLowerCase().includes(query) ||
        p.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(p => selectedCategories.includes(p.category));
    }

    // Price range filter
    filtered = filtered.filter(p => 
      p.price >= priceRange.min && p.price <= priceRange.max
    );

    // Rating filter
    if (minRating > 0) {
      filtered = filtered.filter(p => p.rating >= minRating);
    }

    // Stock filter
    if (showInStockOnly) {
      filtered = filtered.filter(p => p.inStock);
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'rating':
          return b.rating - a.rating;
        case 'newest':
          return b.id.localeCompare(a.id); // Mock: assume newer IDs are newer products
        default: // popular
          return b.reviews - a.reviews;
      }
    });

    setFilteredProducts(filtered);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setPriceRange({ min: 0, max: 10000 });
    setMinRating(0);
    setShowInStockOnly(false);
    setSearchParams({});
  };

  const toggleWishlist = (productId: string) => {
    setWishlist(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
        toast.success('Removed from wishlist');
      } else {
        newSet.add(productId);
        toast.success('Added to wishlist');
      }
      localStorage.setItem('warmpawz_wishlist', JSON.stringify([...newSet]));
      return newSet;
    });
  };

  const addToCart = (product: Product) => {
    const cart = JSON.parse(localStorage.getItem('warmpawz_cart') || '[]');
    const existingItem = cart.find((item: any) => item.productId === product.id);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        quantity: 1
      });
    }
    
    localStorage.setItem('warmpawz_cart', JSON.stringify(cart));
    setCartCount(cart.length);
    toast.success('Added to cart');
  };

  const activeFiltersCount = 
    selectedCategories.length + 
    (minRating > 0 ? 1 : 0) + 
    (showInStockOnly ? 1 : 0) +
    (priceRange.min > 0 || priceRange.max < 10000 ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            {/* Filter Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge className="bg-orange-500 text-white ml-1">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {/* View Toggle */}
            <div className="flex gap-1 border rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-orange-500 text-white' : 'text-gray-600'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-orange-500 text-white' : 'text-gray-600'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Cart */}
            <Button
              onClick={() => navigate('/shop/cart')}
              className="bg-gradient-to-r from-orange-500 to-pink-500 gap-2 relative"
            >
              <ShoppingCart className="w-4 h-4" />
              Cart
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Button>
          </div>

          {/* Active Filters */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {selectedCategories.map(cat => (
                <Badge key={cat} variant="secondary" className="gap-1">
                  {cat}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => toggleCategory(cat)}
                  />
                </Badge>
              ))}
              {minRating > 0 && (
                <Badge variant="secondary" className="gap-1">
                  {minRating}+ Stars
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => setMinRating(0)}
                  />
                </Badge>
              )}
              {showInStockOnly && (
                <Badge variant="secondary" className="gap-1">
                  In Stock
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => setShowInStockOnly(false)}
                  />
                </Badge>
              )}
              <button
                onClick={clearFilters}
                className="text-sm text-orange-600 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar Filters */}
          {showFilters && (
            <div className="w-64 flex-shrink-0">
              <Card className="sticky top-24">
                <CardContent className="p-4 space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">Categories</h3>
                    <div className="space-y-2">
                      {CATEGORIES.map(category => (
                        <label key={category} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(category)}
                            onChange={() => toggleCategory(category)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">{category}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Price Range</h3>
                    <div className="space-y-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={priceRange.min}
                        onChange={(e) => setPriceRange(prev => ({ ...prev, min: Number(e.target.value) }))}
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        value={priceRange.max}
                        onChange={(e) => setPriceRange(prev => ({ ...prev, max: Number(e.target.value) }))}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Rating</h3>
                    <div className="space-y-2">
                      {[4, 3, 2, 1].map(rating => (
                        <label key={rating} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="rating"
                            checked={minRating === rating}
                            onChange={() => setMinRating(rating)}
                          />
                          <div className="flex items-center gap-1">
                            {[...Array(rating)].map((_, i) => (
                              <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            ))}
                            <span className="text-sm text-gray-600">& Up</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showInStockOnly}
                        onChange={(e) => setShowInStockOnly(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium">In Stock Only</span>
                    </label>
                  </div>

                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Products Grid */}
          <div className="flex-1">
            {/* Sort and Results Count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-600">
                {filteredProducts.length} products found
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  {SORT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Products */}
            {filteredProducts.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-gray-500 mb-4">No products found</p>
                  <Button onClick={clearFilters}>Clear Filters</Button>
                </CardContent>
              </Card>
            ) : (
              <div className={viewMode === 'grid' 
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'space-y-4'
              }>
                {filteredProducts.map(product => (
                  <Card
                    key={product.id}
                    className={`overflow-hidden hover:shadow-lg transition-all cursor-pointer group ${
                      viewMode === 'list' ? 'flex' : ''
                    }`}
                  >
                    <div
                      className={viewMode === 'list' ? 'w-48 flex-shrink-0' : 'relative'}
                      onClick={() => navigate(`/shop/product/${product.id}`)}
                    >
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className={`object-cover ${viewMode === 'list' ? 'w-full h-full' : 'w-full h-48'}`}
                      />
                      {!product.inStock && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-white font-semibold">Out of Stock</span>
                        </div>
                      )}
                      {product.originalPrice && (
                        <Badge className="absolute top-2 right-2 bg-red-500">
                          Save ₹{product.originalPrice - product.price}
                        </Badge>
                      )}
                    </div>

                    <CardContent className="p-4 flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1" onClick={() => navigate(`/shop/product/${product.id}`)}>
                          {product.brand && (
                            <p className="text-xs text-gray-500 uppercase">{product.brand}</p>
                          )}
                          <h3 className="font-semibold text-sm group-hover:text-orange-600 transition-colors">
                            {product.name}
                          </h3>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWishlist(product.id);
                          }}
                          className="flex-shrink-0"
                        >
                          <Heart
                            className={`w-5 h-5 ${
                              wishlist.has(product.id)
                                ? 'fill-red-500 text-red-500'
                                : 'text-gray-400'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center gap-1 mb-2">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{product.rating}</span>
                        <span className="text-xs text-gray-500">({product.reviews})</span>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg font-bold">₹{product.price}</span>
                        {product.originalPrice && (
                          <span className="text-sm text-gray-500 line-through">
                            ₹{product.originalPrice}
                          </span>
                        )}
                      </div>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(product);
                        }}
                        disabled={!product.inStock}
                        className="w-full bg-gradient-to-r from-orange-500 to-pink-500 gap-2"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Add to Cart
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
