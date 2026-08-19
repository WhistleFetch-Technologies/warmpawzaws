"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  HelpCircle,
  Calendar,
  ArrowLeft,
  UtensilsCrossed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, supportCrmApi } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { toast } from 'sonner';
import { SUPPORT_INITIAL_TAB_KEY, clearSupportBookingContext, clearSupportMealOrderContext, consumeSupportOpenContactForm, resolveSupportContactContext, type SupportBookingContext, type SupportMealOrderContext } from '@/lib/support-contact';
import {
  DEFAULT_LINKED_SUPPORT_CATEGORY,
  GENERAL_SUPPORT_TICKET_CATEGORIES,
  LINKED_SUPPORT_TICKET_CATEGORIES,
} from '@/lib/support-ticket-categories';

const AIChatbotWidget = dynamic(
  () => import('@/components/customer/AIChatbotWidget').then((m) => ({ default: m.AIChatbotWidget })),
  { ssr: false }
);
import {
  SupportTicketDetailView,
  SupportAttachmentPicker,
  SupportFaqTab,
  SupportContactTab,
  SupportTicketsListTab,
  useSupportTicketThread,
  type SupportTicketDetailBundle,
  type SupportTicketResponseRow,
} from '@/components/customer/support';
import { isOpenTicketStatus } from '@/components/customer/support/support-ticket-ui-utils';
import { SUPPORT_FAQ_CATEGORIES } from '@/lib/support-faq-data';
import type { SupportAttachment } from '@/lib/support-attachment-upload';
import { playNotificationAlertSound } from '@/lib/notification-sound';
import { useNotificationService } from '@/components/customer/useNotificationService';

interface Ticket {
  id: string;
  ticket_number?: string;
  subject: string;
  message?: string;
  status: string;
  priority: string;
  category?: string;
  created_at: string;
  booking_id?: string;
  metadata?: Record<string, unknown>;
}

interface SupportHelpCenterProps {
  phone?: string;
  onBack: () => void;
  onCloseToHome?: () => void;
  /** Expose step-aware back for shell header / hardware back. */
  onInternalBackReady?: (handleBack: () => void) => void;
  initialTab?: 'faq' | 'contact' | 'tickets';
  /** When set, contact form creates a booking-linked ticket for refunds. */
  bookingContext?: SupportBookingContext | null;
  /** When set, contact form creates a meal-order-linked ticket from track order. */
  mealOrderContext?: SupportMealOrderContext | null;
  /** In-app shell: route chatbot deep-links (services, support). Defaults to Next router for `/…` only. */
  onChatbotNavigate?: (dest: string, data?: unknown) => void;
}

export function SupportHelpCenter({
  phone,
  onBack,
  onCloseToHome,
  onInternalBackReady,
  initialTab,
  bookingContext,
  mealOrderContext,
  onChatbotNavigate,
}: SupportHelpCenterProps) {
  const router = useRouter();
  const linked = resolveSupportContactContext(bookingContext, mealOrderContext);
  const activeBooking = linked.booking;
  const activeMeal = linked.meal;
  const isBookingTicket = linked.kind === 'booking';
  const isMealOrderTicket = linked.kind === 'meal';
  const isLinkedTicket = linked.kind !== null;

  const defaultMealSubject = activeMeal
    ? activeMeal.planTitle
      ? `Help with meal order: ${activeMeal.planTitle}`
      : activeMeal.orderDisplayNumber
        ? `Help with meal order ${activeMeal.orderDisplayNumber}`
        : `Help with meal order #${activeMeal.orderId.slice(0, 8)}`
    : '';

  const defaultLinkedSubject = isBookingTicket
    ? activeBooking?.serviceName
      ? `Help with booking: ${activeBooking.serviceName}`
      : activeBooking?.bookingId
        ? `Help with booking #${activeBooking.bookingId.slice(0, 8)}`
        : ''
    : defaultMealSubject;

  const [showAIChat, setShowAIChat] = useState(false);
  const [activeTab, setActiveTab] = useState<'faq' | 'contact' | 'tickets'>('faq');
  const [showContactForm, setShowContactForm] = useState(isLinkedTicket);
  const [contactForm, setContactForm] = useState({
    subject: defaultLinkedSubject,
    message: '',
    category: isLinkedTicket ? DEFAULT_LINKED_SUPPORT_CATEGORY : 'general',
  });
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<SupportTicketDetailBundle | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<SupportAttachment[]>([]);
  const [contactAttachments, setContactAttachments] = useState<SupportAttachment[]>([]);
  const [sendingReply, setSendingReply] = useState(false);
  const supportSoundRef = useRef<{ ticketId: string | null; ready: boolean; lastStaffId: string | null }>({
    ticketId: null,
    ready: false,
    lastStaffId: null,
  });

  useEffect(() => {
    supportSoundRef.current = { ticketId: selectedTicketId, ready: false, lastStaffId: null };
  }, [selectedTicketId]);

  useNotificationService({
    phone: phone || '',
    enabled: Boolean(phone),
  });

  // Deep-link from home "Live chat" (sessionStorage or prop)
  useEffect(() => {
    if (initialTab === 'faq' || initialTab === 'contact' || initialTab === 'tickets') {
      setActiveTab(initialTab);
      try {
        sessionStorage.removeItem(SUPPORT_INITIAL_TAB_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    if (typeof window === 'undefined') return;
    try {
      const stored = sessionStorage.getItem(SUPPORT_INITIAL_TAB_KEY);
      if (stored === 'contact' || stored === 'tickets' || stored === 'faq') {
        setActiveTab(stored);
      }
      sessionStorage.removeItem(SUPPORT_INITIAL_TAB_KEY);
    } catch {
      /* ignore */
    }
  }, [initialTab]);

  useEffect(() => {
    if (consumeSupportOpenContactForm()) {
      setActiveTab('contact');
      setShowContactForm(true);
    }
  }, []);

  useEffect(() => {
    if (linked.kind === 'booking' && activeBooking?.bookingId) {
      setActiveTab('contact');
      setShowContactForm(true);
      setSelectedTicketId(null);
      setTicketDetail(null);
      setContactForm({
        subject: activeBooking.serviceName
          ? `Help with booking: ${activeBooking.serviceName}`
          : `Help with booking #${activeBooking.bookingId.slice(0, 8)}`,
        message: '',
        category: 'billing',
      });
      return;
    }
    if (linked.kind === 'meal' && activeMeal?.orderId) {
      setActiveTab('contact');
      setShowContactForm(true);
      setSelectedTicketId(null);
      setTicketDetail(null);
      setContactForm({
        subject: activeMeal.planTitle
          ? `Help with meal order: ${activeMeal.planTitle}`
          : activeMeal.orderDisplayNumber
            ? `Help with meal order ${activeMeal.orderDisplayNumber}`
            : `Help with meal order #${activeMeal.orderId.slice(0, 8)}`,
        message: '',
        category: DEFAULT_LINKED_SUPPORT_CATEGORY,
      });
    }
  }, [
    linked.kind,
    activeBooking?.bookingId,
    activeBooking?.serviceName,
    activeMeal?.orderId,
    activeMeal?.planTitle,
    activeMeal?.orderDisplayNumber,
  ]);

  const clearLinkedTicketContext = useCallback(() => {
    clearSupportBookingContext();
    clearSupportMealOrderContext();
  }, []);

  const loadTickets = useCallback(async () => {
    if (!phone) return;
    setLoadingTickets(true);
    try {
      const cid = getResolvedCustomerId() || undefined;
      const response = (await supportCrmApi.getTickets({
        customerId: cid,
        customerPhone: phone,
        limit: 50,
        offset: 0,
      })) as { success?: boolean; tickets?: Ticket[] };
      if (response.success) {
        setTickets(response.tickets || []);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoadingTickets(false);
    }
  }, [phone]);

  useEffect(() => {
    if (!phone) return;
    void loadTickets();
  }, [phone, loadTickets]);

  const loadTicketDetail = useCallback(async (ticketId: string, options?: { silent?: boolean }) => {
    if (!ticketId.trim()) return;
    if (!options?.silent) {
      setLoadingDetail(true);
    }
    try {
      const res = (await supportCrmApi.getTicket(ticketId)) as {
        success?: boolean;
        ticket?: Record<string, unknown>;
        responses?: SupportTicketResponseRow[];
      };
      if (res?.success && res.ticket) {
        const raw = res.responses || [];
        const visible = raw.filter((r) => !r.is_internal);
        const staffResponses = visible.filter(
          (r) => r.responder_type === 'agent' || r.responder_type === 'system_ai'
        );
        const lastStaff = staffResponses[staffResponses.length - 1];
        const lastStaffId = lastStaff?.id ? String(lastStaff.id) : null;
        const snap = supportSoundRef.current;
        if (snap.ticketId !== ticketId) {
          snap.ticketId = ticketId;
          snap.ready = false;
          snap.lastStaffId = null;
        }
        if (!snap.ready) {
          snap.ready = true;
          snap.lastStaffId = lastStaffId;
        } else if (options?.silent && lastStaffId && lastStaffId !== snap.lastStaffId) {
          playNotificationAlertSound();
          snap.lastStaffId = lastStaffId;
        } else {
          snap.lastStaffId = lastStaffId;
        }
        setTicketDetail({ ticket: res.ticket, responses: visible });
      } else if (!options?.silent) {
        setTicketDetail(null);
        toast.error('Could not load this ticket.');
      }
    } catch (error) {
      console.error('Error loading ticket detail:', error);
      if (!options?.silent) {
        toast.error('Could not load ticket.');
        setTicketDetail(null);
      }
    } finally {
      if (!options?.silent) {
        setLoadingDetail(false);
      }
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'tickets' || !selectedTicketId) {
      return;
    }
    void loadTicketDetail(selectedTicketId);
  }, [activeTab, selectedTicketId, loadTicketDetail]);

  const refreshOpenTicket = useCallback(() => {
    if (selectedTicketId) {
      void loadTicketDetail(selectedTicketId);
    }
  }, [selectedTicketId, loadTicketDetail]);

  useSupportTicketThread({
    ticketId: selectedTicketId,
    enabled: activeTab === 'tickets' && Boolean(selectedTicketId),
    fetchDetail: loadTicketDetail,
    pollIntervalMs: 4000,
  });

  const handleSendReply = async (attachments?: SupportAttachment[]) => {
    if (!selectedTicketId || (!replyText.trim() && !attachments?.length)) return;
    setSendingReply(true);
    try {
      await supportCrmApi.respondToTicket(selectedTicketId, {
        message: replyText.trim() || '(attachment)',
        responderId: getResolvedCustomerId() || undefined,
        responderType: 'customer',
        attachments,
      });
      toast.success('Message sent');
      setReplyText('');
      setReplyAttachments([]);
      await loadTicketDetail(selectedTicketId);
      await loadTickets();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to send';
      toast.error(msg);
    } finally {
      setSendingReply(false);
    }
  };

  const handleSubmitContact = async () => {
    if (!contactForm.subject.trim() || !contactForm.message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const customerId = getResolvedCustomerId() || undefined;
      const response = await apiClient.post<any>('/support/tickets', {
        subject: contactForm.subject,
        message: contactForm.message,
        category: contactForm.category,
        customerId,
        customerPhone: phone,
        bookingId: isBookingTicket ? activeBooking?.bookingId : undefined,
        orderId: isMealOrderTicket ? activeMeal?.orderId : undefined,
        source: 'customer',
        priority: isLinkedTicket ? 'high' : 'medium',
        attachments: contactAttachments.length ? contactAttachments : undefined,
        metadata: isBookingTicket
          ? { ticket_type: 'booking', booking_context: activeBooking }
          : isMealOrderTicket
            ? { ticket_type: 'meal_order', meal_order_context: activeMeal }
            : { ticket_type: 'general' },
      });

      if (response.success || response.ticketId || response.ticket?.id) {
        toast.success(
          isBookingTicket
            ? 'Booking support ticket created. Our team can review payment and refunds for this booking.'
            : isMealOrderTicket
              ? 'Meal order support ticket created. Our team can review payment and delivery for this order.'
              : 'Support ticket created successfully! We will get back to you soon.'
        );
        clearLinkedTicketContext();
        const created = response.ticket as Ticket | undefined;
        const newTicketId = created?.id || response.ticketId;
        setContactForm({
          subject: '',
          message: '',
          category: isLinkedTicket ? DEFAULT_LINKED_SUPPORT_CATEGORY : 'general',
        });
        setContactAttachments([]);
        setShowContactForm(false);
        setActiveTab('tickets');
        if (created) {
          setTickets((prev) => {
            const without = prev.filter((t) => t.id !== created.id);
            return [created, ...without];
          });
        } else {
          void loadTickets();
        }
        if (newTicketId) {
          setSelectedTicketId(String(newTicketId));
          setTicketDetail(null);
          setReplyText('');
          setReplyAttachments([]);
        }
      }
    } catch (error: any) {
      console.error('Error creating support ticket:', error);
      toast.error(error.message || 'Failed to create support ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChatbotNavigate = useCallback(
    (dest: string, data?: unknown) => {
      const d = (dest || '').trim();
      if (!d) return;
      if (onChatbotNavigate) {
        onChatbotNavigate(d, data);
        return;
      }
      if (d.startsWith('/')) {
        router.push(d);
      }
    },
    [onChatbotNavigate, router]
  );

  const ticketCreateForm = (
    <Card className="p-4 border border-gray-100 shadow-sm rounded-2xl pb-6">
      <button
        type="button"
        onClick={() => {
          setShowContactForm(false);
          clearLinkedTicketContext();
          setContactForm({
            subject: '',
            message: '',
            category: 'general',
          });
          setContactAttachments([]);
        }}
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#FF8C42] mb-4 -ml-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to contact options
      </button>
      <h3 className="font-semibold text-gray-900 mb-1">
        {isBookingTicket
          ? 'Help with this booking'
          : isMealOrderTicket
            ? 'Help with this meal order'
            : 'Create support ticket'}
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        {isBookingTicket
          ? 'Tell us what went wrong — our team can review payment and refunds for this booking.'
          : isMealOrderTicket
            ? 'Tell us what went wrong — our team can review payment, delivery, and refunds for this meal order.'
            : 'For general questions or account-related concerns. For booking or order help, open Help from that booking or order.'}
      </p>
      {isBookingTicket && activeBooking ? (
        <div className="mb-4 rounded-xl border border-[#FF8C42]/30 bg-[#FFF3E8] p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FF8C42]/15 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-[#FF8C42]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Booking-linked ticket</p>
              <p className="text-sm text-gray-700 truncate">
                {activeBooking.serviceName || 'Service booking'}
              </p>
              <p className="text-xs text-gray-500 mt-1 font-mono">
                ID: {activeBooking.bookingId.slice(0, 8)}…
              </p>
              {activeBooking.vendorName ? (
                <p className="text-xs text-gray-600 mt-1">{activeBooking.vendorName}</p>
              ) : null}
              <p className="text-xs text-[#FF8C42] mt-2">
                Support can review payment and process refunds for this booking.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {isMealOrderTicket && activeMeal ? (
        <div className="mb-4 rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Meal order ticket</p>
              <p className="text-sm text-gray-700 truncate">
                {activeMeal.planTitle || 'Meal plan order'}
              </p>
              {activeMeal.orderDisplayNumber ? (
                <p className="text-xs text-gray-500 mt-1 font-mono">
                  {activeMeal.orderDisplayNumber}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1 font-mono">
                  ID: {activeMeal.orderId.slice(0, 8)}…
                </p>
              )}
              {activeMeal.vendorName ? (
                <p className="text-xs text-gray-600 mt-1">{activeMeal.vendorName}</p>
              ) : null}
              {activeMeal.amount != null ? (
                <p className="text-xs text-gray-600 mt-1">
                  Amount: ₹{activeMeal.amount.toLocaleString('en-IN')}
                </p>
              ) : null}
              <p className="text-xs text-emerald-700 mt-2">
                Support can review payment, delivery, and process refunds for this order.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={contactForm.category}
            onChange={(e) => setContactForm({ ...contactForm, category: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] bg-white"
          >
            {(isLinkedTicket ? LINKED_SUPPORT_TICKET_CATEGORIES : GENERAL_SUPPORT_TICKET_CATEGORIES).map(
              (option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
          <Input
            type="text"
            value={contactForm.subject}
            onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
            placeholder="Brief description of your issue"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
          <Textarea
            value={contactForm.message}
            onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
            rows={6}
            placeholder="Please provide detailed information about your issue..."
            className="resize-none"
          />
        </div>

        <SupportAttachmentPicker
          attachments={contactAttachments}
          onChange={setContactAttachments}
          disabled={submitting}
        />

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setShowContactForm(false);
              clearLinkedTicketContext();
              setContactForm({
                subject: '',
                message: '',
                category: 'general',
              });
              setContactAttachments([]);
            }}
            className="flex-1 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmitContact}
            disabled={submitting}
            className="flex-1 rounded-xl bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
          >
            {submitting ? 'Submitting...' : isBookingTicket ? 'Submit ticket' : 'Submit ticket'}
          </Button>
        </div>
      </div>
    </Card>
  );

  const contactHub = (
    <SupportContactTab
      onStartChat={() => setShowAIChat(true)}
      onGoToTickets={() => {
        setSelectedTicketId(null);
        setTicketDetail(null);
        setActiveTab('tickets');
      }}
      onCreateTicket={() => setShowContactForm(true)}
    />
  );

  const openTickets = tickets.filter((t) => isOpenTicketStatus(t.status)).length;

  /** AI chat → ticket detail → contact form → shell exit */
  const handleInternalBack = useCallback(() => {
    if (showAIChat) {
      setShowAIChat(false);
      return;
    }
    if (activeTab === 'tickets' && selectedTicketId) {
      setSelectedTicketId(null);
      setTicketDetail(null);
      setReplyText('');
      setReplyAttachments([]);
      void loadTickets();
      return;
    }
    if (showContactForm && !isLinkedTicket) {
      setShowContactForm(false);
      return;
    }
    onBack();
  }, [
    showAIChat,
    activeTab,
    selectedTicketId,
    showContactForm,
    isLinkedTicket,
    onBack,
    loadTickets,
  ]);

  useEffect(() => {
    onInternalBackReady?.(handleInternalBack);
  }, [handleInternalBack, onInternalBackReady]);

  return (
    <div className="flex flex-col h-full min-h-0 w-full bg-gray-50 max-w-customer mx-auto">
      {/* Single sticky chrome: header + tabs share one stack so tab offset never uses a magic pixel height. */}
      <div className="sticky top-0 z-50 isolate shrink-0 bg-gray-50">
        <ServiceDashboardHeader
          className="z-50"
          serviceName="Help & Support"
          serviceSubtitle="We're here to help"
          serviceIcon={HelpCircle}
          iconColor="text-white"
          headerTrailingImage="/images/home/support/support.webp"
          headerTrailingImageAlt="Warmpawz support mascot"
          clipHeaderTrailingImage
          headerTrailingImageClassName="pointer-events-none absolute bottom-0 right-0 top-[2.25rem] z-[5] flex w-[42%] max-w-[168px] items-end justify-end sm:top-10"
          headerTrailingImageImgClassName="block h-full w-auto max-w-full origin-bottom-right scale-[1.08] object-contain object-right object-bottom drop-shadow-md"
          stats={[
            { value: String(SUPPORT_FAQ_CATEGORIES.length), label: 'Topics' },
            { value: phone ? String(tickets.length) : '—', label: 'Tickets' },
            { value: phone ? String(openTickets) : '—', label: 'Open' },
          ]}
          onCloseToHome={onCloseToHome}
          onBack={handleInternalBack}
          showBackButton={Boolean(onBack)}
        />

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200">
          <div className="flex">
            <button
              type="button"
              onClick={() => {
                setSelectedTicketId(null);
                setTicketDetail(null);
                setActiveTab('faq');
              }}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'faq'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              FAQ
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedTicketId(null);
                setTicketDetail(null);
                if (!linked.kind) {
                  setShowContactForm(false);
                }
                setActiveTab('contact');
              }}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'contact'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Contact
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tickets')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tickets'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              My Tickets
            </button>
          </div>
        </div>
      </div>

      <div
        className={
          activeTab === 'tickets' && selectedTicketId
            ? 'flex flex-1 min-h-0 flex-col overflow-hidden p-4 pb-0'
            : 'flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y p-4 pb-36 space-y-4'
        }
      >
        {activeTab === 'faq' && (
          <SupportFaqTab
            onAskAI={() => setShowAIChat(true)}
            onCreateTicket={() => {
              setSelectedTicketId(null);
              setTicketDetail(null);
              setActiveTab('contact');
              setShowContactForm(true);
            }}
            onGoToTickets={() => {
              setSelectedTicketId(null);
              setTicketDetail(null);
              setActiveTab('tickets');
            }}
          />
        )}

        {activeTab === 'contact' && (
          showContactForm || isLinkedTicket ? ticketCreateForm : contactHub
        )}

        {activeTab === 'tickets' && (
          selectedTicketId ? (
            <SupportTicketDetailView
              loadingInitial={loadingDetail && !ticketDetail}
              detail={ticketDetail}
              replyText={replyText}
              onReplyTextChange={setReplyText}
              sendingReply={sendingReply}
              onSendReply={(attachments) => void handleSendReply(attachments)}
              replyAttachments={replyAttachments}
              onReplyAttachmentsChange={setReplyAttachments}
              onMessagesRefresh={refreshOpenTicket}
              onBack={() => {
                setSelectedTicketId(null);
                setTicketDetail(null);
                setReplyText('');
                setReplyAttachments([]);
                void loadTickets();
              }}
            />
          ) : (
            <SupportTicketsListTab
              tickets={tickets}
              loading={loadingTickets}
              onRefresh={() => void loadTickets()}
              onCreateTicket={() => {
                setActiveTab('contact');
                setShowContactForm(true);
              }}
              onOpenTicket={(ticketId) => {
                setSelectedTicketId(ticketId);
                setTicketDetail(null);
                setReplyText('');
                setReplyAttachments([]);
              }}
            />
          )
        )}
      </div>

      {showAIChat && (
        <AIChatbotWidget
          presentation="modal"
          customerId={getResolvedCustomerId() || undefined}
          customerPhone={phone}
          onClose={() => setShowAIChat(false)}
          onNavigate={handleChatbotNavigate}
        />
      )}
    </div>
  );
}

