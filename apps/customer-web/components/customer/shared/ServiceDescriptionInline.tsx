'use client';

import { useCallback, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildServiceDescriptionPreview } from '@/lib/service-description-preview';

type ServiceDescriptionInlineProps = {
  description: string;
  /** Shown as dialog title (e.g. service or provider name). */
  title: string;
  className?: string;
  linkClassName?: string;
  dialogHint?: string;
  /** When false, render nothing if description is empty. Default true. */
  hideWhenEmpty?: boolean;
};

export function ServiceDescriptionInline({
  description,
  title,
  className = 'm-0 text-sm leading-5 text-gray-600 mb-3',
  linkClassName = 'inline cursor-pointer align-baseline text-[11px] font-semibold text-[#FF8C42] hover:underline',
  dialogHint = 'Full description (vendor-provided)',
  hideWhenEmpty = true,
}: ServiceDescriptionInlineProps) {
  const descTrim = description?.trim() ?? '';
  const [open, setOpen] = useState(false);
  const { preview, showViewMore, modalText } = buildServiceDescriptionPreview(descTrim);

  const openModal = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }, []);

  if (!descTrim) {
    return hideWhenEmpty ? null : <p className={className} />;
  }

  return (
    <>
      <p className={className}>
        {showViewMore ? (
          <>
            <span className="break-words">{preview}</span>
            <span
              role="button"
              tabIndex={0}
              className={linkClassName}
              onClick={openModal}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') openModal(e);
              }}
            >
              {' View more'}
            </span>
          </>
        ) : (
          <span className="line-clamp-2 break-words whitespace-pre-line">{preview}</span>
        )}
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(90vh,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b border-gray-100 px-5 pt-5 pb-3 pr-12 text-left">
            <DialogTitle className="text-base leading-snug text-gray-900">{title}</DialogTitle>
            <p className="text-xs font-normal text-gray-500">{dialogHint}</p>
          </DialogHeader>
          <div className="max-h-[min(65vh,28rem)] min-h-[8rem] overflow-y-auto px-5 py-4 text-sm leading-relaxed text-gray-700 whitespace-pre-line">
            {modalText}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
