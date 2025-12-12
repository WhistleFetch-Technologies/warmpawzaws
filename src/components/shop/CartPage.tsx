import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Heart, Trash2, ShoppingBag, AlertCircle, Gift, Truck } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { ShopLayout } from './ShopLayout';
import { Link } from 'react-router-dom';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { projectId } from '../../utils/supabase/info';
import { authenticatedGet, authenticatedPost, authenticatedDelete, authenticatedPut } from '../../utils/authenticatedFetch'; // ✅ FIX: Add authenticated fetch
import { toast } from 'sonner';

interface CartPageProps {
  onNavigate?: (path: string) => void;
}

export function CartPage({ onNavigate }: CartPageProps = {}) {
  // ✅ FIX: Remove mock data, use real API
  const [items, setItems] = useState<any[]>([]);
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [coupon, setCoupon] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleNavigation = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  };

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const savings = items.reduce((sum, item) => sum + ((item.originalPrice || item.price) - item.price) * item.quantity, 0);
  const shipping = subtotal > 499 ? 0 : 50;
  const couponDiscount = couponApplied ? 100 : 0;
  const total = Math.max(0, subtotal + shipping - couponDiscount);

  const updateQuantity = (id: string, delta: number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const moveToSaved = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      setItems(items.filter(i => i.id !== id));
      setSavedItems([...savedItems, { ...item, quantity: 1 }]); // Reset qty when saving
    }
  };

  const moveToCart = (id: string) => {
    const item = savedItems.find(i => i.id === id);
    if (item) {
      setSavedItems(savedItems.filter(i => i.id !== id));
      setItems([...items, item]);
    }
  };

  const handleApplyCoupon = () => {
    if (coupon.trim().length > 0) {
      setCouponApplied(true);
    }
  };

  useEffect(() => {
    const fetchCartItems = async () => {
      try {
        setLoading(true);
        // ✅ FIX: Use authenticatedGet properly (it returns data directly, not Response object)
        const data = await authenticatedGet(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/cart`,
          true // Requires auth
        );
        
        setItems(data.items || []);
        setSavedItems(data.savedItems || []);
      } catch (error) {
        console.error('Error fetching cart:', error);
        // Keep items empty on error (user sees empty cart instead of error)
      } finally {
        setLoading(false);
      }
    };

    fetchCartItems();
  }, []);

  if (loading) {
    return (
      <ShopLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
          <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center text-gray-300">
            <ShoppingBag className="h-16 w-16" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Loading Cart</h2>
            <p className="text-muted-foreground mb-6">Please wait while we load your cart items.</p>
          </div>
        </div>
      </ShopLayout>
    );
  }

  if (items.length === 0 && savedItems.length === 0) {
    return (
      <ShopLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
          <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center text-gray-300">
            <ShoppingBag className="h-16 w-16" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Your Cart is Empty</h2>
            <p className="text-muted-foreground mb-6">Looks like you haven't added anything to your cart yet.</p>
            <Button size="lg" onClick={() => handleNavigation('/shop')}>
              Start Shopping
            </Button>
          </div>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <div className="mb-6 flex items-center gap-2">
         <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleNavigation('/shop')}>
           <X className="h-4 w-4" /> Back
         </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items List */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Active Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Shopping Cart ({items.length})</h1>
              <span className="text-muted-foreground text-sm hidden sm:inline">Price</span>
            </div>
            
            {items.length === 0 ? (
               <Card className="p-8 text-center text-muted-foreground border-dashed">
                  Your cart is empty. Check your saved items below or continue shopping.
               </Card>
            ) : (
              items.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex gap-4 sm:gap-6">
                      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-md bg-gray-50 shrink-0 overflow-hidden border relative">
                        <ImageWithFallback 
                          src={item.image} 
                          alt={item.title} 
                          className="w-full h-full object-cover mix-blend-multiply"
                        />
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-between">
                        <div className="flex justify-between gap-4">
                          <div className="space-y-1">
                            <h3 className="font-medium text-base sm:text-lg line-clamp-2">{item.title}</h3>
                            <p className="text-sm text-muted-foreground">Variant: {item.variant}</p>
                            <p className="text-xs text-green-600 font-medium">In Stock</p>
                            <div className="flex items-center gap-2 mt-2">
                                <div className="flex items-center border rounded-md h-8">
                                  <button 
                                    onClick={() => updateQuantity(item.id, -1)}
                                    className="w-8 h-full flex items-center justify-center hover:bg-gray-100 disabled:opacity-50"
                                    disabled={item.quantity <= 1}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <div className="w-10 text-center font-medium text-sm border-x h-full flex items-center justify-center">
                                    {item.quantity}
                                  </div>
                                  <button 
                                    onClick={() => updateQuantity(item.id, 1)}
                                    className="w-8 h-full flex items-center justify-center hover:bg-gray-100"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-lg">₹{item.price.toLocaleString()}</div>
                            {item.originalPrice > item.price && (
                              <div className="text-sm text-muted-foreground line-through">
                                ₹{item.originalPrice.toLocaleString()}
                              </div>
                            )}
                            {item.originalPrice > item.price && (
                              <Badge variant="destructive" className="mt-1 ml-auto flex w-fit text-[10px] h-5">
                                {Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}% OFF
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mt-4 text-sm">
                          <button 
                            className="text-muted-foreground hover:text-primary font-medium uppercase text-xs tracking-wide"
                            onClick={() => moveToSaved(item.id)}
                          >
                            Save for Later
                          </button>
                          <Separator orientation="vertical" className="h-4" />
                          <button 
                            className="text-muted-foreground hover:text-red-600 font-medium uppercase text-xs tracking-wide"
                            onClick={() => removeItem(item.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Saved For Later */}
          {savedItems.length > 0 && (
            <div className="space-y-4 mt-8">
               <h2 className="text-xl font-bold">Saved for Later ({savedItems.length})</h2>
               <div className="grid grid-cols-1 gap-4">
                 {savedItems.map((item) => (
                    <Card key={item.id} className="overflow-hidden bg-gray-50/50">
                      <CardContent className="p-4">
                         <div className="flex gap-4">
                            <div className="w-20 h-20 rounded-md bg-white border shrink-0 overflow-hidden">
                              <ImageWithFallback src={item.image} alt={item.title} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 flex flex-col justify-between">
                               <div>
                                 <h3 className="font-medium line-clamp-1">{item.title}</h3>
                                 <div className="flex items-center gap-2 mt-1">
                                    <span className="font-bold">₹{item.price.toLocaleString()}</span>
                                    {item.originalPrice > item.price && (
                                      <span className="text-xs text-muted-foreground line-through">₹{item.originalPrice.toLocaleString()}</span>
                                    )}
                                 </div>
                               </div>
                               <div className="mt-2">
                                 <Button variant="secondary" size="sm" onClick={() => moveToCart(item.id)}>Move to Cart</Button>
                               </div>
                            </div>
                         </div>
                      </CardContent>
                    </Card>
                 ))}
               </div>
            </div>
          )}
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="sticky top-24">
            <CardContent className="p-6 space-y-6">
              <h2 className="text-lg font-bold">Order Summary</h2>
              
              {/* Coupon Input */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Apply Coupon
                </Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enter code" 
                    value={coupon} 
                    onChange={(e) => setCoupon(e.target.value)}
                    disabled={couponApplied}
                  />
                  <Button variant="outline" onClick={handleApplyCoupon} disabled={couponApplied || !coupon}>
                    {couponApplied ? 'Applied' : 'Apply'}
                  </Button>
                </div>
                {couponApplied && <p className="text-xs text-green-600">Coupon applied successfully!</p>}
              </div>

              <Separator />
              
              {/* Price Breakdown */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Price ({items.length} items)</span>
                  <span>₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>- ₹{savings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery Charges</span>
                  <span>{shipping === 0 ? <span className="text-green-600">Free</span> : `₹${shipping}`}</span>
                </div>
                {couponApplied && (
                  <div className="flex justify-between text-green-600">
                    <span>Coupon Discount</span>
                    <span>- ₹{couponDiscount}</span>
                  </div>
                )}
                
                <Separator className="my-4" />
                
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount</span>
                  <span>₹{total.toLocaleString()}</span>
                </div>
                
                <div className="text-xs text-muted-foreground mt-1">
                  Include all taxes and charges
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="gift" />
                <label
                  htmlFor="gift"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                >
                  <Gift className="h-4 w-4 text-primary" /> Gift Wrap this order (₹30)
                </label>
              </div>

              <Button 
                className="w-full h-12 text-base" 
                size="lg" 
                onClick={() => handleNavigation('/shop/checkout')}
                disabled={items.length === 0}
              >
                Proceed to Checkout <Truck className="ml-2 h-4 w-4" />
              </Button>

              <div className="flex items-center gap-3 justify-center text-xs text-muted-foreground bg-gray-50 p-3 rounded-md border">
                <Heart className="h-4 w-4 text-green-600" />
                <span>Safe and Secure Payments. 100% Authentic products.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ShopLayout>
  );
}