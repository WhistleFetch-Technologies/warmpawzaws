'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { productTextPreview } from '@/lib/product-text-preview';

type ProductTextExpandProps = {
  text?: string | null;
  title: string;
  className?: string;
  dialogHint?: string;
};

export function ProductTextExpand({
  text,
  title,
  className = 'text-sm text-slate-500 whitespace-pre-line',
  dialogHint = 'Full product copy',
}: ProductTextExpandProps) {
  const [open, setOpen] = useState(false);
  const raw = String(text || '').trim();
  if (!raw) return null;

  const { preview, showViewMore, full } = productTextPreview(raw);

  return (
    <>
      <p className={className}>
        {preview}
        {showViewMore ? (
          <button
            type="button"
            className="ml-1 inline cursor-pointer align-baseline text-[11px] font-semibold text-orange-600 hover:underline"
            onClick={() => setOpen(true)}
          >
            View more
          </button>
        ) : null}
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(85dvh,36rem)] w-full flex-col gap-0 overflow-hidden p-0 !flex sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b border-gray-100 px-5 pt-5 pb-3 pr-12 text-left">
            <DialogTitle className="text-base leading-snug text-gray-900">{title}</DialogTitle>
            <p className="text-xs font-normal text-gray-500">{dialogHint}</p>
          </DialogHeader>
          <div className="min-h-0 max-h-[min(70dvh,28rem)] flex-1 overflow-y-auto overscroll-contain px-5 py-4 text-sm leading-relaxed text-gray-700 whitespace-pre-line">
            {full}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
