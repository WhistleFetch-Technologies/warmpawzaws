'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, MessageSquare } from 'lucide-react';
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
}: {
  phone: string;
  onBack: () => void;
}) {
  const [rows, setRows] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerUuid, setCustomerUuid] = useState<string | undefined>();
  const [active, setActive] = useState<{ bookingId: string; title: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiClient.get<{ customer?: { id?: string } }>(
          `/customer/by-phone?phone=${encodeURIComponent(phone)}`
        );
        if (!cancelled && r?.customer?.id) setCustomerUuid(r.customer.id);
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phone]);

  const loadList = useCallback(async () => {
    const q = new URLSearchParams();
    if (customerUuid) q.set('customerId', customerUuid);
    const digits = phone.replace(/\D/g, '');
    if (digits) q.set('phone', digits);
    const res = await apiClient.get<{ conversations?: ConvRow[] }>(`/chat/conversations?${q.toString()}`);
    setRows(Array.isArray(res?.conversations) ? res.conversations : []);
  }, [phone, customerUuid]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await loadList();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadList]);

  const openThread = (row: ConvRow) => {
    const bookingId = (row.booking_id || row.id || '').toString();
    if (!bookingId) return;
    setActive({
      bookingId,
      title: row.participant_name || 'Provider',
    });
  };

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

      <div className="flex-1 p-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          </div>
        ) : rows.length === 0 ? (
          <div className="mx-auto mt-12 max-w-sm text-center">
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
      </div>

      {active ? (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="flex h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
            <CommunicationHub
              mode="chat"
              bookingId={active.bookingId}
              customerId={customerUuid}
              userPhone={phone}
              userName="You"
              otherUserName={active.title}
              userType="customer"
              onClose={() => {
                setActive(null);
                void loadList();
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
