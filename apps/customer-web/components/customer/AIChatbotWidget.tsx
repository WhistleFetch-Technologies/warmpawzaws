'use client';
/**
 * AI Chatbot Widget - Web
 * AWS Bedrock-powered chatbot with symptoms checker, booking assist, and support
 * Phase 3: AI Chatbot Integration
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { useRouter } from 'next/navigation';
import { X, Send, Bot, User, AlertCircle, Headphones, Stethoscope, CalendarClock, MessageCircle } from 'lucide-react';
import { aiChatbotApi, apiClient, supportCrmApi } from '@/lib/api-client';
import {
  bookingServiceStyleShortLabel,
  defaultServiceStyleForCategory,
  distinctBookingStyleKeysFromServices,
  normalizeVendorServiceStyleToBookingKey,
  normalizeWizardCategory,
  paymentCategoryLabel,
  servicesFilteredByBookingStyleKey,
  vendorServicesQueryAllStyles,
  type BookingServiceStyleKey,
  type WizardCategory,
} from '@/lib/ai-booking-wizard-category-config';
import { UniversalPaymentPage } from '@/components/customer/payment/UniversalPaymentPage';
import { toast } from 'sonner';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import {
  appendHintStepsToMessage,
  buildBookingAssistActionsFromResponse,
  bookingThankYouBotContent,
  clearPersistedAiChatSession,
  inferBookingAssistIntent,
  inferBookingCategoryFromMessage,
  inferVisitStyleFromText,
  isBookingWizardPickPrompt,
  isWhitelistedAction,
  loadPersistedAiChatSession,
  normalizeActionKey,
  parseCategoryFromBookingUrl,
  resolveAiChatNavTarget,
  savePersistedAiChatSession,
  visitStyleChangeMessage,
  type BookingAssistIntent,
} from '@/lib/ai-chatbot-booking-ui';

interface AIChatbotWidgetProps {
  customerId?: string;
  customerPhone?: string;
  petId?: string;
  onClose?: () => void;
  onNavigate?: (dest: string, data?: any) => void;
  /**
   * `dock` — floating panel above home tab bar (default).
   * `modal` — same card UI as dock, for auth / guest pages (no bottom nav — sits above safe area).
   */
  presentation?: 'dock' | 'modal';
}

type BookingSuggestedProvider = {
  id: string;
  businessName: string;
  city?: string;
  roleName?: string;
  distanceKm?: number;
};

type WizardFsmStep = 'assist' | 'serviceType' | 'service' | 'date' | 'slot' | 'review' | 'booked';

type SessionDraft = {
  id: string;
  version: number;
  category: string;
  vendorId: string | null;
  vendorServiceId: string | null;
  serviceStyle: string | null;
  bookingDate: string | null;
  slotTime: string | null;
  totalDuration: number;
  status: string;
};

function mapSessionDraft(d: any): SessionDraft {
  return {
    id: String(d.id),
    version: Number(d.version ?? 1),
    category: String(d.category || 'vet'),
    vendorId: d.vendorId ? String(d.vendorId) : null,
    vendorServiceId: d.vendorServiceId ? String(d.vendorServiceId) : null,
    serviceStyle: d.serviceStyle ? String(d.serviceStyle) : null,
    bookingDate: d.bookingDate ? String(d.bookingDate) : null,
    slotTime: d.slotTime ? String(d.slotTime) : null,
    totalDuration: Number(d.totalDuration ?? 30),
    status: String(d.status || 'draft'),
  };
}

function nextCalendarDates(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

/** Local calendar add (avoids UTC shift vs YYYY-MM-DD from date chips). */
function addCalendarDays(isoDate: string, days: number): string {
  const parts = isoDate.split('-').map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return isoDate;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function countOpenSlots(slots: unknown): number {
  if (!Array.isArray(slots)) return 0;
  return slots.filter((x: any) => x?.available !== false).length;
}

interface Message {
  id: string;
  type: 'user' | 'bot' | 'system';
  content: string;
  timestamp: string;
  intent?: string;
  suggestedActions?: string[];
  suggestedProviders?: BookingSuggestedProvider[];
  requiresAgent?: boolean;
  /** When set, "Continue to booking" uses this path */
  bookingUrl?: string;
}

function getClientGeoForBooking(): Promise<{ lat: number; lng: number } | undefined> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => resolve(undefined),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 12_000 }
    );
  });
}

/** Match backend inferBookingCategoryFromText — fixes API URLs that wrongly use category=vet for "grooming" etc. */
function alignBookingSearchPath(path: string, userMessage: string): string {
  if (!path.startsWith('/search')) return path;
  const cat = inferBookingCategoryFromMessage(userMessage);
  if (!cat) return path;
  try {
    const qIdx = path.indexOf('?');
    const base = qIdx >= 0 ? path.slice(0, qIdx) : path;
    const sp = new URLSearchParams(qIdx >= 0 ? path.slice(qIdx + 1) : '');
    const cur = sp.get('category') || '';
    if (cur === cat) return path;
    if (cur === 'vet' && cat !== 'vet') {
      sp.set('category', cat);
      if (!sp.get('q')?.trim()) sp.set('q', userMessage.trim());
      return `${base}?${sp.toString()}`;
    }
    if (!cur) {
      sp.set('category', cat);
      if (!sp.get('q')?.trim()) sp.set('q', userMessage.trim());
      return `${base}?${sp.toString()}`;
    }
  } catch {
    /* ignore */
  }
  return path;
}

/** Normalize API provider rows so chips always render (camelCase + valid id). */
function mapSuggestedProvidersFromApi(raw: unknown): BookingSuggestedProvider[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const mapped = (raw as any[])
    .map((x) => ({
      id: String(x?.id ?? x?.vendor_id ?? x?.vendorId ?? '').trim(),
      businessName: String(x?.businessName ?? x?.business_name ?? 'Provider').trim(),
      city: x?.city != null ? String(x.city) : undefined,
      roleName:
        x?.roleName != null || x?.role_name != null ? String(x.roleName ?? x.role_name) : undefined,
      distanceKm:
        typeof x?.distanceKm === 'number'
          ? x.distanceKm
          : typeof x?.distance_km === 'number'
            ? x.distance_km
            : undefined,
    }))
    .filter((p) => p.id.length > 0 && p.businessName.length > 0);
  return mapped.length > 0 ? mapped : undefined;
}

export function AIChatbotWidget({
  customerId,
  customerPhone,
  petId,
  onClose,
  onNavigate,
  presentation = 'dock',
}: AIChatbotWidgetProps) {
  const router = useRouter();
  useVisualViewport();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastBookingUrlRef = useRef<string | null>(null);
  const lastBookingCategoryRef = useRef<string | null>(null);
  const lastBookingIntentRef = useRef<BookingAssistIntent>('discover');
  /** Prevents double close when touch fires pointerdown + click on the backdrop. */
  const backdropCloseDoneRef = useRef(false);
  const showMobileBackdrop = presentation === 'dock' || presentation === 'modal';

  const goTo = useCallback(
    (dest: string, data?: Record<string, unknown>) => {
      const d = (dest || '').trim();
      if (!d) return;
      const target = resolveAiChatNavTarget(d);
      if (target.kind === 'spa') {
        const navData = data ?? target.data;
        if (onNavigate) {
          onNavigate(target.screen, navData);
        } else {
          router.push('/');
        }
        return;
      }
      if (target.path.startsWith('/')) {
        if (onNavigate) onNavigate(target.path, data);
        else router.push(target.path);
      } else if (onNavigate) {
        onNavigate(target.path, data);
      }
    },
    [onNavigate, router]
  );

  // Widget is always open when rendered - parent controls visibility via conditional rendering
  const [isOpen, setIsOpen] = useState(true);
  /** First open: pick Symptom vs Booking (vs optional general chat), then show that assistant. */
  const [botEntry, setBotEntry] = useState<'choose' | 'active'>('choose');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [mode, setMode] = useState<'chat' | 'symptoms' | 'booking'>('chat');

  const enterSymptomBot = useCallback(() => {
    setMode('symptoms');
    setBotEntry('active');
    setConversationId(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        type: 'bot',
        content:
          "You're in **Symptom checker**. Describe what you're seeing — appetite, vomiting, limping, breathing, etc.\n\nThis is general guidance only, not a diagnosis. For emergencies, contact a vet immediately.",
        timestamp: new Date().toISOString(),
        suggestedActions: ['Contact Support'],
      },
    ]);
  }, []);

  const enterBookingBot = useCallback(() => {
    setMode('booking');
    setBotEntry('active');
    setConversationId(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        type: 'bot',
        content:
          "You're in **Booking assistant**. Tell me what you need — grooming, vet visit, training, boarding, etc. I'll help you find services and providers.",
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  const enterGeneralChat = useCallback(() => {
    setMode('chat');
    setBotEntry('active');
    setConversationId(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        type: 'bot',
        content:
          "Hi! I'm your Warmpawz AI Assistant. Ask about the app, orders, or pet care. Use **Change assistant** in the header anytime to pick symptoms, booking, or this chat again.",
        timestamp: new Date().toISOString(),
        suggestedActions: ['Contact Support'],
      },
    ]);
  }, []);

  /** Return to the in-chat bot picker (no header tabs). */
  const returnToBotPicker = useCallback(() => {
    clearPersistedAiChatSession(customerId, customerPhone);
    setInputText('');
    setConversationId(null);
    setSending(false);
    setMessages([]);
    setMode('chat');
    setBotEntry('choose');
    setBookingSessionId(null);
    setBookingDraft(null);
    setWizardStep('assist');
    setBookedVendorName(null);
    selectedVendorNameRef.current = null;
    lastBookingUrlRef.current = null;
    lastBookingCategoryRef.current = null;
    lastBookingIntentRef.current = 'discover';
    lastBookingQueryRef.current = '';
  }, [customerId, customerPhone]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastBookingQueryRef = useRef('');
  const selectedVendorNameRef = useRef<string | null>(null);
  const [bookingSessionId, setBookingSessionId] = useState<string | null>(null);
  const [bookingDraft, setBookingDraft] = useState<SessionDraft | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardFsmStep>('assist');
  const [wizardCategory, setWizardCategory] = useState<WizardCategory>('vet');
  const [wizardVendorServicesAll, setWizardVendorServicesAll] = useState<any[]>([]);
  const [wizardServices, setWizardServices] = useState<any[]>([]);
  const [wizardSlots, setWizardSlots] = useState<any[]>([]);
  const [wizardSlotsRaw, setWizardSlotsRaw] = useState<unknown>(null);
  const [wizardDate, setWizardDate] = useState<string | null>(null);
  const [wizardBusy, setWizardBusy] = useState(false);
  /** Slot list fetch + 3-week scan — separate from wizardBusy so user actions are not stuck if an effect run is cancelled. */
  const [wizardSlotsLoading, setWizardSlotsLoading] = useState(false);
  const [wizardSuggestedDates, setWizardSuggestedDates] = useState<{ date: string; openCount: number }[]>([]);
  const [wizardAlternativesLoading, setWizardAlternativesLoading] = useState(false);
  const [wizardAvailableDates, setWizardAvailableDates] = useState<string[]>([]);
  const [wizardDatesLoading, setWizardDatesLoading] = useState(false);
  const [paymentHandoff, setPaymentHandoff] = useState<Record<string, unknown> | null>(null);
  const [bookedVendorName, setBookedVendorName] = useState<string | null>(null);
  const sessionRestoredRef = useRef(false);

  const finalizeBookingAfterPayment = useCallback((vendorName?: string) => {
    const vendorLabel =
      (vendorName || selectedVendorNameRef.current || bookedVendorName || '').trim() || 'your provider';
    selectedVendorNameRef.current = vendorLabel;
    setBookedVendorName(vendorLabel);
    setWizardStep('booked');
    setPaymentHandoff(null);
    setWizardBusy(false);
    setMessages((prev) => {
      const withoutPicks = prev.filter(
        (m) => !(m.type === 'bot' && m.intent === 'booking' && isBookingWizardPickPrompt(m.content))
      );
      const thankYouContent = bookingThankYouBotContent(vendorLabel);
      if (withoutPicks.some((m) => m.type === 'bot' && m.content === thankYouContent)) {
        return withoutPicks;
      }
      return [
        ...withoutPicks,
        {
          id: `bot-booked-${Date.now()}`,
          type: 'bot' as const,
          content: thankYouContent,
          timestamp: new Date().toISOString(),
          intent: 'booking',
        },
      ];
    });
    toast.success('Booking confirmed');
  }, [bookedVendorName]);

  const persistChatState = useCallback(() => {
    if (botEntry === 'choose' && messages.length === 0) return;
    savePersistedAiChatSession(
      {
        savedAt: Date.now(),
        mode,
        botEntry,
        messages,
        conversationId,
        bookingSessionId,
        bookingDraft,
        wizardStep,
        wizardCategory,
        bookedVendorName,
        lastBookingUrl: lastBookingUrlRef.current,
        lastBookingQuery: lastBookingQueryRef.current,
      },
      customerId,
      customerPhone
    );
  }, [
    botEntry,
    messages,
    mode,
    conversationId,
    bookingSessionId,
    bookingDraft,
    wizardStep,
    wizardCategory,
    bookedVendorName,
    customerId,
    customerPhone,
  ]);

  const closeWidget = useCallback(() => {
    persistChatState();
    setIsOpen(false);
    onClose?.();
  }, [persistChatState, onClose]);

  const closeFromBackdrop = useCallback(() => {
    if (backdropCloseDoneRef.current) return;
    backdropCloseDoneRef.current = true;
    closeWidget();
  }, [closeWidget]);

  useEffect(() => {
    if (sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;
    const saved = loadPersistedAiChatSession(customerId, customerPhone);
    if (!saved || saved.botEntry !== 'active' || !Array.isArray(saved.messages) || saved.messages.length === 0) {
      return;
    }
    setMode(saved.mode);
    setBotEntry('active');
    setMessages(saved.messages as Message[]);
    setConversationId(saved.conversationId);
    setBookingSessionId(saved.bookingSessionId);
    if (saved.bookingDraft) {
      setBookingDraft(mapSessionDraft(saved.bookingDraft));
    }
    setWizardStep((saved.wizardStep as WizardFsmStep) || 'assist');
    setWizardCategory(normalizeWizardCategory(saved.wizardCategory));
    const restoredVendor =
      typeof saved.bookedVendorName === 'string' && saved.bookedVendorName.trim()
        ? saved.bookedVendorName.trim()
        : null;
    if (restoredVendor) {
      setBookedVendorName(restoredVendor);
      selectedVendorNameRef.current = restoredVendor;
    } else if (saved.wizardStep === 'booked' && Array.isArray(saved.messages)) {
      const thankYou = (saved.messages as Message[]).findLast(
        (m) => m.type === 'bot' && typeof m.content === 'string' && /\byour service is booked/i.test(m.content)
      );
      const match = thankYou?.content?.match(/^\*\*(.+?)\*\*/);
      if (match?.[1]) {
        const name = match[1].trim();
        setBookedVendorName(name);
        selectedVendorNameRef.current = name;
      }
    }
    lastBookingUrlRef.current = saved.lastBookingUrl;
    lastBookingQueryRef.current = saved.lastBookingQuery || '';
  }, [customerId, customerPhone]);

  useEffect(() => {
    persistChatState();
  }, [persistChatState]);

  useEffect(() => {
    if (mode !== 'booking') {
      setBookingSessionId(null);
      setBookingDraft(null);
      setWizardStep('assist');
      setWizardVendorServicesAll([]);
      setWizardServices([]);
      setWizardSlots([]);
      setWizardSlotsRaw(null);
      setWizardDate(null);
      setWizardSuggestedDates([]);
      setWizardAlternativesLoading(false);
      setWizardSlotsLoading(false);
      setWizardAvailableDates([]);
      setWizardDatesLoading(false);
      setPaymentHandoff(null);
      setBookedVendorName(null);
      selectedVendorNameRef.current = null;
    }
  }, [mode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const patchBookingDraft = useCallback(
    async (partial: Record<string, unknown>) => {
      if (!bookingSessionId || !bookingDraft) {
        throw new Error('No booking session');
      }
      const r: any = await aiChatbotApi.patchBookingSession(bookingSessionId, {
        expectedVersion: bookingDraft.version,
        customerId,
        customerPhone,
        ...partial,
      });
      if (r?.draft) {
        const d = mapSessionDraft(r.draft);
        setBookingDraft(d);
        return d;
      }
      throw new Error(r?.error || 'Could not update booking draft');
    },
    [bookingSessionId, bookingDraft, customerId, customerPhone]
  );

  const pickWizardServiceType = useCallback(
    async (key: BookingServiceStyleKey) => {
      if (wizardStep === 'booked' || !bookingSessionId || !bookingDraft) return;
      const filtered = servicesFilteredByBookingStyleKey(wizardVendorServicesAll, key);
      if (filtered.length === 0) {
        toast.error('No services for that visit type.');
        return;
      }
      setWizardBusy(true);
      try {
        await patchBookingDraft({
          serviceStyle: key,
          vendorServiceId: null,
          bookingDate: null,
          slotTime: null,
        });
        setWizardServices(filtered);
        setWizardStep('service');
        setWizardDate(null);
        setWizardAvailableDates([]);
        setWizardSlots([]);
        setWizardSlotsRaw(null);
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            type: 'bot',
            content:
              key === 'at_center'
                ? 'Pick an in-clinic / center service below, then a date and time.'
                : key === 'at_home'
                  ? 'Pick a home-visit service below, then a date and time.'
                  : 'Pick a tele / video service below, then a date and time.',
            timestamp: new Date().toISOString(),
            intent: 'booking',
          },
        ]);
      } catch (e: any) {
        toast.error(e?.message || 'Could not set visit type');
      } finally {
        setWizardBusy(false);
      }
    },
    [bookingSessionId, bookingDraft, wizardVendorServicesAll, patchBookingDraft, wizardStep]
  );

  const applyVisitStyleFromChat = useCallback(
    async (messageText: string): Promise<boolean> => {
      if (wizardStep === 'booked') return false;
      const style = inferVisitStyleFromText(messageText);
      if (!style || !bookingSessionId || !bookingDraft) return false;
      const filtered = servicesFilteredByBookingStyleKey(wizardVendorServicesAll, style);
      if (filtered.length === 0) {
        toast.error(`This provider does not offer ${bookingServiceStyleShortLabel(style)} services.`);
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            type: 'bot',
            content: `No ${bookingServiceStyleShortLabel(style)} services for this provider. Use **Change visit type** chips below or pick another provider.`,
            timestamp: new Date().toISOString(),
            intent: 'booking',
          },
        ]);
        return true;
      }
      setWizardBusy(true);
      try {
        const d = await patchBookingDraft({
          serviceStyle: style,
          vendorServiceId: null,
          bookingDate: null,
          slotTime: null,
        });
        setBookingDraft(d);
        setWizardServices(filtered);
        setWizardStep('service');
        setWizardDate(null);
        setWizardSlots([]);
        setWizardSlotsRaw(null);
        setWizardSuggestedDates([]);
        setWizardAvailableDates([]);
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            type: 'bot',
            content: visitStyleChangeMessage(style),
            timestamp: new Date().toISOString(),
            intent: 'booking',
          },
        ]);
        return true;
      } catch (e: any) {
        toast.error(e?.message || 'Could not change visit type');
        return true;
      } finally {
        setWizardBusy(false);
      }
    },
    [bookingSessionId, bookingDraft, wizardVendorServicesAll, patchBookingDraft, wizardStep]
  );

  const handlePickSuggestedProvider = useCallback(
    async (p: BookingSuggestedProvider) => {
      selectedVendorNameRef.current = p.businessName?.trim() || null;
      setBookedVendorName(null);
      setMode('booking');
      setWizardStep('serviceType');
      setWizardDate(null);
      setWizardSlots([]);
      setWizardSlotsRaw(null);
      setWizardSuggestedDates([]);
      setWizardAlternativesLoading(false);
      setWizardSlotsLoading(false);
      setWizardVendorServicesAll([]);
      setWizardServices([]);
      setWizardBusy(true);
      try {
        const cat = wizardCategory;
        const ss = defaultServiceStyleForCategory(cat);
        const created: any = await aiChatbotApi.createBookingSession({
          customerId,
          customerPhone,
          category: cat,
          serviceStyle: ss,
        });
        if (!created?.draft?.id) {
          toast.error(created?.error || 'Could not start booking session');
          return;
        }
        const sid = String(created.draft.id);
        const ver = Number(created.draft.version ?? 1);
        setBookingSessionId(sid);
        setBookingDraft(mapSessionDraft(created.draft));

        const patched: any = await aiChatbotApi.patchBookingSession(sid, {
          expectedVersion: ver,
          customerId,
          customerPhone,
          vendorId: p.id,
          category: cat,
          serviceStyle: ss,
          ...(petId ? { petId } : {}),
        });
        if (!patched?.success) {
          toast.error(patched?.error || 'Could not select provider');
          return;
        }
        const draftAfterVendor = mapSessionDraft(patched.draft);
        setBookingDraft(draftAfterVendor);

        const qs = vendorServicesQueryAllStyles(cat);
        const svcRes: any = await apiClient.get(`/customer/vendor/${encodeURIComponent(p.id)}/services${qs}`);
        const list = Array.isArray(svcRes?.services)
          ? mergeCustomerVendorServicesPayload(svcRes)
          : Array.isArray(svcRes)
            ? svcRes
            : [];
        setWizardVendorServicesAll(list);

        if (list.length === 0) {
          toast.error('No bookable services for this provider in this category.');
          return;
        }

        const styles = distinctBookingStyleKeysFromServices(list);
        if (styles.length === 1) {
          const key = styles[0];
          const filtered = servicesFilteredByBookingStyleKey(list, key);
          const stPatch: any = await aiChatbotApi.patchBookingSession(sid, {
            expectedVersion: draftAfterVendor.version,
            customerId,
            customerPhone,
            serviceStyle: key,
          });
          if (!stPatch?.success) {
            toast.error(stPatch?.error || 'Could not set visit type');
            return;
          }
          if (stPatch.draft) setBookingDraft(mapSessionDraft(stPatch.draft));
          setWizardServices(filtered);
          setWizardStep('service');
          setMessages((prev) => [
            ...prev,
            {
              id: `bot-${Date.now()}`,
              type: 'bot',
              content: `**${p.businessName}** — pick a service below, then choose a date and time.`,
              timestamp: new Date().toISOString(),
              intent: 'booking',
            },
          ]);
        } else {
          setWizardStep('serviceType');
          setMessages((prev) => [
            ...prev,
            {
              id: `bot-${Date.now()}`,
              type: 'bot',
              content: `**${p.businessName}** — pick a **visit type** (clinic, home, or video), then a service, date, and time.`,
              timestamp: new Date().toISOString(),
              intent: 'booking',
            },
          ]);
        }
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'Could not start in-chat booking');
      } finally {
        setWizardBusy(false);
      }
    },
    [wizardCategory, customerId, customerPhone, petId]
  );

  /** Only show calendar chips for days that have at least one open slot (next 21 days). */
  useEffect(() => {
    if (wizardStep === 'booked' || mode !== 'booking' || wizardStep !== 'date') {
      setWizardAvailableDates([]);
      setWizardDatesLoading(false);
      return;
    }
    if (!bookingDraft?.vendorId || !bookingDraft?.vendorServiceId) return;

    let cancelled = false;
    const st = bookingDraft.serviceStyle
      ? normalizeVendorServiceStyleToBookingKey(bookingDraft.serviceStyle)
      : defaultServiceStyleForCategory(normalizeWizardCategory(wizardCategory));
    const dur = bookingDraft.totalDuration || 30;
    const vendorId = bookingDraft.vendorId;
    const serviceId = bookingDraft.vendorServiceId;

    (async () => {
      setWizardDatesLoading(true);
      setWizardAvailableDates([]);
      const candidates = nextCalendarDates(21);
      const available: string[] = [];

      const fetchOpen = async (dateStr: string) => {
        const q = new URLSearchParams({
          date: dateStr,
          serviceStyle: st,
          serviceId,
          totalDuration: String(dur),
        });
        const res: any = await apiClient.get(
          `/customer/vendor/${encodeURIComponent(vendorId)}/available-slots?${q.toString()}`
        );
        const slots = Array.isArray(res?.slots) ? res.slots : [];
        return countOpenSlots(slots);
      };

      try {
        for (let i = 0; i < candidates.length && !cancelled; i += 5) {
          const batch = candidates.slice(i, i + 5);
          const counts = await Promise.all(
            batch.map(async (dateStr) => ({ dateStr, open: await fetchOpen(dateStr).catch(() => 0) }))
          );
          for (const row of counts) {
            if (row.open > 0) available.push(row.dateStr);
          }
        }
        if (!cancelled) {
          setWizardAvailableDates(available);
        }
      } catch (e) {
        console.error('[AIChatbot] date availability scan failed', e);
        if (!cancelled) setWizardAvailableDates([]);
      } finally {
        if (!cancelled) setWizardDatesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      setWizardDatesLoading(false);
    };
  }, [
    mode,
    wizardStep,
    bookingDraft?.vendorId,
    bookingDraft?.vendorServiceId,
    bookingDraft?.serviceStyle,
    bookingDraft?.totalDuration,
    wizardCategory,
  ]);

  useEffect(() => {
    if (mode !== 'booking') return;
    if (wizardStep === 'booked' || wizardStep !== 'slot') return;
    if (!wizardDate || !bookingDraft?.vendorId || !bookingDraft.vendorServiceId) return;

    let cancelled = false;
    setWizardSuggestedDates([]);

    (async () => {
      setWizardSlotsLoading(true);
      setWizardAlternativesLoading(false);
      if (!cancelled) {
        setWizardSlots([]);
        setWizardSlotsRaw(null);
      }
      const st = bookingDraft.serviceStyle
        ? normalizeVendorServiceStyleToBookingKey(bookingDraft.serviceStyle)
        : defaultServiceStyleForCategory(normalizeWizardCategory(wizardCategory));
      const dur = bookingDraft.totalDuration || 30;
      const vendorId = bookingDraft.vendorId;
      const serviceId = bookingDraft.vendorServiceId;

      const fetchSlotsForDate = async (dateStr: string) => {
        const q = new URLSearchParams({
          date: dateStr,
          serviceStyle: st,
          serviceId,
          totalDuration: String(dur),
        });
        const res: any = await apiClient.get(
          `/customer/vendor/${encodeURIComponent(vendorId)}/available-slots?${q.toString()}`
        );
        const slots = Array.isArray(res?.slots) ? res.slots : [];
        return { res, slots, open: countOpenSlots(slots) };
      };

      try {
        const { res, slots, open } = await fetchSlotsForDate(wizardDate);
        if (cancelled) return;
        setWizardSlotsRaw(res);
        setWizardSlots(slots);

        if (open === 0) {
          setWizardAlternativesLoading(true);
          const found: { date: string; openCount: number }[] = [];
          const maxDaysAhead = 21;
          const maxSuggestions = 8;
          for (let batchStart = 1; batchStart <= maxDaysAhead && found.length < maxSuggestions; batchStart += 5) {
            const tasks: Promise<{ date: string; openCount: number }>[] = [];
            for (let k = 0; k < 5 && batchStart + k <= maxDaysAhead; k++) {
              const dayOffset = batchStart + k;
              const dateStr = addCalendarDays(wizardDate, dayOffset);
              tasks.push(
                fetchSlotsForDate(dateStr)
                  .then(({ open: o }) => ({ date: dateStr, openCount: o }))
                  .catch(() => ({ date: dateStr, openCount: 0 }))
              );
            }
            const chunk = await Promise.all(tasks);
            if (cancelled) return;
            for (const row of chunk.sort((a, b) => a.date.localeCompare(b.date))) {
              if (row.openCount > 0) found.push(row);
            }
          }
          if (!cancelled) {
            setWizardSuggestedDates(found.slice(0, maxSuggestions));
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error(e);
          toast.error(e?.message || 'Could not load time slots');
          setWizardSlots([]);
          setWizardSlotsRaw(null);
        }
      } finally {
        setWizardSlotsLoading(false);
        setWizardAlternativesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      setWizardSlotsLoading(false);
    };
  }, [
    mode,
    wizardStep,
    wizardDate,
    bookingDraft?.vendorId,
    bookingDraft?.vendorServiceId,
    bookingDraft?.serviceStyle,
    bookingDraft?.totalDuration,
    wizardCategory,
  ]);

  const sendMessage = async () => {
    if (botEntry !== 'active' || !inputText.trim() || sending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputText.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    if (mode !== 'booking' && mode !== 'symptoms') {
      lastBookingUrlRef.current = null;
    }

    try {
      let response: any;
      
      if (mode === 'symptoms') {
        response = await aiChatbotApi.symptomsChecker({
          symptoms: messageText,
          petId,
          customerId,
          customerPhone,
        });

        let bookingPath =
          typeof response.bookingUrl === 'string' && response.bookingUrl.startsWith('/')
            ? response.bookingUrl
            : '/search?category=vet';
        bookingPath = alignBookingSearchPath(bookingPath, messageText);
        lastBookingUrlRef.current = bookingPath;

        const vetBook = Boolean(response.vetBookingSuggested);
        const suggestedActions = vetBook ? ['Go to Booking', 'Continue to booking'] : undefined;

        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          content: response.response || 'I understand your concern. Please consult with a veterinarian for proper diagnosis.',
          timestamp: new Date().toISOString(),
          intent: 'symptoms',
          ...(suggestedActions && suggestedActions.length > 0 ? { suggestedActions } : {}),
          bookingUrl: bookingPath,
        };

        setMessages(prev => [...prev, botMessage]);
      } else if (mode === 'booking') {
        lastBookingQueryRef.current = messageText;
        const inferred = inferBookingCategoryFromMessage(messageText);
        if (inferred) {
          setWizardCategory(normalizeWizardCategory(inferred));
        }

        if (wizardStep === 'booked') {
          return;
        }
        if (bookingSessionId && wizardStep !== 'assist') {
          if (await applyVisitStyleFromChat(messageText)) {
            return;
          }
          const interp: any = await aiChatbotApi.interpretBookingSession(bookingSessionId, {
            message: messageText,
          });
          if (interp?.draft) {
            const nextDraft = mapSessionDraft(interp.draft);
            setBookingDraft(nextDraft);
            if (interp.appliedActions?.some((a: { type?: string }) => a?.type === 'setServiceStyle')) {
              const styleKey = normalizeVendorServiceStyleToBookingKey(nextDraft.serviceStyle);
              const filtered = servicesFilteredByBookingStyleKey(wizardVendorServicesAll, styleKey);
              setWizardServices(filtered);
              setWizardStep(filtered.length > 0 ? 'service' : 'serviceType');
              setWizardDate(null);
              setWizardAvailableDates([]);
            }
          }
          const botMessage: Message = {
            id: `bot-${Date.now()}`,
            type: 'bot',
            content:
              interp?.assistantMessage ||
              'I updated your booking draft where it was safe to do so. Use the chips below for date and time.',
            timestamp: new Date().toISOString(),
            intent: 'booking',
          };
          setMessages((prev) => [...prev, botMessage]);
        } else {
          const bookingLocation = await getClientGeoForBooking();
          response = await aiChatbotApi.bookingAssist({
            query: messageText,
            customerId,
            customerPhone,
            petId,
            ...(bookingLocation ? { location: bookingLocation } : {}),
          });

          let bookingPath =
            typeof response.bookingUrl === 'string' && response.bookingUrl.startsWith('/')
              ? response.bookingUrl
              : '/search';
          bookingPath = alignBookingSearchPath(bookingPath, messageText);

          const stepLabels = Array.isArray(response.nextSteps)
            ? response.nextSteps.filter((s: unknown) => typeof s === 'string' && String(s).trim())
            : [];

          const suggestedProviders = mapSuggestedProvidersFromApi(response.suggestedProviders);
          const hasProviders = Boolean(suggestedProviders && suggestedProviders.length > 0);
          const category =
            inferBookingCategoryFromMessage(messageText) ||
            parseCategoryFromBookingUrl(bookingPath) ||
            null;

          const apiIntent = response.assistIntent as BookingAssistIntent | undefined;
          let intent: BookingAssistIntent =
            apiIntent === 'trouble' || apiIntent === 'discover' || apiIntent === 'resume'
              ? apiIntent
              : inferBookingAssistIntent(messageText, {
                  forceResume: hasProviders || Boolean(bookingSessionId),
                });
          if (hasProviders && intent !== 'trouble') {
            intent = 'resume';
          }
          lastBookingIntentRef.current = intent;
          lastBookingCategoryRef.current = category;

          if (intent === 'trouble') {
            lastBookingUrlRef.current = category ? `/search?category=${category}` : null;
          } else {
            lastBookingUrlRef.current = bookingPath;
          }

          const { actions: bookingActions, hintSteps } = buildBookingAssistActionsFromResponse({
            intent,
            hasProviders,
            category,
            stepLabels,
          });

          const botMessage: Message = {
            id: `bot-${Date.now()}`,
            type: 'bot',
            content: appendHintStepsToMessage(
              response.response || "I'd be happy to help you book a service!",
              hintSteps,
              bookingActions
            ),
            timestamp: new Date().toISOString(),
            intent: 'booking',
            suggestedActions: bookingActions,
            suggestedProviders,
            bookingUrl: lastBookingUrlRef.current || bookingPath,
          };

          setMessages((prev) => [...prev, botMessage]);
        }
      } else {
        response = await aiChatbotApi.chat({
          message: messageText,
          customerId,
          customerPhone,
          conversationId: conversationId || undefined,
          petId,
          context: { widgetMode: 'chat' },
        });
        
        if (!conversationId && response.conversationId) {
          setConversationId(response.conversationId);
        }
        
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          content: response.response || "I'm here to help!",
          timestamp: new Date().toISOString(),
          intent: response.intent,
          suggestedActions: ['Create Ticket', 'Contact Support'].filter(isWhitelistedAction),
          requiresAgent: response.requiresAgent,
        };
        
        setMessages(prev => [...prev, botMessage]);
        
        if (response.requiresAgent) {
          const shouldEscalate = confirm('Would you like to be connected with a human support agent?');
          if (shouldEscalate) {
            await handleEscalateToAgent(response.conversationId || conversationId || '');
          }
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: 'system',
        content: 'Sorry, I encountered an error. Please try again or contact support.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const handleEscalateToAgent = async (convId: string) => {
    try {
      const conversationHistory = messages
        .map(m => `${m.type}: ${m.content}`)
        .join('\n');
      
      const response: any = await aiChatbotApi.escalateToAgent({
        conversationId: convId,
        customerId,
        customerPhone,
        reason: 'User requested human agent',
        conversationHistory,
      });
      
      const systemMessage: Message = {
        id: `system-${Date.now()}`,
        type: 'system',
        content: response.message || 'Your conversation has been escalated to a support agent. They will contact you shortly.',
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, systemMessage]);
    } catch (error: any) {
      console.error('Error escalating to agent:', error);
      alert('Failed to connect with agent. Please try again.');
    }
  };

  const handleContactSupport = useCallback(() => {
    const transcript =
      [...messages].reverse().find((m) => m.type === 'user')?.content?.slice(0, 800) || '';

    if (onNavigate && customerId) {
      onNavigate('support_help', { initialTab: 'contact' });
      closeWidget();
      return;
    }

    const digits = (customerPhone || '').replace(/\D/g, '');
    const defaultBody =
      transcript ||
      'I need help with Warmpawz (reached via Contact Support in the AI Assistant).';

    if (digits.length >= 10) {
      void (async () => {
        try {
          await supportCrmApi.createTicket({
            customerId,
            customerPhone,
            subject: 'Support request (AI Assistant)',
            message: defaultBody.slice(0, 4000),
            source: 'ai_chatbot',
            priority: 'medium',
            category: 'general',
          });
          toast.success('Support request received. Our team will follow up.');
        } catch (e: any) {
          console.error('createTicket', e);
          toast.error(e?.message || 'Could not submit online.');
          const sub = encodeURIComponent('Support request (AI Assistant)');
          const body = encodeURIComponent(
            `${defaultBody}\n\n(Sent by email because online ticket could not be created.)`
          );
          if (typeof window !== 'undefined') {
            window.location.href = `mailto:support@warmpawz.com?subject=${sub}&body=${body}`;
          }
          toast.info('Opening email to support@warmpawz.com');
        }
      })();
      return;
    }

    const sub = encodeURIComponent('WARMPAWZ Customer Support');
    const body = encodeURIComponent(
      `${transcript ? `From in-app chat:\n${transcript}\n\n` : ''}Describe your issue below:\n`
    );
    if (typeof window !== 'undefined') {
      window.location.href = `mailto:support@warmpawz.com?subject=${sub}&body=${body}`;
    }
    toast.info('Opening your email app. Sign in later for in-app tickets.');
  }, [customerId, customerPhone, messages, closeWidget, onNavigate]);

  const handleContinueToBooking = useCallback(() => {
    const lastWithProviders = [...messages]
      .reverse()
      .find((m) => m.suggestedProviders && m.suggestedProviders.length > 0);

    if (bookingSessionId && bookingDraft?.vendorId) {
      toast.message('Continue in the panel below — visit type, service, date, and time.');
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (lastWithProviders?.suggestedProviders?.length) {
      toast.message('Tap a provider name below to book in the chat.');
      return;
    }

    const category = lastBookingCategoryRef.current;
    const intent = lastBookingIntentRef.current;
    const url = lastBookingUrlRef.current;

    if (intent === 'trouble' && !url && !category) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          type: 'bot',
          content:
            'Which service are you trying to book — **vet**, **grooming**, **training**, or **boarding**? Tell me and I can guide you to the right place.',
          timestamp: new Date().toISOString(),
          intent: 'booking',
        },
      ]);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (category && (!url || url.startsWith('/search'))) {
      goTo(category);
      closeWidget();
      return;
    }

    if (url) {
      goTo(url);
      closeWidget();
      return;
    }

    goTo('/search?category=vet');
    closeWidget();
  }, [bookingSessionId, bookingDraft, messages, goTo, closeWidget]);

  const handleSuggestedAction = (action: string) => {
    if (!isWhitelistedAction(action)) {
      return;
    }

    const key = normalizeActionKey(action);

    if (key === 'book in chat') {
      setMode('booking');
      toast.message('Tap a provider below to start booking in the chat.');
      return;
    }

    if (key === 'go to booking' || key === 'continue to booking' || key === 'try again') {
      if (mode === 'symptoms') {
        setMode('booking');
      }
      handleContinueToBooking();
      return;
    }

    if (key === 'browse bookings' || key === 'view my bookings') {
      goTo('my-bookings');
      closeWidget();
      return;
    }

    if (key === 'browse services') {
      const category = lastBookingCategoryRef.current;
      if (category) {
        goTo(category);
      } else {
        goTo(lastBookingUrlRef.current || '/search');
      }
      closeWidget();
      return;
    }

    if (key === 'create ticket') {
      const recentUser = [...messages].reverse().find(m => m.type === 'user');
      const transcript = recentUser?.content?.slice(0, 800) || '';
      const extra =
        typeof window !== 'undefined'
          ? window.prompt('Add details for support (optional):', transcript) ?? transcript
          : transcript;
      const body = [transcript && `Latest message: ${transcript}`, extra && extra !== transcript ? extra : '']
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 4000);
      void (async () => {
        try {
          await supportCrmApi.createTicket({
            customerId,
            customerPhone,
            subject: 'Support request (AI Chat)',
            message: body || 'Customer requested support from AI Assistant.',
            source: 'ai_chatbot',
            priority: 'medium',
            category: 'general',
          });
          toast.success('Support ticket created. Our team will follow up.');
        } catch (e: any) {
          console.error('createTicket', e);
          toast.error(e?.message || 'Could not create ticket.');
          const sub = encodeURIComponent('Support request (AI Chat)');
          const fallbackBody =
            body || 'Customer requested support from AI Assistant.';
          const mailBody = encodeURIComponent(
            `${fallbackBody}\n\n(Sent by email because online ticket could not be created.)`
          );
          if (typeof window !== 'undefined') {
            window.location.href = `mailto:support@warmpawz.com?subject=${sub}&body=${mailBody}`;
          }
          toast.info('Opening email to support@warmpawz.com');
        }
      })();
      return;
    }

    if (key === 'contact support') {
      handleContactSupport();
      return;
    }
  };

  // Keep the floating panel above the virtual keyboard on mobile.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const basePx = presentation === 'modal' ? 16 : 104; // 1rem vs 6.5rem

    function updatePanel() {
      const el = panelRef.current;
      if (!el) return;
      const kbHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.bottom = `${Math.max(basePx, kbHeight + basePx)}px`;
      el.style.maxHeight = `${vv.height - basePx - 16}px`;
    }

    updatePanel();
    vv.addEventListener('resize', updatePanel);
    vv.addEventListener('scroll', updatePanel);
    return () => {
      vv.removeEventListener('resize', updatePanel);
      vv.removeEventListener('scroll', updatePanel);
    };
  }, [presentation]);

  if (!isOpen) {
    return null;
  }

  const panelShell =
    presentation === 'modal'
      ? [
          'fixed z-[56] flex min-h-0 flex-col bg-white rounded-lg shadow-2xl border border-gray-200',
          'left-3 right-3 bottom-[max(1rem,env(safe-area-inset-bottom,0px))]',
          'max-h-[min(600px,calc(100dvh-2rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px)))]',
          'sm:left-auto sm:right-6 sm:w-96',
        ].join(' ')
      : [
          'fixed z-[56] flex flex-col min-h-[min(22rem,58dvh)] bg-white rounded-lg shadow-2xl border border-gray-200',
          'left-3 right-3 bottom-[max(6.5rem,calc(5.5rem+env(safe-area-inset-bottom,0px)))]',
          'max-h-[min(600px,calc(100dvh-7.5rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px)))]',
          'sm:left-auto sm:right-6 sm:w-96',
        ].join(' ');

  return (
    <>
      {showMobileBackdrop && (
        <button
          type="button"
          className="fixed inset-0 z-[55] bg-black/40 sm:hidden"
          aria-label="Close chat"
          style={{ touchAction: 'manipulation' }}
          onClick={closeFromBackdrop}
          onPointerDown={(e) => {
            if (e.pointerType === 'touch') {
              closeFromBackdrop();
            }
          }}
        />
      )}
      <div ref={panelRef} className={panelShell}>
      {/* Header — match home FAB / Help gradient */}
      <div className="flex flex-col gap-2 p-4 border-b border-gray-200 shrink-0 rounded-t-lg bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="w-5 h-5 shrink-0" />
            <h3 className="font-semibold truncate">AI Assistant</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleContactSupport()}
              className="flex items-center gap-1 rounded-full bg-white/20 hover:bg-white/30 px-2.5 py-1.5 text-xs font-semibold"
              aria-label="Contact support"
            >
              <Headphones className="w-3.5 h-3.5 shrink-0" />
              Support
            </button>
            <button
              type="button"
              onClick={() => closeWidget()}
              className="shrink-0 hover:bg-white/20 rounded-lg p-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {botEntry === 'choose' ? (
          <p className="text-xs text-white/95 font-medium">Choose an assistant below</p>
        ) : (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-medium text-white/95">
              {mode === 'symptoms' && 'Symptom checker'}
              {mode === 'booking' && 'Booking assistant'}
              {mode === 'chat' && 'General chat'}
            </span>
            <button
              type="button"
              onClick={returnToBotPicker}
              className="text-xs font-semibold rounded-full bg-white/20 hover:bg-white/30 px-2.5 py-1 text-white shrink-0"
            >
              Change assistant
            </button>
          </div>
        )}
        <p className="text-[11px] text-white/85 leading-snug">
          {botEntry === 'choose' && 'Pick symptom help, booking, or general chat — no tab bar; you can switch anytime with Change assistant.'}
          {botEntry === 'active' && mode === 'symptoms' &&
            'Describe signs for general triage only (not a diagnosis). To book a vet, tap Change assistant → Booking assistant.'}
          {botEntry === 'active' && mode === 'booking' &&
            'Say the service you want — we match catalog services and providers, then use the buttons to continue.'}
          {botEntry === 'active' && mode === 'chat' && 'Ask anything about the app, orders, or pet care. Use buttons below the reply when shown.'}
        </p>
      </div>

      {/* Messages or entry picker */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {botEntry === 'choose' && (
          <div className="flex flex-col gap-3 pt-2 pb-4 min-h-[12rem] justify-center">
            <p className="text-center text-sm font-semibold text-gray-900">What do you need help with?</p>
            <button
              type="button"
              onClick={enterSymptomBot}
              className="flex items-center gap-3 w-full rounded-xl border-2 border-orange-100 bg-orange-50/80 hover:bg-orange-100/90 px-4 py-3.5 text-left transition-colors"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm text-[#E85D04]">
                <Stethoscope className="w-5 h-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900">Symptom checker</span>
                <span className="block text-xs text-gray-600 mt-0.5">Pet health signs &amp; guidance</span>
              </span>
            </button>
            <button
              type="button"
              onClick={enterBookingBot}
              className="flex items-center gap-3 w-full rounded-xl border-2 border-orange-100 bg-orange-50/80 hover:bg-orange-100/90 px-4 py-3.5 text-left transition-colors"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm text-[#E85D04]">
                <CalendarClock className="w-5 h-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900">Booking assistant</span>
                <span className="block text-xs text-gray-600 mt-0.5">Find services &amp; book appointments</span>
              </span>
            </button>
            <button
              type="button"
              onClick={enterGeneralChat}
              className="flex items-center justify-center gap-2 text-xs text-[#E85D04] font-medium hover:underline py-1"
            >
              <MessageCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
              General questions only (chat)
            </button>
          </div>
        )}
        {botEntry === 'active' &&
          messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.type === 'user'
                  ? 'bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white'
                  : message.type === 'system'
                  ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="flex items-start gap-2">
                {message.type === 'bot' && <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                {message.type === 'user' && <User className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                {message.type === 'system' && <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
              
              {message.suggestedActions && message.suggestedActions.filter(isWhitelistedAction).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {message.suggestedActions.filter(isWhitelistedAction).map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestedAction(action)}
                      className="px-3 py-1 text-xs bg-white text-[#E85D04] border border-[#FF8C42] rounded-md hover:bg-orange-50"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}

              {message.suggestedProviders && message.suggestedProviders.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {message.suggestedProviders.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        void handlePickSuggestedProvider(p);
                      }}
                      disabled={wizardBusy}
                      className="text-left px-3 py-2 text-xs rounded-md border border-gray-200 bg-white hover:bg-orange-50 text-gray-900 disabled:opacity-50"
                    >
                      <span className="font-medium">{p.businessName}</span>
                      {typeof p.distanceKm === 'number' ? (
                        <span className="text-gray-500"> · {p.distanceKm} km</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
              
              {message.requiresAgent && (
                <button
                  onClick={() => handleEscalateToAgent(conversationId || '')}
                  className="mt-2 w-full px-3 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100"
                >
                  Connect with Agent
                </button>
              )}
            </div>
          </div>
        ))}
        
        {botEntry === 'active' && sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {mode === 'booking' && wizardStep === 'booked' && bookedVendorName ? (
        <div className="shrink-0 border-t border-green-100 bg-green-50/60 px-3 py-3 space-y-2 text-xs">
          <p className="font-semibold text-gray-900">{bookedVendorName}</p>
          <p className="text-gray-700 leading-snug">Your service is booked. Thank you!</p>
          <button
            type="button"
            onClick={() => goTo('/bookings')}
            className="w-full px-3 py-2 rounded-lg border border-[#FF8C42] bg-white text-[#E85D04] text-xs font-semibold hover:bg-orange-50"
          >
            View my bookings
          </button>
        </div>
      ) : null}

      {mode === 'booking' && bookingSessionId && bookingDraft && wizardStep !== 'booked' && (
        <div className="shrink-0 border-t border-orange-100 bg-orange-50/40 px-3 py-2 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-gray-800">In-chat booking</span>
            {wizardBusy || wizardSlotsLoading ? (
              <span className="text-gray-500">Loading…</span>
            ) : null}
          </div>
          {wizardStep === 'serviceType' && (
            <div className="flex flex-col gap-1.5">
              {wizardVendorServicesAll.length === 0 && wizardBusy ? (
                <span className="text-gray-600">Loading this provider&apos;s catalogue…</span>
              ) : distinctBookingStyleKeysFromServices(wizardVendorServicesAll).length === 0 ? (
                <span className="text-gray-600">No services available.</span>
              ) : (
                <>
                  <p className="text-[11px] text-gray-600">
                    Visit type first — only options this provider actually offers are shown.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {distinctBookingStyleKeysFromServices(wizardVendorServicesAll).map((key) => {
                      const count = servicesFilteredByBookingStyleKey(wizardVendorServicesAll, key).length;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={wizardBusy || count === 0}
                          onClick={() => void pickWizardServiceType(key)}
                          className="px-2 py-1 rounded-full border border-gray-200 bg-white hover:bg-orange-50 text-[11px] font-medium"
                        >
                          {bookingServiceStyleShortLabel(key)}
                          <span className="text-gray-500 font-normal"> ({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          {wizardStep === 'service' && (
            <div className="space-y-1.5">
              {distinctBookingStyleKeysFromServices(wizardVendorServicesAll).length > 1 &&
              !bookingDraft.vendorServiceId ? (
                <button
                  type="button"
                  className="text-left text-[11px] font-semibold text-[#E85D04] underline"
                  onClick={() => {
                    setWizardServices([]);
                    setWizardStep('serviceType');
                  }}
                >
                  ← Change visit type
                </button>
              ) : null}
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {wizardServices.length === 0 ? (
                <span className="text-gray-600">No services returned for this provider.</span>
              ) : (
                wizardServices.map((s: any) => (
                  <button
                    key={String(s.id)}
                    type="button"
                    disabled={wizardBusy}
                    onClick={async () => {
                      setWizardBusy(true);
                      try {
                        const rowKey = normalizeVendorServiceStyleToBookingKey(
                          s.serviceStyle ?? s.service_style ?? bookingDraft.serviceStyle
                        );
                        await patchBookingDraft({
                          vendorServiceId: String(s.id),
                          totalDuration: Number(s.duration ?? s.duration_minutes ?? 30),
                          serviceStyle: rowKey,
                        });
                        setWizardStep('date');
                        setMessages((prev) => [
                          ...prev,
                          {
                            id: `bot-${Date.now()}`,
                            type: 'bot',
                            content: 'Pick a date below, then a time.',
                            timestamp: new Date().toISOString(),
                            intent: 'booking',
                          },
                        ]);
                      } catch (e: any) {
                        toast.error(e?.message || 'Could not select service');
                      } finally {
                        setWizardBusy(false);
                      }
                    }}
                    className="px-2 py-1 rounded-full border border-gray-200 bg-white hover:bg-orange-50 text-[11px] max-w-[11rem] truncate"
                  >
                    {String(s.name || s.serviceName || s.service_name || 'Service')}
                  </button>
                ))
              )}
              </div>
            </div>
          )}
          {wizardStep === 'date' && (
            <div className="flex flex-col gap-1.5">
              {wizardDatesLoading ? (
                <span className="text-gray-600">Checking which days have openings…</span>
              ) : wizardAvailableDates.length === 0 ? (
                <span className="text-gray-600 leading-snug">
                  No openings in the next 3 weeks for this visit type and service. Try{' '}
                  <button
                    type="button"
                    className="font-semibold text-[#E85D04] underline"
                    onClick={() => {
                      setWizardServices([]);
                      setWizardStep('serviceType');
                    }}
                  >
                    change visit type
                  </button>{' '}
                  or pick another provider.
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {wizardAvailableDates.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setWizardDate(d);
                        void (async () => {
                          setWizardBusy(true);
                          try {
                            await patchBookingDraft({ bookingDate: d });
                            setWizardStep('slot');
                          } catch (e: any) {
                            toast.error(e?.message || 'Could not set date');
                          } finally {
                            setWizardBusy(false);
                          }
                        })();
                      }}
                      disabled={wizardBusy || wizardSlotsLoading}
                      className="px-2 py-1 rounded-full border border-gray-200 bg-white hover:bg-orange-50 text-[11px]"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {wizardStep === 'slot' && (
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
              {wizardSlots.filter((x: any) => x?.available !== false).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {wizardSlots
                    .filter((x: any) => x?.available !== false)
                    .map((slot: any) => (
                      <button
                        key={String(slot.time)}
                        type="button"
                        disabled={wizardBusy || wizardSlotsLoading}
                        onClick={async () => {
                          setWizardBusy(true);
                          try {
                            const snap = wizardSlotsRaw ?? { slots: wizardSlots };
                            const d1 = await patchBookingDraft({ slotsSnapshot: snap });
                            const commit: any = await aiChatbotApi.commitBookingSlot(bookingSessionId, {
                              slotTime: String(slot.time),
                              expectedVersion: d1.version,
                            });
                            if (!commit?.success) {
                              toast.error(commit?.error || 'Slot could not be reserved');
                              if (commit?.slots) {
                                const slots = Array.isArray((commit.slots as any)?.slots)
                                  ? (commit.slots as any).slots
                                  : [];
                                setWizardSlots(slots);
                                setWizardSlotsRaw(commit.slots);
                              }
                              return;
                            }
                            if (commit.draft) setBookingDraft(mapSessionDraft(commit.draft));
                            setWizardStep('review');
                          } catch (e: any) {
                            const status = e?.statusCode ?? e?.status;
                            const data = e?.responseData ?? e?.response;
                            if (status === 409 && data?.slots) {
                              const slots = Array.isArray(data.slots?.slots) ? data.slots.slots : [];
                              setWizardSlots(slots);
                              setWizardSlotsRaw(data.slots);
                              toast.error('That time was just taken — pick another slot.');
                            } else {
                              toast.error(e?.message || 'Could not reserve slot');
                            }
                          } finally {
                            setWizardBusy(false);
                          }
                        }}
                        className="px-2 py-1 rounded-full border border-gray-200 bg-white hover:bg-orange-50 text-[11px]"
                      >
                        {String(slot.time)}
                      </button>
                    ))}
                </div>
              ) : (
                <div className="space-y-2 text-gray-700">
                  <p className="leading-snug">
                    No open slots on <span className="font-semibold">{wizardDate}</span> for this provider and service.
                  </p>
                  {wizardAlternativesLoading ? (
                    <p className="text-gray-500">Checking the next 3 weeks for days with availability…</p>
                  ) : wizardSlotsLoading ? (
                    <p className="text-gray-500">Loading times for this day…</p>
                  ) : wizardSuggestedDates.length > 0 ? (
                    <>
                      <p className="text-[11px] text-gray-600">Pick a day that has openings (same vendor & service):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {wizardSuggestedDates.map((row) => (
                          <button
                            key={row.date}
                            type="button"
                            disabled={wizardBusy || wizardSlotsLoading}
                            onClick={() => {
                              setWizardSuggestedDates([]);
                              void (async () => {
                                setWizardBusy(true);
                                try {
                                  await patchBookingDraft({ bookingDate: row.date });
                                  setWizardDate(row.date);
                                } catch (e: any) {
                                  toast.error(e?.message || 'Could not switch date');
                                } finally {
                                  setWizardBusy(false);
                                }
                              })();
                            }}
                            className="px-2 py-1 rounded-full border border-[#FF8C42] bg-white hover:bg-orange-50 text-[11px] font-medium"
                          >
                            {row.date}
                            <span className="text-gray-500 font-normal"> ({row.openCount})</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-gray-600">
                      No openings in the next 3 weeks for this service. Try <span className="font-medium">Change date</span>{' '}
                      from the calendar or choose another provider.
                    </p>
                  )}
                  <button
                    type="button"
                    className="text-left text-[11px] font-semibold text-[#E85D04] underline"
                    onClick={() => {
                      setWizardSuggestedDates([]);
                      setWizardStep('date');
                    }}
                  >
                    Change date
                  </button>
                </div>
              )}
            </div>
          )}
          {wizardStep === 'review' && (
            <div className="space-y-2">
              <p className="text-gray-700 leading-snug">
                Review: {bookingDraft.vendorServiceId ? `Service ${bookingDraft.vendorServiceId}` : 'Service'} on{' '}
                {bookingDraft.bookingDate || '—'} at {bookingDraft.slotTime || '—'}.
              </p>
              <button
                type="button"
                disabled={wizardBusy || !customerPhone}
                onClick={async () => {
                  setWizardBusy(true);
                  try {
                    const prep: any = await aiChatbotApi.prepareBookingPayment(bookingSessionId, {
                      customerId,
                      customerPhone,
                    });
                    if (!prep?.universalPaymentProps) {
                      toast.error(prep?.error || 'Could not start payment');
                      return;
                    }
                    const up = prep.universalPaymentProps as Record<string, unknown>;
                    up.category = paymentCategoryLabel(wizardCategory);
                    const vn = String(up.vendorName || selectedVendorNameRef.current || '').trim();
                    if (vn) selectedVendorNameRef.current = vn;
                    setPaymentHandoff(up);
                  } catch (e: any) {
                    toast.error(e?.message || 'Could not prepare payment');
                  } finally {
                    setWizardBusy(false);
                  }
                }}
                className="w-full px-3 py-2 rounded-lg bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white text-xs font-semibold disabled:opacity-50"
              >
                Continue to payment
              </button>
              {!customerPhone ? (
                <p className="text-[11px] text-red-600">Sign in with a verified phone to pay.</p>
              ) : null}
            </div>
          )}
        </div>
      )}

      {paymentHandoff ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#FAF6F0]">
          <UniversalPaymentPage
            {...(paymentHandoff as any)}
            onBack={() => setPaymentHandoff(null)}
            onSuccess={() => {
              const vn = String(
                (paymentHandoff as { vendorName?: string })?.vendorName ||
                  selectedVendorNameRef.current ||
                  ''
              ).trim();
              finalizeBookingAfterPayment(vn || undefined);
            }}
          />
        </div>
      ) : null}

      {/* Input — after assistant choice */}
      {botEntry === 'active' && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              onFocus={() => {
                setTimeout(() => {
                  inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 350);
              }}
              placeholder={
                mode === 'symptoms'
                  ? "Describe your pet's symptoms..."
                  : mode === 'booking'
                    ? 'What service do you need?'
                    : 'Type your message...'
              }
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/40"
              style={{ fontSize: '16px' }}
              disabled={sending}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!inputText.trim() || sending}
              title="Send"
              aria-label="Send message"
              className="shrink-0 h-11 w-11 rounded-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white shadow-md hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

