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

export type BookingChatThreadTarget = {
  bookingId: string;
  title: string;
};

type CustomerBookingMessagesModalContextValue = {
  openMessages: () => void;
  /** Open booking chat (CommunicationHub) on the package parent booking or any booking thread. */
  openBookingChat: (bookingId: string, vendorName?: string) => void;
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
  const [bookingThreadTarget, setBookingThreadTarget] = useState<BookingChatThreadTarget | null>(null);
  const [messagesInboxVersion, setMessagesInboxVersion] = useState(0);
  const openMessages = useCallback(() => {
    setBookingThreadTarget(null);
    setOpen(true);
  }, []);
  const openBookingChat = useCallback((bookingId: string, vendorName?: string) => {
    const bid = String(bookingId || '').trim();
    if (!bid) return;
    setBookingThreadTarget({
      bookingId: bid,
      title: String(vendorName || '').trim() || 'Provider',
    });
    setOpen(true);
  }, []);
  const bumpMessagesInboxVersion = useCallback(() => {
    setMessagesInboxVersion((v) => v + 1);
  }, []);
  const closeMessages = useCallback(() => {
    setOpen(false);
    setBookingThreadTarget(null);
    bumpMessagesInboxVersion();
  }, [bumpMessagesInboxVersion]);
  const value = useMemo(
    () => ({
      openMessages,
      openBookingChat,
      closeMessages,
      messagesInboxVersion,
      bumpMessagesInboxVersion,
    }),
    [openMessages, openBookingChat, closeMessages, messagesInboxVersion, bumpMessagesInboxVersion]
  );

  const modal =
    typeof document !== 'undefined' && open
      ? createPortal(
          <CustomerBookingMessagesInbox
            variant="modal"
            phone={phone}
            onClose={closeMessages}
            initialBookingThread={bookingThreadTarget}
          />,
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
