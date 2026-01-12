"use client";

import { useState } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingBag,
  ChevronRight,
  Tag,
  Percent,
  AlertCircle,
  Star,
  MapPin,
  Clock,
  Truck,
  Shield,
  RotateCcw,
  Gift,
  BadgeCheck,
  Lock,
  Info,
  Package,
  Bookmark,
  TrendingUp,
  Zap,
  X,
  CheckCircle2,
  Store
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/context/CartContext';
import { calculateTax } from '@/lib/tax-system';
import { cartItemsToTaxableItems } from '@/lib/tax-system/taxCalculatorUtils';

interface ShoppingCartViewProps {
  onBack: () => void;
  onCheckout: () => void;
  onContinueShopping: () => void;
}

interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'delivery';
  value: number;
  minOrder: number;
  maxDiscount?: number;
  vendorId?: string;
  description: string;
  expiryDate?: string;
}

interface SavedItem {
  id: string;
  name: string;
  price: number;
  image?: string;
  vendorId?: string;
  [key: string]: any;
}

const availableCoupons: Coupon[] = [
  {
    id: '1',
    code: 'FIRST50',
    type: 'percentage',
    value: 50,
    minOrder: 0,
    maxDiscount: 500,
    description: 'Get 50% off on your first order (Max ₹500)',
  },
  {
    id: '2',
    code: 'PAWZ200',
    type: 'fixed',
    value: 200,
    minOrder: 999,
    description: 'Flat ₹200 off on orders above ₹999',
  },
  {
    id: '3',
    code: 'FREEDEL',
    type: 'delivery',
    value: 100,
    minOrder: 499,
    description: 'Free delivery on orders above ₹499',
  },
  {
    id: '4',
    code: 'MEGA30',
    type: 'percentage',
    value: 30,
    minOrder: 1499,
    maxDiscount: 1000,
    description: 'Get 30% off on orders above ₹1499 (Max ₹1000)',
  },
];

// Mock vendor data - in production this would come from your backend
const vendorData: Record<string, { name: string; rating: number; reviews: number; deliveryTime: string; freeDeliveryMin: number }> = {
  'vendor1': { name: 'PawSome Pets Store', rating: 4.8, reviews: 2340, deliveryTime: '2-3 days', freeDeliveryMin: 999 },
  'vendor2': { name: 'Pet Paradise', rating: 4.6, reviews: 1820, deliveryTime: '1-2 days', freeDeliveryMin: 799 },
  'vendor3': { name: 'Furry Friends Shop', rating: 4.9, reviews: 3100, deliveryTime: '3-4 days', freeDeliveryMin: 1200 },
  'default': { name: 'WarmPawz Store', rating: 4.7, reviews: 1500, deliveryTime: '2-3 days', freeDeliveryMin: 999 },
};

export function ShoppingCartView({ onBack, onCheckout, onContinueShopping }: ShoppingCartViewProps) {
  const { cart, updateQuantity, removeFromCart, addToCart, getTotal, itemCount } = useCart();
  const [promoCode, setPromoCode] = useState('');
  const [appliedCoupons, setAppliedCoupons] = useState<Coupon[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<'standard' | 'express' | 'scheduled'>('standard');
  const [showCoupons, setShowCoupons] = useState(false);
  const [giftWrap, setGiftWrap] = useState(false);
  const [productProtection, setProductProtection] = useState(false);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);

  // Group items by vendor
  const itemsByVendor = cart.reduce((acc, item) => {
    const vendorId = item.vendorId || 'default';
    if (!acc[vendorId]) {
      acc[vendorId] = [];
    }
    acc[vendorId].push(item);
    return acc;
  }, {} as Record<string, typeof cart>);

  // Calculate vendor-wise totals
  const getVendorTotal = (vendorItems: typeof cart) => {
    return vendorItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // Calculate delivery fees
  const calculateDeliveryFee = (vendorId: string, vendorTotal: number) => {
    const vendor = vendorData[vendorId] || vendorData['default'];
    
    const hasDeliveryFreeCoupon = appliedCoupons.some(c => c.type === 'delivery');
    if (hasDeliveryFreeCoupon || vendorTotal >= vendor.freeDeliveryMin) return 0;
    
    if (selectedDelivery === 'express') return 150;
    if (selectedDelivery === 'scheduled') return 80;
    return 60;
  };

  // Calculate discount
  const calculateDiscount = () => {
    const cartTotal = getTotal();
    let totalDiscount = 0;
    appliedCoupons.forEach(coupon => {
      if (coupon.type === 'percentage') {
        const discount = (cartTotal * coupon.value) / 100;
        totalDiscount += coupon.maxDiscount ? Math.min(discount, coupon.maxDiscount) : discount;
      } else if (coupon.type === 'fixed') {
        totalDiscount += coupon.value;
      }
    });
    return totalDiscount;
  };

  const cartTotal = getTotal();
  const discount = calculateDiscount();
  const deliveryFees = Object.keys(itemsByVendor).reduce((total, vendorId) => {
    return total + calculateDeliveryFee(vendorId, getVendorTotal(itemsByVendor[vendorId]));
  }, 0);
  
  const giftWrapFee = giftWrap ? itemCount * 25 : 0;
  const protectionFee = productProtection ? cartTotal * 0.02 : 0;
  
  // Calculate tax using tax system
  const subtotalForTax = cartTotal - discount;
  const taxableItems = cartItemsToTaxableItems(cart);
  const taxResult = calculateTax(taxableItems.map(item => ({
    ...item,
    amount: (item.amount * (item.quantity || 1) - (discount * (item.amount * (item.quantity || 1)) / cartTotal)) / (item.quantity || 1)
  })));
  const taxAmount = taxResult.total;
  const totalAmount = subtotalForTax + deliveryFees + giftWrapFee + protectionFee + taxAmount;

  const handleApplyCoupon = (coupon: Coupon) => {
    if (cartTotal < coupon.minOrder) {
      alert(`Minimum order of ₹${coupon.minOrder} required for this coupon`);
      return;
    }
    if (appliedCoupons.some(c => c.id === coupon.id)) {
      alert('Coupon already applied');
      return;
    }
    setAppliedCoupons([...appliedCoupons, coupon]);
    setShowCoupons(false);
    setPromoCode('');
  };

  const handleRemoveCoupon = (couponId: string) => {
    setAppliedCoupons(appliedCoupons.filter(c => c.id !== couponId));
  };

  const handleSaveForLater = (itemId: string) => {
    const item = cart.find(i => i.id === itemId);
    if (item) {
      setSavedItems([...savedItems, item]);
      removeFromCart(itemId);
    }
  };

  const handleMoveToCart = (itemId: string) => {
    const item = savedItems.find(i => i.id === itemId);
    if (item) {
      const { savedDate, ...cartItem } = item as any;
      addToCart({ ...cartItem, quantity: 1 });
      setSavedItems(savedItems.filter(i => i.id !== itemId));
    }
  };

  const handleRemoveSavedItem = (itemId: string) => {
    setSavedItems(savedItems.filter(i => i.id !== itemId));
  };

  if (cart.length === 0 && savedItems.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col max-w-md mx-auto relative">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 z-10">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg">Shopping Cart</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-32 h-32 bg-gradient-to-br from-orange-100 to-pink-100 rounded-full flex items-center justify-center mb-6">
            <ShoppingBag className="w-16 h-16 text-[#FF8C42]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-500 mb-8 max-w-sm">
            Discover amazing products for your pets and start shopping now!
          </p>
          <Button 
            onClick={onContinueShopping}
            className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A2A] hover:to-[#FF5A8D] text-white px-8 h-12 font-medium"
          >
            Explore Products
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto relative">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg flex-1">Shopping Cart</h1>
          <Badge className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] text-white px-3 py-1">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Badge>
        </div>
      </div>

      <div className="pb-[500px]">
        {/* Trust Badges */}
        <div className="bg-gradient-to-r from-blue-50 to-green-50 px-4 py-3 border-b border-blue-100">
          <div className="flex items-center justify-around text-xs">
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-green-600" />
              <span className="text-gray-700">Secure</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4 text-blue-600" />
              <span className="text-gray-700">Verified</span>
            </div>
            <div className="flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-orange-600" />
              <span className="text-gray-700">Easy Returns</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-purple-600" />
              <span className="text-gray-700">Fast Delivery</span>
            </div>
          </div>
        </div>

        {/* Delivery Options */}
        <div className="bg-white px-4 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#FF8C42]" />
            Choose Delivery Speed
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setSelectedDelivery('standard')}
              className={`p-3 rounded-xl border-2 transition-all ${
                selectedDelivery === 'standard'
                  ? 'border-[#FF8C42] bg-orange-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <Package className="w-5 h-5 text-gray-600 mx-auto mb-1" />
              <div className="text-xs font-medium text-gray-900">Standard</div>
              <div className="text-xs text-gray-500">₹60</div>
            </button>
            <button
              onClick={() => setSelectedDelivery('express')}
              className={`p-3 rounded-xl border-2 transition-all ${
                selectedDelivery === 'express'
                  ? 'border-[#FF8C42] bg-orange-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <Zap className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
              <div className="text-xs font-medium text-gray-900">Express</div>
              <div className="text-xs text-gray-500">₹150</div>
            </button>
            <button
              onClick={() => setSelectedDelivery('scheduled')}
              className={`p-3 rounded-xl border-2 transition-all ${
                selectedDelivery === 'scheduled'
                  ? 'border-[#FF8C42] bg-orange-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <Clock className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <div className="text-xs font-medium text-gray-900">Scheduled</div>
              <div className="text-xs text-gray-500">₹80</div>
            </button>
          </div>
        </div>

        {/* Cart Items by Vendor */}
        {Object.entries(itemsByVendor).map(([vendorId, vendorItems]) => {
          const vendor = vendorData[vendorId] || vendorData['default'];
          const vendorTotal = getVendorTotal(vendorItems);
          const vendorDeliveryFee = calculateDeliveryFee(vendorId, vendorTotal);
          const freeDeliveryRemaining = vendor.freeDeliveryMin - vendorTotal;

          return (
            <div key={vendorId} className="bg-white mb-3 border-b-4 border-gray-100">
              {/* Vendor Header */}
              <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] rounded-full flex items-center justify-center">
                      <Store className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{vendor.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span>{vendor.rating}</span>
                        </div>
                        <span>•</span>
                        <span>{vendor.reviews.toLocaleString()} reviews</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Clock className="w-3 h-3" />
                      <span>{vendor.deliveryTime}</span>
                    </div>
                  </div>
                </div>

                {/* Free Delivery Progress */}
                {freeDeliveryRemaining > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-green-700 font-medium">
                        Add ₹{freeDeliveryRemaining} more for FREE delivery
                      </span>
                      <span className="text-gray-500">
                        ₹{vendorTotal}/₹{vendor.freeDeliveryMin}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-gradient-to-r from-green-400 to-green-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min((vendorTotal / vendor.freeDeliveryMin) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Vendor Items */}
              <div className="divide-y divide-gray-100">
                {vendorItems.map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <div className="w-24 h-24 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 relative">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">
                            🐾
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 text-sm">{item.name}</h3>
                        
                        {/* Price */}
                        <div className="flex items-baseline gap-2 mb-3">
                          <span className="text-lg font-bold text-gray-900">₹{(item.price * item.quantity).toLocaleString()}</span>
                          <span className="text-xs text-gray-500">₹{item.price.toLocaleString()} each</span>
                        </div>

                        {/* Quantity and Actions */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center bg-gray-100 rounded-lg">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="p-2 hover:bg-gray-200 rounded-l-lg transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="px-4 font-semibold min-w-[40px] text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="p-2 hover:bg-gray-200 rounded-r-lg transition-colors"
                              disabled={item.quantity >= 10}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-4 mt-3">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="flex items-center gap-1.5 text-red-500 text-xs hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                          <button
                            onClick={() => handleSaveForLater(item.id)}
                            className="flex items-center gap-1.5 text-blue-600 text-xs hover:text-blue-700 transition-colors"
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                            Save for Later
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Vendor Delivery Info */}
              <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span className="text-gray-700">Delivery by {vendor.deliveryTime}</span>
                  </div>
                  {vendorDeliveryFee > 0 ? (
                    <span className="font-semibold text-gray-900">₹{vendorDeliveryFee}</span>
                  ) : (
                    <span className="font-semibold text-green-600">FREE</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Saved for Later */}
        {savedItems.length > 0 && (
          <div className="bg-white mt-4 border-t-4 border-gray-200">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-[#FF8C42]" />
                Saved for Later ({savedItems.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {savedItems.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          🐾
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1 text-sm line-clamp-2">{item.name}</h4>
                      <p className="text-base font-bold text-gray-900 mb-2">₹{item.price.toLocaleString()}</p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleMoveToCart(item.id)}
                          className="text-[#FF8C42] text-xs font-medium hover:underline"
                        >
                          Move to Cart
                        </button>
                        <button
                          onClick={() => handleRemoveSavedItem(item.id)}
                          className="text-red-500 text-xs font-medium hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Services */}
        <div className="bg-white mt-3 p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 mb-3">Additional Services</h3>
          
          {/* Gift Wrap */}
          <div className="flex items-center justify-between p-3 bg-pink-50 border border-pink-200 rounded-xl">
            <div className="flex items-center gap-3">
              <Gift className="w-5 h-5 text-pink-600" />
              <div>
                <p className="font-medium text-gray-900 text-sm">Gift Wrap</p>
                <p className="text-xs text-gray-600">₹25 per item</p>
              </div>
            </div>
            <button
              onClick={() => setGiftWrap(!giftWrap)}
              className={`w-12 h-6 rounded-full transition-colors ${
                giftWrap ? 'bg-pink-500' : 'bg-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                giftWrap ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Product Protection */}
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900 text-sm">Product Protection</p>
                <p className="text-xs text-gray-600">2% of cart value</p>
              </div>
            </div>
            <button
              onClick={() => setProductProtection(!productProtection)}
              className={`w-12 h-6 rounded-full transition-colors ${
                productProtection ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                productProtection ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>

        {/* Coupons Section */}
        <div className="bg-white mt-3 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Percent className="w-5 h-5 text-[#FF8C42]" />
              Apply Coupons
            </h3>
            <button
              onClick={() => setShowCoupons(!showCoupons)}
              className="text-[#FF8C42] text-sm font-medium"
            >
              {showCoupons ? 'Hide' : 'View All'}
            </button>
          </div>

          {/* Applied Coupons */}
          {appliedCoupons.map((coupon) => (
            <div key={coupon.id} className="mb-2 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900 text-sm">{coupon.code}</p>
                  <p className="text-xs text-green-700">{coupon.description}</p>
                </div>
              </div>
              <button
                onClick={() => handleRemoveCoupon(coupon.id)}
                className="p-1 hover:bg-green-100 rounded-full"
              >
                <X className="w-4 h-4 text-green-700" />
              </button>
            </div>
          ))}

          {/* Coupon Input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8C42] text-sm"
            />
            <Button
              onClick={() => {
                const coupon = availableCoupons.find(c => c.code === promoCode);
                if (coupon) handleApplyCoupon(coupon);
                else alert('Invalid coupon code');
              }}
              disabled={!promoCode}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A2A] hover:to-[#FF5A8D] text-white px-6"
            >
              Apply
            </Button>
          </div>

          {/* Available Coupons */}
          {showCoupons && (
            <div className="space-y-2 mt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Available Coupons:</p>
              {availableCoupons.map((coupon) => (
                <div
                  key={coupon.id}
                  className="p-3 border-2 border-dashed border-gray-300 rounded-xl bg-gradient-to-r from-orange-50 to-yellow-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-[#FF8C42]" />
                      <span className="font-bold text-gray-900 text-sm">{coupon.code}</span>
                    </div>
                    <button
                      onClick={() => handleApplyCoupon(coupon)}
                      disabled={appliedCoupons.some(c => c.id === coupon.id)}
                      className="text-[#FF8C42] text-xs font-semibold hover:underline disabled:text-gray-400 disabled:no-underline"
                    >
                      {appliedCoupons.some(c => c.id === coupon.id) ? 'Applied' : 'Apply'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-700 mb-1">{coupon.description}</p>
                  <p className="text-xs text-gray-500">Min order: ₹{coupon.minOrder}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Price Summary */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-2xl max-w-[430px] mx-auto">
        <div className="p-4">
          {/* Price Breakdown */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-gray-700 text-sm">
              <span>Subtotal ({itemCount} items)</span>
              <span className="font-medium">₹{cartTotal.toFixed(2)}</span>
            </div>
            
            {discount > 0 && (
              <div className="flex items-center justify-between text-green-600 text-sm">
                <span>Coupon Discount</span>
                <span className="font-medium">-₹{discount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-gray-700 text-sm">
              <span>Delivery Charges</span>
              {deliveryFees > 0 ? (
                <span className="font-medium">₹{deliveryFees.toFixed(2)}</span>
              ) : (
                <span className="font-medium text-green-600">FREE</span>
              )}
            </div>

            {giftWrap && (
              <div className="flex items-center justify-between text-gray-700 text-sm">
                <span>Gift Wrap</span>
                <span className="font-medium">₹{giftWrapFee.toFixed(2)}</span>
              </div>
            )}

            {productProtection && (
              <div className="flex items-center justify-between text-gray-700 text-sm">
                <span>Product Protection</span>
                <span className="font-medium">₹{protectionFee.toFixed(2)}</span>
              </div>
            )}

            {taxResult.byType.map((taxType) => (
              <div key={taxType.taxType} className="flex items-center justify-between text-gray-700 text-sm">
                <span>
                  {taxType.taxType === 'gst' ? 'GST' : 
                   taxType.taxType === 'service_tax' ? 'Service Tax' :
                   taxType.taxType === 'education_cess' ? 'Education Cess' :
                   taxType.taxType === 'infrastructure_cess' ? 'Infrastructure Cess' :
                   taxType.taxType.toUpperCase()} 
                  {taxType.breakdown.length > 0 && ` (${taxType.breakdown[0].rate}%)`}
                </span>
                <span className="font-medium">₹{taxType.totalAmount.toFixed(2)}</span>
              </div>
            ))}

            <Separator className="my-2" />

            <div className="flex items-center justify-between text-lg">
              <span className="font-bold text-gray-900">Total Amount</span>
              <span className="font-bold text-gray-900">₹{totalAmount.toFixed(2)}</span>
            </div>

            {discount > 0 && (
              <p className="text-xs text-green-600 font-medium">
                You're saving ₹{discount.toFixed(2)} on this order!
              </p>
            )}
          </div>

          {/* Checkout Button */}
          <Button
            onClick={onCheckout}
            className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A2A] hover:to-[#FF5A8D] text-white h-14 text-base font-semibold shadow-lg"
          >
            Proceed to Checkout
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>

          {/* Continue Shopping Link */}
          <button
            onClick={onContinueShopping}
            className="w-full mt-3 text-[#FF8C42] font-medium hover:underline text-sm"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}
