'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  GuestAuthModal,
  type GuestAuthModalOptions,
} from '@/components/customer/auth/GuestAuthModal';
import {
  registerGuestAuthModalOpener,
  type GuestAuthRequestOptions,
} from '@/lib/guest-auth-gate';

type GuestAuthModalContextValue = {
  openGuestAuth: (options: GuestAuthRequestOptions) => void;
  closeGuestAuth: () => void;
};

const GuestAuthModalContext = createContext<GuestAuthModalContextValue | null>(null);

export function useGuestAuthModal(): GuestAuthModalContextValue {
  const ctx = useContext(GuestAuthModalContext);
  if (!ctx) {
    throw new Error('useGuestAuthModal must be used within GuestAuthModalProvider');
  }
  return ctx;
}

/** Safe optional hook for lib code that may run outside the provider tree. */
export function tryUseGuestAuthModal(): GuestAuthModalContextValue | null {
  return useContext(GuestAuthModalContext);
}

export function GuestAuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<GuestAuthModalOptions | null>(null);

  const closeGuestAuth = useCallback(() => {
    setOpen(false);
    setOptions(null);
  }, []);

  const openGuestAuth = useCallback((request: GuestAuthRequestOptions) => {
    setOptions({
      mode: request.mode || 'signup',
      returnPath: request.returnPath || '/',
      resumeScreen: request.resumeScreen,
    });
    setOpen(true);
  }, []);

  useEffect(() => {
    registerGuestAuthModalOpener(openGuestAuth);
    return () => registerGuestAuthModalOpener(null);
  }, [openGuestAuth]);

  const value = useMemo(
    () => ({ openGuestAuth, closeGuestAuth }),
    [openGuestAuth, closeGuestAuth]
  );

  return (
    <GuestAuthModalContext.Provider value={value}>
      {children}
      <GuestAuthModal open={open} options={options} onOpenChange={(next) => (next ? setOpen(true) : closeGuestAuth())} />
    </GuestAuthModalContext.Provider>
  );
}
