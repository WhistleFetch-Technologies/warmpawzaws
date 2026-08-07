'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildServiceDescriptionPreview } from '@/lib/service-description-preview';

const PREVIEW_LINE_COUNT = 2;

type ServiceDescriptionInlineProps = {
  description: string;
  /** Shown as dialog title (e.g. service or provider name). */
  title: string;
  className?: string;
  linkClassName?: string;
  dialogHint?: string;
  /** When false, render nothing if description is empty. Default true. */
  hideWhenEmpty?: boolean;
  /**
   * When false, only show a clamped preview (no “View more” control).
   * Use inside parent `<button>` rows so nested interactive elements are avoided.
   */
  expandInDialog?: boolean;
};

/** Strip caller-supplied line-clamp utilities; this component owns truncation. */
function stripLineClampClasses(className: string): string {
  return className.replace(/\bline-clamp-\d+\b/g, '').replace(/\s+/g, ' ').trim();
}

export function ServiceDescriptionInline({
  description,
  title,
  className = 'm-0 text-sm leading-5 text-gray-600 mb-3',
  linkClassName = 'inline cursor-pointer align-baseline text-[11px] font-semibold text-[#FF8C42] hover:underline',
  dialogHint = 'Full description (vendor-provided)',
  hideWhenEmpty = true,
  expandInDialog = true,
}: ServiceDescriptionInlineProps) {
  const descTrim = description?.trim() ?? '';
  const [open, setOpen] = useState(false);
  const [measuredOverflow, setMeasuredOverflow] = useState(false);
  const measureRef = useRef<HTMLSpanElement>(null);

  const { preview, showViewMore: heuristicShowViewMore, modalText } =
    buildServiceDescriptionPreview(descTrim);

  const displayClassName = stripLineClampClasses(className);

  useLayoutEffect(() => {
    if (!expandInDialog || !descTrim) {
      setMeasuredOverflow(false);
      return;
    }

    const measureOverflow = () => {
      const el = measureRef.current;
      if (!el) return;
      const style = window.getComputedStyle(el);
      const lineHeight = Number.parseFloat(style.lineHeight);
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
      setMeasuredOverflow(el.scrollHeight > lineHeight * PREVIEW_LINE_COUNT + 1);
    };

    measureOverflow();

    const el = measureRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measureOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [descTrim, displayClassName, expandInDialog]);

  const showViewMore =
    expandInDialog && (heuristicShowViewMore || measuredOverflow);

  const openModal = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }, []);

  if (!descTrim) {
    return hideWhenEmpty ? null : <p className={displayClassName} />;
  }

  return (
    <>
      <div className="relative min-w-0">
        {expandInDialog ? (
          <span
            ref={measureRef}
            aria-hidden
            className={`${displayClassName} pointer-events-none invisible absolute inset-x-0 top-0 -z-10 block break-words whitespace-pre-line`}
          >
            {modalText}
          </span>
        ) : null}
        <p className={displayClassName}>
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
      </div>
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
