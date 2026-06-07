'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCheckout } from '@/context/CheckoutProvider';
import { CheckoutStepper } from './CheckoutStepper';
import { CheckoutOrderSummary } from './CheckoutOrderSummary';
import { CheckoutAddressStep } from './CheckoutAddressStep';
import { CheckoutPaymentStep } from './CheckoutPaymentStep';
import { CheckoutReviewStep } from './CheckoutReviewStep';

export function CheckoutFlow() {
  const { step, goBack, cart } = useCheckout();

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#F2F4F7] flex flex-col max-w-customer mx-auto">
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
    <div className="min-h-screen bg-[#F2F4F7] pb-8 max-w-customer mx-auto w-full">
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
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start">
          <main className="min-w-0">
            {step === 'address' && <CheckoutAddressStep />}
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
