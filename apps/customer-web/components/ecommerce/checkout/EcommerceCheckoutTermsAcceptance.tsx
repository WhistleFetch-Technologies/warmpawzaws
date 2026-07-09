'use client';

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from 'react';
import { cn } from '@/components/ui/utils';
import { EcommerceCheckoutTermsDialog } from './EcommerceCheckoutTermsDialog';

export type EcommerceCheckoutTermsAcceptanceHandle = {
  triggerAttention: () => void;
};

type EcommerceCheckoutTermsAcceptanceProps = {
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
};

export const EcommerceCheckoutTermsAcceptance = forwardRef<
  EcommerceCheckoutTermsAcceptanceHandle,
  EcommerceCheckoutTermsAcceptanceProps
>(function EcommerceCheckoutTermsAcceptance({ accepted, onAcceptedChange }, ref) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const openDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const triggerAttention = useCallback(() => {
    setShowHint(true);
    setShaking(true);
    window.setTimeout(() => setShaking(false), 450);
  }, []);

  useImperativeHandle(ref, () => ({ triggerAttention }), [triggerAttention]);

  const handleAccept = () => {
    onAcceptedChange(true);
    setShowHint(false);
  };

  return (
    <>
      <section
        className={cn(
          'rounded-2xl border bg-white p-4 shadow-sm transition-colors',
          shaking ? 'border-[#FF8C42] ecom-terms-shake' : 'border-slate-100',
          showHint && !accepted && 'border-red-300 bg-red-50/40',
        )}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={openDialog}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openDialog();
            }
          }}
          className="flex cursor-pointer items-start gap-3"
        >
          <input
            type="checkbox"
            readOnly
            checked={accepted}
            tabIndex={-1}
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-[#FF8C42] pointer-events-none"
          />
          <div className="text-sm text-slate-700">
            <span>I accept the </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openDialog();
              }}
              className="font-semibold text-[#FF8C42] underline-offset-2 hover:underline"
            >
              Terms & Conditions
            </button>
          </div>
        </div>
        {showHint && !accepted && (
          <p className="mt-2 text-xs font-medium text-red-600">
            Please read and accept the Terms & Conditions to continue.
          </p>
        )}
      </section>

      <EcommerceCheckoutTermsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAccept={handleAccept}
      />

      <style jsx>{`
        @keyframes ecomTermsShake {
          0%,
          100% {
            transform: translateX(0);
          }
          20%,
          60% {
            transform: translateX(-6px);
          }
          40%,
          80% {
            transform: translateX(6px);
          }
        }
        :global(.ecom-terms-shake) {
          animation: ecomTermsShake 0.45s ease-in-out;
        }
      `}</style>
    </>
  );
});
