'use client';

import { MapPin, Phone, User } from 'lucide-react';
import {
  formatMealOrderDeliveryAddress,
  resolveMealTrackingCustomer,
} from '@/lib/meal-order-tracking-details';

export function MealDeliveryAddressCard({
  order,
  customer,
}: {
  order: Record<string, unknown>;
  customer?: Record<string, unknown> | null;
}) {
  const profile = resolveMealTrackingCustomer(order, customer);
  const addressText = formatMealOrderDeliveryAddress(order);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
      <h2 className="mb-3 text-base font-bold text-slate-900">Delivery Address</h2>
      <div className="space-y-3">
        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-sm leading-relaxed text-slate-700">
            {addressText || 'Address not available'}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span className="font-medium text-slate-900">{profile.name}</span>
          </div>
          {profile.phone ? (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <a href={`tel:${profile.phone}`} className="font-medium text-emerald-700 hover:underline">
                {profile.phone}
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
