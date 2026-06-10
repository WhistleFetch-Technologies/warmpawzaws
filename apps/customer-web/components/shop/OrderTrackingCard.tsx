'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/shareUtils';

export interface OrderTrackingInfo {
  carrierName?: string | null;
  trackingNumber: string;
  trackingUrl?: string | null;
}

interface OrderTrackingCardProps {
  tracking: OrderTrackingInfo;
  className?: string;
}

export function OrderTrackingCard({ tracking, className = '' }: OrderTrackingCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(tracking.trackingNumber);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`rounded-2xl bg-blue-50/90 p-4 text-sm ${className}`}>
      <p className="text-xs font-semibold text-blue-600">Shipment tracking</p>

      {tracking.carrierName && (
        <p className="mt-2 text-xs text-blue-700">
          Courier: <span className="font-semibold text-blue-900">{tracking.carrierName}</span>
        </p>
      )}

      <div className="mt-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-blue-700">Tracking number</p>
          <p className="break-all font-bold text-blue-900">{tracking.trackingNumber}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-lg border border-blue-200 bg-white p-2 text-blue-700 hover:bg-blue-100 transition"
          title="Copy tracking number"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>

      {tracking.trackingUrl && (
        <div className="mt-3">
          <a
            href={tracking.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline"
          >
            Track shipment
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <p className="mt-1.5 text-xs text-blue-600/90">
            Copy the tracking number above and paste it on the courier site.
          </p>
        </div>
      )}
    </div>
  );
}

const TRACKING_VISIBLE_STATUSES = new Set(['shipped', 'out_for_delivery', 'delivered']);

export function shouldShowOrderTracking(
  status: string,
  trackingNumber?: string | null
): boolean {
  return Boolean(trackingNumber?.trim()) && TRACKING_VISIBLE_STATUSES.has(status);
}

export function resolveOrderTracking(raw: any): OrderTrackingInfo | null {
  const structured = raw.tracking;
  if (structured?.trackingNumber) {
    return {
      carrierName: structured.carrierName,
      trackingNumber: structured.trackingNumber,
      trackingUrl: structured.trackingUrl,
    };
  }

  const trackingNumber = raw.tracking_number?.trim();
  if (!trackingNumber) return null;

  return {
    carrierName: raw.delivery_partner || raw.carrier_name || null,
    trackingNumber,
    trackingUrl: raw.tracking_url || null,
  };
}
