'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Truck } from 'lucide-react';

interface VendorShipmentTrackingReadOnlyProps {
  carrierName?: string | null;
  trackingNumber: string;
  trackingUrl?: string | null;
  className?: string;
}

export function VendorShipmentTrackingReadOnly({
  carrierName,
  trackingNumber,
  trackingUrl,
  className = '',
}: VendorShipmentTrackingReadOnlyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className={`rounded-xl border border-purple-100 bg-purple-50/80 p-4 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-purple-800 mb-3">
        <Truck className="w-4 h-4" />
        Shipment tracking
        <span className="text-xs font-normal text-purple-600">(submitted — cannot be edited)</span>
      </div>

      {carrierName && (
        <div className="mb-2">
          <p className="text-xs text-purple-600">Courier</p>
          <p className="text-sm font-medium text-purple-900">{carrierName}</p>
        </div>
      )}

      <div className="mb-2">
        <p className="text-xs text-purple-600">Tracking number</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-sm font-bold text-purple-900 break-all">{trackingNumber}</p>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 p-1.5 rounded-lg bg-white border border-purple-200 text-purple-700 hover:bg-purple-100 transition"
            title="Copy tracking number"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {trackingUrl && (
        <a
          href={trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-700 hover:text-purple-900 underline-offset-2 hover:underline"
        >
          Track shipment
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}
