'use client';

import { Building2, Home, MapPin, Shield, Video } from 'lucide-react';
import { paymentCardClass } from './payment-page-styles';

const DEFAULT_TAGLINE = 'Trusted care for your furry friend';

export type PaymentProviderSectionProps = {
  vendorName: string;
  vendorAddress?: string;
  staffName?: string;
  staffPhoto?: string;
  serviceStyle?: string;
  vendorTagline?: string;
  vendorIsVerified?: boolean;
};

export function PaymentProviderSection({
  vendorName,
  vendorAddress,
  staffName,
  staffPhoto,
  serviceStyle,
  vendorTagline = DEFAULT_TAGLINE,
  vendorIsVerified,
}: PaymentProviderSectionProps) {
  const showVerified = vendorIsVerified !== false;

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-gray-900">Your provider</h2>
      <div className={`${paymentCardClass} flex min-h-[120px] flex-col justify-center p-5`}>
        <div className="flex gap-4">
          {staffPhoto ? (
            <img
              src={staffPhoto}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-[#FFF0E6] text-[#FF8C42] shadow-[0_4px_16px_rgba(255,140,66,0.15)]">
              {serviceStyle === 'tele' ? (
                <Video className="h-8 w-8" />
              ) : serviceStyle === 'at_center' ? (
                <Building2 className="h-8 w-8" />
              ) : (
                <Home className="h-8 w-8" />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1 py-0.5">
            <p className="text-xl font-bold leading-tight text-gray-900">{vendorName || 'Provider'}</p>
            {vendorTagline ? (
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{vendorTagline}</p>
            ) : null}
            {staffName && staffName.trim() !== (vendorName || '').trim() ? (
              <p className="mt-2 text-sm text-gray-600">Professional: {staffName}</p>
            ) : null}
            {vendorAddress ? (
              <p className="mt-2 flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8C42]" aria-hidden />
                <span>{vendorAddress}</span>
              </p>
            ) : null}
          </div>
        </div>
        {showVerified ? (
          <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
            <Shield className="h-3.5 w-3.5" aria-hidden />
            Verified Provider
          </span>
        ) : null}
      </div>
    </div>
  );
}
