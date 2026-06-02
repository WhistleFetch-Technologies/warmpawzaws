"use client";

import { useState, useMemo, useCallback, useTransition, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
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
  Store,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { formatRatingNumberOrDash } from '@/lib/rating-display';
import {
  computeCartPricing,
  persistPricingOptionsForCheckout,
  VENDOR_DELIVERY_CONFIG,
  type CartPricingCoupon,
  type SellerPromotionPricing,
} from '@/lib/ecommerce/cart-pricing';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { CartPromotionsBanner } from './shared/CartPromotionsBanner';
import { CartPromotionResult } from '@/lib/promotions-engine';
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';

interface ShoppingCartViewProps {
  onBack: () => void;
  /** Empty-state header only: go to Home without browser back. Falls back to `onBack` if omitted. */
  onNavigateHome?: () => void;
  onCheckout: () => void;
  onContinueShopping: () => void;
  /** `shell` = bottom nav clearance; `standalone` = `/cart` route without tab bar */
  variant?: 'shell' | 'standalone';
}

type Coupon = CartPricingCoupon;

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

/** Cart "Choose Delivery Speed" UI. Totals still use standard (₹60) fee when hidden. */
const SHOW_CART_DELIVERY_SPEED_PICKER = false;

export function ShoppingCartView({
  onBack,
  onNavigateHome,
  onCheckout,
  onContinueShopping,
  variant = 'shell',
}: ShoppingCartViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { cart, updateQuantity, removeFromCart, addToCart, itemCount } = useCart();
  const [isCheckoutPending, startCheckoutTransition] = useTransition();

  const handleNavigateBack = useCallback(() => {
    if (typeof window === 'undefined') {
      onBack();
      return;
    }
    // Embedded on `/` without extra history (WebViews): URL-only `goBackOrHome` does not change `currentScreen`.
    if (window.history.length <= 1) {
      onBack();
      return;
    }
    const before = window.location.href;
    router.back();
    window.setTimeout(() => {
      if (window.location.href === before) {
        onBack();
      }
    }, 120);
  }, [router, onBack]);
  const [promoCode, setPromoCode] = useState('');
  const [appliedCoupons, setAppliedCoupons] = useState<Coupon[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<'standard' | 'express' | 'scheduled'>('standard');
  const [showCoupons, setShowCoupons] = useState(false);
  const [giftWrap, setGiftWrap] = useState(false);
  const [productProtection, setProductProtection] = useState(false);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [promotionResult, setPromotionResult] = useState<CartPromotionResult | null>(null);

  const itemsByVendor = useMemo(() => {
    return cart.reduce((acc, item) => {
      const vendorId = item.vendorId || 'default';
      if (!acc[vendorId]) {
        acc[vendorId] = [];
      }
      acc[vendorId].push(item);
      return acc;
    }, {} as Record<string, typeof cart>);
  }, [cart]);

  const primaryVendorId = useMemo(() => Object.keys(itemsByVendor)[0], [itemsByVendor]);

  const promotionBannerItems = useMemo(
    () =>
      cart.map((item) => {
        const lineProduct = item.warmpawzLine?.product as
          | { category_id?: string }
          | undefined;
        const categoryId =
          item.categoryId ??
          (lineProduct?.category_id != null
            ? String(lineProduct.category_id)
            : undefined);
        return {
          id: item.id,
          productId: (item as { productId?: string }).productId ?? item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          vendorId: item.vendorId,
          category: (item as { category?: string }).category ?? categoryId,
          categoryId,
        };
      }),
    [cart]
  );

  const sellerPromotionPricing = useMemo((): SellerPromotionPricing | undefined => {
    if (!isCustomerEcommerceEnabled() || !promotionResult?.totalSavings) return undefined;
    const main = promotionResult.appliedPromotions[0];
    return {
      autoDiscount: promotionResult.totalSavings,
      label: main?.description || main?.promotion?.name,
      promotionId: main?.promotion?.id,
      code: main?.promotion?.code,
    };
  }, [promotionResult]);

  const pricing = useMemo(
    () =>
      computeCartPricing(cart, {
        appliedCoupons,
        deliverySpeed: selectedDelivery,
        giftWrap,
        productProtection,
        itemCount,
        sellerPromotion: sellerPromotionPricing,
      }),
    [
      cart,
      appliedCoupons,
      selectedDelivery,
      giftWrap,
      productProtection,
      itemCount,
      sellerPromotionPricing,
    ]
  );

  const totalAmount = pricing.total;

  const cartHeaderStats = useMemo(() => {
    const vendorCount = Object.keys(itemsByVendor).length;
    return [
      { value: String(itemCount), label: 'Items' },
      { value: String(vendorCount), label: 'Stores' },
      { value: `₹${Math.round(totalAmount)}`, label: 'Est. total' },
    ];
  }, [itemCount, itemsByVendor, totalAmount]);

  const handleProceedToCheckout = useCallback(() => {
    persistPricingOptionsForCheckout({
      appliedCoupons,
      deliverySpeed: selectedDelivery,
      giftWrap,
      productProtection,
      itemCount,
      sellerPromotion: sellerPromotionPricing,
    });
    onCheckout();
  }, [
    appliedCoupons,
    selectedDelivery,
    giftWrap,
    productProtection,
    itemCount,
    sellerPromotionPricing,
    onCheckout,
  ]);

  useEffect(() => {
    if (variant !== 'standalone' || searchParams.get('buynow') !== '1' || cart.length === 0) return;
    const t = window.setTimeout(() => {
      document.getElementById('cart-order-summary')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    return () => clearTimeout(t);
  }, [variant, searchParams, cart.length]);

  const handleApplyCoupon = (coupon: Coupon) => {
    if (pricing.lineSubtotal < coupon.minOrder) {
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
    const shopEnabled = isCustomerEcommerceEnabled();
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col max-w-customer mx-auto relative">
        <ServiceDashboardHeader
          className="sticky top-0 z-30 shrink-0"
          serviceName="Shopping Cart"
          serviceSubtitle="Review before checkout"
          serviceIcon={ShoppingBag}
          iconColor="text-white"
          stats={[]}
          onBack={onNavigateHome ?? onBack}
          showBackButton
          bottomEdge="sheet"
          sheetToneClass="bg-gradient-to-br from-orange-50 to-amber-50"
        />

        <div className="-mt-1 flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="w-32 h-32 bg-gradient-to-br from-orange-100 to-pink-100 rounded-full flex items-center justify-center mb-6">
            <ShoppingBag className="w-16 h-16 text-[#FF8C42]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Your cart is empty</h2>
          <p className="text-gray-600 mt-2 mb-8 max-w-sm text-[15px] leading-relaxed">
            {shopEnabled
              ? 'Browse the shop and add items — they appear here for checkout when you are ready.'
              : 'The marketplace is not available in this build yet. Check back soon.'}
          </p>
          <div className="flex w-full min-w-0 max-w-xs flex-col gap-3 sm:flex-row sm:items-stretch">
            {shopEnabled ? (
              <Button
                type="button"
                className="w-full min-w-0 shrink rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-6 font-semibold text-white sm:flex-1"
                onClick={() => onContinueShopping()}
              >
                Browse shop
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full min-w-0 shrink rounded-xl py-6 sm:flex-1"
                onClick={() => (onNavigateHome ?? onBack)()}
              >
                Go back
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full min-w-0 shrink rounded-xl border-gray-300 py-6 sm:flex-1"
              onClick={() => (onNavigateHome ?? onBack)()}
            >
              {onNavigateHome ? 'Home' : 'Back'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const checkoutBarBottom =
    variant === 'shell'
      ? 'calc(5.5rem + env(safe-area-inset-bottom, 0px))'
      : 'env(safe-area-inset-bottom, 0px)';

  const scrollBottomPad =
    variant === 'shell'
      ? 'pb-[calc(5.5rem+4.5rem+env(safe-area-inset-bottom,0px)+12px)]'
      : 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px)+12px)]';

  return (
    <div className="relative w-full max-w-customer mx-auto min-h-0">
      <ServiceDashboardHeader
        className="sticky top-0 z-30 shrink-0"
        serviceName="Shopping Cart"
        serviceSubtitle={`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
        serviceIcon={ShoppingBag}
        iconColor="text-white"
        stats={cartHeaderStats}
        onBack={handleNavigateBack}
        showBackButton
        bottomEdge="sheet"
        sheetToneClass="bg-white"
      />

      <div className={`-mt-1 ${scrollBottomPad}`}>
        {/* Trust Badges */}
        <div className="bg-gradient-to-r from-blue-50 to-green-50 px-4 py-3 border-b border-blue-100">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:flex sm:flex-nowrap sm:items-center sm:justify-between sm:gap-0">
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

        {/* Seller promotions (vendor_promotions) — marketplace only */}
        {isCustomerEcommerceEnabled() && cart.length > 0 && primaryVendorId !== 'default' && (
          <div className="px-4 py-3">
            <CartPromotionsBanner
              items={promotionBannerItems}
              vendorId={primaryVendorId}
              onPromotionApplied={(result) => setPromotionResult(result)}
            />
          </div>
        )}

        {SHOW_CART_DELIVERY_SPEED_PICKER && (
          <div className="bg-white px-4 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#FF8C42]" />
              Choose Delivery Speed
            </h3>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setSelectedDelivery('standard')}
                className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                  selectedDelivery === 'standard'
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <Package className="h-5 w-5 shrink-0 text-gray-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">Standard</div>
                  <div className="text-xs text-gray-500">₹60</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDelivery('express')}
                className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                  selectedDelivery === 'express'
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <Zap className="h-5 w-5 shrink-0 text-yellow-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">Express</div>
                  <div className="text-xs text-gray-500">₹150</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDelivery('scheduled')}
                className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                  selectedDelivery === 'scheduled'
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <Clock className="h-5 w-5 shrink-0 text-blue-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">Scheduled</div>
                  <div className="text-xs text-gray-500">₹80</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Cart Items by Vendor */}
        {Object.entries(itemsByVendor).map(([vendorId, vendorItems]) => {
          const vendor = VENDOR_DELIVERY_CONFIG[vendorId] || VENDOR_DELIVERY_CONFIG.default;
          const vendorRow = pricing.byVendor.find((v) => v.vendorId === vendorId);
          const vendorTotal = vendorRow?.subtotal ?? 0;
          const vendorDeliveryFee = vendorRow?.deliveryFee ?? 0;
          const freeDeliveryRemaining = vendorRow?.freeDeliveryGap ?? 0;

          return (
            <div key={vendorId} className="bg-white mb-3 border-b-4 border-gray-100">
              {/* Vendor Header */}
              <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] rounded-full flex items-center justify-center">
                      <Store className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{vendor.name}</h3>
                      {vendor.deliveryTime ? (
                        <p className="text-xs text-gray-600">{vendor.deliveryTime}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <div className="flex items-center gap-1 text-xs text-gray-600 sm:justify-end">
                      <Clock className="w-3 h-3 shrink-0" />
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
                  <div key={item.id} className="p-3 sm:p-4">
                    <div className="flex gap-3 sm:gap-4">
                      {/* Product Image */}
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-24 sm:w-24">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl sm:text-3xl">
                            🐾
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="min-w-0 flex-1 space-y-2">
                        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">{item.name}</h3>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-base font-bold text-gray-900 sm:text-lg">
                              ₹{(item.price * item.quantity).toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-500">₹{item.price.toLocaleString()} each</span>
                          </div>
                          <div className="flex w-fit items-center rounded-lg bg-gray-100">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="rounded-l-lg p-2 transition-colors hover:bg-gray-200"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-[40px] px-3 text-center text-sm font-semibold">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="rounded-r-lg p-2 transition-colors hover:bg-gray-200 disabled:opacity-40"
                              disabled={item.quantity >= 10}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-3 pt-1">
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
        <div id="cart-order-summary" className="bg-white mt-3 p-4">
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

        <div className="px-4 pb-2 pt-1">
          <button
            type="button"
            onClick={onContinueShopping}
            className="text-sm font-medium text-[#FF8C42] hover:underline"
          >
            Continue shopping
          </button>
        </div>
      </div>

      {/* Compact checkout bar — fixed above bottom nav; short bar so main content stays visible while scrolling */}
      <div
        className="fixed left-0 right-0 z-40 mx-auto w-full max-w-md border-t border-gray-200 bg-white/95 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-sm supports-[backdrop-filter]:bg-white/90"
        style={{ bottom: checkoutBarBottom }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 shrink-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Total</p>
            <p className="text-lg font-bold leading-tight text-gray-900">₹{totalAmount.toFixed(2)}</p>
          </div>
          <Button
            type="button"
            disabled={isCheckoutPending}
            onClick={() => startCheckoutTransition(() => handleProceedToCheckout())}
            className="h-12 min-w-0 flex-1 bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] text-sm font-semibold text-white shadow-md hover:from-[#FF7A2A] hover:to-[#FF5A8D] disabled:opacity-70 sm:text-base"
          >
            {isCheckoutPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                <span>Loading…</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Proceed to Checkout
                <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
