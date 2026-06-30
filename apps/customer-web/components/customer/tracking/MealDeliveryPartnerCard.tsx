'use client';

import { Clock, Truck } from 'lucide-react';
import { DeliveryPartnerCallAction } from '@/components/customer/tracking/DeliveryPartnerCallAction';

export interface MealDeliveryPartnerCardProps {
  riderName: string;
  riderPhone?: string;
  riderPhoto?: string | null;
  vehicleLabel: string;
  etaMinutes?: number | null;
}

export function MealDeliveryPartnerCard({
  riderName,
  riderPhone,
  riderPhoto,
  vehicleLabel,
  etaMinutes,
}: MealDeliveryPartnerCardProps) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
      <h2 className="mb-3 text-base font-bold text-slate-900">Delivery Partner</h2>
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-100 to-teal-50">
          {riderPhoto ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={riderPhoto} alt="" className="h-full w-full object-cover" />
          ) : (
            <Truck className="h-7 w-7 text-teal-600" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{riderName}</p>
          <p className="text-sm text-slate-500">{vehicleLabel}</p>
        </div>
        {riderPhone ? <DeliveryPartnerCallAction phone={riderPhone} variant="pill" /> : null}
      </div>
      {etaMinutes != null && Number.isFinite(Number(etaMinutes)) ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2.5">
          <Clock className="h-4 w-4 shrink-0 text-teal-600" aria-hidden />
          <p className="text-sm font-medium text-teal-900">
            Arriving in ~{Math.round(Number(etaMinutes))} minutes
          </p>
        </div>
      ) : null}
    </section>
  );
}
