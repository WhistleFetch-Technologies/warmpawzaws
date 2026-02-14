"use client";

import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, ShoppingCart, ArrowLeft, TrendingUp, Star, Heart, Package, Truck, Shield, Zap, MapPin, Store, Dog, ShoppingBag, Bone, Shirt, Watch, Pill, Scissors, Bed, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCart } from '@/context/CartContext';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PromotionBanner } from './shared/PromotionBanner';

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

export function ShopDashboard({ phone, product, category: initialCategory, onBack, onNavigate, onReviewsClick, onVendorClick }: ShopDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || 'all');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [apiCategories, setApiCategories] = useState<any[]>([]);
  const { itemCount } = useCart();

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
  }, [products, selectedCategory, searchQuery]);

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
      const formattedProducts: Product[] = productsData.map((prod: any) => ({
        id: prod.id || prod.product_id,
        name: prod.name || prod.product_name,
        description: prod.description || '',
        price: parseFloat(prod.price || prod.unit_price || 0),
        originalPrice: prod.original_price || prod.mrp ? parseFloat(prod.original_price || prod.mrp) : undefined,
        rating: prod.rating || prod.average_rating || 0,
        reviews: prod.review_count || prod.reviews || 0,
        image: prod.image || prod.image_url || prod.primary_image || '',
        category: prod.category || prod.category_name || 'general',
        vendor: {
          name: prod.vendor_name || prod.vendor?.business_name || 'WarmPawz Store',
          rating: prod.vendor_rating || 4.7,
          location: prod.vendor_location || prod.vendor?.city || '',
          deliveryTime: prod.delivery_time || '2-3 days',
        },
        vendorId: prod.vendor_id || prod.vendor?.id,
        stock: prod.in_stock !== false && prod.stock_quantity > 0 ? 'In Stock' : 'Out of Stock',
        badge: prod.badge || prod.tag || '',
        discount: prod.discount_percentage ? `${prod.discount_percentage}%` : undefined,
      }));
      
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
    let filtered = products;
    
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
    
    setFilteredProducts(filtered);
  };

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
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto relative">
      {/* Header with Search */}
      <div className="bg-white sticky top-0 z-50 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-gray-900 flex-1 font-semibold text-lg">Shop</h1>
            <button 
              onClick={() => onNavigate?.('cart')}
              className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ShoppingCart className="w-5 h-5 text-gray-700" />
              {itemCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{itemCount}</span>
                </div>
              )}
            </button>
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
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <SlidersHorizontal className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
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

      <div className="pb-24">
        {/* PHASE 1.3: Promotion Banners (from Admin Marketing) */}
        <div className="p-4">
          <PromotionBanner 
            service="shop"
          />
        </div>

        {/* Quick Features */}
        <div className="px-4 mb-6">
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: Truck, label: 'Free Delivery', color: 'text-blue-600' },
              { icon: Shield, label: '100% Genuine', color: 'text-green-600' },
              { icon: Zap, label: 'Fast Shipping', color: 'text-orange-600' },
              { icon: Package, label: 'Easy Returns', color: 'text-purple-600' }
            ].map((feature, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-3 text-center shadow-sm">
                <feature.icon className={`w-6 h-6 mx-auto mb-1 ${feature.color}`} />
                <p className="text-xs text-gray-700 leading-tight">{feature.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Featured Vendors Section */}
        <div className="mb-6">
          <div className="px-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-[#FF8C42]" />
              <h2 className="font-bold text-gray-900">✨ Featured Vendors</h2>
            </div>
            <button className="text-[#FF8C42] text-sm font-medium flex items-center gap-1">
              View All <span>→</span>
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4">
            {[
              { name: 'PetMart India', rating: 4.7, products: '1500+', logo: '🏪', verified: true },
              { name: 'Pet Tech Store', rating: 4.8, products: '800+', logo: '🤖', verified: true },
              { name: 'Gadgets4Pets', rating: 4.9, products: '1200+', logo: '⚡', verified: true },
              { name: 'Groom & Care', rating: 4.7, products: '600+', logo: '✨', verified: true }
            ].map((vendor, idx) => (
              <Card key={idx} className="flex-shrink-0 w-36 p-4 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="text-center">
                  <div className="text-4xl mb-2">{vendor.logo}</div>
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">{vendor.name}</h3>
                  {vendor.verified && (
                    <div className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full mb-2">
                      <Shield className="w-3 h-3" />
                      <span>Verified</span>
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-medium">{vendor.rating}</span>
                  </div>
                  <p className="text-xs text-gray-500">{vendor.products} products</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Hot Deals Section */}
        {filteredProducts.length > 0 && (
        <div className="mb-6">
          <div className="px-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-red-600" />
              <h2 className="font-bold text-gray-900">🔥 Hot Deals</h2>
            </div>
            <button className="text-[#FF8C42] text-sm font-medium flex items-center gap-1">
              View All <span>→</span>
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4">
            {filteredProducts.slice(0, 4).map((deal, index) => (
              <Card 
                key={deal.id || index} 
                onClick={() => onNavigate?.('product_detail', { product: deal })}
                className="flex-shrink-0 w-48 overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
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
                        const customerId = localStorage.getItem('warmpawz_customer_id');
                        if (!customerId) {
                          toast.info('Please login to add items to wishlist');
                          return;
                        }
                        await apiClient.post('/customer/wishlist', {
                          customerId,
                          productId: product.id,
                          productName: product.name,
                          price: product.price,
                          image: product.image,
                        });
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
                      {deal.originalPrice && (
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
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Products</h2>
            {filteredProducts.length > 0 && (
              <button className="text-[#FF8C42] text-sm font-medium">View All →</button>
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
              {(searchQuery || selectedCategory !== 'all') && (
                <Button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A2A] hover:to-[#FF5A8D] text-white"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.slice(0, 6).map((product, index) => (
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
                          const customerId = localStorage.getItem('warmpawz_customer_id');
                          if (!customerId) {
                            toast.info('Please login to add items to wishlist');
                            return;
                          }
                          await apiClient.post('/customer/wishlist', {
                            customerId,
                            productId: product.id,
                            productName: product.name,
                            price: product.price,
                            image: product.image,
                          });
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
        <div className="px-4">
          <Card className="p-6 bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
            <h3 className="font-bold text-gray-900 mb-4">Why Shop With Us?</h3>
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
    </div>
  );
}
