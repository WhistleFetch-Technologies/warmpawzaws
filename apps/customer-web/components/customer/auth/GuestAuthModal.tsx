'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  CustomerAuthFlow,
  type CustomerAuthCompleteResult,
} from '@/components/customer/auth/CustomerAuthFlow';
import {
  BACK_HANDLER_PRIORITY,
  registerBackHandler,
} from '@/lib/navigation/back-handler-registry';
import {
  emitCustomerAuthCompleted,
  persistCustomerAuthSessionSideEffects,
} from '@/lib/customer-auth-session-event';

export type GuestAuthModalOptions = {
  mode: 'login' | 'signup';
  returnPath?: string;
  resumeScreen?: string;
};

type GuestAuthModalProps = {
  open: boolean;
  options: GuestAuthModalOptions | null;
  onOpenChange: (open: boolean) => void;
};

export function GuestAuthModal({ open, options, onOpenChange }: GuestAuthModalProps) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    return registerBackHandler(() => {
      onOpenChange(false);
      return true;
    }, BACK_HANDLER_PRIORITY.shellOverlay);
  }, [open, onOpenChange]);

  const handleComplete = (result: CustomerAuthCompleteResult) => {
    persistCustomerAuthSessionSideEffects();
    emitCustomerAuthCompleted();
    onOpenChange(false);
    const returnPath = result.redirectPath;
    const isHomeReturn = !returnPath || returnPath === '/' || returnPath.startsWith('/?');
    if (!isHomeReturn && returnPath.startsWith('/')) {
      router.push(returnPath);
    }
  };

  const handleDismiss = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/55 backdrop-blur-[3px]"
        className="w-[calc(100%-2rem)] max-w-[420px] gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:max-w-[420px] rounded-[20px]"
      >
        {open && options ? (
          <CustomerAuthFlow
            key={`${options.mode}:${options.returnPath || '/'}`}
            variant="modal"
            initialMode={options.mode}
            returnPath={options.returnPath || '/'}
            onComplete={handleComplete}
            onDismiss={handleDismiss}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
