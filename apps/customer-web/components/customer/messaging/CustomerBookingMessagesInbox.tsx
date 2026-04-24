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

const CHAT_FALLBACK_CHUNK = 6;

type MsgRow = { content?: string; message?: string; timestamp?: string; created_at?: string; isRead?: boolean; senderType?: string; sender_type?: string };

/**
 * If /chat/conversations is empty (old API, strict SQL, or proxy issues), list threads by
 * walking the customer's bookings and keeping those with chat_messages (same idea as checking each booking in the app).
 */
async function loadRowsWithBookingsFallback(
  customerKey: string,
  fromConversations: ConvRow[]
): Promise<ConvRow[]> {
  if (fromConversations.length > 0) return fromConversations;
  if (!customerKey) return [];

  const br = (await apiClient
    .get<any>(`/customer/${encodeURIComponent(customerKey)}/bookings?limit=30`)
    .catch(() => null)) as { bookings?: any[] } | null;
  const bookings = Array.isArray(br?.bookings) ? br!.bookings : [];
  if (bookings.length === 0) return [];

  const out: ConvRow[] = [];
  for (let i = 0; i < bookings.length; i += CHAT_FALLBACK_CHUNK) {
    const slice = bookings.slice(i, i + CHAT_FALLBACK_CHUNK);
    const part = await Promise.all(
      slice.map(async (b: any) => {
        const bid = (b.id || b.bookingId || '') as string;
        if (!bid) return null;
        try {
          const m = (await apiClient.get<{ messages?: MsgRow[]; total?: number }>(`/chat/${bid}/messages`)) as any;
          const msgs: MsgRow[] = Array.isArray(m?.messages) ? m.messages : [];
          if (msgs.length === 0) return null;
          const last = msgs[msgs.length - 1]!;
          const text = (last?.content || last?.message || '').toString() || '—';
          const time = (last?.timestamp || last?.created_at || '') as string;
          const unread = msgs.filter((x) => {
            if (x?.isRead === true) return false;
            const st = (x?.senderType || x?.sender_type || '').toLowerCase();
            return st !== 'customer';
          }).length;
          return {
            booking_id: bid,
            id: bid,
            participant_name: (b.vendorName as string) || 'Provider',
            booking_service: (b.serviceName || b.serviceType || b.list_svc_name || 'Booking') as string,
            last_message: text,
            last_message_time: time,
            unread_count: unread,
          } as ConvRow;
        } catch {
          return null;
        }
      })
    );
    for (const r of part) {
      if (r) out.push(r);
    }
  }

  out.sort((a, b) => {
    const ta = new Date(a.last_message_time || 0).getTime();
    const tb = new Date(b.last_message_time || 0).getTime();
    return tb - ta;
  });
  return out;
}

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
    const fromStorage =
      (typeof localStorage !== 'undefined' && (localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone'))) || '';
    const p = (phone || fromStorage).replace(/\D/g, '');
    const cid = resolvedCustomerId ?? customerUuid;
    if (!p && !cid) {
      setRows([]);
      return;
    }
    const q = new URLSearchParams();
    if (cid) q.set('customerId', cid);
    if (p) q.set('phone', p);
    const res = await apiClient.get<{ conversations?: ConvRow[] }>(`/chat/conversations?${q.toString()}`);
    const first = Array.isArray(res?.conversations) ? res.conversations : [];
    const key = cid || p;
    setRows(await loadRowsWithBookingsFallback(key, first));
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
        const anyR = r as any;
        resolvedId =
          anyR?.customer?.id ||
          (typeof anyR?.id === 'string' ? anyR.id : undefined) ||
          (typeof anyR?.customerId === 'string' ? anyR.customerId : undefined) ||
          (typeof anyR?.data?.customer?.id === 'string' ? anyR.data.customer.id : undefined);
        if (alive && resolvedId) setCustomerUuid(resolvedId);
        else if (alive) setCustomerUuid(undefined);
      } catch {
        if (alive) setCustomerUuid(undefined);
      }
      try {
        if (!alive) return;
        // Prefer session phone, then localStorage (matches API client / UAT when prop is empty).
        const fromStorage =
          (typeof localStorage !== 'undefined' && (localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone'))) || '';
        const p = (phone || fromStorage).replace(/\D/g, '');
        const q = new URLSearchParams();
        if (resolvedId) q.set('customerId', resolvedId);
        if (p) q.set('phone', p);
        const res = await apiClient.get<{ conversations?: ConvRow[] }>(`/chat/conversations?${q.toString()}`);
        const first = Array.isArray(res?.conversations) ? res.conversations : [];
        const bookKey = resolvedId || p;
        const merged = bookKey ? await loadRowsWithBookingsFallback(bookKey, first) : first;
        if (alive) setRows(merged);
      } catch (e) {
        console.error('[Messages inbox] Failed to load conversations', e);
        try {
          const fromStorage2 =
            (typeof localStorage !== 'undefined' && (localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone'))) || '';
          const p2 = (phone || fromStorage2).replace(/\D/g, '');
          const key2 = resolvedId || p2;
          if (alive && key2) {
            setRows(await loadRowsWithBookingsFallback(key2, []));
          } else if (alive) {
            setRows([]);
          }
        } catch {
          if (alive) setRows([]);
        }
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
