'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ECOMMERCE_CHECKOUT_TERMS_FOOTER,
  ECOMMERCE_CHECKOUT_TERMS_INTRO,
  ECOMMERCE_CHECKOUT_TERMS_SECTIONS,
  ECOMMERCE_CHECKOUT_TERMS_TITLE,
} from '@/lib/ecommerce/ecommerce-checkout-terms';

type EcommerceCheckoutTermsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
};

export function EcommerceCheckoutTermsDialog({
  open,
  onOpenChange,
  onAccept,
}: EcommerceCheckoutTermsDialogProps) {
  const handleAccept = () => {
    onAccept();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden sm:max-w-2xl bg-white p-0">
        <div className="flex max-h-[85vh] flex-col">
          <DialogHeader className="shrink-0 border-b border-slate-100 px-6 pt-6 pb-4">
            <DialogTitle className="text-left text-lg font-semibold text-slate-900">
              {ECOMMERCE_CHECKOUT_TERMS_TITLE}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <p className="mb-4 text-sm text-slate-600">{ECOMMERCE_CHECKOUT_TERMS_INTRO}</p>

            <div className="space-y-4">
              {ECOMMERCE_CHECKOUT_TERMS_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="mb-1.5 text-sm font-semibold text-slate-900">{section.title}</h3>
                  {section.intro && (
                    <p className="mb-1.5 text-sm text-slate-600">{section.intro}</p>
                  )}
                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                  {section.footer && (
                    <p className="mt-1.5 text-sm text-slate-600">{section.footer}</p>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-4 text-sm text-slate-600">{ECOMMERCE_CHECKOUT_TERMS_FOOTER}</p>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-slate-100 px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAccept}
              className="rounded-xl bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
            >
              Accept
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
