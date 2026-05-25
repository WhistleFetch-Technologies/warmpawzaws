'use client';

import { useState } from 'react';
import { Phone } from 'lucide-react';

function normalizeTelHref(phone: string): string {
  const trimmed = phone.trim();
  const cleaned = trimmed.replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  return cleaned.startsWith('+') ? cleaned : cleaned.replace(/^0+/, '');
}

/** Human-readable label (India 10-digit friendly). */
export function formatDeliveryPartnerPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone.trim();
}

type Variant = 'pill' | 'icon';

export function DeliveryPartnerCallAction({
  phone,
  variant = 'pill',
  className = '',
}: {
  phone: string;
  variant?: Variant;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const tel = normalizeTelHref(phone);
  const display = formatDeliveryPartnerPhone(phone);

  if (!tel) return null;

  const openDialer = () => {
    setRevealed(true);
    if (typeof window !== 'undefined') {
      window.location.href = `tel:${tel}`;
    }
  };

  if (variant === 'icon') {
    return (
      <div className={`flex flex-col items-end gap-1 shrink-0 ${className}`}>
        {revealed ? (
          <p className="text-sm font-semibold text-slate-900 tabular-nums">{display}</p>
        ) : null}
        <button
          type="button"
          onClick={openDialer}
          className="p-3 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 transition shrink-0"
          aria-label={`Call delivery partner${revealed ? `, ${display}` : ''}`}
        >
          <Phone className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-stretch gap-2 shrink-0 min-w-[7.5rem] ${className}`}>
      {revealed ? (
        <p className="text-center text-sm font-semibold text-slate-900 tabular-nums">{display}</p>
      ) : null}
      <button
        type="button"
        onClick={openDialer}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 active:scale-[0.98] transition"
        aria-label={`Call delivery partner at ${display}`}
      >
        <Phone className="w-5 h-5 shrink-0" />
        Call
      </button>
      {revealed ? (
        <a
          href={`tel:${tel}`}
          className="text-center text-xs font-medium text-green-700 hover:underline"
        >
          Open in phone app
        </a>
      ) : null}
    </div>
  );
}
