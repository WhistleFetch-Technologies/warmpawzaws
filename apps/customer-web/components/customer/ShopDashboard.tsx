"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, SlidersHorizontal, ArrowLeft, TrendingUp, Star, Heart, Package, Truck, Shield, Zap, MapPin, Store, Dog, ShoppingBag, Bone, Shirt, Watch, Pill, Scissors, Bed, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { canonicalProductId } from '@/lib/product-id';
import { toast } from 'sonner';
import { cn } from '@/components/ui/utils';
import { hasEffectivePriceReduction } from '@warmpawz/shared-types';

interface ShopDashboardProps {
  phone?: string;
  product?: any;
  category?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onReviewsClick?: () => void;
  onVendorClick?: () => void;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  rating?: number;
  reviews?: number;
  image?: string;
  category?: string;
  vendorId?: string;
  vendor?: {
    name: string;
    rating?: number;
    location?: string;
    deliveryTime?: string;
  };
  stock?: string;
  badge?: string;
  discount?: string;
}

type ShopSortOption = 'default' | 'price_asc' | 'price_desc' | 'rating_desc';
type PricePreset = 'any' | 'lt500' | 'mid' | 'gt2000';

export function ShopDashboard({ phone, product, category: initialCategory, onBack, onNavigate, onReviewsClick, onVendorClick }: ShopDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || 'all');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [apiCategories, setApiCategories] = useState<any[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOption, setSortOption] = useState<ShopSortOption>('default');
  const [pricePreset, setPricePreset] = useState<PricePreset>('any');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [catalogExpanded, setCatalogExpanded] = useState(false);
  const shopProductsSectionRef = useRef<HTMLDivElement>(null);

  const scrollToFullCatalog = useCallback(() => {
    setCatalogExpanded(true);
    requestAnimationFrame(() => {
      shopProductsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // Sync selected category when initial category from navigation changes
  useEffect(() => {
    if (initialCategory) setSelectedCategory(initialCategory);
  }, [initialCategory]);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Load products on mount and when category/search changes
  useEffect(() => {
    loadProducts();
  }, [selectedCategory, searchQuery]);

  // Filter products
  useEffect(() => {
    filterProducts();
  }, [products, selectedCategory, searchQuery, sortOption, pricePreset, inStockOnly]);

  useEffect(() => {
    setCatalogExpanded(false);
  }, [selectedCategory, searchQuery, sortOption, pricePreset, inStockOnly]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params: any = {};
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (searchQuery) params.search = searchQuery;
      
      const queryString = new URLSearchParams(params).toString();
      
      // Call API endpoint - products listed by vendors will appear here
      const response = await apiClient.get<any>(`/ecommerce/products${queryString ? `?${queryString}` : ''}`);
      
      // Handle response structure: { success: true, products: [...] } or { products: [...] } or [...]
      let productsData: any[] = [];
      if (Array.isArray(response)) {
        productsData = response;
      } else if (response.products && Array.isArray(response.products)) {
        productsData = response.products;
      } else if (response.success && response.products && Array.isArray(response.products)) {
        productsData = response.products;
      }
      
      // Format products from API response (vendor-listed products)
      const formattedProducts: Product[] = productsData.map((prod: any) => {
        const reviews = prod.review_count || prod.reviews || 0;
        const rc = Number(reviews) || 0;
        const avg =
          prod.rating != null || prod.average_rating != null
            ? Number(prod.rating ?? prod.average_rating)
            : NaN;
        const productRating =
          rc > 0 && Number.isFinite(avg) && avg > 0 ? avg : 0;
        const vrc = Number(prod.vendor_review_count ?? prod.vendorReviewCount ?? 0) || 0;
        const vr =
          prod.vendor_rating != null ? Number(prod.vendor_rating) : NaN;
        const vendorRating =
          vrc > 0 && Number.isFinite(vr) && vr > 0 ? vr : 0;
        return {
        id: canonicalProductId(prod as Record<string, unknown>) || String(prod.id || prod.product_id || ''),
        name: prod.name || prod.product_name,
        description: prod.description || '',
        price: parseFloat(prod.price || prod.unit_price || 0),
        originalPrice: prod.original_price || prod.mrp ? parseFloat(prod.original_price || prod.mrp) : undefined,
        rating: productRating,
        reviews: rc,
        image: prod.image || prod.image_url || prod.primary_image || '',
        category: prod.category || prod.category_name || 'general',
        vendor: {
          name: prod.vendor_name || prod.vendor?.business_name || 'Warmpawz Store',
          rating: vendorRating,
          location: prod.vendor_location || prod.vendor?.city || '',
          deliveryTime: prod.delivery_time || '2-3 days',
        },
        vendorId: prod.vendor_id || prod.vendor?.id,
        stock: prod.in_stock !== false && prod.stock_quantity > 0 ? 'In Stock' : 'Out of Stock',
        badge: prod.badge || prod.tag || '',
        discount: prod.discount_percentage ? `${prod.discount_percentage}%` : undefined,
      };
      });
      
      setProducts(formattedProducts);
    } catch (error) {
      console.error('Error loading products:', error);
      // No mock fallback - show empty state when API fails
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await apiClient.get<any>('/ecommerce/categories');
      const categoriesData = response.categories || response || [];
      setApiCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
      // Categories will use default list if API fails
    }
  };

  const filterProducts = () => {
    let filtered = [...products];

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => {
        const categoryMatch = p.category === selectedCategory ||
                             p.category?.toLowerCase() === selectedCategory.toLowerCase();
        return categoryMatch;
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    }

    if (inStockOnly) {
      filtered = filtered.filter(p => p.stock === 'In Stock');
    }

    if (pricePreset === 'lt500') {
      filtered = filtered.filter(p => p.price < 500);
    } else if (pricePreset === 'mid') {
      filtered = filtered.filter(p => p.price >= 500 && p.price <= 2000);
    } else if (pricePreset === 'gt2000') {
      filtered = filtered.filter(p => p.price > 2000);
    }

    if (sortOption === 'price_asc') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortOption === 'price_desc') {
      filtered.sort((a, b) => b.price - a.price);
    } else if (sortOption === 'rating_desc') {
      filtered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }

    setFilteredProducts(filtered);
  };

  const resetShopFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSortOption('default');
    setPricePreset('any');
    setInStockOnly(false);
  };

  const hasAdvancedFilters =
    sortOption !== 'default' || pricePreset !== 'any' || inStockOnly;

  const categories = [
    { id: 'all', label: 'All', icon: <Store className="w-5 h-5 text-gray-600" />, color: 'bg-gray-100 text-gray-700' },
    { id: 'food', label: 'Food', icon: <Bone className="w-5 h-5 text-orange-600" />, color: 'bg-orange-100 text-orange-700' },
    { id: 'toys', label: 'Toys', icon: <Dog className="w-5 h-5 text-blue-600" />, color: 'bg-blue-100 text-blue-700' },
    { id: 'clothes', label: 'Clothes', icon: <Shirt className="w-5 h-5 text-teal-600" />, color: 'bg-teal-100 text-teal-700' },
    { id: 'accessories', label: 'Accessories', icon: <Watch className="w-5 h-5 text-pink-600" />, color: 'bg-pink-100 text-pink-700' },
    { id: 'medicine', label: 'Medicine', icon: <Pill className="w-5 h-5 text-red-600" />, color: 'bg-red-100 text-red-700' },
    { id: 'grooming', label: 'Grooming', icon: <Scissors className="w-5 h-5 text-purple-600" />, color: 'bg-purple-100 text-purple-700' },
    { id: 'beds', label: 'Beds', icon: <Bed className="w-5 h-5 text-indigo-600" />, color: 'bg-indigo-100 text-indigo-700' },
    { id: 'bowls', label: 'Bowls', icon: <UtensilsCrossed className="w-5 h-5 text-green-600" />, color: 'bg-green-100 text-green-700' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto relative">
      {/* Header with Search — safe-area-top (viewportFit: cover in root layout) */}
      <div className="bg-white sticky top-0 z-50 isolate shadow-sm pt-[max(4rem,calc(env(safe-area-inset-top,0px)+0.75rem))] md:pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <div className="px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back"
              className="min-h-11 min-w-11 shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden />
            </button>
            <h1 className="text-gray-900 flex-1 font-semibold text-lg sm:text-xl">Shop</h1>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search products, brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-12 h-12 bg-gray-50 border-gray-200 focus:bg-white"
            />
            <button
              type="button"
              aria-label="Open product filters"
              onClick={() => setFilterOpen(true)}
              className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
            >
              <SlidersHorizontal className="w-5 h-5 text-gray-600" aria-hidden />
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-4 pb-3 sm:px-5 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] text-white shadow-md'
                    : cat.color + ' hover:shadow-sm'
                }`}
              >
                <span className="mr-1 inline-block align-middle">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
        {/* Quick Features */}
        <div className="px-4 sm:px-5 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Truck, label: 'Free Delivery', color: 'text-blue-600' },
              { icon: Shield, label: '100% Genuine', color: 'text-green-600' },
              { icon: Zap, label: 'Fast Shipping', color: 'text-orange-600' },
              { icon: Package, label: 'Easy Returns', color: 'text-purple-600' }
            ].map((feature, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-3 sm:p-3.5 text-center shadow-sm">
                <feature.icon className={`w-6 h-6 sm:w-7 sm:h-7 mx-auto mb-1 ${feature.color}`} />
                <p className="text-xs sm:text-sm text-gray-700 leading-tight">{feature.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Featured Vendors Section */}
        <div className="mb-6">
          <div className="px-4 sm:px-5 mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Store className="w-5 h-5 shrink-0 text-[#FF8C42]" />
              <h2 className="font-bold text-gray-900 text-base sm:text-lg truncate">✨ Featured Vendors</h2>
            </div>
            <button
              type="button"
              onClick={scrollToFullCatalog}
              className="text-[#FF8C42] text-sm font-medium flex items-center gap-1 shrink-0 hover:opacity-80 active:opacity-70"
            >
              View All <span>→</span>
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 sm:px-5">
            {[
              { name: 'PetMart India', products: '1500+', logo: '🏪', verified: true },
              { name: 'Pet Tech Store', products: '800+', logo: '🤖', verified: true },
              { name: 'Gadgets4Pets', products: '1200+', logo: '⚡', verified: true },
              { name: 'Groom & Care', products: '600+', logo: '✨', verified: true }
            ].map((vendor, idx) => (
              <Card key={idx} className="flex-shrink-0 min-w-[9rem] w-36 sm:w-40 p-4 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="text-center">
                  <div className="text-4xl mb-2">{vendor.logo}</div>
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">{vendor.name}</h3>
                  {vendor.verified && (
                    <div className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full mb-2">
                      <Shield className="w-3 h-3" />
                      <span>Verified</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">{vendor.products} products</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Hot Deals Section */}
        {filteredProducts.length > 0 && (
        <div className="mb-6">
          <div className="px-4 sm:px-5 mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp className="w-5 h-5 shrink-0 text-red-600" />
              <h2 className="font-bold text-gray-900 text-base sm:text-lg truncate">🔥 Hot Deals</h2>
            </div>
            <button
              type="button"
              onClick={scrollToFullCatalog}
              className="text-[#FF8C42] text-sm font-medium flex items-center gap-1 shrink-0 hover:opacity-80 active:opacity-70"
            >
              View All <span>→</span>
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 sm:px-5">
            {filteredProducts.slice(0, 4).map((deal, index) => (
              <Card 
                key={deal.id || index} 
                onClick={() => onNavigate?.('product_detail', { product: deal })}
                className="flex-shrink-0 min-w-[11rem] w-48 sm:w-52 overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
              >
                {/* Product Image */}
                <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 relative flex items-center justify-center text-6xl">
                  {deal.image || '🐾'}
                  {deal.badge && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                      {deal.badge}
                    </div>
                  )}
                  {deal.discount && (
                    <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                      {deal.discount} OFF
                    </div>
                  )}
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const customerId = getResolvedCustomerId();
                        const productId =
                          canonicalProductId(deal as Record<string, unknown>) || String(deal.id || '');
                        if (!customerId) {
                          toast.info('Please login to add items to wishlist');
                          return;
                        }
                        if (!productId) {
                          console.warn('[wishlist] ShopDashboard deal missing id', { deal });
                          return;
                        }
                        console.log('[wishlist] ShopDashboard POST', { customerId, productId });
                        const res = await apiClient.post(`/customer/${customerId}/wishlist`, {
                          productId,
                          action: 'add',
                        });
                        console.log('[wishlist] ShopDashboard POST response', { customerId, productId, res });
                        toast.success('Added to wishlist');
                      } catch (error: any) {
                        console.error('Error adding to wishlist:', error);
                        toast.error('Failed to add to wishlist');
                      }
                    }}
                    className="absolute bottom-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                  >
                    <Heart className="w-4 h-4 text-gray-700" />
                  </button>
                </div>

                {/* Product Info */}
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-2">{deal.name}</h3>
                  
                  {/* Vendor Info */}
                  {deal.vendor && (
                    <div className="flex items-center gap-1 mb-2 text-xs">
                      <Store className="w-3 h-3 text-gray-500" />
                      <span className="text-gray-600 font-medium">{deal.vendor.name}</span>
                      {deal.vendor.rating && (
                        <>
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 ml-1" />
                          <span className="text-gray-600">{deal.vendor.rating}</span>
                        </>
                      )}
                    </div>
                  )}

                  {(deal.rating || deal.reviews) && (
                    <div className="flex items-center gap-1 mb-2">
                      {deal.rating && (
                        <>
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          <span className="text-xs font-medium text-gray-900">{deal.rating}</span>
                        </>
                      )}
                      {deal.reviews && (
                        <span className="text-xs text-gray-500">({deal.reviews})</span>
                      )}
                    </div>
                  )}

                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[#FF8C42] font-bold">₹{deal.price.toLocaleString()}</span>
                      {deal.originalPrice != null &&
                        hasEffectivePriceReduction(deal.originalPrice, deal.price) && (
                        <span className="text-gray-400 line-through text-sm">₹{deal.originalPrice.toLocaleString()}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-medium ${deal.stock === 'In Stock' ? 'text-green-600' : 'text-orange-600'}`}>
                        {deal.stock || 'In Stock'}
                      </span>
                      {deal.vendor?.deliveryTime && (
                        <span className="text-gray-500 flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          {deal.vendor.deliveryTime}
                        </span>
                      )}
                    </div>
                  </div>

                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.('product_detail', { product: deal });
                    }}
                    className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A2A] hover:to-[#FF5A8D] text-white h-9 text-sm font-medium"
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
        )}

        {/* Top Products Grid */}
        <div
          ref={shopProductsSectionRef}
          id="shop-products-section"
          className="px-4 sm:px-5 mb-6 scroll-mt-[calc(8.5rem+env(safe-area-inset-top,0px))] md:scroll-mt-[calc(6.5rem+env(safe-area-inset-top,0px))]"
        >
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="font-bold text-gray-900 text-base sm:text-lg">Products</h2>
            {filteredProducts.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  catalogExpanded
                    ? setCatalogExpanded(false)
                    : scrollToFullCatalog()
                }
                className="text-[#FF8C42] text-sm font-medium shrink-0 hover:opacity-80 active:opacity-70"
              >
                {catalogExpanded ? 'Show less' : 'View All →'}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-pink-100 rounded-full flex items-center justify-center mb-4">
                <ShoppingBag className="w-12 h-12 text-[#FF8C42]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-500 text-sm mb-4 max-w-sm">
                {searchQuery 
                  ? `No products match your search "${searchQuery}". Try different keywords.`
                  : selectedCategory !== 'all'
                  ? `No products available in this category yet.`
                  : 'No products listed yet. Products will appear here when vendors list them.'}
              </p>
              {(searchQuery || selectedCategory !== 'all' || hasAdvancedFilters) && (
                <Button
                  onClick={resetShopFilters}
                  className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A2A] hover:to-[#FF5A8D] text-white"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {(catalogExpanded ? filteredProducts : filteredProducts.slice(0, 6)).map((product, index) => (
                <Card 
                  key={product.id || index} 
                  onClick={() => onNavigate?.('product_detail', { product })}
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div className="h-36 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-5xl relative">
                    {product.image || '🐾'}
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const customerId = getResolvedCustomerId();
                          const productId =
                            canonicalProductId(product as Record<string, unknown>) ||
                            String(product.id || '');
                          if (!customerId) {
                            toast.info('Please login to add items to wishlist');
                            return;
                          }
                          if (!productId) {
                            console.warn('[wishlist] ShopDashboard product missing id', { product });
                            return;
                          }
                          console.log('[wishlist] ShopDashboard POST', { customerId, productId });
                          const res = await apiClient.post(`/customer/${customerId}/wishlist`, {
                            productId,
                            action: 'add',
                          });
                          console.log('[wishlist] ShopDashboard POST response', { customerId, productId, res });
                          toast.success('Added to wishlist');
                        } catch (error: any) {
                          console.error('Error adding to wishlist:', error);
                          toast.error('Failed to add to wishlist');
                        }
                      }}
                      className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                    >
                      <Heart className="w-4 h-4 text-gray-700" />
                    </button>
                  </div>
                  <div className="p-3">
                    {product.category && (
                      <div className="text-xs text-gray-500 mb-1">{product.category}</div>
                    )}
                    <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-2">{product.name}</h3>
                    
                    {/* Vendor Badge */}
                    {product.vendor && (
                      <div className="flex items-center gap-1 mb-2">
                        <div className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Store className="w-3 h-3" />
                          <span className="font-medium">{product.vendor.name}</span>
                        </div>
                      </div>
                    )}

                    {product.rating && (
                      <div className="flex items-center gap-1 mb-2">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs font-medium">{product.rating}</span>
                        {product.vendor?.deliveryTime && (
                          <span className="text-xs text-gray-400 ml-1">• {product.vendor.deliveryTime}</span>
                        )}
                      </div>
                    )}
                    <p className="text-[#FF8C42] font-bold mb-2">₹{product.price.toLocaleString()}</p>
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate?.('product_detail', { product });
                      }}
                      className="w-full bg-gray-900 hover:bg-gray-800 h-8 text-sm"
                    >
                      Add to Cart
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Benefits Section */}
        <div className="px-4 sm:px-5">
          <Card className="p-6 bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
            <h3 className="font-bold text-gray-900 mb-4 text-base sm:text-lg">Why Shop With Us?</h3>
            <div className="space-y-3">
              {[
                { icon: '✅', title: '100% Authentic Products', desc: 'Genuine brands & quality guaranteed' },
                { icon: '🚚', title: 'Fast & Free Delivery', desc: 'Free shipping on orders above ₹999' },
                { icon: '💰', title: 'Best Price Guarantee', desc: 'Lowest prices in the market' },
                { icon: '🔒', title: 'Secure Payments', desc: 'Safe & encrypted transactions' }
              ].map((benefit, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">
                    {benefit.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm">{benefit.title}</h4>
                    <p className="text-xs text-gray-600">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent
          className={cn(
            'max-w-md sm:max-w-md gap-0 border border-white/20 bg-black p-6 text-white shadow-2xl sm:rounded-2xl',
            '[&>button]:text-white [&>button]:hover:bg-white/10 [&>button]:ring-offset-black',
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-white">Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <p className="mb-2 text-sm font-medium text-white">Sort by</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'default' as const, label: 'Default' },
                    { id: 'price_asc' as const, label: 'Price: Low to high' },
                    { id: 'price_desc' as const, label: 'Price: High to low' },
                    { id: 'rating_desc' as const, label: 'Rating' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortOption(opt.id)}
                    className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      sortOption === opt.id
                        ? 'border-[#FF8C42] bg-white/10 text-white'
                        : 'border-white/20 bg-neutral-900 text-neutral-200 hover:border-white/30 hover:bg-neutral-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-white">Price</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'any' as const, label: 'Any' },
                    { id: 'lt500' as const, label: 'Under ₹500' },
                    { id: 'mid' as const, label: '₹500 – ₹2,000' },
                    { id: 'gt2000' as const, label: 'Above ₹2,000' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPricePreset(opt.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      pricePreset === opt.id
                        ? 'border-[#FF8C42] bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] text-white'
                        : 'border-white/20 bg-neutral-900 text-neutral-200 hover:border-white/30 hover:bg-neutral-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/20 bg-neutral-900/80 p-3 hover:bg-neutral-800/80">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-black text-[#FF8C42] focus:ring-[#FF8C42] focus:ring-offset-0"
              />
              <span className="text-sm font-medium text-white">In stock only</span>
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto"
              onClick={() => {
                setSortOption('default');
                setPricePreset('any');
                setInStockOnly(false);
              }}
            >
              Reset
            </Button>
            <Button
              type="button"
              className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] text-white hover:from-[#FF7A2A] hover:to-[#FF5A8D] sm:w-auto"
              onClick={() => setFilterOpen(false)}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
