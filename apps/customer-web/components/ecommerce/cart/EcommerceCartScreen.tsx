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
  loadCustomerDeliveryAddresses,
  pickDefaultDeliveryAddress,
  type DeliveryAddress,
} from '@/lib/ecommerce/load-customer-addresses';
import {
  readCheckoutAddressId,
  writeCheckoutAddressId,
} from '@/lib/ecommerce/checkout-address-storage';
import { CheckoutPriceBreakdown } from '@/components/ecommerce/checkout/CheckoutPriceBreakdown';
import { mapApiProductsList } from '@/components/shop/map-shop-product';
import type { ShopProduct } from '@/components/shop/shop-types';
import {
  formatSelectedVariations,
  shopProductToCartItem,
  computeCartMrpTotal,
} from '@/lib/ecommerce/cart-product-helpers';
import type { CheckoutAddress } from '@/components/customer/ecommerce/useEcommerceCheckout';
import { ApiError } from '@/lib/error-handling';
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

function CartRecommendationTile({
  product,
  onAdd,
}: {
  product: ShopProduct;
  onAdd: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const primaryImage =
    product.images?.length && product.images[0] && !imageFailed
      ? String(product.images[0]).trim()
      : '';

  useEffect(() => {
    setImageFailed(false);
  }, [product.id, product.images?.[0]]);

  return (
    <div className="snap-start shrink-0 w-36 rounded-xl border border-slate-100 p-2">
      <div className="w-full aspect-square rounded-lg bg-slate-50 flex items-center justify-center text-2xl mb-2 overflow-hidden">
        {primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryImage}
            alt={product.name}
            className="w-full h-full object-cover rounded-lg"
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="text-2xl">{product.emoji || '🐾'}</span>
        )}
      </div>
      <p className="text-xs font-medium text-slate-900 line-clamp-2 min-h-[2.5rem]">
        {product.name}
      </p>
      <p className="text-sm font-bold text-[#FF8C42] mt-1">₹{product.price}</p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 w-full text-xs font-semibold py-1.5 rounded-lg border border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
      >
        Add
      </button>
    </div>
  );
}

export function EcommerceCartScreen({ phone: phoneProp }: EcommerceCartScreenProps) {
  const nav = useCustomerNavigation();
  const { cart, itemCount, updateQuantity, removeFromCart, addToCart } = useCart();
  const phone = phoneProp || resolveCustomerPhone();

  const [selectedPromo, setSelectedPromo] = useState<SelectedCartPromotion | null>(null);
  const [autoPromo, setAutoPromo] = useState<{
    discountAmount: number;
    promotionId?: string;
    label?: string;
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
      });
    }
  }, []);

  const sellerPromotionPricing = useMemo(() => {
    const autoDiscount = selectedPromo ? 0 : (autoPromo?.discountAmount ?? 0);
    const codeDiscount = selectedPromo?.discountAmount ?? 0;
    if (autoDiscount <= 0 && codeDiscount <= 0) return undefined;
    return {
      autoDiscount,
      codeDiscount,
      label: selectedPromo?.label ?? autoPromo?.label,
      promotionId: selectedPromo?.promotionId ?? autoPromo?.promotionId,
      code: selectedPromo?.code,
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

  const mrpTotal = useMemo(() => computeCartMrpTotal(cart), [cart]);
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
      cart.map((item) => ({
        productId: item.id,
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        categoryId: item.categoryId || item.category,
        category: item.categoryId || item.category,
      })),
    [cart]
  );

  useEffect(() => {
    if (!primaryVendorId || cart.length === 0 || selectedPromo) {
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
          };
        }>('/promotions/calculate-cart', {
          vendorId: primaryVendorId,
          customerId: getResolvedCustomerId() || undefined,
          items: cartPromoItems,
        });
        if (cancelled) return;
        const best = res?.bestPromotion;
        const amount = best?.calculatedDiscount ?? 0;
        if (amount > 0) {
          setAutoPromo({
            discountAmount: amount,
            promotionId: best?.id,
            label: best?.description || best?.name || 'Promotion applied',
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

  useEffect(() => {
    if (cart.length === 0) {
      setRecommendations([]);
      return;
    }
    let cancelled = false;

    async function loadRecommendations() {
      setRecsLoading(true);
      try {
        let products: ShopProduct[] = [];
        try {
          const res = await apiClient.post<{ products?: unknown[] }>(
            '/ecommerce/cart/recommendations',
            {
              items: cart.map((item) => ({
                productId: item.id,
                categoryId: item.categoryId || item.category,
                quantity: item.quantity,
                price: item.price,
              })),
              limit: 5,
            }
          );
          products = mapApiProductsList(res?.products ?? []);
        } catch (err) {
          const is404 = err instanceof ApiError && err.statusCode === 404;
          if (!is404) throw err;
          const anchorId = cart[0]?.id;
          if (anchorId) {
            const fallback = await apiClient.get<{ products?: unknown[] }>(
              `/products/${anchorId}/also-bought?limit=5`
            );
            products = mapApiProductsList(fallback?.products ?? []);
          }
        }
        if (cancelled) return;
        const filtered = products.filter((p) => !cart.some((c) => c.id === p.id));
        setRecommendations(filtered.slice(0, 5));
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

  const handleApplyPromo = (promo: SelectedCartPromotion) => {
    setSelectedPromo(promo);
    persistPromoForCheckout(promo);
  };

  const handleRemovePromo = () => {
    setSelectedPromo(null);
    persistPromoForCheckout(null);
  };

  const handleProceedCheckout = () => {
    if (!selectedAddress?.id) {
      toast.error('Please add a delivery address before checkout');
      setShowAddressPicker(true);
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
              onClick={() => nav.goToShop({ replace: true })}
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
            onClick={() => nav.goToShop({ replace: true })}
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
                          {selectedAddress.fullName || selectedAddress.name || 'Home'}
                        </p>
                        <p className="text-sm text-slate-600 truncate">
                          {selectedAddress.city}, {selectedAddress.pincode}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-amber-700 mt-0.5 font-medium">
                        Add delivery address to checkout
                      </p>
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
                const showMrp =
                  item.originalPrice != null && item.originalPrice > item.price;
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
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-bold text-[#FF8C42]">₹{item.price}</span>
                        {showMrp && (
                          <span className="text-xs text-slate-400 line-through">
                            ₹{item.originalPrice}
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

            {(recsLoading || recommendations.length > 0) && (
              <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <h2 className="font-semibold text-slate-900 mb-3">You may also like</h2>
                {recsLoading ? (
                  <p className="text-sm text-slate-400">Loading suggestions…</p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                    {recommendations.map((product) => (
                      <CartRecommendationTile
                        key={product.id}
                        product={product}
                        onAdd={() => addToCart(shopProductToCartItem(product))}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:hidden">
              <CheckoutPriceBreakdown cart={cart} pricing={pricing} showItems={false} />
            </section>
          </div>

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
