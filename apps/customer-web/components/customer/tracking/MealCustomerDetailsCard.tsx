'use client';

import { useEffect, useState } from 'react';
import { MapPin, Phone, User } from 'lucide-react';
import { formatMealOrderDeliveryAddress, resolveMealTrackingCustomer } from '@/lib/meal-order-tracking-details';

export function MealCustomerDetailsCard({
  order,
  customer,
}: {
  order: Record<string, unknown>;
  customer?: Record<string, unknown> | null;
}) {
  const profile = resolveMealTrackingCustomer(order, customer);
  const addressText = formatMealOrderDeliveryAddress(order);
  const initial = profile.name.trim().charAt(0).toUpperCase() || 'C';
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    setPhotoFailed(false);
  }, [profile.photoUrl]);

  const showPhoto = Boolean(profile.photoUrl) && !photoFailed;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100/80 p-5">
      <h2 className="text-base font-bold text-slate-900 mb-4">Customer details</h2>
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-100 to-emerald-50 flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-white shadow-sm">
          {showPhoto ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profile.photoUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <span className="text-lg font-bold text-teal-700">{initial}</span>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Name</p>
              <p className="text-sm font-semibold text-slate-900">{profile.name}</p>
            </div>
          </div>
          {profile.phone ? (
            <div className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Phone</p>
                <a href={`tel:${profile.phone}`} className="text-sm font-medium text-teal-700 hover:underline">
                  {profile.phone}
                </a>
              </div>
            </div>
          ) : null}
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Delivery address</p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {addressText || 'Address not available'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
