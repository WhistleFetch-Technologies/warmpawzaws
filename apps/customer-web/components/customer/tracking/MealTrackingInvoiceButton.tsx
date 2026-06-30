'use client';

import { Download } from 'lucide-react';

export function MealTrackingInvoiceButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1 text-slate-700 transition active:bg-white/70"
      aria-label="Download invoice"
    >
      <Download className="h-5 w-5" strokeWidth={2} />
      <span className="text-[10px] font-medium text-slate-500">Invoice</span>
    </button>
  );
}
