'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Headphones, MessageSquare, X } from 'lucide-react';
import { apiClient, supportCrmApi } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import {
  markSupportThreadSeenInBrowser,
  supportTicketDetailIndicatesUnreadForCustomer,
} from '@/lib/customer-message-unread';
import {
  useCustomerBookingMessagesModal,
  type BookingChatThreadTarget,
} from './CustomerBookingMessagesModalProvider';
import { toast } from 'sonner';
import { CommunicationHub } from '@/components/communication/CommunicationHub';
import {
  SupportTicketDetailView,
  type SupportTicketDetailBundle,
  type SupportTicketResponseRow,
} from '@/components/customer/support';
import type { SupportAttachment } from '@/lib/support-attachment-upload';

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

const SUPPORT_INBOX_DISPLAY = 'Warmpawz Support';
const EXCLUDED_TICKET_STATUSES = new Set(['closed', 'cancelled']);

type MsgRow = {
  content?: string;
  message?: string;
  timestamp?: string;
  created_at?: string;
  isRead?: boolean;
  senderType?: string;
  sender_type?: string;
};

type SupportListMeta = {
  ticketId: string;
  subject: string;
  last_message: string;
  last_message_time: string;
  /** Matches header badge: last reply from support and not yet "seen" in this browser. */
  hasUnreadFromSupport?: boolean;
};

type InboxMergedRow =
  | { kind: 'booking'; conv: ConvRow }
  | { kind: 'support'; support: SupportListMeta };

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

function sortTimeMs(iso?: string): number {
  if (!iso) return 0;
  const t = new Date(String(iso)).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function mapTicketToSupportMeta(t: unknown): SupportListMeta | null {
  const row = t as Record<string, unknown>;
  const ticketId = (row?.id != null ? String(row.id) : '').trim();
  if (!ticketId) return null;
  const status = String(row?.status || '').toLowerCase();
  if (EXCLUDED_TICKET_STATUSES.has(status)) return null;
  const subject = String(row?.subject || 'Support request').trim() || 'Support request';
  const msg = String(row?.message || '').trim();
  const time = String(
    row?.last_updated_at ||
      row?.lastUpdatedAt ||
      row?.updated_at ||
      row?.updatedAt ||
      row?.created_at ||
      row?.createdAt ||
      ''
  ).trim();
  return {
    ticketId,
    subject,
    last_message: msg || subject,
    last_message_time: time,
  };
}

async function fetchSupportTicketsForInbox(opts: {
  resolvedCustomerId?: string;
  rawPhone: string;
}): Promise<SupportListMeta[]> {
  const cid = opts.resolvedCustomerId || getResolvedCustomerId() || undefined;
  const raw = opts.rawPhone.trim();
  if (!cid && !raw) return [];
  try {
    const res = (await supportCrmApi.getTickets({
      customerId: cid,
      customerPhone: raw || undefined,
      limit: 40,
      offset: 0,
    })) as { success?: boolean; tickets?: unknown[] };
    if (!res?.success || !Array.isArray(res.tickets)) return [];
    const seen = new Set<string>();
    const out: SupportListMeta[] = [];
    for (const t of res.tickets) {
      const m = mapTicketToSupportMeta(t);
      if (m && !seen.has(m.ticketId)) {
        seen.add(m.ticketId);
        out.push(m);
      }
    }
    return enrichSupportRowsWithUnread(out);
  } catch (e) {
    console.warn('[Messages inbox] support tickets failed', e);
    return [];
  }
}

const SUPPORT_UNREAD_CHUNK = 5;

async function enrichSupportRowsWithUnread(rows: SupportListMeta[]): Promise<SupportListMeta[]> {
  const out: SupportListMeta[] = [];
  for (let i = 0; i < rows.length; i += SUPPORT_UNREAD_CHUNK) {
    const slice = rows.slice(i, i + SUPPORT_UNREAD_CHUNK);
    const part = await Promise.all(
      slice.map(async (row) => {
        try {
          const d = (await supportCrmApi.getTicket(row.ticketId)) as {
            ticket?: Record<string, unknown>;
            responses?: Array<{
              responder_type?: string;
              is_internal?: boolean;
              created_at?: string;
            }>;
          };
          if (!d?.ticket) return { ...row, hasUnreadFromSupport: false };
          return {
            ...row,
            hasUnreadFromSupport: supportTicketDetailIndicatesUnreadForCustomer(d, row.ticketId),
          };
        } catch {
          return { ...row, hasUnreadFromSupport: false };
        }
      })
    );
    out.push(...part);
  }
  return out;
}

async function buildMergedInboxRows(opts: {
  resolvedCustomerId?: string;
  phoneProp: string;
}): Promise<InboxMergedRow[]> {
  const fromStorage =
    (typeof localStorage !== 'undefined' && (localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone'))) ||
    '';
  const rawPhone = (opts.phoneProp || fromStorage).trim();
  const digits = rawPhone.replace(/\D/g, '');
  const cid = opts.resolvedCustomerId || getResolvedCustomerId() || undefined;
  if (!digits && !cid) return [];

  const q = new URLSearchParams();
  if (cid) q.set('customerId', cid);
  if (digits) q.set('phone', digits);
  const res = await apiClient.get<{ conversations?: ConvRow[] }>(`/chat/conversations?${q.toString()}`);
  const first = Array.isArray(res?.conversations) ? res.conversations : [];
  const bookKey = cid || digits;
  const bookingRows = bookKey ? await loadRowsWithBookingsFallback(bookKey, first) : first;

  const supportRows = await fetchSupportTicketsForInbox({
    resolvedCustomerId: cid,
    rawPhone,
  });

  const merged: InboxMergedRow[] = [
    ...bookingRows.map((conv) => ({ kind: 'booking' as const, conv })),
    ...supportRows.map((support) => ({ kind: 'support' as const, support })),
  ];
  merged.sort((a, b) => {
    const ta = a.kind === 'booking' ? sortTimeMs(a.conv.last_message_time) : sortTimeMs(a.support.last_message_time);
    const tb = b.kind === 'booking' ? sortTimeMs(b.conv.last_message_time) : sortTimeMs(b.support.last_message_time);
    return tb - ta;
  });
  return merged;
}

type ActivePane =
  | { mode: 'booking'; bookingId: string; title: string }
  | { mode: 'support'; ticketId: string }
  | null;

export function CustomerBookingMessagesInbox({
  phone,
  onBack,
  variant = 'page',
  onClose,
  initialBookingThread = null,
}: {
  phone: string;
  /** Full-page stack (back arrow in orange header). */
  onBack?: () => void;
  variant?: 'page' | 'modal';
  /** Modal shell: dimmed backdrop, title row with close. */
  onClose?: () => void;
  /** When set, opens CommunicationHub on this booking thread (e.g. package parent booking). */
  initialBookingThread?: BookingChatThreadTarget | null;
}) {
  const [rows, setRows] = useState<InboxMergedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerUuid, setCustomerUuid] = useState<string | undefined>();
  const [active, setActive] = useState<ActivePane>(null);
  const [supportTicketDetail, setSupportTicketDetail] = useState<SupportTicketDetailBundle | null>(null);
  const [loadingSupportDetail, setLoadingSupportDetail] = useState(false);
  const [supportReplyText, setSupportReplyText] = useState('');
  const [supportReplyAttachments, setSupportReplyAttachments] = useState<SupportAttachment[]>([]);
  const [sendingSupportReply, setSendingSupportReply] = useState(false);

  const isModal = variant === 'modal';

  const { bumpMessagesInboxVersion } = useCustomerBookingMessagesModal();

  useEffect(() => {
    const bid = String(initialBookingThread?.bookingId || '').trim();
    if (!bid) return;
    setActive({
      mode: 'booking',
      bookingId: bid,
      title: initialBookingThread?.title?.trim() || 'Provider',
    });
  }, [initialBookingThread?.bookingId, initialBookingThread?.title]);

  useEffect(() => {
    if (!isModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isModal]);

  const refreshInbox = useCallback(
    async (resolvedCustomerId?: string) => {
      const fromStorage =
        (typeof localStorage !== 'undefined' &&
          (localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone'))) ||
        '';
      const p = (phone || fromStorage).replace(/\D/g, '');
      const cid = resolvedCustomerId ?? customerUuid;
      if (!p && !cid) {
        setRows([]);
        return;
      }
      const merged = await buildMergedInboxRows({
        resolvedCustomerId: cid,
        phoneProp: phone || fromStorage,
      });
      setRows(merged);
    },
    [phone, customerUuid]
  );

  const loadSupportDetail = useCallback(
    async (ticketId: string) => {
      if (!ticketId.trim()) return;
      setLoadingSupportDetail(true);
      try {
        const res = (await supportCrmApi.getTicket(ticketId)) as {
          success?: boolean;
          ticket?: Record<string, unknown>;
          responses?: SupportTicketResponseRow[];
        };
        if (res?.success && res.ticket) {
          const raw = res.responses || [];
          const visible = raw.filter((r) => !r.is_internal);
          markSupportThreadSeenInBrowser(ticketId, { ticket: res.ticket, responses: visible });
          setSupportTicketDetail({ ticket: res.ticket, responses: visible });
          bumpMessagesInboxVersion();
          void refreshInbox();
        } else {
          setSupportTicketDetail(null);
          toast.error('Could not load this ticket.');
        }
      } catch {
        toast.error('Could not load ticket.');
        setSupportTicketDetail(null);
      } finally {
        setLoadingSupportDetail(false);
      }
    },
    [bumpMessagesInboxVersion, refreshInbox]
  );

  useEffect(() => {
    if (!active || active.mode !== 'support') {
      setSupportTicketDetail(null);
      setSupportReplyText('');
      return;
    }
    void loadSupportDetail(active.ticketId);
  }, [active, loadSupportDetail]);

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
        const fromStorage =
          (typeof localStorage !== 'undefined' &&
            (localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone'))) ||
          '';
        const merged = await buildMergedInboxRows({
          resolvedCustomerId: resolvedId,
          phoneProp: phone || fromStorage,
        });
        if (alive) setRows(merged);
      } catch (e) {
        console.error('[Messages inbox] Failed to load conversations', e);
        try {
          const fromStorage2 =
            (typeof localStorage !== 'undefined' &&
              (localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone'))) ||
            '';
          const key2 = resolvedId || (phone || fromStorage2).replace(/\D/g, '');
          if (alive && key2) {
            const merged = await buildMergedInboxRows({
              resolvedCustomerId: resolvedId,
              phoneProp: phone || fromStorage2,
            });
            setRows(merged);
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

  const handleSupportSendReply = async (attachments?: SupportAttachment[]) => {
    if (!active || active.mode !== 'support' || (!supportReplyText.trim() && !attachments?.length)) return;
    const ticketId = active.ticketId;
    setSendingSupportReply(true);
    try {
      await supportCrmApi.respondToTicket(ticketId, {
        message: supportReplyText.trim() || '(attachment)',
        responderId: getResolvedCustomerId() || undefined,
        responderType: 'customer',
        attachments,
      });
      toast.success('Message sent');
      setSupportReplyText('');
      setSupportReplyAttachments([]);
      await loadSupportDetail(ticketId);
      await refreshInbox();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSendingSupportReply(false);
    }
  };

  const openBookingThread = (row: ConvRow) => {
    const bookingId = (row.booking_id || row.id || '').toString();
    if (!bookingId) return;
    setActive({
      mode: 'booking',
      bookingId,
      title: row.participant_name || 'Provider',
    });
  };

  const hubZ = isModal ? 'z-[210]' : 'z-[200]';
  const supportZ = isModal ? 'z-[220]' : 'z-[210]';

  const listBody = (
    <>
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <div className={`mx-auto max-w-sm text-center ${isModal ? 'mt-6' : 'mt-12'}`}>
          <MessageSquare className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-base font-semibold text-gray-800">No messages yet</p>
          <p className="mt-2 text-sm text-gray-500">
            Provider chats appear after you message from a booking. Support tickets you create in Help &amp; Support show
            here too.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, idx) => {
            if (row.kind === 'support') {
              const s = row.support;
              return (
                <li key={`support-${s.ticketId}`}>
                  <button
                    type="button"
                    onClick={() =>
                      setActive({
                        mode: 'support',
                        ticketId: s.ticketId,
                      })
                    }
                    className="flex w-full items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-amber-200 hover:bg-amber-50/40"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <Headphones className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-gray-900">{SUPPORT_INBOX_DISPLAY}</span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {s.hasUnreadFromSupport ? (
                            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white tabular-nums">
                              1
                            </span>
                          ) : null}
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            Support
                          </span>
                        </div>
                      </div>
                      <p className="truncate text-xs text-gray-500">{s.subject}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">{s.last_message || '—'}</p>
                    </div>
                  </button>
                </li>
              );
            }
            const conv = row.conv;
            const bookingId = (conv.booking_id || conv.id || idx).toString();
            return (
              <li key={`booking-${bookingId}`}>
                <button
                  type="button"
                  onClick={() => openBookingThread(conv)}
                  className="flex w-full items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-orange-200 hover:bg-orange-50/40"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-gray-900">{conv.participant_name || 'Provider'}</span>
                      {conv.unread_count != null && conv.unread_count > 0 ? (
                        <span className="shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
                          {conv.unread_count}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-gray-500">{conv.booking_service || 'Booking'}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">{conv.last_message || '—'}</p>
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
    active?.mode === 'booking' ? (
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
            onBookingChatMarkedRead={() => {
              bumpMessagesInboxVersion();
              void refreshInbox();
            }}
          />
        </div>
      </div>
    ) : null;

  const supportOverlay =
    active?.mode === 'support' ? (
      <div
        className={`fixed inset-0 ${supportZ} flex items-end justify-center bg-black/50 sm:items-center sm:p-4`}
      >
        <div className="flex h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
            <SupportTicketDetailView
              embeddedInModal
              loadingInitial={loadingSupportDetail && !supportTicketDetail}
              detail={supportTicketDetail}
              replyText={supportReplyText}
              onReplyTextChange={setSupportReplyText}
              sendingReply={sendingSupportReply}
              onSendReply={(attachments) => void handleSupportSendReply(attachments)}
              replyAttachments={supportReplyAttachments}
              onReplyAttachmentsChange={setSupportReplyAttachments}
              onMessagesRefresh={() => void loadSupportDetail(active.ticketId)}
              onBack={() => {
                setActive(null);
                setSupportTicketDetail(null);
                setSupportReplyText('');
                setSupportReplyAttachments([]);
                void refreshInbox();
              }}
            />
          </div>
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
        {supportOverlay}
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
      {supportOverlay}
    </div>
  );
}
