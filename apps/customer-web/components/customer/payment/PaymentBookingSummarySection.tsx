'use client';

import { useState } from 'react';
import { Calendar, ChevronRight, ChevronUp, Clock, Info, MapPin } from 'lucide-react';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import {
  paymentCategoryPillLabel,
  paymentPetServiceLine,
  paymentServiceStyleIconClass,
} from './payment-display-utils';
import { paymentCardClass } from './payment-page-styles';

export type PaymentBookingSummarySectionProps = {
  summaryTitle: 'Booking Summary' | 'Order Summary';
  displayName: string;
  vendorName?: string;
  displayDescription?: string;
  displayAmount: number;
  displayDuration?: number | null;
  quantity?: number;
  petName?: string;
  serviceStyle?: string;
  category?: string;
  selectedServices?: Array<{
    id?: string;
    serviceId?: string;
    name?: string;
    serviceName?: string;
    price?: number;
    duration?: number;
    serviceStyle?: string;
    service_style?: string;
    description?: string;
  }> | null;
  includedSummary?: string;
  includedItems?: string[];
  bookingDate?: string;
  bookingTime?: string;
  showInlineAddress?: boolean;
  selectedAddress?: {
    label?: string;
    addressLine1?: string;
    address?: string;
    city?: string;
    pincode?: string;
  } | null;
};

function ServiceIconBox({ style }: { style?: string }) {
  return (
    <div
      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-[0_4px_14px_rgba(0,0,0,0.06)] ${paymentServiceStyleIconClass(style)}`}
    >
      {style === 'tele' ? '📱' : style === 'at_home' ? '🏠' : style === 'at_center' ? '🏥' : '🛒'}
    </div>
  );
}

function DurationCategoryPills({
  duration,
  category,
}: {
  duration?: number | null;
  category?: string;
}) {
  const categoryLabel = paymentCategoryPillLabel(category);
  const hasDuration = duration != null && !Number.isNaN(Number(duration)) && Number(duration) > 0;
  if (!hasDuration && !categoryLabel) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {hasDuration ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-3 py-1.5 text-xs font-medium text-gray-600">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {Number(duration)} mins
        </span>
      ) : null}
      {categoryLabel ? (
        <span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-700">
          {categoryLabel}
        </span>
      ) : null}
    </div>
  );
}

function WhatsIncludedCard({
  includedSummary,
  includedItems,
}: {
  includedSummary?: string;
  includedItems?: string[];
}) {
  const items = includedItems?.filter(Boolean) ?? [];
  const summary = includedSummary?.trim();
  if (!summary && items.length === 0) return null;

  const [expanded, setExpanded] = useState(false);
  const preview =
    summary ||
    (items.length > 0 ? items.slice(0, 2).join(', ') + (items.length > 2 ? '…' : '') : '');

  return (
    <button
      type="button"
      onClick={() => setExpanded((e) => !e)}
      className="mt-4 flex w-full items-start gap-3 rounded-[16px] bg-[#FFF4EC] p-4 text-left shadow-[0_4px_16px_rgba(255,140,66,0.08)] transition active:opacity-90"
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#FF8C42]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">What&apos;s included</p>
        {!expanded ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-600">{preview}</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm text-gray-700">
            {summary ? <li>{summary}</li> : null}
            {items.map((item, i) => (
              <li key={`${i}-${item}`}>{item}</li>
            ))}
          </ul>
        )}
      </div>
      {expanded ? (
        <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
      )}
    </button>
  );
}

function ServiceSummaryBlock({
  svcName,
  svcPrice,
  vendorName,
  petLine,
  displayDescription,
  duration,
  category,
  serviceStyle,
}: {
  svcName: string;
  svcPrice: number;
  vendorName?: string;
  petLine: string | null;
  displayDescription?: string;
  duration?: number | null;
  category?: string;
  serviceStyle?: string;
}) {
  return (
    <div className="flex gap-4">
      <ServiceIconBox style={serviceStyle} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-snug text-gray-900">{svcName}</h3>
            {vendorName ? <p className="mt-1 text-sm text-gray-500">{vendorName}</p> : null}
            {petLine ? <p className="mt-0.5 text-sm text-gray-500">{petLine}</p> : null}
            {displayDescription && !petLine ? (
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">{displayDescription}</p>
            ) : null}
          </div>
          <p className="shrink-0 text-xl font-bold tabular-nums text-[#FF8C42]">
            {formatPriceWithSymbol(svcPrice)}
          </p>
        </div>
        <DurationCategoryPills duration={duration} category={category} />
      </div>
    </div>
  );
}

export function PaymentBookingSummarySection({
  summaryTitle,
  displayName,
  vendorName,
  displayDescription,
  displayAmount,
  displayDuration,
  quantity = 1,
  petName,
  serviceStyle,
  category,
  selectedServices,
  includedSummary,
  includedItems,
  bookingDate,
  bookingTime,
  showInlineAddress,
  selectedAddress,
}: PaymentBookingSummarySectionProps) {
  const petLine = paymentPetServiceLine(displayName, petName, displayDescription);
  const isMulti = selectedServices && selectedServices.length > 1;

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-gray-900">{summaryTitle}</h2>
      <div className={`${paymentCardClass} p-5`}>
        {selectedServices && selectedServices.length > 0 ? (
          <div className="space-y-5">
            {selectedServices.map((svc, idx) => {
              const svcName = svc.name || svc.serviceName || 'Service';
              const svcPrice = Number(svc.price) || 0;
              const svcDuration = svc.duration != null ? Number(svc.duration) : null;
              const svcStyle = svc.serviceStyle || svc.service_style || serviceStyle;
              const linePet =
                idx === 0
                  ? paymentPetServiceLine(svcName, petName, svc.description || displayDescription)
                  : null;
              return (
                <div key={svc.id || svc.serviceId || idx} className={idx > 0 ? 'pt-5' : ''}>
                  <ServiceSummaryBlock
                    svcName={svcName}
                    svcPrice={svcPrice}
                    vendorName={idx === 0 ? vendorName : undefined}
                    petLine={linePet}
                    displayDescription={idx === 0 ? displayDescription : undefined}
                    duration={idx === 0 ? (displayDuration ?? svcDuration) : svcDuration}
                    category={idx === 0 ? category : undefined}
                    serviceStyle={svcStyle}
                  />
                </div>
              );
            })}
            {isMulti ? (
              <div className="flex items-center justify-between pt-1 text-base font-bold text-gray-900">
                <span>Subtotal</span>
                <span className="text-[#FF8C42]">{formatPriceWithSymbol(displayAmount)}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <ServiceSummaryBlock
            svcName={displayName}
            svcPrice={displayAmount}
            vendorName={vendorName}
            petLine={petLine}
            displayDescription={displayDescription}
            duration={displayDuration}
            category={category}
            serviceStyle={serviceStyle}
          />
        )}

        {quantity > 1 && !selectedServices?.length ? (
          <p className="mt-2 text-sm text-gray-500">Quantity: {quantity}</p>
        ) : null}

        <WhatsIncludedCard includedSummary={includedSummary} includedItems={includedItems} />

        {bookingDate || bookingTime ? (
          <div className="mt-4 flex items-center gap-3 rounded-[16px] bg-[#FAF6F0] px-3 py-3">
            <Calendar className="h-5 w-5 shrink-0 text-[#FF8C42]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Schedule</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900">
                {bookingDate
                  ? new Date(bookingDate).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })
                  : ''}
                {bookingTime ? ` at ${bookingTime}` : ''}
              </p>
            </div>
          </div>
        ) : null}

        {showInlineAddress && selectedAddress ? (
          <div className="mt-3 flex items-center gap-3 rounded-[16px] bg-[#FAF6F0] px-3 py-3">
            <MapPin className="h-5 w-5 shrink-0 text-[#FF8C42]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Delivery Address
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900">
                {selectedAddress.label || 'Home'}
              </p>
              <p className="text-sm text-gray-500">
                {selectedAddress.addressLine1 || selectedAddress.address}, {selectedAddress.city} -{' '}
                {selectedAddress.pincode}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
