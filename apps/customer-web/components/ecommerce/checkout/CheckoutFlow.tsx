'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCheckout } from '@/context/CheckoutProvider';
import { readCheckoutOrderResponse } from '@/lib/ecommerce/checkout-order-storage';
import { CheckoutStepper } from './CheckoutStepper';
import { CheckoutOrderSummary } from './CheckoutOrderSummary';
import { CheckoutPaymentStep } from './CheckoutPaymentStep';
import { CheckoutReviewStep } from './CheckoutReviewStep';
import { ECOMMERCE_PAGE_SHELL } from '@/lib/ecommerce/ecommerce-page-shell';
import { registerCheckoutUrlBackHandler } from '@/lib/navigation/back-handler-registry';
import { navigateToCheckoutSuccessPage } from '@/lib/navigation/navigation-coordinator';
import { registerLeaveGuard } from '@/lib/navigation/leave-guard';

export function CheckoutFlow() {
  const { step, goBack, cart, isPlacingOrder } = useCheckout();

  useEffect(() => {
    return registerCheckoutUrlBackHandler(goBack);
  }, [goBack]);

  useEffect(() => {
    const removePlacing = registerLeaveGuard({
      id: 'checkout-placing-order',
      canLeave: () => !isPlacingOrder,
      confirmLeave: () => {
        toast.error('Please wait — your order is being placed.');
        return false;
      },
    });
    const removePayment = registerLeaveGuard({
      id: 'checkout-payment-step',
      canLeave: () => step !== 'payment' || isPlacingOrder,
      confirmLeave: () =>
        window.confirm(
          'Leave payment? You will return to your cart. Your delivery address and items are saved.',
        ),
    });
    return () => {
      removePlacing();
      removePayment();
    };
  }, [step, isPlacingOrder]);

  // Payment succeeded but cart was cleared before route change — send to success page
  useEffect(() => {
    if (cart.length > 0 || isPlacingOrder) return;
    const stored = readCheckoutOrderResponse();
    if (stored?.orderId) {
      navigateToCheckoutSuccessPage();
    }
  }, [cart.length, isPlacingOrder]);

  if (cart.length === 0) {
    const pendingOrder = typeof window !== 'undefined' ? readCheckoutOrderResponse() : null;
    if (pendingOrder?.orderId || isPlacingOrder) {
      return (
        <div className={`${ECOMMERCE_PAGE_SHELL} flex items-center justify-center`}>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-[#FF8C42]" />
        </div>
      );
    }

    return (
      <div className={`${ECOMMERCE_PAGE_SHELL} flex flex-col`}>
        <header className="bg-white border-b border-slate-100 px-4 py-4 cw-header-safe-x">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goBack} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold text-slate-900">Checkout</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <p className="text-slate-600 mb-4">Your cart is empty.</p>
            <Button onClick={goBack} className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white">
              Back to cart
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${ECOMMERCE_PAGE_SHELL} pb-8`}>
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-sm cw-header-safe-x pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="rounded-full shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-slate-900">Checkout</h1>
        </div>
        <div className="px-4 pb-4">
          <CheckoutStepper current={step} />
        </div>
      </header>

      <div className="px-4 pt-4 lg:px-6 lg:pt-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:items-start">
          <main className="min-w-0">
            {step === 'payment' && <CheckoutPaymentStep />}
            {step === 'review' && <CheckoutReviewStep />}
          </main>
          <div className="hidden lg:block mt-0">
            <CheckoutOrderSummary sticky />
          </div>
        </div>
      </div>
    </div>
  );
}
