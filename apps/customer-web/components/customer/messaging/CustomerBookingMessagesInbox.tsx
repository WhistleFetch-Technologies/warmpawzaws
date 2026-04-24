'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, MessageSquare, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { CommunicationHub } from '@/components/communication/CommunicationHub';

type ConvRow = {
  booking_id?: string;
  id?: string;
  participant_name?: string;
  booking_service?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
};

export function CustomerBookingMessagesInbox({
  phone,
  onBack,
  variant = 'page',
  onClose,
}: {
  phone: string;
  /** Full-page stack (back arrow in orange header). */
  onBack?: () => void;
  variant?: 'page' | 'modal';
  /** Modal shell: dimmed backdrop, title row with close. */
  onClose?: () => void;
}) {
  const [rows, setRows] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerUuid, setCustomerUuid] = useState<string | undefined>();
  const [active, setActive] = useState<{ bookingId: string; title: string } | null>(null);

  const isModal = variant === 'modal';

  useEffect(() => {
    if (!isModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isModal]);

  const refreshInbox = useCallback(async (resolvedCustomerId?: string) => {
    const p = phone.replace(/\D/g, '');
    const cid = resolvedCustomerId ?? customerUuid;
    if (!p && !cid) {
      setRows([]);
      return;
    }
    const q = new URLSearchParams();
    if (cid) q.set('customerId', cid);
    if (p) q.set('phone', p);
    const res = await apiClient.get<{ conversations?: ConvRow[] }>(`/chat/conversations?${q.toString()}`);
    setRows(Array.isArray(res?.conversations) ? res.conversations : []);
  }, [phone, customerUuid]);

  // Resolve customer first, then load once per phone — so `customerId` and `phone` are sent together (avoids list missing rows that key only on `customer_id` in the DB).
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setRows([]);
      let resolvedId: string | undefined;
      try {
        const r = await apiClient.get<{ customer?: { id?: string } }>(
          `/customer/by-phone?phone=${encodeURIComponent(phone)}`
        );
        resolvedId = r?.customer?.id;
        if (alive && resolvedId) setCustomerUuid(resolvedId);
        else if (alive) setCustomerUuid(undefined);
      } catch {
        if (alive) setCustomerUuid(undefined);
      }
      try {
        if (!alive) return;
        const p = phone.replace(/\D/g, '');
        const q = new URLSearchParams();
        if (resolvedId) q.set('customerId', resolvedId);
        if (p) q.set('phone', p);
        const res = await apiClient.get<{ conversations?: ConvRow[] }>(`/chat/conversations?${q.toString()}`);
        if (alive) setRows(Array.isArray(res?.conversations) ? res.conversations : []);
      } catch (e) {
        console.error('[Messages inbox] Failed to load conversations', e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [phone]);

  const onThreadClosedRefresh = useCallback(() => {
    setActive(null);
    void refreshInbox();
  }, [refreshInbox]);

  const openThread = (row: ConvRow) => {
    const bookingId = (row.booking_id || row.id || '').toString();
    if (!bookingId) return;
    setActive({
      bookingId,
      title: row.participant_name || 'Provider',
    });
  };

  const hubZ = isModal ? 'z-[210]' : 'z-[200]';

  const listBody = (
    <>
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <div className={`mx-auto max-w-sm text-center ${isModal ? 'mt-6' : 'mt-12'}`}>
          <MessageSquare className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-base font-semibold text-gray-800">No conversations yet</p>
          <p className="mt-2 text-sm text-gray-500">
            Open a booking and use &quot;Message provider&quot; to start chatting. Threads show here after the first
            message.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, idx) => {
            const bookingId = (row.booking_id || row.id || idx).toString();
            return (
              <li key={bookingId}>
                <button
                  type="button"
                  onClick={() => openThread(row)}
                  className="flex w-full items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-orange-200 hover:bg-orange-50/40"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-gray-900">
                        {row.participant_name || 'Provider'}
                      </span>
                      {row.unread_count != null && row.unread_count > 0 ? (
                        <span className="shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
                          {row.unread_count}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-gray-500">{row.booking_service || 'Booking'}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">{row.last_message || '—'}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  const hubOverlay =
    active ? (
      <div
        className={`fixed inset-0 ${hubZ} flex items-end justify-center bg-black/50 sm:items-center sm:p-4`}
      >
        <div className="flex h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
          <CommunicationHub
            mode="chat"
            bookingId={active.bookingId}
            customerId={customerUuid}
            userPhone={phone}
            userName="You"
            otherUserName={active.title}
            userType="customer"
            onClose={onThreadClosedRefresh}
          />
        </div>
      </div>
    ) : null;

  if (isModal) {
    return (
      <>
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-booking-messages-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <MessageSquare className="h-5 w-5 shrink-0 text-[#FF8C42]" />
                <h2 id="customer-booking-messages-modal-title" className="text-lg font-semibold text-gray-900">
                  Messages
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onClose?.()}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{listBody}</div>
          </div>
        </div>
        {hubOverlay}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto flex flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] px-4 py-3 text-white cw-header-safe-top">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <MessageSquare className="h-5 w-5 shrink-0 opacity-90" />
          <h1 className="truncate text-lg font-bold">Messages</h1>
        </div>
      </header>

      <div className="flex-1 p-4">{listBody}</div>

      {hubOverlay}
    </div>
  );
}
