'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  price: number;
  sale_price?: number;
  images: string[];
  rating: number;
  review_count: number;
  in_stock: boolean;
  stock_quantity: number;
  vendor_id: string;
  vendor_name: string;
  pet_type: 'dog' | 'cat' | 'bird' | 'fish' | 'all';
}

interface Category {
  id: string;
  name: string;
  icon: string;
  product_count: number;
}

interface CartItem {
  product_id: string;
  product: Product;
  quantity: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPetType, setSelectedPetType] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('popular');
  const [searchTerm, setSearchTerm] = useState('');
  
  // UI States
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'address' | 'payment' | 'confirm'>('address');
  const [processing, setProcessing] = useState(false);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
    loadCart();
  }, [selectedCategory, selectedPetType, sortBy]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedPetType) params.append('pet_type', selectedPetType);
      if (sortBy) params.append('sort', sortBy);
      
      const [productsRes, categoriesRes] = await Promise.allSettled([
        apiClient.get<any>(`/ecommerce/products?${params.toString()}`),
        apiClient.get<any>('/ecommerce/categories'),
      ]);
      
      if (productsRes.status === 'fulfilled') {
        setProducts(productsRes.value.products || []);
      } else {
        // Mock products
        setProducts([
          { id: '1', name: 'Premium Dog Food - Chicken & Rice', description: 'High-quality nutrition for adult dogs', category: 'food', price: 1299, sale_price: 999, images: ['/products/dog-food.jpg'], rating: 4.5, review_count: 234, in_stock: true, stock_quantity: 50, vendor_id: 'v1', vendor_name: 'PetMart', pet_type: 'dog' },
          { id: '2', name: 'Interactive Cat Toy', description: 'Battery-operated mouse toy', category: 'toys', price: 599, images: ['/products/cat-toy.jpg'], rating: 4.2, review_count: 89, in_stock: true, stock_quantity: 30, vendor_id: 'v2', vendor_name: 'Paws & Play', pet_type: 'cat' },
          { id: '3', name: 'Orthopedic Dog Bed - Large', description: 'Memory foam bed for joint support', category: 'accessories', price: 2499, sale_price: 1999, images: ['/products/dog-bed.jpg'], rating: 4.8, review_count: 156, in_stock: true, stock_quantity: 15, vendor_id: 'v1', vendor_name: 'PetMart', pet_type: 'dog' },
          { id: '4', name: 'Cat Scratching Post', description: 'Sisal rope with play ball', category: 'accessories', price: 899, images: ['/products/scratch-post.jpg'], rating: 4.3, review_count: 67, in_stock: true, stock_quantity: 25, vendor_id: 'v2', vendor_name: 'Paws & Play', pet_type: 'cat' },
          { id: '5', name: 'Flea & Tick Shampoo', description: 'Gentle formula for all pets', category: 'grooming', price: 449, images: ['/products/shampoo.jpg'], rating: 4.6, review_count: 312, in_stock: true, stock_quantity: 100, vendor_id: 'v3', vendor_name: 'Pet Care Plus', pet_type: 'all' },
          { id: '6', name: 'Bird Cage - Deluxe', description: 'Spacious cage with accessories', category: 'accessories', price: 3499, images: ['/products/bird-cage.jpg'], rating: 4.4, review_count: 45, in_stock: true, stock_quantity: 8, vendor_id: 'v1', vendor_name: 'PetMart', pet_type: 'bird' },
        ]);
      }
      
      if (categoriesRes.status === 'fulfilled') {
        setCategories(categoriesRes.value.categories || []);
      } else {
        setCategories([
          { id: 'food', name: 'Food & Treats', icon: '🍖', product_count: 45 },
          { id: 'toys', name: 'Toys', icon: '🧸', product_count: 32 },
          { id: 'accessories', name: 'Accessories', icon: '🎀', product_count: 28 },
          { id: 'grooming', name: 'Grooming', icon: '🧴', product_count: 18 },
          { id: 'health', name: 'Health & Wellness', icon: '💊', product_count: 24 },
        ]);
      }
    } catch (err: any) {
      console.error('Error loading shop:', err);
      setError(err.message || 'Failed to load shop');
    } finally {
      setLoading(false);
    }
  };

  const loadCart = () => {
    if (typeof window !== 'undefined') {
      const savedCart = localStorage.getItem('warmpawz_cart');
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    }
  };

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    if (typeof window !== 'undefined') {
      localStorage.setItem('warmpawz_cart', JSON.stringify(newCart));
    }
  };

  // ============================================================================
  // CART ACTIONS
  // ============================================================================

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    
    if (existingItem) {
      const newCart = cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
      saveCart(newCart);
    } else {
      saveCart([...cart, { product_id: product.id, product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      saveCart(cart.filter(item => item.product_id !== productId));
    } else {
      saveCart(cart.map(item =>
        item.product_id === productId ? { ...item, quantity } : item
      ));
    }
  };

  const removeFromCart = (productId: string) => {
    saveCart(cart.filter(item => item.product_id !== productId));
  };

  const clearCart = () => {
    saveCart([]);
  };

  const cartTotal = cart.reduce((sum, item) => {
    const price = item.product.sale_price || item.product.price;
    return sum + price * item.quantity;
  }, 0);

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // ============================================================================
  // CHECKOUT
  // ============================================================================

  const handleCheckout = async () => {
    try {
      setProcessing(true);
      
      await apiClient.post('/ecommerce/orders', {
        items: cart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.product.sale_price || item.product.price,
        })),
        total: cartTotal,
      });
      
      clearCart();
      setShowCheckout(false);
      setShowCart(false);
      alert('Order placed successfully! You can track it in My Orders.');
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
    } finally {
      setProcessing(false);
    }
  };

  // ============================================================================
  // FILTER
  // ============================================================================

  const filteredProducts = products.filter(product => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        product.name.toLowerCase().includes(search) ||
        product.description.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading shop...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">🛒 Pet Shop</h1>
            <button
              onClick={() => setShowCart(true)}
              className="relative px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              🛒 Cart
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
          
          {/* Search */}
          <div className="mt-4">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
            />
          </div>
        </div>
      </header>

      {/* Categories */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex gap-3 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition ${
                !selectedCategory ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition ${
                  selectedCategory === cat.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <select
              value={selectedPetType}
              onChange={(e) => setSelectedPetType(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
            >
              <option value="">All Pets</option>
              <option value="dog">🐕 Dogs</option>
              <option value="cat">🐱 Cats</option>
              <option value="bird">🐦 Birds</option>
              <option value="fish">🐠 Fish</option>
            </select>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
          >
            <option value="popular">Most Popular</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* Products Grid */}
      <main className="max-w-7xl mx-auto px-4 pb-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-gray-500">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <div key={product.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition">
                <div className="aspect-square bg-gray-100 relative">
                  <div className="absolute inset-0 flex items-center justify-center text-6xl">
                    {product.category === 'food' ? '🍖' :
                     product.category === 'toys' ? '🧸' :
                     product.category === 'grooming' ? '🧴' :
                     product.category === 'health' ? '💊' : '🎀'}
                  </div>
                  {product.sale_price && (
                    <span className="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white text-xs rounded-full font-medium">
                      {Math.round((1 - product.sale_price / product.price) * 100)}% OFF
                    </span>
                  )}
                </div>
                
                <div className="p-4">
                  <p className="text-xs text-gray-400 mb-1">{product.vendor_name}</p>
                  <h3 className="font-medium text-gray-900 line-clamp-2">{product.name}</h3>
                  
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-sm text-gray-600">{product.rating}</span>
                    <span className="text-xs text-gray-400">({product.review_count})</span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      {product.sale_price ? (
                        <>
                          <span className="text-lg font-bold text-orange-500">₹{product.sale_price}</span>
                          <span className="text-sm text-gray-400 line-through ml-2">₹{product.price}</span>
                        </>
                      ) : (
                        <span className="text-lg font-bold text-gray-900">₹{product.price}</span>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => addToCart(product)}
                    disabled={!product.in_stock}
                    className="w-full mt-3 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {product.in_stock ? 'Add to Cart' : 'Out of Stock'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl">
            <div className="flex flex-col h-full">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-xl font-semibold">Your Cart ({cartItemCount})</h2>
                <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
              
              {cart.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-5xl mb-4">🛒</div>
                    <p className="text-gray-500">Your cart is empty</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {cart.map(item => (
                      <div key={item.product_id} className="flex gap-4 bg-gray-50 rounded-xl p-3">
                        <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-3xl">
                          {item.product.category === 'food' ? '🍖' : '🧸'}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 line-clamp-1">{item.product.name}</h3>
                          <p className="text-orange-500 font-semibold">
                            ₹{item.product.sale_price || item.product.price}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <button
                              onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                              className="w-8 h-8 bg-white border rounded-lg hover:bg-gray-100"
                            >
                              -
                            </button>
                            <span className="font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                              className="w-8 h-8 bg-white border rounded-lg hover:bg-gray-100"
                            >
                              +
                            </button>
                            <button
                              onClick={() => removeFromCart(item.product_id)}
                              className="ml-auto text-red-500 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-4 border-t bg-gray-50">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="text-xl font-bold text-gray-900">₹{cartTotal.toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => { setShowCart(false); setShowCheckout(true); }}
                      className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition"
                    >
                      Proceed to Checkout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCheckout(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Checkout</h2>
                <button onClick={() => setShowCheckout(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Order Summary */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="font-medium text-gray-900 mb-3">Order Summary</h3>
                {cart.map(item => (
                  <div key={item.product_id} className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">{item.product.name} × {item.quantity}</span>
                    <span className="font-medium">₹{((item.product.sale_price || item.product.price) * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t mt-3 pt-3 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-orange-500">₹{cartTotal.toLocaleString()}</span>
                </div>
              </div>
              
              {/* Delivery Address */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-3">Delivery Address</h3>
                <div className="p-4 border rounded-xl">
                  <p className="font-medium">Home</p>
                  <p className="text-sm text-gray-500">123 Pet Street, Koramangala, Bangalore - 560034</p>
                </div>
              </div>
              
              {/* Payment */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-3">Payment Method</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:border-orange-500">
                    <input type="radio" name="payment" defaultChecked className="text-orange-500" />
                    <span>💳 Pay Online (Razorpay)</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:border-orange-500">
                    <input type="radio" name="payment" className="text-orange-500" />
                    <span>💵 Cash on Delivery</span>
                  </label>
                </div>
              </div>
              
              <button
                onClick={handleCheckout}
                disabled={processing}
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition disabled:opacity-50"
              >
                {processing ? 'Processing...' : `Place Order • ₹${cartTotal.toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

