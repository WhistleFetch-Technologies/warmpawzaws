/**
 * Shopping Cart Page with Coupon Application
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Plus, Minus, Tag, ShoppingBag } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { EXPANDED_PRODUCTS, MOCK_COUPONS } from '../../lib/mockDataExpanded';
import { toast } from 'sonner';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl: string;
  quantity: number;
}

export function CartPage() {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = () => {
    setLoading(true);
    const saved = localStorage.getItem('warmpawz_cart');
    if (saved) {
      setCartItems(JSON.parse(saved));
    }
    setLoading(false);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCartItems(prev => {
      const updated = prev.map(item => {
        if (item.productId === productId) {
          const newQuantity = Math.max(1, Math.min(10, item.quantity + delta));
          return { ...item, quantity: newQuantity };
        }
        return item;
      });
      localStorage.setItem('warmpawz_cart', JSON.stringify(updated));
      return updated;
    });
  };

  const removeItem = (productId: string) => {
    setCartItems(prev => {
      const updated = prev.filter(item => item.productId !== productId);
      localStorage.setItem('warmpawz_cart', JSON.stringify(updated));
      toast.success('Item removed from cart');
      return updated;
    });
  };

  const applyCoupon = () => {
    const coupon = MOCK_COUPONS.find(
      c => c.code.toLowerCase() === couponCode.toLowerCase() && c.isActive
    );

    if (!coupon) {
      toast.error('Invalid coupon code');
      return;
    }

    // Check if applicable
    if (coupon.applicableOn === 'services') {
      toast.error('This coupon is only valid for services');
      return;
    }

    if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
      toast.error(`Minimum order value is ₹${coupon.minOrderValue}`);
      return;
    }

    setAppliedCoupon(coupon);
    toast.success(`Coupon applied: ${coupon.description}`);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    toast.success('Coupon removed');
  };

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;

    let discount = 0;

    if (appliedCoupon.type === 'flat') {
      discount = appliedCoupon.value;
    } else if (appliedCoupon.type === 'percentage') {
      discount = (subtotal * appliedCoupon.value) / 100;
      if (appliedCoupon.maxDiscount) {
        discount = Math.min(discount, appliedCoupon.maxDiscount);
      }
    }

    return discount;
  };

  const proceedToCheckout = () => {
    // Store order summary
    const orderSummary = {
      items: cartItems,
      subtotal,
      discount: calculateDiscount(),
      deliveryFee,
      total: grandTotal,
      appliedCoupon: appliedCoupon?.code
    };
    
    localStorage.setItem('warmpawz_checkout_data', JSON.stringify(orderSummary));
    navigate('/shop/checkout');
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = calculateDiscount();
  const deliveryFee = subtotal >= 500 ? 0 : 50;
  const grandTotal = subtotal - discount + deliveryFee;

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
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate('/shop')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Continue Shopping
            </Button>
            <h1 className="text-2xl font-bold">Shopping Cart</h1>
            <div className="w-40"></div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {cartItems.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
              <p className="text-gray-600 mb-6">
                Add some products to your cart to get started!
              </p>
              <Button
                onClick={() => navigate('/shop')}
                className="bg-gradient-to-r from-orange-500 to-pink-500"
              >
                Browse Products
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="md:col-span-2 space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">
                      Cart Items ({cartItems.length})
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {cartItems.map(item => {
                      const product = EXPANDED_PRODUCTS.find(p => p.id === item.productId);
                      
                      return (
                        <div
                          key={item.productId}
                          className="flex gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-24 h-24 object-cover rounded-lg cursor-pointer"
                            onClick={() => navigate(`/shop/product/${item.productId}`)}
                          />
                          
                          <div className="flex-1">
                            <h3
                              className="font-semibold mb-1 cursor-pointer hover:text-orange-600"
                              onClick={() => navigate(`/shop/product/${item.productId}`)}
                            >
                              {item.name}
                            </h3>
                            
                            {product?.brand && (
                              <p className="text-xs text-gray-500 uppercase mb-2">
                                {product.brand}
                              </p>
                            )}

                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2 border rounded-lg">
                                <button
                                  onClick={() => updateQuantity(item.productId, -1)}
                                  className="p-2 hover:bg-gray-100 rounded-l-lg"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="px-3 font-semibold">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.productId, 1)}
                                  className="p-2 hover:bg-gray-100 rounded-r-lg"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>

                              <span className="text-lg font-bold">
                                ₹{item.price * item.quantity}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => removeItem(item.productId)}
                            className="text-red-500 hover:text-red-700 p-2"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Available Coupons */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    Available Coupons
                  </h3>
                  <div className="space-y-2">
                    {MOCK_COUPONS.filter(c => 
                      c.isActive && 
                      (c.applicableOn === 'products' || c.applicableOn === 'both') &&
                      (!c.minOrderValue || subtotal >= c.minOrderValue)
                    ).slice(0, 3).map(coupon => (
                      <div
                        key={coupon.id}
                        className="border rounded-lg p-3 flex items-center justify-between hover:bg-orange-50 transition-colors cursor-pointer"
                        onClick={() => {
                          setCouponCode(coupon.code);
                          setAppliedCoupon(coupon);
                          toast.success('Coupon applied!');
                        }}
                      >
                        <div>
                          <Badge className="bg-orange-500 mb-1">{coupon.code}</Badge>
                          <p className="text-sm text-gray-600">{coupon.description}</p>
                        </div>
                        <Button size="sm" variant="outline">
                          Apply
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div>
              <Card className="sticky top-4">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-6">Order Summary</h2>

                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-semibold">₹{subtotal}</span>
                    </div>

                    {discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span className="font-semibold">-₹{discount}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-gray-600">Delivery Fee</span>
                      <span className="font-semibold">
                        {deliveryFee === 0 ? (
                          <Badge className="bg-green-500">FREE</Badge>
                        ) : (
                          `₹${deliveryFee}`
                        )}
                      </span>
                    </div>

                    {deliveryFee > 0 && (
                      <p className="text-xs text-gray-500">
                        Add ₹{500 - subtotal} more for FREE delivery
                      </p>
                    )}

                    <div className="border-t pt-4">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span>₹{grandTotal}</span>
                      </div>
                    </div>
                  </div>

                  {/* Coupon Input */}
                  <div className="mb-6">
                    {appliedCoupon ? (
                      <div className="border border-green-500 rounded-lg p-3 bg-green-50">
                        <div className="flex items-center justify-between mb-2">
                          <Badge className="bg-green-600">
                            {appliedCoupon.code}
                          </Badge>
                          <button
                            onClick={removeCoupon}
                            className="text-sm text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                        <p className="text-sm text-green-700">
                          {appliedCoupon.description}
                        </p>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter coupon code"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        />
                        <Button onClick={applyCoupon} variant="outline">
                          Apply
                        </Button>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={proceedToCheckout}
                    className="w-full bg-gradient-to-r from-orange-500 to-pink-500 h-12 text-lg"
                  >
                    Proceed to Checkout
                  </Button>

                  <p className="text-xs text-center text-gray-500 mt-4">
                    Safe and secure checkout
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
