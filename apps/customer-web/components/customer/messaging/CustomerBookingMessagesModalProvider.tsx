'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CustomerBookingMessagesInbox } from './CustomerBookingMessagesInbox';

type CustomerBookingMessagesModalContextValue = {
  openMessages: () => void;
  closeMessages: () => void;
};

const CustomerBookingMessagesModalContext =
  createContext<CustomerBookingMessagesModalContextValue | null>(null);

export function useCustomerBookingMessagesModal(): CustomerBookingMessagesModalContextValue {
  const ctx = useContext(CustomerBookingMessagesModalContext);
  if (!ctx) {
    throw new Error('useCustomerBookingMessagesModal must be used within CustomerBookingMessagesModalProvider');
  }
  return ctx;
}

export function CustomerBookingMessagesModalProvider({
  phone,
  children,
}: {
  phone: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openMessages = useCallback(() => setOpen(true), []);
  const closeMessages = useCallback(() => setOpen(false), []);
  const value = useMemo(
    () => ({ openMessages, closeMessages }),
    [openMessages, closeMessages]
  );

  const modal =
    typeof document !== 'undefined' && open
      ? createPortal(
          <CustomerBookingMessagesInbox variant="modal" phone={phone} onClose={closeMessages} />,
          document.body
        )
      : null;

  return (
    <CustomerBookingMessagesModalContext.Provider value={value}>
      {children}
      {modal}
    </CustomerBookingMessagesModalContext.Provider>
  );
}
