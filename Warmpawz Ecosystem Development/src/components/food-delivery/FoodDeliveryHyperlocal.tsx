import React, { useState, useEffect } from 'react';
import { Search, MapPin, ShoppingBag, Star, Clock, Package, Filter } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

/**
 * 🍽️ FOOD DELIVERY HYPERLOCAL COMPONENT
 * 
 * Phase 7B: Critical Services - Rule 8 Implementation
 * 
 * Features:
 * - Browse nearby vendors
 * - View food menu
 * - Place delivery order
 * - Real-time order tracking
 */

interface FoodMenuItem {
  itemId: string;
  vendorId: string;
  itemName: string;
  description: string;
  category: 'dog_food' | 'cat_food' | 'treats' | 'supplements';
  price: number;
  image?: string;
  nutritionalInfo: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
  ingredients: string[];
  allergens?: string[];
  isAvailable: boolean;
  preparationTime: number;
}

interface Vendor {
  vendorId: string;
  vendorName: string;
  location: { lat: number; lng: number; address: string };
  rating: number;
  distance: number;
  services: string[];
}

interface CartItem extends FoodMenuItem {
  quantity: number;
}

interface FoodDeliveryHyperlocalProps {
  customerId: string;
  petId: string;
  userLocation: { lat: number; lng: number; address: string };
}

export default function FoodDeliveryHyperlocal({
  customerId,
  petId,
  userLocation,
}: FoodDeliveryHyperlocalProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [menuItems, setMenuItems] = useState<FoodMenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    fetchNearbyVendors();
  }, [userLocation]);

  useEffect(() => {
    if (selectedVendor) {
      fetchVendorMenu(selectedVendor.vendorId);
    }
  }, [selectedVendor]);

  const fetchNearbyVendors = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/food-delivery/available-vendors?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=5`,
        {
          headers: {
            Authorization: (getAuthHeaders().Authorization || ""),
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setVendors(data.data.vendors || []);
        if (data.data.vendors.length > 0) {
          setSelectedVendor(data.data.vendors[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendorMenu = async (vendorId: string) => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/food-delivery/menu/${vendorId}`,
        {
          headers: {
            Authorization: (getAuthHeaders().Authorization || ""),
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setMenuItems(data.data.menu || []);
      }
    } catch (error) {
      console.error('Error fetching menu:', error);
    }
  };

  const addToCart = (item: FoodMenuItem) => {
    const existingItem = cart.find((i) => i.itemId === item.itemId);
    if (existingItem) {
      setCart(cart.map((i) => (i.itemId === item.itemId ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((i) => i.itemId !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity === 0) {
      removeFromCart(itemId);
    } else {
      setCart(cart.map((i) => (i.itemId === itemId ? { ...i, quantity } : i)));
    }
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryFee = 50;
    return { subtotal, deliveryFee, total: subtotal + deliveryFee };
  };

  const placeOrder = async () => {
    if (!selectedVendor || cart.length === 0) return;

    try {
      const { subtotal, deliveryFee, total } = calculateTotal();

      const response = await fetch(
        `${getApiBaseUrl()}/food-delivery/order/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: (getAuthHeaders().Authorization || ""),
          },
          body: JSON.stringify({
            customerId,
            vendorId: selectedVendor.vendorId,
            petId,
            items: cart.map((item) => ({
              itemId: item.itemId,
              itemName: item.itemName,
              quantity: item.quantity,
              price: item.price,
            })),
            deliveryAddress: userLocation,
            orderTotal: subtotal,
            deliveryFee,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        alert('Order placed successfully!');
        setCart([]);
        setShowCart(false);
        // Redirect to tracking page
        window.location.href = `/food-delivery/track/${data.data.order.orderId}`;
      } else {
        alert('Failed to place order: ' + data.error);
      }
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order');
    }
  };

  const filteredMenuItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && item.isAvailable;
  });

  const { subtotal, deliveryFee, total } = calculateTotal();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-gray-900">Pet Food Delivery</h1>
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{userLocation.address}</span>
              </div>
            </div>
            <button
              onClick={() => setShowCart(true)}
              className="relative bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
            >
              <ShoppingBag className="w-5 h-5" />
              <span>Cart</span>
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">
                  {cart.length}
                </span>
              )}
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search food items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="dog_food">Dog Food</option>
              <option value="cat_food">Cat Food</option>
              <option value="treats">Treats</option>
              <option value="supplements">Supplements</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Vendors List */}
        {vendors.length > 0 && (
          <div className="mb-6">
            <h2 className="text-gray-900 mb-4">Nearby Vendors</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vendors.map((vendor) => (
                <button
                  key={vendor.vendorId}
                  onClick={() => setSelectedVendor(vendor)}
                  className={`text-left p-4 rounded-lg transition-all ${
                    selectedVendor?.vendorId === vendor.vendorId
                      ? 'bg-orange-50 border-2 border-orange-500 shadow-md'
                      : 'bg-white hover:shadow-md'
                  }`}
                >
                  <h3 className="text-gray-900 mb-2">{vendor.vendorName}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span>{vendor.rating}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{vendor.distance}km</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Menu Items */}
        {selectedVendor && (
          <div>
            <h2 className="text-gray-900 mb-4">Menu</h2>
            {filteredMenuItems.length === 0 ? (
              <div className="bg-white rounded-lg p-12 text-center">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No items found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMenuItems.map((item) => (
                  <div key={item.itemId} className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    {item.image && (
                      <div className="h-48 bg-gray-200">
                        <img src={item.image} alt={item.itemName} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-gray-900 mb-1">{item.itemName}</h3>
                          <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            {item.category.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-orange-600">₹{item.price}</p>
                      </div>

                      <p className="text-gray-600 text-sm mb-3">{item.description}</p>

                      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                        <div className="bg-gray-50 rounded px-2 py-1">
                          <span className="text-gray-600">Calories: {item.nutritionalInfo.calories}</span>
                        </div>
                        <div className="bg-gray-50 rounded px-2 py-1">
                          <span className="text-gray-600">Protein: {item.nutritionalInfo.protein}g</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                        <Clock className="w-4 h-4" />
                        <span>{item.preparationTime} min prep time</span>
                      </div>

                      <button
                        onClick={() => addToCart(item)}
                        className="w-full bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 transition-colors"
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-gray-900">Your Cart</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.itemId} className="flex items-center gap-4 bg-gray-50 rounded-lg p-4">
                      <div className="flex-1">
                        <h3 className="text-gray-900">{item.itemName}</h3>
                        <p className="text-gray-600 text-sm">₹{item.price}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.itemId, item.quantity - 1)}
                          className="w-8 h-8 bg-white border border-gray-300 rounded-lg hover:bg-gray-100"
                        >
                          -
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.itemId, item.quantity + 1)}
                          className="w-8 h-8 bg-white border border-gray-300 rounded-lg hover:bg-gray-100"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.itemId)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 border-t border-gray-200">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery Fee</span>
                    <span>₹{deliveryFee}</span>
                  </div>
                  <div className="flex justify-between text-gray-900">
                    <span>Total</span>
                    <span>₹{total}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCart(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Continue Shopping
                  </button>
                  <button
                    onClick={placeOrder}
                    className="flex-1 bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    Place Order
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
