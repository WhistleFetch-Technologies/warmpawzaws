'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';
import {
  ArrowLeft,
  MapPin,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { parseCartLineKey } from '@/lib/product-sku-client';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import {
  computeCartPricing,
  persistPricingOptionsForCheckout,
  readPricingOptionsForCheckout,
} from '@/lib/ecommerce/cart-pricing';
import { CartPromotionSelect, type SelectedCartPromotion } from '@/components/ecommerce/cart/CartPromotionSelect';
import { CartLineQuantityStepper } from '@/components/ecommerce/shared/CartLineQuantityStepper';
import { DeliveryAddressPickerSheet } from '@/components/customer/ecommerce/DeliveryAddressPickerSheet';
import { AddAddressModal } from '@/components/customer/shared/AddAddressModal';
import {
  loadDeliveryAddressesForCheckout,
  pickDefaultDeliveryAddress,
  type DeliveryAddress,
} from '@/lib/ecommerce/load-customer-addresses';
import { deliveryAddressTitle } from '@/lib/ecommerce/delivery-address-display';
import {
  isGuestApplicationState,
  requestGuestAuth,
} from '@/lib/guest-auth-gate';
import { LOCATION_UPDATED_EVENT } from '@/lib/customer-discovery-coords';
import {
  readCheckoutAddressId,
  writeCheckoutAddressId,
} from '@/lib/ecommerce/checkout-address-storage';
import { CheckoutPriceBreakdown } from '@/components/ecommerce/checkout/CheckoutPriceBreakdown';
import {
  ECOMMERCE_RECOMMENDATIONS_LIMIT,
  loadCartRecommendations,
} from '@/lib/ecommerce/load-ecommerce-recommendations';
import { RecommendationProductScroller } from '@/components/ecommerce/shared/RecommendationProductScroller';
import type { ShopProduct } from '@/components/shop/shop-types';
import {
  formatSelectedVariations,
  shopProductToCartItem,
  allocateLinePromotionDiscount,
  cartLineMrpTotal,
} from '@/lib/ecommerce/cart-product-helpers';
import type { CheckoutAddress } from '@/components/customer/ecommerce/useEcommerceCheckout';
import { ECOMMERCE_PAGE_SHELL } from '@/lib/ecommerce/ecommerce-page-shell';
import {
  deliveryBlockMessage,
  deliveryRegionsFromCartItem,
  findUndeliverableCartItems,
} from '@/lib/ecommerce/product-delivery-guard';

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
  const nav = useCustomerNavigation();
  const { cart, itemCount, updateQuantity, removeFromCart, addToCart } = useCart();
  const phone = phoneProp || resolveCustomerPhone();
  const isGuest = isGuestApplicationState();

  const [selectedPromo, setSelectedPromo] = useState<SelectedCartPromotion | null>(null);
  const [autoPromo, setAutoPromo] = useState<{
    discountAmount: number;
    promotionId?: string;
    label?: string;
    source?: 'vendor' | 'admin';
  } | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<DeliveryAddress | null>(null);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [recommendations, setRecommendations] = useState<ShopProduct[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  useEffect(() => {
    const persisted = readPricingOptionsForCheckout();
    const sp = persisted.sellerPromotion;
    if (sp?.code && (sp.codeDiscount ?? 0) > 0) {
      setSelectedPromo({
        code: sp.code,
        discountAmount: sp.codeDiscount ?? 0,
        promotionId: sp.promotionId,
        label: sp.label || sp.code,
        source: sp.source ?? 'vendor',
      });
    }
  }, []);

  const sellerPromotionPricing = useMemo(() => {
    // Best Offer: only the winning offer is priced (auto XOR selected code).
    const autoDiscount = selectedPromo ? 0 : (autoPromo?.discountAmount ?? 0);
    const codeDiscount = selectedPromo?.discountAmount ?? 0;
    if (autoDiscount <= 0 && codeDiscount <= 0) return undefined;
    return {
      autoDiscount,
      codeDiscount,
      label: selectedPromo?.label ?? autoPromo?.label,
      promotionId: selectedPromo?.promotionId ?? autoPromo?.promotionId,
      code: selectedPromo?.code,
      source: selectedPromo ? selectedPromo.source : (autoPromo?.source ?? 'vendor'),
    };
  }, [selectedPromo, autoPromo]);

  const pricing = useMemo(() => {
    const persisted = readPricingOptionsForCheckout();
    return computeCartPricing(cart, {
      ...persisted,
      deliverySpeed: 'standard',
      itemCount,
      sellerPromotion: sellerPromotionPricing,
    });
  }, [cart, itemCount, sellerPromotionPricing]);


  const undeliverableItems = useMemo(
    () => findUndeliverableCartItems(cart, selectedAddress?.city),
    [cart, selectedAddress?.city],
  );
  const hasUndeliverable = undeliverableItems.length > 0;
  const primaryVendorId = useMemo(
    () => cart.find((i) => i.vendorId && i.vendorId !== 'default')?.vendorId,
    [cart]
  );

  const cartPromoItems = useMemo(
    () =>
      cart.map((item) => {
        // Cart line ids are `productId::skuId` for variants; promos match bare product UUIDs.
        const productId =
          parseCartLineKey(item.id).productId ||
          (item.warmpawzLine?.product?.id != null
            ? String(item.warmpawzLine.product.id)
            : item.id);
        return {
          productId,
          id: productId,
          quantity: item.quantity,
          price: item.price,
          categoryId: item.categoryId || item.category,
          category: item.categoryId || item.category,
        };
      }),
    [cart]
  );

  useEffect(() => {
    // Admin/platform campaigns work without vendorId; only skip when cart empty or a manual promo is selected.
    if (cart.length === 0 || selectedPromo) {
      if (!selectedPromo) setAutoPromo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.post<{
          bestPromotion?: {
            id?: string;
            name?: string;
            description?: string;
            calculatedDiscount?: number;
            promotionSource?: 'vendor' | 'admin';
          };
          promotionSource?: 'vendor' | 'admin' | null;
        }>('/promotions/calculate-cart', {
          ...(primaryVendorId ? { vendorId: primaryVendorId } : {}),
          customerId: getResolvedCustomerId() || undefined,
          items: cartPromoItems,
        });
        if (cancelled) return;
        const best = res?.bestPromotion;
        const amount = best?.calculatedDiscount ?? 0;
        const promoSource =
          best?.promotionSource ?? res?.promotionSource ?? undefined;
        if (amount > 0) {
          setAutoPromo({
            discountAmount: amount,
            promotionId: best?.id,
            label: best?.description || best?.name || 'Promotion applied',
            source: promoSource === 'admin' ? 'admin' : 'vendor',
          });
        } else {
          setAutoPromo(null);
        }
      } catch {
        if (!cancelled) setAutoPromo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primaryVendorId, cart.length, cartPromoItems, selectedPromo]);

  const refreshAddresses = useCallback(async () => {
    setAddressesLoading(true);
    try {
      const list = await loadDeliveryAddressesForCheckout(phone || undefined);
      setAddresses(list);
      const storedId = readCheckoutAddressId();
      let picked = storedId ? list.find((a) => a.id === storedId) : null;
      if (!picked) picked = pickDefaultDeliveryAddress(list);
      if (picked?.id) {
        writeCheckoutAddressId(picked.id);
        setSelectedAddress(picked);
      } else {
        setSelectedAddress(null);
      }
    } catch {
      setAddresses([]);
      setSelectedAddress(null);
    } finally {
      setAddressesLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    void refreshAddresses();
  }, [refreshAddresses]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onLocationUpdated = () => {
      void refreshAddresses();
    };
    window.addEventListener(LOCATION_UPDATED_EVENT, onLocationUpdated);
    return () => window.removeEventListener(LOCATION_UPDATED_EVENT, onLocationUpdated);
  }, [refreshAddresses]);

  useEffect(() => {
    if (cart.length === 0) {
      setRecommendations([]);
      return;
    }
    let cancelled = false;

    async function loadRecommendations() {
      setRecsLoading(true);
      try {
        const products = await loadCartRecommendations(
          cart.map((item) => ({
            productId: item.id,
            categoryId: item.categoryId || item.category,
            quantity: item.quantity,
            price: item.price,
          })),
          ECOMMERCE_RECOMMENDATIONS_LIMIT,
        );
        if (cancelled) return;
        const filtered = products.filter((p) => !cart.some((c) => c.id === p.id));
        setRecommendations(filtered);
      } catch {
        if (!cancelled) setRecommendations([]);
      } finally {
        if (!cancelled) setRecsLoading(false);
      }
    }

    void loadRecommendations();
    return () => {
      cancelled = true;
    };
  }, [cart]);

  const handleAddressSelect = (addr: DeliveryAddress) => {
    if (addr.id) writeCheckoutAddressId(addr.id);
    setSelectedAddress(addr);
  };

  const persistPromoForCheckout = useCallback(
    (promo: SelectedCartPromotion | null) => {
      const persisted = readPricingOptionsForCheckout();
      const autoDiscount = promo ? 0 : (autoPromo?.discountAmount ?? 0);
      persistPricingOptionsForCheckout({
        ...persisted,
        itemCount,
        deliverySpeed: 'standard',
        sellerPromotion:
          promo || autoDiscount > 0
            ? {
                autoDiscount,
                codeDiscount: promo?.discountAmount ?? 0,
                label: promo?.label ?? autoPromo?.label,
                code: promo?.code,
                promotionId: promo?.promotionId ?? autoPromo?.promotionId,
                source: promo ? promo.source : (autoPromo?.source ?? 'vendor'),
              }
            : undefined,
      });
    },
    [itemCount, autoPromo]
  );

  useEffect(() => {
    if (!selectedPromo) {
      persistPromoForCheckout(null);
    }
  }, [autoPromo, selectedPromo, persistPromoForCheckout]);

  const handleApplyPromo = async (promo: SelectedCartPromotion) => {
    // Re-run Best Offer with this code so a weaker coupon cannot replace a stronger auto promo.
    try {
      const res = await apiClient.post<{
        bestPromotion?: {
          id?: string;
          name?: string;
          description?: string;
          code?: string;
          calculatedDiscount?: number;
          promotionSource?: 'vendor' | 'admin';
        };
        totalSavings?: number;
        promotionSource?: 'vendor' | 'admin' | null;
      }>('/promotions/calculate-cart', {
        ...(primaryVendorId ? { vendorId: primaryVendorId } : {}),
        customerId: getResolvedCustomerId() || undefined,
        items: cartPromoItems,
        manualCode: promo.code,
      });

      const savings = Number(res?.totalSavings ?? res?.bestPromotion?.calculatedDiscount ?? 0);
      const source: 'vendor' | 'admin' =
        (res?.bestPromotion?.promotionSource ?? res?.promotionSource) === 'admin'
          ? 'admin'
          : 'vendor';
      const best = res?.bestPromotion;
      const codeUpper = promo.code.trim().toUpperCase();
      const bestCode = String(best?.code || '').trim().toUpperCase();
      const wonBySelectedCode =
        savings > 0 &&
        (bestCode === codeUpper ||
          (best?.id != null &&
            promo.promotionId != null &&
            String(best.id) === String(promo.promotionId)) ||
          // Platform coupon payload may omit id match but source+amount align with validate-code.
          (source === promo.source &&
            Math.abs(savings - Number(promo.discountAmount || 0)) <= 1));

      if (!wonBySelectedCode) {
        // Stronger auto (or other) offer wins — keep auto, do not pin the weaker coupon.
        setSelectedPromo(null);
        if (savings > 0) {
          setAutoPromo({
            discountAmount: savings,
            promotionId: best?.id,
            label: best?.description || best?.name || 'Promotion applied',
            source,
          });
          toast.message(
            `Better offer already applied (−₹${Math.round(savings)}). Coupon not used.`
          );
        } else {
          toast.error('Coupon is not the best available offer for this cart');
        }
        persistPromoForCheckout(null);
        return;
      }

      const applied: SelectedCartPromotion = {
        code: promo.code,
        discountAmount: savings,
        promotionId: best?.id ?? promo.promotionId,
        label: best?.description || best?.name || promo.label,
        source,
      };
      setSelectedPromo(applied);
      persistPromoForCheckout(applied);
      toast.success('Coupon applied');
    } catch {
      // Fallback: use validated coupon as selected (server re-validates at order create).
      setSelectedPromo(promo);
      persistPromoForCheckout(promo);
    }
  };

  const handleRemovePromo = () => {
    setSelectedPromo(null);
    persistPromoForCheckout(null);
  };

  const handleProceedCheckout = () => {
    if (!selectedAddress?.id) {
      toast.error('Please add a delivery address before checkout');
      if (!isGuest) setShowAddressPicker(true);
      return;
    }
    if (isGuest) {
      requestGuestAuth({ mode: 'signup', returnPath: '/checkout' });
      return;
    }
    if (hasUndeliverable) {
      const first = undeliverableItems[0];
      toast.error(
        deliveryBlockMessage(
          first.name,
          selectedAddress.city ?? '',
          deliveryRegionsFromCartItem(first),
        ),
      );
      return;
    }
    persistPricingOptionsForCheckout({
      ...readPricingOptionsForCheckout(),
      itemCount,
      deliverySpeed: 'standard',
      sellerPromotion: sellerPromotionPricing,
    });
    nav.goToCheckout({ step: 'payment' });
  };

  const handleAddAddressSuccess = async (newAddress: CheckoutAddress) => {
    setShowAddAddressModal(false);
    await refreshAddresses();
    if (newAddress?.id) {
      handleAddressSelect(newAddress as DeliveryAddress);
    }
  };

  const contentPad = 'pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] lg:pb-8';

  if (cart.length === 0) {
    return (
      <div className={`${ECOMMERCE_PAGE_SHELL} flex flex-col ${contentPad}`}>
        <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 cw-header-safe-x">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => nav.backOr('/shop')}
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
            onClick={() => nav.goToShop({ replace: true })}
            className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white rounded-xl px-8"
          >
            Continue shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${ECOMMERCE_PAGE_SHELL} ${contentPad}`}>
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-sm cw-header-safe-x pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full shrink-0"
            onClick={() => nav.backOr('/shop')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-slate-900 flex-1">
            Cart ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </h1>
        </div>
      </header>

      <div className="px-4 pt-4 lg:px-6 lg:pt-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:items-start">
          <div className="space-y-4 min-w-0">
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
                          {deliveryAddressTitle(selectedAddress)}
                        </p>
                        <p className="text-sm text-slate-600 truncate">
                          {selectedAddress.city}
                          {selectedAddress.city && selectedAddress.pincode ? ', ' : ''}
                          {selectedAddress.pincode}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-amber-700 mt-0.5 font-medium">
                        Add delivery address to checkout
                      </p>
                    )}
                  </div>
                </div>
                {!isGuest && (
                  <button
                    type="button"
                    onClick={() => setShowAddressPicker(true)}
                    className="text-sm font-semibold text-[#FF8C42] shrink-0"
                  >
                    Change
                  </button>
                )}
              </div>
            </section>

            <CartPromotionSelect
              orderAmount={pricing.lineSubtotal}
              vendorId={primaryVendorId}
              cartItems={cartPromoItems}
              customerId={getResolvedCustomerId() || undefined}
              selected={selectedPromo}
              onApply={handleApplyPromo}
              onRemove={handleRemovePromo}
            />

            {!selectedPromo && autoPromo && autoPromo.discountAmount > 0 && (
              <section className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
                <p className="text-sm font-semibold text-emerald-900">{autoPromo.label}</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  −₹{autoPromo.discountAmount.toFixed(0)} auto-applied
                </p>
              </section>
            )}

            <section className="space-y-3">
              {cart.map((item) => {
                const variantLabel = formatSelectedVariations(item.selectedVariations);
                const lineMrp = cartLineMrpTotal(item);
                const lineDiscount = allocateLinePromotionDiscount(
                  lineMrp,
                  pricing.lineSubtotal,
                  pricing.discount,
                );
                const linePayable = Math.max(0, lineMrp - lineDiscount);
                const unitMrp = item.originalPrice ?? item.price;
                const hasPromotion = pricing.discount > 0;
                const undeliverable =
                  Boolean(selectedAddress?.city) &&
                  undeliverableItems.some((u) => u.id === item.id);
                return (
                  <article
                    key={item.id}
                    className={`rounded-2xl border bg-white p-3 shadow-sm flex gap-3 ${
                      undeliverable ? 'border-red-200 bg-red-50/40' : 'border-slate-100'
                    }`}
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
                      {variantLabel && (
                        <p className="text-xs text-slate-500 mt-0.5">{variantLabel}</p>
                      )}
                      {undeliverable && selectedAddress?.city && (
                        <p className="text-xs text-red-600 mt-1 font-medium">
                          {deliveryBlockMessage(
                            item.name,
                            selectedAddress.city,
                            deliveryRegionsFromCartItem(item),
                          )}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {hasPromotion ? (
                          <>
                            <span className="text-xs text-slate-400 tabular-nums">
                              <span className="cw-price-strike">₹{unitMrp}</span> MRP
                            </span>
                            <span className="font-bold text-[#FF8C42] tabular-nums">
                              ₹{(linePayable / item.quantity).toFixed(0)}
                            </span>
                          </>
                        ) : (
                          <span className="font-bold text-[#FF8C42] tabular-nums">
                            ₹{unitMrp}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-2">
                        <CartLineQuantityStepper
                          quantity={item.quantity}
                          onDecrease={() => updateQuantity(item.id, item.quantity - 1)}
                          onIncrease={() => updateQuantity(item.id, item.quantity + 1)}
                          size="sm"
                        />
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

            <RecommendationProductScroller
              products={recommendations}
              loading={recsLoading}
              getCartQuantity={(id) => cart.find((i) => i.id === id)?.quantity ?? 0}
              onAdd={(product) => addToCart(shopProductToCartItem(product))}
              onQuantityChange={(product, quantity) => updateQuantity(product.id, quantity)}
              onProductClick={(product) => nav.goToProduct(product.id)}
            />

            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:hidden">
              <CheckoutPriceBreakdown
                cart={cart}
                pricing={pricing}
                showItems={false}
                promotionLabel={selectedPromo?.label ?? autoPromo?.label}
              />
            </section>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-900 mb-4">Order summary</h2>
              {pricing.discount > 0 && (
                <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-emerald-800">
                    You save ₹{pricing.discount.toFixed(0)} on this order
                  </p>
                  {(selectedPromo?.label ?? autoPromo?.label) ? (
                    <p className="text-xs text-emerald-700 mt-0.5">
                      {selectedPromo?.label ?? autoPromo?.label}
                    </p>
                  ) : null}
                </div>
              )}
              <CheckoutPriceBreakdown
                cart={cart}
                pricing={pricing}
                promotionLabel={selectedPromo?.label ?? autoPromo?.label}
              />
              <Button
                onClick={handleProceedCheckout}
                disabled={!selectedAddress?.id || hasUndeliverable}
                className="w-full mt-4 h-12 bg-[#FF8C42] hover:bg-[#FF7A29] text-white font-semibold rounded-xl disabled:opacity-60"
              >
                {hasUndeliverable
                  ? 'Remove undeliverable items'
                  : 'Proceed to checkout'}
              </Button>
            </div>
          </aside>
        </div>
      </div>

      <div className="fixed left-0 right-0 z-40 border-t border-slate-200 bg-white p-4 lg:hidden mx-auto w-full max-w-customer cw-footer-safe-b bottom-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-600">Total</span>
          <span className="text-lg font-bold text-[#FF8C42]">₹{pricing.total.toFixed(0)}</span>
        </div>
        <Button
          onClick={handleProceedCheckout}
          disabled={!selectedAddress?.id || hasUndeliverable}
          className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A29] text-white font-semibold rounded-xl disabled:opacity-60"
        >
          {!selectedAddress?.id
            ? 'Add address to checkout'
            : hasUndeliverable
              ? 'Remove undeliverable items'
              : 'Proceed to checkout'}
        </Button>
      </div>

      {!isGuest && (
        <>
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
        </>
      )}
    </div>
  );
}
