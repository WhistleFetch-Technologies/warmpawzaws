'use client';

import React from 'react';
import {
  formatMealOrderCustomerDelivery,
  formatMealSchedulingInstant,
} from '@/lib/format-meal-order-schedule';
import { vendorMealPrepSchedulingFromOrder } from '@/lib/vendor-meal-prep-scheduling';

type Props = {
  order: Record<string, unknown>;
  /** When true, show post-prep fields (prep started, expected ready). */
  showAfterPrep?: boolean;
  className?: string;
};

export function VendorMealPrepScheduleInfo({ order, showAfterPrep, className = '' }: Props) {
  const scheduling = vendorMealPrepSchedulingFromOrder(order);
  const prepStarted = order.prep_started_at != null && String(order.prep_started_at).trim() !== '';
  const expectedReady = order.expected_ready_at;
  const afterPrep = showAfterPrep ?? prepStarted;

  if (!scheduling.commitment_at_ms && !scheduling.recommended_prepare_at_ms && !afterPrep) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-600 space-y-1 ${className}`}
    >
      <p>
        <span className="font-medium text-slate-700">Customer Delivery: </span>
        {formatMealOrderCustomerDelivery(order)}
      </p>
      <p>
        <span className="font-medium text-slate-700">Prep Time: </span>
        {scheduling.prep_minutes} mins
      </p>
      {afterPrep ? (
        <>
          {prepStarted && (
            <p>
              <span className="font-medium text-slate-700">Prep Started: </span>
              {formatMealSchedulingInstant(String(order.prep_started_at))}
            </p>
          )}
          {(expectedReady != null && String(expectedReady).trim() !== '') && (
            <p>
              <span className="font-medium text-slate-700">Expected Ready: </span>
              {formatMealSchedulingInstant(String(expectedReady))}
            </p>
          )}
        </>
      ) : (
        <>
          {scheduling.recommended_prepare_at_iso && (
            <p>
              <span className="font-medium text-slate-700">Suggested Start Preparing: </span>
              {formatMealSchedulingInstant(scheduling.recommended_prepare_at_iso)}
              {scheduling.isEarlyPrep && (
                <span className="ml-1 text-amber-700">(earlier than recommended)</span>
              )}
            </p>
          )}
          {scheduling.expected_ready_before_start_iso && (
            <p>
              <span className="font-medium text-slate-700">Expected Ready Time: </span>
              {formatMealSchedulingInstant(scheduling.expected_ready_before_start_iso)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
