'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import {
  computeCartPricing,
  persistPricingOptionsForCheckout,
  readPricingOptionsForCheckout,
  VENDOR_DELIVERY_CONFIG,
} from '@/lib/ecommerce/cart-pricing';
import { CartPromotionsBanner } from '@/components/customer/shared/CartPromotionsBanner';
import { DeliveryAddressPickerSheet } from '@/components/customer/ecommerce/DeliveryAddressPickerSheet';
import { AddAddressModal } from '@/components/customer/shared/AddAddressModal';
import {
  loadCustomerDeliveryAddresses,
  pickDefaultDeliveryAddress,
  type DeliveryAddress,
} from '@/lib/ecommerce/load-customer-addresses';
import {
  readCheckoutAddressId,
  writeCheckoutAddressId,
} from '@/lib/ecommerce/checkout-address-storage';
import { CheckoutPriceBreakdown } from '@/components/ecommerce/checkout/CheckoutPriceBreakdown';
import { apiClient } from '@/lib/api-client';
import { mapApiProductsList } from '@/components/shop/map-shop-product';
import type { ShopProduct } from '@/components/shop/shop-types';
import {
  formatSelectedVariations,
  shopProductToCartItem,
  computeCartMrpTotal,
} from '@/lib/ecommerce/cart-product-helpers';
import type { CheckoutAddress } from '@/components/customer/ecommerce/useEcommerceCheckout';
import { goBackOrReplace } from '@/lib/go-back-or-replace';
import type { CartPromotionResult } from '@/lib/promotions-engine';

type EcommerceCartScreenProps = {
  phone: string;
};

function resolveCustomerPhone(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('customerPhone') ||
    localStorage.getItem('customer_phone') ||
    ''
  );
}

export function EcommerceCartScreen({ phone: phoneProp }: EcommerceCartScreenProps) {
  const router = useRouter();
  const { cart, itemCount, updateQuantity, removeFromCart, addToCart } = useCart();
  const phone = phoneProp || resolveCustomerPhone();

  const [promotionResult, setPromotionResult] = useState<CartPromotionResult | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<DeliveryAddress | null>(null);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [recommendations, setRecommendations] = useState<ShopProduct[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  const sellerPromotionPricing = useMemo(() => {
    if (!promotionResult?.totalSavings) return undefined;
    const main = promotionResult.appliedPromotions[0];
    return {
      autoDiscount: promotionResult.totalSavings,
      label: main?.description || main?.promotion?.name,
      promotionId: main?.promotion?.id,
      code: main?.promotion?.code,
    };
  }, [promotionResult]);

  const pricing = useMemo(() => {
    const persisted = readPricingOptionsForCheckout();
    return computeCartPricing(cart, {
      ...persisted,
      itemCount,
      sellerPromotion: sellerPromotionPricing,
    });
  }, [cart, itemCount, sellerPromotionPricing]);

  const mrpTotal = useMemo(() => computeCartMrpTotal(cart), [cart]);
  const primaryVendorId = useMemo(
    () => cart.find((i) => i.vendorId && i.vendorId !== 'default')?.vendorId ?? 'default',
    [cart]
  );
  const freeDeliveryMin =
    VENDOR_DELIVERY_CONFIG[primaryVendorId]?.freeDeliveryMin ??
    VENDOR_DELIVERY_CONFIG.default.freeDeliveryMin;
  const freeDeliveryProgress = useMemo(() => {
    if (pricing.freeDeliveryGap <= 0) return 100;
    const subtotal =
      pricing.byVendor.find((v) => v.vendorId === primaryVendorId)?.subtotal ??
      pricing.lineSubtotal;
    return Math.min(100, Math.round((subtotal / freeDeliveryMin) * 100));
  }, [pricing, primaryVendorId, freeDeliveryMin]);

  const refreshAddresses = useCallback(async () => {
    if (!phone) {
      setAddresses([]);
      setAddressesLoading(false);
      return;
    }
    setAddressesLoading(true);
    try {
      const list = await loadCustomerDeliveryAddresses(phone);
      setAddresses(list);
      const storedId = readCheckoutAddressId();
      let picked = storedId ? list.find((a) => a.id === storedId) : null;
      if (!picked) picked = pickDefaultDeliveryAddress(list);
      if (picked?.id) {
        writeCheckoutAddressId(picked.id);
        setSelectedAddress(picked);
      }
    } catch {
      setAddresses([]);
    } finally {
      setAddressesLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    void refreshAddresses();
  }, [refreshAddresses]);

  const firstProductId = cart[0]?.id;

  useEffect(() => {
    if (!firstProductId) {
      setRecommendations([]);
      return;
    }
    let cancelled = false;
    setRecsLoading(true);
    apiClient
      .get<{ products?: unknown[] }>(`/products/${firstProductId}/also-bought`)
      .then((res) => {
        if (cancelled) return;
        const mapped = mapApiProductsList(res?.products ?? []).filter(
          (p) => !cart.some((c) => c.id === p.id)
        );
        setRecommendations(mapped.slice(0, 6));
      })
      .catch(() => {
        if (!cancelled) setRecommendations([]);
      })
      .finally(() => {
        if (!cancelled) setRecsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [firstProductId, cart]);

  const handleAddressSelect = (addr: DeliveryAddress) => {
    if (addr.id) writeCheckoutAddressId(addr.id);
    setSelectedAddress(addr);
  };

  const handleProceedCheckout = () => {
    persistPricingOptionsForCheckout({
      ...readPricingOptionsForCheckout(),
      itemCount,
      sellerPromotion: sellerPromotionPricing,
    });
    router.push('/checkout?step=address');
  };

  const handleAddAddressSuccess = async (newAddress: CheckoutAddress) => {
    setShowAddAddressModal(false);
    await refreshAddresses();
    if (newAddress?.id) {
      handleAddressSelect(newAddress as DeliveryAddress);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#F2F4F7] max-w-customer mx-auto flex flex-col">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 cw-header-safe-x">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => goBackOrReplace(router, '/shop')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold text-slate-900">Cart</h1>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-24 h-24 rounded-full bg-orange-100 flex items-center justify-center mb-4">
            <ShoppingBag className="w-12 h-12 text-[#FF8C42]" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Your cart is empty</h2>
          <p className="text-slate-500 mt-2 mb-6 max-w-xs">
            Browse the shop and add products for your pet.
          </p>
          <Button
            onClick={() => router.replace('/shop')}
            className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white rounded-xl px-8"
          >
            Continue shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F4F7] max-w-customer mx-auto w-full pb-28">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-sm cw-header-safe-x pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full shrink-0"
            onClick={() => goBackOrReplace(router, '/shop')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-slate-900 flex-1">
            Cart ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </h1>
        </div>
      </header>

      <div className="px-4 pt-4 lg:px-6 lg:pt-6">
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start">
          <div className="space-y-4 min-w-0">
            {/* Delivery address */}
            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex gap-3 min-w-0">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-[#FF8C42]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Deliver to
                    </p>
                    {addressesLoading ? (
                      <p className="text-sm text-slate-400 mt-0.5">Loading…</p>
                    ) : selectedAddress ? (
                      <>
                        <p className="font-semibold text-slate-900 truncate">
                          {selectedAddress.fullName || selectedAddress.name || 'Home'}
                        </p>
                        <p className="text-sm text-slate-600 truncate">
                          {selectedAddress.city}, {selectedAddress.pincode}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500 mt-0.5">Add delivery address</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddressPicker(true)}
                  className="text-sm font-semibold text-[#FF8C42] shrink-0"
                >
                  Change
                </button>
              </div>
            </section>

            {/* Free delivery progress */}
            {pricing.freeDeliveryGap > 0 ? (
              <section className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm font-medium text-emerald-800">
                    Add ₹{Math.ceil(pricing.freeDeliveryGap)} more for free delivery
                  </p>
                </div>
                <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${freeDeliveryProgress}%` }}
                  />
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-800">You&apos;ve unlocked free delivery</p>
              </section>
            )}

            <CartPromotionsBanner
              items={cart.map((item) => ({
                id: item.id,
                productId: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                vendorId: item.vendorId,
                categoryId: item.categoryId,
              }))}
              vendorId={primaryVendorId !== 'default' ? primaryVendorId : undefined}
              onPromotionApplied={setPromotionResult}
            />

            {/* Line items */}
            <section className="space-y-3">
              {cart.map((item) => {
                const variantLabel = formatSelectedVariations(item.selectedVariations);
                const showMrp =
                  item.originalPrice != null && item.originalPrice > item.price;
                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm flex gap-3"
                  >
                    <div className="w-20 h-20 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                      {item.image && item.image.startsWith('http') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl">{item.image || '📦'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <h3 className="font-medium text-slate-900 line-clamp-2 text-sm leading-snug">
                        {item.name}
                      </h3>
                      {item.vendorName && (
                        <p className="text-xs text-slate-500 mt-0.5">{item.vendorName}</p>
                      )}
                      {variantLabel && (
                        <p className="text-xs text-slate-500 mt-0.5">{variantLabel}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-bold text-[#FF8C42]">₹{item.price}</span>
                        {showMrp && (
                          <span className="text-xs text-slate-400 line-through">
                            ₹{item.originalPrice}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-2">
                        <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-l-lg"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-r-lg"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          aria-label="Remove item"
                          onClick={() => removeFromCart(item.id)}
                          className="p-2 text-slate-400 hover:text-red-500 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            {/* Recommendations */}
            {(recsLoading || recommendations.length > 0) && (
              <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <h2 className="font-semibold text-slate-900 mb-3">You may also like</h2>
                {recsLoading ? (
                  <p className="text-sm text-slate-400">Loading suggestions…</p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                    {recommendations.map((product) => (
                      <div
                        key={product.id}
                        className="snap-start shrink-0 w-36 rounded-xl border border-slate-100 p-2"
                      >
                        <div className="w-full aspect-square rounded-lg bg-slate-50 flex items-center justify-center text-2xl mb-2">
                          {product.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.images[0]}
                              alt=""
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            product.emoji || '🐾'
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-900 line-clamp-2 min-h-[2.5rem]">
                          {product.name}
                        </p>
                        <p className="text-sm font-bold text-[#FF8C42] mt-1">₹{product.price}</p>
                        <button
                          type="button"
                          onClick={() => addToCart(shopProductToCartItem(product))}
                          className="mt-2 w-full text-xs font-semibold py-1.5 rounded-lg border border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Mobile summary */}
            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:hidden">
              <button
                type="button"
                onClick={handleProceedCheckout}
                className="w-full flex items-center justify-between py-2 mb-3 border-b border-slate-100"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Tag className="w-4 h-4 text-[#FF8C42]" />
                  Coupons applied at checkout
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
              <CheckoutPriceBreakdown cart={cart} pricing={pricing} showItems={false} />
            </section>
          </div>

          {/* Desktop sticky summary */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-900 mb-4">Order summary</h2>
              {mrpTotal > pricing.total && (
                <p className="text-sm text-emerald-600 font-medium mb-3">
                  You save ₹{(mrpTotal - pricing.total).toFixed(0)}
                </p>
              )}
              <CheckoutPriceBreakdown cart={cart} pricing={pricing} />
              <Button
                onClick={handleProceedCheckout}
                className="w-full mt-4 h-12 bg-[#FF8C42] hover:bg-[#FF7A29] text-white font-semibold rounded-xl"
              >
                Proceed to checkout
              </Button>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white p-4 lg:hidden max-w-customer mx-auto cw-footer-safe-b">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-600">Total</span>
          <span className="text-lg font-bold text-[#FF8C42]">₹{pricing.total.toFixed(0)}</span>
        </div>
        <Button
          onClick={handleProceedCheckout}
          className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A29] text-white font-semibold rounded-xl"
        >
          Proceed to checkout
        </Button>
      </div>

      <DeliveryAddressPickerSheet
        open={showAddressPicker}
        onClose={() => setShowAddressPicker(false)}
        addresses={addresses}
        selectedAddress={selectedAddress}
        onSelect={handleAddressSelect}
        onAddNew={() => {
          setShowAddressPicker(false);
          setShowAddAddressModal(true);
        }}
        onManageAddresses={() => setShowAddressPicker(false)}
        loading={addressesLoading}
        phone={phone}
      />

      <AddAddressModal
        phone={phone}
        isOpen={showAddAddressModal}
        onClose={() => setShowAddAddressModal(false)}
        onSuccess={handleAddAddressSuccess}
        customerName={selectedAddress?.fullName || selectedAddress?.name || ''}
      />
    </div>
  );
}
