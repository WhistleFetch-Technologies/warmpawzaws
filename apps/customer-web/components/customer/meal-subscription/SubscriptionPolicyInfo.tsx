'use client';

import { Info } from 'lucide-react';

export function SubscriptionPolicyInfo() {
  return (
    <div className="rounded-xl border border-teal-100 bg-teal-50/80 px-4 py-3 text-sm text-teal-950">
      <div className="flex gap-2">
        <Info className="w-5 h-5 shrink-0 text-teal-700 mt-0.5" />
        <div className="space-y-2 leading-relaxed">
          <p className="font-semibold">Pause &amp; reschedule</p>
          <p className="text-teal-900/90">
            You can pause active subscriptions, skip an upcoming delivery, or reschedule from &quot;My meal
            subscriptions&quot;. Vendor preparation windows may apply — changes are subject to vendor acceptance.
          </p>
          <p className="font-semibold pt-1">Delivery fees</p>
          <p className="text-teal-900/90">
            Fees shown are estimates per delivery based on your address. Final charges follow Warmpawz meal checkout
            rules for your zone.
          </p>
        </div>
      </div>
    </div>
  );
}
