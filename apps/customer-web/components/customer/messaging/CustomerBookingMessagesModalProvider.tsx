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
  /** Incremented when the messages modal closes so the home header badge can refetch. */
  messagesInboxVersion: number;
  /** Call after vendor messages are marked read or a support thread is viewed so the header badge refetches. */
  bumpMessagesInboxVersion: () => void;
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
  const [messagesInboxVersion, setMessagesInboxVersion] = useState(0);
  const openMessages = useCallback(() => setOpen(true), []);
  const bumpMessagesInboxVersion = useCallback(() => {
    setMessagesInboxVersion((v) => v + 1);
  }, []);
  const closeMessages = useCallback(() => {
    setOpen(false);
    bumpMessagesInboxVersion();
  }, [bumpMessagesInboxVersion]);
  const value = useMemo(
    () => ({ openMessages, closeMessages, messagesInboxVersion, bumpMessagesInboxVersion }),
    [openMessages, closeMessages, messagesInboxVersion, bumpMessagesInboxVersion]
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
