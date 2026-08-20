'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useCart, type CartItem } from '@/context/CartContext';
import {
  useEcommerceCheckout,
  type CheckoutAddress,
} from '@/components/customer/ecommerce/useEcommerceCheckout';
import {
  computeCartPricing,
  persistPricingOptionsForCheckout,
  readPricingOptionsForCheckout,
  type CartPricingBreakdown,
  type DeliverySpeed,
} from '@/lib/ecommerce/cart-pricing';
import {
  loadDeliveryAddressesForCheckout,
  pickDefaultDeliveryAddress,
  type DeliveryAddress,
} from '@/lib/ecommerce/load-customer-addresses';
import {
  readCheckoutAddressId,
  writeCheckoutAddressId,
} from '@/lib/ecommerce/checkout-address-storage';
import {
  persistCheckoutOrderResponse,
  type StoredCheckoutOrderResponse,
} from '@/lib/ecommerce/checkout-order-storage';
import { navigateToCheckoutSuccessPage } from '@/lib/navigation/navigation-coordinator';
import { requestLeave } from '@/lib/navigation/leave-guard';
import { createCustomerNavigation } from '@/lib/navigation/navigation-service';
import { computeCartMrpTotal } from '@/lib/ecommerce/cart-product-helpers';

export type CheckoutStep = 'payment' | 'review';

export type CheckoutCoupon = {
  code: string;
  discountAmount: number;
  promotionId?: string;
  /** Which table validated this — 'vendor' (vendor_promotions) or 'admin' (commercial campaigns / legacy platform promos). */
  source?: 'vendor' | 'admin';
};

const VALID_STEPS: CheckoutStep[] = ['payment', 'review'];

function parseStep(raw: string | null): CheckoutStep {
  if (raw === 'review') return 'review';
  if (raw === 'payment') return 'payment';
  /** Legacy URLs — address step removed; address is set on cart. */
  if (raw === 'address') return 'payment';
  return 'payment';
}

function deliveryToCheckoutAddress(addr: DeliveryAddress): CheckoutAddress {
  return {
    id: addr.id,
    name: addr.name,
    fullName: addr.fullName,
    phone: addr.phone,
    street: addr.street,
    addressLine1: addr.addressLine1,
    addressLine2: addr.addressLine2,
    city: addr.city,
    state: addr.state,
    pincode: addr.pincode,
    isDefault: addr.isDefault,
  };
}

function resolveAddressLabel(addr: CheckoutAddress | null): string {
  if (!addr) return 'Address';
  const label = (addr.fullName || addr.name || '').trim();
  if (label) return label;
  return 'Home';
}

type CheckoutContextValue = {
  phone: string;
  step: CheckoutStep;
  cart: CartItem[];
  pricing: CartPricingBreakdown;
  mrpTotal: number;
  savingsAmount: number;
  promotionLabel?: string;
  address: CheckoutAddress | null;
  addressId: string | null;
  addresses: DeliveryAddress[];
  addressesLoading: boolean;
  shippingMethod: DeliverySpeed;
  coupon: CheckoutCoupon | null;
  walletAmountApplied: number;
  setWalletAmountApplied: (amount: number) => void;
  orderResponse: StoredCheckoutOrderResponse | null;
  isPlacingOrder: boolean;
  primaryVendorId: string | undefined;
  setStep: (step: CheckoutStep) => void;
  goNext: () => void;
  goBack: () => void;
  selectAddress: (addr: DeliveryAddress) => void;
  selectShipping: (method: DeliverySpeed) => void;
  applyCoupon: (coupon: CheckoutCoupon) => void;
  removeCoupon: () => void;
  refreshAddresses: () => Promise<void>;
  placeOrder: () => Promise<void>;
  reset: () => void;
  addressLabel: string;
};

const CheckoutContext = createContext<CheckoutContextValue | undefined>(undefined);

type CheckoutProviderProps = {
  phone: string;
  children: ReactNode;
};

export function CheckoutProvider({ phone, children }: CheckoutProviderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nav = useMemo(() => createCustomerNavigation(router), [router]);
  const { cart, clearCart } = useCart();
  const { placeOrder: placeEcommerceOrder } = useEcommerceCheckout();

  const [step, setStepState] = useState<CheckoutStep>(() =>
    parseStep(searchParams.get('step'))
  );
  const [address, setAddress] = useState<CheckoutAddress | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [shippingMethod, setShippingMethod] = useState<DeliverySpeed>('standard');
  const [coupon, setCoupon] = useState<CheckoutCoupon | null>(null);
  const [walletAmountApplied, setWalletAmountApplied] = useState(0);
  const [orderResponse, setOrderResponse] = useState<StoredCheckoutOrderResponse | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const placingRef = useRef(false);

  const primaryVendorId = useMemo(() => {
    const id = cart.find((i) => i.vendorId && i.vendorId !== 'default')?.vendorId;
    return id;
  }, [cart]);

  const pricing = useMemo(() => {
    const persisted = readPricingOptionsForCheckout();
    const codeDiscount = coupon?.discountAmount ?? persisted.sellerPromotion?.codeDiscount ?? 0;
    return computeCartPricing(cart, {
      ...persisted,
      deliverySpeed: shippingMethod,
      itemCount: cart.reduce((s, i) => s + i.quantity, 0),
      sellerPromotion: {
        autoDiscount: persisted.sellerPromotion?.autoDiscount ?? 0,
        codeDiscount,
        label: persisted.sellerPromotion?.label,
        code: coupon?.code ?? persisted.sellerPromotion?.code,
        promotionId: coupon?.promotionId ?? persisted.sellerPromotion?.promotionId,
        source: coupon?.source ?? persisted.sellerPromotion?.source,
      },
    });
  }, [cart, coupon, shippingMethod]);

  const mrpTotal = useMemo(() => computeCartMrpTotal(cart), [cart]);
  const savingsAmount = useMemo(() => Math.max(0, pricing.discount), [pricing.discount]);
  const promotionLabel = useMemo(() => {
    const persisted = readPricingOptionsForCheckout();
    return (
      coupon?.code
        ? `Coupon ${coupon.code}`
        : persisted.sellerPromotion?.label
    );
  }, [coupon?.code]);

  const syncStepToUrl = useCallback(
    (next: CheckoutStep, historyMode: 'push' | 'replace' = 'replace') => {
      setStepState(next);
      const href = `/checkout?step=${next}`;
      if (historyMode === 'push') {
        router.push(href, { scroll: false });
        return;
      }
      router.replace(href, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    const fromUrl = parseStep(searchParams.get('step'));
    setStepState(fromUrl);
  }, [searchParams]);

  const hydrateAddressFromList = useCallback(
    (list: DeliveryAddress[], storedId: string | null) => {
      let picked: DeliveryAddress | null = null;
      if (storedId) {
        picked = list.find((a) => a.id === storedId) ?? null;
      }
      if (!picked) {
        picked = pickDefaultDeliveryAddress(list);
      }
      if (picked?.id) {
        writeCheckoutAddressId(picked.id);
        setAddressId(picked.id);
        setAddress(deliveryToCheckoutAddress(picked));
      } else {
        setAddressId(null);
        setAddress(null);
      }
    },
    []
  );

  const refreshAddresses = useCallback(async () => {
    setAddressesLoading(true);
    try {
      const list = await loadDeliveryAddressesForCheckout(phone || undefined);
      setAddresses(list);
      hydrateAddressFromList(list, readCheckoutAddressId());
    } catch (err) {
      console.error('[checkout] load addresses failed', err);
      setAddresses([]);
    } finally {
      setAddressesLoading(false);
    }
  }, [phone, hydrateAddressFromList]);

  useEffect(() => {
    void refreshAddresses();
  }, [refreshAddresses]);

  useEffect(() => {
    const persisted = readPricingOptionsForCheckout();
    setShippingMethod('standard');
    const sp = persisted.sellerPromotion;
    if (sp?.code && (sp.codeDiscount ?? 0) > 0) {
      setCoupon({
        code: sp.code,
        discountAmount: sp.codeDiscount ?? 0,
        promotionId: sp.promotionId,
        source: sp.source,
      });
    }
  }, []);

  const persistCheckoutOptions = useCallback(() => {
    const persisted = readPricingOptionsForCheckout();
    persistPricingOptionsForCheckout({
      ...persisted,
      deliverySpeed: shippingMethod,
      itemCount: cart.reduce((s, i) => s + i.quantity, 0),
      sellerPromotion: {
        autoDiscount: persisted.sellerPromotion?.autoDiscount ?? 0,
        codeDiscount: coupon?.discountAmount ?? persisted.sellerPromotion?.codeDiscount ?? 0,
        label: persisted.sellerPromotion?.label,
        code: coupon?.code ?? persisted.sellerPromotion?.code,
        promotionId: coupon?.promotionId ?? persisted.sellerPromotion?.promotionId,
        source: coupon?.source ?? persisted.sellerPromotion?.source,
      },
    });
  }, [cart, coupon, shippingMethod]);

  const setStep = useCallback(
    (next: CheckoutStep) => {
      syncStepToUrl(next);
    },
    [syncStepToUrl]
  );

  const goNext = useCallback(() => {
    if (step === 'payment') {
      persistCheckoutOptions();
      // Push so hardware/swipe/browser back from review returns to payment (not /cart).
      syncStepToUrl('review', 'push');
    }
  }, [step, persistCheckoutOptions, syncStepToUrl]);

  const goBack = useCallback(() => {
    void (async () => {
      if (!(await requestLeave())) return;
      if (step === 'review') {
        syncStepToUrl('payment');
        return;
      }
      nav.goToCart({ replace: true });
    })();
  }, [step, syncStepToUrl, nav]);

  const selectAddress = useCallback((addr: DeliveryAddress) => {
    if (addr.id) {
      writeCheckoutAddressId(addr.id);
      setAddressId(addr.id);
    }
    setAddress(deliveryToCheckoutAddress(addr));
    toast.success('Delivery address updated');
  }, []);

  const selectShipping = useCallback(
    (method: DeliverySpeed) => {
      setShippingMethod(method);
      const persisted = readPricingOptionsForCheckout();
      persistPricingOptionsForCheckout({ ...persisted, deliverySpeed: method });
    },
    []
  );

  const applyCoupon = useCallback((next: CheckoutCoupon) => {
    setCoupon(next);
    const persisted = readPricingOptionsForCheckout();
    persistPricingOptionsForCheckout({
      ...persisted,
      sellerPromotion: {
        ...persisted.sellerPromotion,
        codeDiscount: next.discountAmount,
        code: next.code,
        promotionId: next.promotionId,
        source: next.source,
      },
    });
  }, []);

  const removeCoupon = useCallback(() => {
    setCoupon(null);
    const persisted = readPricingOptionsForCheckout();
    persistPricingOptionsForCheckout({
      ...persisted,
      sellerPromotion: {
        ...persisted.sellerPromotion,
        codeDiscount: 0,
        code: undefined,
        promotionId: undefined,
        source: undefined,
      },
    });
  }, []);

  const reset = useCallback(() => {
    setStepState('payment');
    setOrderResponse(null);
    setIsPlacingOrder(false);
  }, []);

  const placeOrder = useCallback(async () => {
    if (placingRef.current || isPlacingOrder) return;
    if (!address) {
      toast.error('Please add a delivery address on the cart page');
      nav.goToCart();
      return;
    }
    if (cart.length === 0) {
      toast.error('Your cart is empty');
      nav.goToCart();
      return;
    }

    persistCheckoutOptions();
    placingRef.current = true;

    try {
      await placeEcommerceOrder({
        phone,
        cart,
        pricing,
        shippingAddress: address,
        onProcessingChange: setIsPlacingOrder,
        clearCart,
        walletAmountApplied,
        onPaymentDismiss: (orderId) => {
          toast.info('Payment not completed. You can pay from My Orders within 5 minutes.');
          nav.afterCheckoutSuccess(orderId);
        },
        onSuccess: (orderId) => {
          const stored: StoredCheckoutOrderResponse = {
            orderId,
            totalAmount: pricing.total,
            phone,
            shippingAddress: address,
            status: 'confirmed',
            paymentMethod: 'online',
            shippingMethod,
          };
          setOrderResponse(stored);
          persistCheckoutOrderResponse(stored);
          toast.success('Order placed successfully!');
          navigateToCheckoutSuccessPage();
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not place order';
      if (message !== 'Payment cancelled') {
        toast.error(message);
      }
    } finally {
      placingRef.current = false;
    }
  }, [
    address,
    cart,
    clearCart,
    persistCheckoutOptions,
    phone,
    placeEcommerceOrder,
    pricing,
    router,
    nav,
    shippingMethod,
    syncStepToUrl,
    isPlacingOrder,
    walletAmountApplied,
  ]);

  const value = useMemo<CheckoutContextValue>(
    () => ({
      phone,
      step,
      cart,
      pricing,
      mrpTotal,
      savingsAmount,
      promotionLabel,
      address,
      addressId,
      addresses,
      addressesLoading,
      shippingMethod,
      coupon,
      walletAmountApplied,
      setWalletAmountApplied,
      orderResponse,
      isPlacingOrder,
      primaryVendorId,
      setStep,
      goNext,
      goBack,
      selectAddress,
      selectShipping,
      applyCoupon,
      removeCoupon,
      refreshAddresses,
      placeOrder,
      reset,
      addressLabel: resolveAddressLabel(address),
    }),
    [
      phone,
      step,
      cart,
      pricing,
      mrpTotal,
      savingsAmount,
      promotionLabel,
      address,
      addressId,
      addresses,
      addressesLoading,
      shippingMethod,
      coupon,
      walletAmountApplied,
      orderResponse,
      isPlacingOrder,
      primaryVendorId,
      setStep,
      goNext,
      goBack,
      selectAddress,
      selectShipping,
      applyCoupon,
      removeCoupon,
      refreshAddresses,
      placeOrder,
      reset,
    ]
  );

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout(): CheckoutContextValue {
  const ctx = useContext(CheckoutContext);
  if (!ctx) {
    throw new Error('useCheckout must be used within CheckoutProvider');
  }
  return ctx;
}
