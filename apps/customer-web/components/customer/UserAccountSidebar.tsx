'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { useCommerceConfigOptional } from '@/lib/commerce-config-provider';
import { isWarmpawzPayModuleCapable } from '@/lib/commerce-switch-routing';
import { filterAccountMenuForReviewAccount } from '@/lib/app-review-demo-account';
import { Button } from '@/components/ui/button';
import { 
  User, Calendar, Edit2,
  Heart, ChevronRight, Package, Package2,
  Clock, MapPin, Star, Bell, CreditCard, HelpCircle, LogOut,
  ShoppingCart, Home as HomeIcon, FileText, Shield, AlertCircle, Mail,
  Trash2, Plus, Check, Wallet, ShoppingBag,
  Gift, Users, Award, Smartphone, Building2, MessageSquare, X, QrCode
} from 'lucide-react';
import { ProfileAccountHero } from '@/components/customer/profile/ProfileAccountHero';
import { ProfileMenuFloatingSheet } from '@/components/customer/profile/ProfileMenuFloatingSheet';
// Uses apiClient with Cognito auth
import { apiClient, isUatMode } from '@/lib/api-client';
import { EnhancedAddressAutocomplete, AddressComponents } from '@/components/shared/EnhancedAddressAutocomplete';
import { UseCurrentLocationButton } from '@/components/shared/UseCurrentLocationButton';
import type { AddressFromGeolocationResult } from '@/lib/address-from-geolocation';
import { CountryCodeSelector } from '@/components/ui/CountryCodeSelector';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { normalizeCustomerProfileFields } from '@/lib/normalize-customer-profile-api';
import {
  inferCityStateFromCommaAddress,
  mergeStreetAddressLineOnly,
} from '@/lib/profile-address-format';
import { SUPPORT_INITIAL_TAB_KEY, rememberSupportOpenContactForm } from '@/lib/support-contact';
import {
  consumeAccountSidebarActiveView,
  rememberAccountSidebarActiveView,
} from '@/lib/go-back-or-replace';
import { formatIstInstantDisplay } from '@/lib/ist-display-format';
import { invalidateCustomerLocationCache } from '@/lib/customer-location';
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import {
  canSyncWishlistToApi,
  readWishlistIds,
  removeWishlistProductIds,
  resolveWishlistIdsForDisplay,
  sameWishlistIdSet,
  setWishlistIds,
  WISHLIST_UPDATED_EVENT,
  type WishlistApiItem,
} from '@/lib/warmpawz-wishlist-local';
import {
  fetchWishlistProductSummary,
  type WishlistProductRow,
} from '@/lib/wishlist-product-fetch';
const CUSTOMER_SUPPORT_EMAIL = 'support@warmpawz.com';

const WISHLIST_CUSTOMER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function SavedItemThumbnail({
  image,
  emoji,
  name,
}: {
  image?: string;
  emoji?: string;
  name: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (image && !imageFailed) {
    return (
      <PresignableImage
        src={image}
        alt={name}
        className="h-full w-full object-cover"
        onUnavailable={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-4xl">
      {emoji || '🛍️'}
    </div>
  );
}

function setSupportInitialTab(tab: 'faq' | 'contact' | 'tickets') {
  try {
    sessionStorage.setItem(SUPPORT_INITIAL_TAB_KEY, tab);
  } catch {
    /* ignore */
  }
}

function prepareSupportHelpFromSidebar(
  tab: 'faq' | 'contact' | 'tickets',
  opts?: { openContactForm?: boolean },
) {
  rememberAccountSidebarActiveView('help');
  setSupportInitialTab(tab);
  if (opts?.openContactForm) {
    rememberSupportOpenContactForm();
  }
}

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  pincode: string;
  houseNo: string;
  floor: string;
  city?: string;
  state?: string;
  photo?: string;
  created_at?: string;
}

function formatMemberSinceLabel(createdAt?: string): string | undefined {
  if (!createdAt) return undefined;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

interface Booking {
  id: string;
  /** Normalized from API (may be camelCase or snake_case source). */
  serviceType: string;
  petId: string;
  petName: string;
  petPhoto?: string;
  vendorId: string;
  vendorName: string;
  vendorPhoto?: string;
  startDate: string;
  endDate?: string;
  duration: string;
  frequency: 'single' | 'weekly' | 'monthly';
  schedule: 'morning' | 'evening' | 'anytime';
  sessionsPerDay?: number;
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
  status: 'active' | 'completed' | 'cancelled';
  price: number;
  requiresOTP?: boolean;
  completionOTP?: string;
  otpVerifiedAt?: string;
}

interface CartItem {
  itemId: string;
  type: 'product' | 'service';
  name: string;
  price: number;
  quantity: number;
  photo?: string;
  vendorId?: string;
  details?: any;
}

interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  houseNo?: string;
  floor?: string;
  coordinates?: { lat: number; lng: number };
  isDefault: boolean;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'upi' | 'netbanking';
  cardNumber?: string;
  cardHolderName?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cardType?: 'visa' | 'mastercard' | 'rupay' | 'amex';
  upiId?: string;
  bankName?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Path/query segment for phone-based payment routes (avoids broken URLs when phone contains + or spaces). */
function encodePaymentPhoneForPath(phone: string): string {
  return encodeURIComponent(String(phone).trim());
}

const PAYMENT_METHODS_LS_PREFIX = 'warmpawz_payments_v2_';

function paymentMethodsLocalStorageKey(phone: string): string {
  const d = String(phone).replace(/\D/g, '');
  const k = d.length >= 10 ? d.slice(-10) : d || 'unknown';
  return PAYMENT_METHODS_LS_PREFIX + k;
}

function readLocalPaymentMethods(phone: string): PaymentMethod[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(paymentMethodsLocalStorageKey(phone));
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) =>
        item && typeof item === 'object'
          ? normalizePaymentMethodFromApi(item as Record<string, unknown>)
          : null
      )
      .filter((pm): pm is PaymentMethod => pm != null);
  } catch {
    return [];
  }
}

function writeLocalPaymentMethods(phone: string, methods: PaymentMethod[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(paymentMethodsLocalStorageKey(phone), JSON.stringify(methods));
  } catch {
    /* quota */
  }
}

/** API list wins on id clash; keeps local-only rows when API returns empty (refresh resilience). */
function mergePaymentMethodLists(apiList: PaymentMethod[], localList: PaymentMethod[]): PaymentMethod[] {
  const map = new Map<string, PaymentMethod>();
  for (const p of localList) {
    if (p.id) map.set(p.id, p);
  }
  for (const p of apiList) {
    if (p.id) map.set(p.id, p);
  }
  return Array.from(map.values()).sort((a, b) =>
    String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
}

type PaymentFormState = {
  type: 'card' | 'upi' | 'netbanking';
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardType: 'visa' | 'mastercard' | 'rupay' | 'amex';
  upiId: string;
  bankName: string;
  isDefault: boolean;
};

const CARD_TYPE_SELECTOR_LABELS: Record<PaymentFormState['cardType'], string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  rupay: 'RuPay',
  amex: 'Amex',
};

/** POST only fields for the selected type so backend does not see leftover card defaults. */
function buildPaymentMethodPostBody(np: PaymentFormState): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type: np.type,
    isDefault: np.isDefault,
  };
  if (np.type === 'card') {
    base.cardNumber = np.cardNumber;
    base.cardHolderName = np.cardHolderName;
    base.expiryMonth = np.expiryMonth;
    base.expiryYear = np.expiryYear;
    base.cvv = np.cvv;
    base.cardType = np.cardType;
    return base;
  }
  if (np.type === 'upi') {
    base.upiId = np.upiId.trim();
    return base;
  }
  base.bankName = np.bankName.trim();
  return base;
}

/**
 * Prefer real payload fields over `payment_type` (DB often stores everything as "card").
 * Order: UPI handle → net banking (bank name, no card digits) → card (≥4 digits).
 */
function inferPaymentKindFromFields(
  last4Str: string,
  upiRaw: string | undefined,
  bankRaw: string | undefined
): PaymentMethod['type'] | null {
  const upi = upiRaw != null ? String(upiRaw).trim() : '';
  const bank = bankRaw != null ? String(bankRaw).trim() : '';
  const digits = last4Str.replace(/\D/g, '');
  if (upi.length > 0) return 'upi';
  if (bank.length > 0 && digits.length < 4) return 'netbanking';
  if (digits.length >= 4) return 'card';
  return null;
}

/** Map API/DB type strings + present fields → UI payment kind (fallback when fields are ambiguous). */
function resolvePaymentMethodKind(
  row: Record<string, unknown>,
  last4Str: string,
  upiStr: string | undefined,
  bankStr: string | undefined
): PaymentMethod['type'] {
  const fromFields = inferPaymentKindFromFields(last4Str, upiStr, bankStr);
  if (fromFields) return fromFields;

  const upiT = upiStr != null ? String(upiStr).trim() : '';
  if (upiT.includes('@')) return 'upi';

  const raw = String(row.type ?? row.payment_type ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  const c = raw.replace(/_/g, '');
  if (raw === 'upi' || c === 'upi' || raw.includes('upi')) return 'upi';
  if (
    c === 'netbanking' ||
    raw === 'net_banking' ||
    c === 'banktransfer' ||
    raw === 'bank_transfer' ||
    c === 'nb'
  ) {
    return 'netbanking';
  }
  if (
    c === 'card' ||
    c === 'debitcard' ||
    c === 'creditcard' ||
    raw === 'debit_card' ||
    raw === 'credit_card'
  ) {
    return 'card';
  }

  const last4 = last4Str.replace(/\D/g, '');
  const hasUpi = Boolean(upiStr && upiStr.trim());
  const hasBank = Boolean(bankStr && bankStr.trim());
  if (hasUpi && last4.length < 4) return 'upi';
  if (hasBank && last4.length < 4 && !hasUpi) return 'netbanking';
  return 'card';
}

/** Use in list UI so labels match data even if `pm.type` was wrong in state/localStorage. */
function effectivePaymentDisplayKind(pm: PaymentMethod): PaymentMethod['type'] {
  return (
    inferPaymentKindFromFields(pm.cardNumber || '', pm.upiId, pm.bankName) ?? pm.type
  );
}

/** Normalize GET payload whether API returns mapped fields, raw DB rows, or enhanced `methods` items (last4/brand). */
function normalizePaymentMethodFromApi(row: Record<string, unknown>): PaymentMethod | null {
  const id = row.id != null ? String(row.id) : '';
  if (!id) return null;
  const last4 =
    row.cardNumber ?? row.card_last4 ?? row.last4 ?? row.last_four ?? '';
  const last4Str = String(last4 || '');
  const upiStr = (row.upiId ?? row.upi_id) as string | undefined;
  const bankStr = (row.bankName ?? row.bank_name) as string | undefined;
  const type = resolvePaymentMethodKind(row, last4Str, upiStr, bankStr);

  return {
    id,
    type,
    cardNumber: last4Str,
    cardHolderName: (row.cardHolderName ?? row.card_holder_name) as string | undefined,
    expiryMonth:
      row.expiryMonth != null
        ? String(row.expiryMonth)
        : row.card_expiry_month != null
          ? String(row.card_expiry_month)
          : undefined,
    expiryYear:
      row.expiryYear != null
        ? String(row.expiryYear)
        : row.card_expiry_year != null
          ? String(row.card_expiry_year)
          : undefined,
    cardType: (row.cardType ?? row.card_brand ?? row.brand ?? row.cardBrand) as PaymentMethod['cardType'],
    upiId: upiStr != null && String(upiStr).trim() !== '' ? String(upiStr).trim() : undefined,
    bankName: bankStr != null && String(bankStr).trim() !== '' ? String(bankStr).trim() : undefined,
    isDefault: Boolean(row.isDefault ?? row.is_default),
    createdAt:
      row.createdAt != null
        ? String(row.createdAt)
        : row.created_at != null
          ? String(row.created_at)
          : '',
    updatedAt:
      row.updatedAt != null
        ? String(row.updatedAt)
        : row.updated_at != null
          ? String(row.updated_at)
          : '',
  };
}

interface NotificationSettings {
  push: boolean;
  email: boolean;
  sms: boolean;
  bookingUpdates: boolean;
  promotions: boolean;
  newServices: boolean;
  newsletter: boolean;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  push: true,
  email: false,
  sms: true,
  bookingUpdates: true,
  promotions: true,
  newServices: false,
  newsletter: false,
};

function notificationSettingsStorageKey(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  return `warmpawz_notification_settings_${clean || 'unknown'}`;
}

function httpStatusFromApiError(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const o = err as { statusCode?: number; status?: number };
  return o.statusCode ?? o.status;
}

function mergeNotificationSettings(partial: Partial<NotificationSettings> | undefined | null): NotificationSettings {
  if (!partial || typeof partial !== 'object') {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...partial };
}

function normalizeCustomerBookingRow(raw: Record<string, unknown>): Booking {
  const r = raw as Record<string, any>;
  const serviceTypeRaw =
    r.serviceType ??
    r.service_type ??
    r.service_category ??
    r.serviceCategory ??
    '';
  const serviceType = String(serviceTypeRaw).trim() || 'service';

  const statusRaw = String(r.status ?? '').toLowerCase();
  let status: Booking['status'];
  if (statusRaw === 'completed') status = 'completed';
  else if (statusRaw === 'cancelled' || statusRaw === 'canceled') status = 'cancelled';
  else status = 'active';

  const id = String(r.id ?? r.booking_id ?? '');
  const petId = String(r.pet_id ?? r.petId ?? '');
  const petName = String(r.pet_name ?? r.petName ?? 'Pet');
  const vendorId = String(r.vendor_id ?? r.vendorId ?? '');
  const vendorName = String(r.vendor_name ?? r.vendorName ?? 'Vendor');

  const totalSessions = Math.max(1, Number(r.total_sessions ?? r.totalSessions ?? 1) || 1);
  const completedSessions = Number(r.completed_sessions ?? r.completedSessions ?? 0) || 0;
  const upcomingSessions =
    Number(r.upcoming_sessions ?? r.upcomingSessions ?? Math.max(0, totalSessions - completedSessions)) || 0;

  const price = Number(r.price ?? r.amount ?? r.total_amount ?? 0) || 0;
  const startDate = String(
    r.booking_date ?? r.start_date ?? r.startDate ?? r.created_at ?? r.bookingDate ?? ''
  );

  const freq = (r.frequency ?? 'single') as Booking['frequency'];
  const sched = (r.schedule ?? 'anytime') as Booking['schedule'];

  return {
    id,
    serviceType,
    petId,
    petName,
    petPhoto: r.pet_photo ?? r.petPhoto,
    vendorId,
    vendorName,
    vendorPhoto: r.vendor_photo ?? r.vendorPhoto,
    startDate,
    endDate: r.end_date ?? r.endDate,
    duration: String(r.duration ?? r.duration_minutes ?? '—'),
    frequency: ['single', 'weekly', 'monthly'].includes(freq) ? freq : 'single',
    schedule: ['morning', 'evening', 'anytime'].includes(sched) ? sched : 'anytime',
    sessionsPerDay: r.sessions_per_day ?? r.sessionsPerDay,
    totalSessions,
    completedSessions,
    upcomingSessions,
    status,
    price,
    requiresOTP: Boolean(r.requires_otp ?? r.requiresOTP ?? r.requires_start_otp),
    completionOTP: r.completion_otp ?? r.completionOTP ?? r.otp_code ?? r.otpCode,
    otpVerifiedAt: r.otp_verified_at ?? r.otpVerifiedAt,
  };
}

function formatServiceTypeLabel(serviceType: string | undefined): string {
  const t = (serviceType ?? '').trim().replace(/_/g, ' ');
  if (!t) return 'Service';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

interface UserAccountSidebarProps {
  phone: string;
  onClose: () => void;
  /** X button: exit to app home (full shell reset). Falls back to closing the sheet if omitted. */
  onNavigateHome?: () => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  onViewAppointments?: () => void;
  onViewWallet?: () => void;
  /** Full-page `/my-packages` (same pattern as wallet). */
  onViewMyPackages?: () => void;
  /** Canonical `/profile` page — avoids duplicate inline profile editor in this sheet. */
  onViewProfile?: () => void;
  onNavigate?: (path: string) => void;
  /** Parent registers nested overlay back for hardware back (returns true when consumed). */
  onRegisterOverlayBack?: (handler: (() => boolean) | null) => void;
}

export function UserAccountSidebar({
  phone,
  onClose,
  onNavigateHome,
  onViewBooking,
  onViewAppointments,
  onViewWallet,
  onViewMyPackages,
  onViewProfile,
  onNavigate,
  onRegisterOverlayBack,
}: UserAccountSidebarProps) {
  const commerce = useCommerceConfigOptional();
  const showWarmpawzPayMenu =
    commerce?.isWarmpawzPay === true && commerce.isLoaded && isWarmpawzPayModuleCapable();
  const [isOpen, setIsOpen] = useState(false);
  const [activeView, setActiveView] = useState<
    'menu' | 'bookings' | 'cart' | 'saved' | 'addresses' | 'payments' | 'notifications' | 'help'
  >('menu');
  
  // Profile summary for header (full edit opens CustomerProfileView)
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  
  // Bookings states
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  
  // Cart states
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loadingCart, setLoadingCart] = useState(true);
  const [cartTotal, setCartTotal] = useState(0);
  
  // Saved items states
  const [savedItems, setSavedItems] = useState<WishlistProductRow[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [savedBadgeCount, setSavedBadgeCount] = useState(0);
  const savedLoadGenRef = useRef(0);
  const savedRefreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Address states
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressCountryCode, setAddressCountryCode] = useState(() => {
    // Get saved country code or default to +91
    if (typeof window !== 'undefined') {
      return localStorage.getItem('customerCountryCode') || '+91';
    }
    return '+91';
  });
  
  // Payment states
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [newPayment, setNewPayment] = useState({
    type: 'card' as 'card' | 'upi' | 'netbanking',
    cardNumber: '',
    cardHolderName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    cardType: 'visa' as 'visa' | 'mastercard' | 'rupay' | 'amex',
    upiId: '',
    bankName: '',
    isDefault: false
  });
  
  // Notification states
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => ({
    ...DEFAULT_NOTIFICATION_SETTINGS,
  }));
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const loadSaved = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!isCustomerEcommerceEnabled()) {
      setSavedItems([]);
      setLoadingSaved(false);
      return;
    }

    const gen = ++savedLoadGenRef.current;
    if (mode === 'initial') setLoadingSaved(true);

    try {
      const localIds = [...new Set(readWishlistIds())];
      let idsToRender = [...localIds];

      if (mode === 'initial') {
        const customerId = getResolvedCustomerId();
        if (customerId && WISHLIST_CUSTOMER_UUID_RE.test(customerId)) {
          try {
            const res = await apiClient.get<{
              wishlist?: { items?: WishlistApiItem[] };
            }>(`/customer/${encodeURIComponent(customerId)}/wishlist`);
            const items = res?.wishlist?.items ?? [];
            const merged = resolveWishlistIdsForDisplay('initial', localIds, items);
            if (!sameWishlistIdSet(localIds, merged)) {
              setWishlistIds(merged);
            }
            idsToRender = merged;
          } catch {
            /* local ids remain source of truth */
          }
        }
      }

      if (gen !== savedLoadGenRef.current) return;

      const summaries = await Promise.all(
        idsToRender.map((storageKey) => fetchWishlistProductSummary(storageKey))
      );
      if (gen !== savedLoadGenRef.current) return;
      setSavedItems(summaries);
    } catch (error) {
      console.error('Error loading saved items:', error);
      if (gen !== savedLoadGenRef.current) return;
      const fallbackIds = [...new Set(readWishlistIds())];
      if (fallbackIds.length === 0) {
        setSavedItems([]);
        return;
      }
      try {
        const summaries = await Promise.all(
          fallbackIds.map((storageKey) => fetchWishlistProductSummary(storageKey))
        );
        if (gen !== savedLoadGenRef.current) return;
        setSavedItems(summaries);
      } catch {
        if (gen !== savedLoadGenRef.current) return;
        setSavedItems([]);
      }
    } finally {
      if (mode === 'initial') setLoadingSaved(false);
    }
  }, []);

  const removeFromSaved = async (row: WishlistProductRow) => {
    removeWishlistProductIds(row.storageKey, row.id);
    setSavedItems((items) => items.filter((x) => x.storageKey !== row.storageKey));

    const customerId = getResolvedCustomerId();
    if (canSyncWishlistToApi(customerId, row.id)) {
      try {
        await apiClient.post(`/customer/${encodeURIComponent(customerId!)}/wishlist`, {
          productId: row.id,
          action: 'remove',
        });
      } catch {
        /* local removal already applied */
      }
    }
  };

  useEffect(() => {
    setTimeout(() => setIsOpen(true), 50);
    loadProfile();
    loadBookings();
    try {
      const restored = consumeAccountSidebarActiveView();
      if (restored === 'bookings' || restored === 'addresses' || restored === 'help') {
        setActiveView(restored);
      }
    } catch {
      /* ignore */
    }
  }, [phone]);

  // Reset scroll position when view changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeView]);

  useEffect(() => {
    if (activeView === 'cart') loadCart();
    if (activeView === 'saved') void loadSaved('initial');
    if (activeView === 'addresses') loadAddresses();
    if (activeView === 'payments') loadPayments();
    if (activeView === 'notifications') loadNotificationSettings();
    if (activeView === 'bookings') loadBookings(); // Reload bookings when viewing bookings tab
  }, [activeView, loadSaved]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncBadge = () => setSavedBadgeCount(readWishlistIds().length);
    syncBadge();
    window.addEventListener(WISHLIST_UPDATED_EVENT, syncBadge as EventListener);
    return () => window.removeEventListener(WISHLIST_UPDATED_EVENT, syncBadge as EventListener);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || activeView !== 'saved') return undefined;

    const scheduleRefresh = () => {
      if (savedRefreshDebounceRef.current) clearTimeout(savedRefreshDebounceRef.current);
      savedRefreshDebounceRef.current = setTimeout(() => {
        savedRefreshDebounceRef.current = null;
        void loadSaved('refresh');
      }, 120);
    };

    window.addEventListener(WISHLIST_UPDATED_EVENT, scheduleRefresh as EventListener);
    return () => {
      window.removeEventListener(WISHLIST_UPDATED_EVENT, scheduleRefresh as EventListener);
      if (savedRefreshDebounceRef.current) clearTimeout(savedRefreshDebounceRef.current);
    };
  }, [activeView, loadSaved]);

  // ============================================
  // PROFILE FUNCTIONS
  // ============================================
  
  const loadProfile = async () => {
    try {
      setLoading(true);
      const result = await apiClient.get<{ profile?: UserProfile & { name?: string; profile_photo_url?: string } }>(
        `/customer/profile?phone=${encodeURIComponent(phone)}`
      );

      if (result && result.profile) {
        const base = normalizeCustomerProfileFields(result.profile as any, phone);
        const raw = result.profile as any;
        const addressLine = mergeStreetAddressLineOnly({
          address: base.address,
          city: base.city,
          state: base.state,
        });
        const houseNo = String(raw.houseNo ?? raw.house_no ?? '').trim();
        const floor = String(raw.floor ?? '').trim();
        const { city: ic, state: ist } = inferCityStateFromCommaAddress(addressLine);
        const next: UserProfile = {
          firstName: base.firstName,
          lastName: base.lastName,
          email: base.email,
          phone: base.phone,
          address: addressLine,
          pincode: base.pincode,
          houseNo,
          floor,
          city: ic ?? base.city,
          state: ist ?? base.state,
          photo: base.photo,
          created_at: raw.created_at ?? raw.createdAt,
        };
        setProfile(next);
        setPhotoPreview(base.photo);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // Clear all localStorage items
    localStorage.removeItem('customerPhone');
    localStorage.removeItem('customerId');
    localStorage.removeItem('authToken');
    localStorage.removeItem('customerData');
    localStorage.removeItem('customerOnboardingComplete');
    localStorage.removeItem('onboarding_completed');
    localStorage.removeItem('profile_completed');
    localStorage.removeItem('customerJourneyStage');
    
    // Redirect to auth page
    if (typeof window !== 'undefined') {
      window.location.href = '/auth';
    }
  };

  // ============================================
  // BOOKINGS FUNCTIONS
  // ============================================
  
  const loadBookings = async () => {
    try {
      setLoadingBookings(true);
      const result = await apiClient.get<{ bookings?: Record<string, unknown>[] }>(
        `/customer/bookings?phone=${encodeURIComponent(phone)}`
      );
      console.log('📚 [CUSTOMER-PROFILE] Loaded bookings:', result);
      const rows = Array.isArray(result.bookings) ? result.bookings : [];
      setBookings(rows.map((row) => normalizeCustomerBookingRow(row)));
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  };

  // ============================================
  // CART FUNCTIONS
  // ============================================
  
  const loadCart = async () => {
    try {
      setLoadingCart(true);
      const result = await apiClient.get<{ cartItems?: CartItem[]; totalPrice?: number }>(`/customer/cart/${phone}`);
      setCartItems(result.cartItems || []);
      setCartTotal(result.totalPrice || 0);
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setLoadingCart(false);
    }
  };

  const updateCartQuantity = async (itemId: string, quantity: number) => {
    try {
      await apiClient.put(`/customer/cart/${phone}/items/${itemId}`, { quantity });
      await loadCart();
    } catch (error) {
      console.error('Error updating cart:', error);
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      await apiClient.delete(`/customer/cart/${phone}/items/${itemId}`);
      await loadCart();
    } catch (error) {
      console.error('Error removing from cart:', error);
    }
  };

  // ============================================
  // SAVED ITEMS FUNCTIONS — loadSaved/removeFromSaved defined above (before effects)
  // ============================================

  // ============================================
  // ADDRESS FUNCTIONS
  // ============================================
  
  const loadAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const result = await apiClient.get<{ addresses?: Address[] }>(
        `/customer/addresses?phone=${encodeURIComponent(phone)}`
      );
      setAddresses(result.addresses || []);
    } catch (error) {
      console.error('Error loading addresses:', error);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const saveAddress = async (addressData: any) => {
    try {
      const coords = addressData.coordinates as { lat: number; lng: number } | null | undefined;
      const payload = {
        ...addressData,
        label: typeof addressData.label === 'string' ? addressData.label.toLowerCase() : addressData.label,
        flatNo: null,
        addressLine2: null,
        coordinates: coords ?? undefined,
        latitude: addressData.latitude ?? coords?.lat,
        longitude: addressData.longitude ?? coords?.lng,
      };
      let data: any;
      if (editingAddress) {
        data = await apiClient.put(`/customer/${phone}/addresses/${editingAddress.id}`, payload) as any;
      } else {
        data = await apiClient.post(`/customer/${phone}/addresses`, payload) as any;
      }

      if (data && data.success) {
        invalidateCustomerLocationCache(phone);
        alert(editingAddress ? '✅ Address updated!' : '✅ Address added!');
        await loadAddresses();
        setShowAddressForm(false);
        setEditingAddress(null);
      } else {
        alert(`❌ Error: ${data?.error || 'Failed to save address'}`);
      }
    } catch (error) {
      console.error('Error saving address:', error);
      alert('❌ Error saving address');
    }
  };

  const deleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
      const data = await apiClient.delete(`/customer/${phone}/addresses/${addressId}`) as any;

      if (data && data.success) {
        alert('✅ Address deleted!');
        await loadAddresses();
      } else {
        alert(`❌ Error: ${data?.error || 'Failed to delete address'}`);
      }
    } catch (error) {
      console.error('Error deleting address:', error);
      alert('❌ Error deleting address');
    }
  };

  // ============================================
  // PAYMENT FUNCTIONS
  // ============================================
  
  /** Fetch list from API (query route first — avoids some API Gateway path-param quirks). */
  const fetchPaymentMethodsFromApi = async (): Promise<PaymentMethod[]> => {
    const phoneSeg = encodePaymentPhoneForPath(phone);
    const qPhone = encodeURIComponent(phone.trim());
    type PayGet = {
      paymentMethods?: unknown[];
      methods?: unknown[];
      success?: boolean;
    };
    let raw: unknown[] = [];
    try {
      const alt = await apiClient.get<PayGet>(
        `/customer/payment-methods?phone=${qPhone}`
      );
      raw = Array.isArray(alt.paymentMethods)
        ? alt.paymentMethods
        : Array.isArray(alt.methods)
          ? alt.methods
          : [];
    } catch (e) {
      console.warn('GET /customer/payment-methods failed, trying path route:', e);
    }
    if (raw.length === 0) {
      try {
        const primary = await apiClient.get<PayGet>(`/customer/payments/${phoneSeg}`);
        raw = Array.isArray(primary.paymentMethods) ? primary.paymentMethods : [];
      } catch (e) {
        console.warn('GET /customer/payments/:phone failed:', e);
      }
    }
    const apiList = raw
      .map((row) =>
        row && typeof row === 'object'
          ? normalizePaymentMethodFromApi(row as Record<string, unknown>)
          : null
      )
      .filter((pm): pm is PaymentMethod => pm != null);

    const localList = readLocalPaymentMethods(phone);
    return mergePaymentMethodLists(apiList, localList);
  };

  const loadPayments = async () => {
    try {
      setLoadingPayments(true);
      const normalized = await fetchPaymentMethodsFromApi();
      setPaymentMethods(normalized);
      if (normalized.length > 0) {
        writeLocalPaymentMethods(phone, normalized);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    } finally {
      setLoadingPayments(false);
    }
  };

  const savePaymentMethod = async () => {
    try {
      // Validate based on payment type
      if (newPayment.type === 'card') {
        if (!newPayment.cardNumber || !newPayment.cardHolderName || !newPayment.expiryMonth || !newPayment.expiryYear || !newPayment.cvv) {
          alert('❌ Please fill all card details');
          return;
        }
        if (newPayment.cardNumber.replace(/\s/g, '').length !== 16) {
          alert('❌ Card number must be 16 digits');
          return;
        }
        if (newPayment.cvv.length !== 3) {
          alert('❌ CVV must be 3 digits');
          return;
        }
        const eyDigits = newPayment.expiryYear.replace(/\D/g, '');
        if (eyDigits.length !== 2 && eyDigits.length !== 4) {
          alert('❌ Year must be 2 digits (YY) or 4 digits (YYYY)');
          return;
        }
        const fullYear =
          eyDigits.length === 2 ? parseInt(`20${eyDigits}`, 10) : parseInt(eyDigits, 10);
        const minY = new Date().getFullYear();
        const maxY = minY + 25;
        if (Number.isNaN(fullYear) || fullYear < minY || fullYear > maxY) {
          alert(`❌ Enter a valid expiry year (${minY}–${maxY})`);
          return;
        }
      } else if (newPayment.type === 'upi') {
        if (!newPayment.upiId) {
          alert('❌ Please enter UPI ID');
          return;
        }
      } else if (newPayment.type === 'netbanking') {
        if (!newPayment.bankName) {
          alert('❌ Please select a bank');
          return;
        }
      }

      const phoneSeg = encodePaymentPhoneForPath(phone);
      const postBody = buildPaymentMethodPostBody(newPayment);
      const created = await apiClient.post<{
        success?: boolean;
        paymentMethod?: Record<string, unknown>;
      }>(`/customer/payments/${phoneSeg}`, postBody);
      const added =
        created?.paymentMethod && typeof created.paymentMethod === 'object'
          ? normalizePaymentMethodFromApi(created.paymentMethod as Record<string, unknown>)
          : null;

      setShowPaymentForm(false);
      setNewPayment({
        type: 'card',
        cardNumber: '',
        cardHolderName: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: '',
        cardType: 'visa',
        upiId: '',
        bankName: '',
        isDefault: false
      });

      // Single list update: refetch, then append POST response if GET missed it (avoids loadPayments wiping merged state).
      setLoadingPayments(true);
      try {
        let list = await fetchPaymentMethodsFromApi();
        if (added && !list.some((p) => p.id === added.id)) {
          list = [...list, added];
        }
        setPaymentMethods(list);
        writeLocalPaymentMethods(phone, list);
      } finally {
        setLoadingPayments(false);
      }

      alert('✅ Payment method added successfully!');
    } catch (error: unknown) {
      console.error('Error saving payment method:', error);
      const msg =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message?: string }).message)
            : 'Failed to save payment method';
      alert(`❌ ${msg}`);
    }
  };

  const deletePaymentMethod = async (paymentId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;

    try {
      await apiClient.delete(
        `/customer/payments/${encodePaymentPhoneForPath(phone)}/${encodeURIComponent(paymentId)}`
      );
      writeLocalPaymentMethods(
        phone,
        readLocalPaymentMethods(phone).filter((p) => p.id !== paymentId)
      );
      alert('✅ Payment method removed!');
      await loadPayments();
    } catch (error) {
      console.error('Error deleting payment method:', error);
    }
  };

  // ============================================
  // NOTIFICATION FUNCTIONS
  // ============================================
  
  const notificationSettingsQueryUrl = `/customer/notifications?phone=${encodeURIComponent(phone)}`;

  const loadNotificationSettings = async () => {
    try {
      setLoadingNotifications(true);
      // Query-string URL matches GET /customer/notifications; POST uses the same path (deployed Lambda must include POST handler).
      const result = await apiClient.get<{ settings?: Partial<NotificationSettings> }>(
        `${notificationSettingsQueryUrl}&limit=1`
      );
      const merged = mergeNotificationSettings(result.settings);
      setNotificationSettings(merged);
      try {
        if (typeof window !== 'undefined' && result.settings) {
          localStorage.setItem(notificationSettingsStorageKey(phone), JSON.stringify(merged));
        }
      } catch {
        /* ignore quota */
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      try {
        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem(notificationSettingsStorageKey(phone));
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
            setNotificationSettings(mergeNotificationSettings(parsed));
          }
        }
      } catch {
        /* ignore */
      }
    } finally {
      setLoadingNotifications(false);
    }
  };

  const toggleNotification = async (key: keyof NotificationSettings) => {
    const previous = notificationSettings;
    const next = { ...previous, [key]: !previous[key] };
    // Normalize so every channel key is an explicit boolean in state and in JSON (matches backend merge).
    const payload = mergeNotificationSettings(next);
    setNotificationSettings(payload);

    const persistLocal = () => {
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(notificationSettingsStorageKey(phone), JSON.stringify(payload));
        }
      } catch {
        /* ignore */
      }
    };

    try {
      // PUT is present on older Lambda bundles; POST matches GET /customer/notifications on current code.
      await apiClient.put(`/customer/notifications/${encodeURIComponent(phone)}`, payload);
      persistLocal();
    } catch (putErr) {
      try {
        await apiClient.post(notificationSettingsQueryUrl, payload);
        persistLocal();
      } catch (postErr) {
        const put404 = httpStatusFromApiError(putErr) === 404;
        const post404 = httpStatusFromApiError(postErr) === 404;
        // Remote dev API may not have POST yet; PUT may 404 if phone has no DB row. In UAT, keep toggles in localStorage.
        if (isUatMode() && put404 && post404) {
          if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.warn(
              '[notifications] PUT and POST returned 404 — saved toggles locally only. ' +
                'For a real API: run backend/lambda `npm run start:local` and set NEXT_PUBLIC_API_BASE_URL=http://localhost:3000 in apps/customer-web/.env.local, or deploy the Lambda.'
            );
          }
          persistLocal();
        } else {
          console.error('Error updating notification settings:', putErr, postErr);
          setNotificationSettings(previous);
        }
      }
    }
  };

  // ============================================
  // UI HELPERS
  // ============================================
  
  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  };

  const handleHeaderCloseToHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
      return;
    }
    handleClose();
  };

  const handleSidebarBack = () => {
    if (showAddressForm) {
      setShowAddressForm(false);
      setEditingAddress(null);
      return;
    }
    if (showPaymentForm) {
      setShowPaymentForm(false);
      return;
    }
    if (activeView !== 'menu') {
      setActiveView('menu');
      setShowAddressForm(false);
      setShowPaymentForm(false);
      setEditingAddress(null);
    }
  };

  const showProfileMenuBack = activeView !== 'menu' || showAddressForm || showPaymentForm;

  useEffect(() => {
    if (!onRegisterOverlayBack) return;
    onRegisterOverlayBack(() => {
      if (activeView === 'menu' && !showAddressForm && !showPaymentForm) {
        return false;
      }
      handleSidebarBack();
      return true;
    });
    return () => onRegisterOverlayBack(null);
  }, [activeView, showAddressForm, showPaymentForm, onRegisterOverlayBack]);

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'walker': return '🐕';
      case 'grooming': return '✂️';
      case 'vet': return '⚕️';
      case 'boarding': return '🏠';
      default: return '📦';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const activeBookings = bookings.filter(b => b.status === 'active');
  const completedBookings = bookings.filter(b => b.status === 'completed');

  const menuItems = useMemo(
    () =>
      [
    {
      icon: User,
      label: 'My Profile',
      subtitle: 'View and manage your personal details',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      action: 'profile' as const,
      isExternal: true,
    },
    {
      icon: Package2,
      label: 'My Packages',
      subtitle: 'View purchased packages',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      action: 'my-packages' as const,
      isExternal: true,
    },
    {
      icon: ShoppingBag,
      label: 'My Orders',
      subtitle: 'View order history and tracking',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-700',
      action: 'orders' as const,
      isExternal: true,
      comingSoon: !isCustomerEcommerceEnabled(),
    },
    {
      icon: Wallet,
      label: 'My Wallet',
      subtitle: 'Manage wallet and transactions',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      action: 'wallet' as const,
      isExternal: true,
    },
    ...(showWarmpawzPayMenu
      ? [
          {
            icon: QrCode,
            label: 'Warmpawz Pay',
            subtitle: 'View pay-at-vendor transactions',
            iconBg: 'bg-orange-100',
            iconColor: 'text-orange-600',
            action: 'warmpawz-pay' as const,
            isExternal: true,
          },
        ]
      : []),
    {
      icon: Award,
      label: 'Rewards & Points',
      subtitle: 'View rewards and redeem points',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      action: 'rewards-loyalty' as const,
      isExternal: true,
    },
    {
      icon: Users,
      label: 'Refer & Earn',
      subtitle: 'Invite friends and earn rewards',
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
      action: 'referral-system' as const,
      isExternal: true,
    },
    {
      icon: Calendar,
      label: 'My Appointments',
      subtitle: 'View upcoming and past appointments',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      action: 'appointments' as const,
      isExternal: true,
    },
    {
      icon: MapPin,
      label: 'Address Book',
      subtitle: 'Manage saved addresses',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      action: 'addresses' as const,
      isExternal: true,
    },
    {
      icon: Package,
      label: 'My Bookings',
      subtitle: 'View all bookings',
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600',
      view: 'bookings' as const,
      badge: activeBookings.length,
    },
    {
      icon: ShoppingCart,
      label: 'My Cart',
      subtitle: 'Review items before checkout',
      iconBg: 'bg-pink-100',
      iconColor: 'text-pink-600',
      view: 'cart' as const,
      badge: cartItems.length,
      comingSoon: !isCustomerEcommerceEnabled(),
    },
    {
      icon: Heart,
      label: 'Saved Items',
      subtitle: 'Your wishlist and favorites',
      iconBg: 'bg-pink-100',
      iconColor: 'text-pink-600',
      view: 'saved' as const,
      badge: savedBadgeCount,
      comingSoon: !isCustomerEcommerceEnabled(),
    },
    {
      icon: CreditCard,
      label: 'Payment Settings',
      subtitle: 'Manage payment methods',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      view: 'payments' as const,
    },
    {
      icon: Bell,
      label: 'Notifications',
      subtitle: 'Manage notification preferences',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      view: 'notifications' as const,
    },
    {
      icon: HelpCircle,
      label: 'Help & Support',
      subtitle: 'Get help and contact support',
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-600',
      view: 'help' as const,
    },
  ],
    [showWarmpawzPayMenu, activeBookings.length, cartItems.length, savedBadgeCount]
  );

  const visibleMenuItems = filterAccountMenuForReviewAccount(
    menuItems.filter(
      (item) =>
        !(isCustomerEcommerceEnabled() && 'view' in item && item.view === 'cart')
    ),
    phone
  );

  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() || 'Account';
  const memberSinceLabel = formatMemberSinceLabel(profile?.created_at);

  return (
    <div 
      className={`fixed inset-x-0 top-0 bottom-0 z-50 overflow-hidden bg-[#F5F5F5] transition-transform duration-300 ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-customer flex-col overflow-hidden">
        {activeView === 'menu' ? (
          <ProfileAccountHero
            displayName={displayName}
            phone={phone}
            photoUrl={photoPreview || profile?.photo}
            loading={loading}
            memberSinceLabel={memberSinceLabel}
            onCloseToHome={handleHeaderCloseToHome}
            onSettings={() => setActiveView('notifications')}
          />
        ) : (
          <ServiceDashboardHeader
            serviceName={
              loading
                ? 'Account'
                : displayName
            }
            serviceSubtitle={loading ? undefined : phone}
            serviceIcon={
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white">
                {loading ? (
                  <span className="h-8 w-8 animate-pulse rounded-full bg-white/40" aria-hidden />
                ) : photoPreview ? (
                  <PresignableImage src={photoPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-6 w-6 text-[#FF8C42]" />
                )}
              </span>
            }
            iconColor="text-white"
            stats={[]}
            onCloseToHome={handleHeaderCloseToHome}
            onBack={showProfileMenuBack ? handleSidebarBack : undefined}
            showBackButton={showProfileMenuBack}
            bottomEdge="sheet"
            sheetToneClass="bg-gray-50"
          />
        )}

        {/* Single scroll container — fills remaining height; no footer placeholder */}
        <div 
          ref={scrollContainerRef}
          className={`relative z-20 min-h-0 flex-1 overflow-y-auto overscroll-contain ${
            activeView === 'menu'
              ? '-mt-4 bg-[#F5F5F5] pb-[max(1rem,env(safe-area-inset-bottom))]'
              : '-mt-1 pb-6'
          }`}
          style={{ height: '100%', WebkitOverflowScrolling: 'touch' }}
        >
          {activeView === 'menu' && (
            <ProfileMenuFloatingSheet>
                <div className="space-y-2.5">
              {visibleMenuItems.map((item, index) => {
                const isComingSoon = 'comingSoon' in item && item.comingSoon;
                const showCountBadge =
                  !isComingSoon &&
                  item.badge !== undefined &&
                  item.badge > 0 &&
                  (item.label === 'My Bookings' || item.label === 'Saved Items');
                const showComingSoonBadge =
                  isComingSoon && (item.label === 'My Cart' || item.label === 'Saved Items');
                return (
                <button
                  key={index}
                  type="button"
                  disabled={isComingSoon}
                  aria-disabled={isComingSoon || undefined}
                  onClick={() => {
                    if (isComingSoon) return;
                    if (item.isExternal) {
                      if (item.action === 'profile') {
                        if (onViewProfile) onViewProfile();
                        handleClose();
                      } else if (item.action === 'appointments' && onViewAppointments) {
                        onViewAppointments();
                        handleClose();
                      } else if (item.action === 'my-packages' && onViewMyPackages) {
                        onViewMyPackages();
                        handleClose();
                      } else if (item.action === 'wallet' && onViewWallet) {
                        onViewWallet();
                        handleClose();
                      } else if (item.action && onNavigate) {
                        if (item.action === 'orders') {
                          onNavigate('account/orders');
                        } else if (item.action === 'addresses') {
                          onNavigate('account/addresses');
                        } else {
                          onNavigate(item.action);
                        }
                        handleClose();
                      }
                    } else if (item.view) {
                      setActiveView(item.view);
                    }
                  }}
                  className={`group flex h-[88px] w-full items-center justify-between gap-3 rounded-[20px] border border-[#F1F1F1] bg-white px-3.5 text-left shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition active:scale-[0.99] ${
                    isComingSoon ? 'cursor-not-allowed opacity-70' : 'hover:border-[#E8E8E8]'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] ${item.iconBg}`}>
                      <item.icon className={`h-6 w-6 ${item.iconColor}`} strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[15px] font-semibold leading-tight text-gray-900">{item.label}</span>
                        {showComingSoonBadge && (
                          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-500">
                            COMING SOON
                          </span>
                        )}
                      </div>
                      {'subtitle' in item && item.subtitle && (
                        <p className="mt-1 truncate text-xs leading-snug text-gray-500">{item.subtitle}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {showCountBadge && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#FF8C42] px-1.5 text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className={`h-4 w-4 ${isComingSoon ? 'text-gray-300' : 'text-gray-400'}`} />
                  </div>
                </button>
              );
              })}
                </div>

              {/* Logout */}
              <button 
                onClick={handleLogout}
                className="group mt-2.5 flex h-[88px] w-full items-center justify-between gap-3 rounded-[20px] border border-red-200 bg-red-50/60 px-3.5 text-left shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition active:scale-[0.99]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-red-100">
                    <LogOut className="h-6 w-6 text-red-600" strokeWidth={2} />
                  </div>
                  <div>
                    <span className="text-[15px] font-semibold text-red-600">Logout</span>
                    <p className="mt-1 text-xs text-red-400">Sign out of your account</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-red-300" />
              </button>
              </ProfileMenuFloatingSheet>
          )}

          {/* Bookings View */}
          {activeView === 'bookings' && (
            <div className="p-5 pb-8">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-800">My Bookings</h3>
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-4 text-center border border-orange-200">
                  <p className="text-3xl font-bold text-[#FF8C42]">{bookings.length}</p>
                  <p className="text-xs text-gray-600 mt-1.5">Total</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 text-center border border-green-200">
                  <p className="text-3xl font-bold text-green-600">{activeBookings.length}</p>
                  <p className="text-xs text-gray-600 mt-1.5">Active</p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 text-center border border-gray-200">
                  <p className="text-3xl font-bold text-gray-600">{completedBookings.length}</p>
                  <p className="text-xs text-gray-600 mt-1.5">Done</p>
                </div>
              </div>

              {/* Bookings List */}
              {loadingBookings ? (
                <div className="text-center py-20">
                  <div className="w-14 h-14 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading...</p>
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl">
                  <Package className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-gray-800 font-semibold text-lg mb-2">No Bookings Yet</h3>
                  <p className="text-gray-600">Your service bookings will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookings.map((booking) => (
                    <button
                      key={booking.id}
                      onClick={() => {
                        onViewBooking && onViewBooking(booking.id, booking.petId);
                        handleClose();
                      }}
                      className="w-full bg-white border border-gray-200 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform text-left"
                    >
                      <div className="flex gap-3">
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-pink-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                          {getServiceIcon(booking.serviceType)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-bold text-gray-800">
                              {formatServiceTypeLabel(booking.serviceType)}
                            </h4>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                              {booking.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">
                            {booking.petName} • {booking.vendorName}
                          </p>

                          {/* 🔐 OTP DISPLAY - Show prominently for active/confirmed bookings */}
                          {booking.requiresOTP && booking.completionOTP && 
                           booking.status !== 'completed' && booking.status !== 'cancelled' && (
                            <div className="mb-3 p-3 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-xl">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">🔐 Service OTP</span>
                                <span className="text-xs text-orange-600">Share with vendor</span>
                              </div>
                              <div className="flex items-center justify-center gap-2 mt-2">
                                <span className="text-3xl font-bold text-orange-600 tracking-widest">
                                  {booking.completionOTP}
                                </span>
                              </div>
                              <p className="text-xs text-center text-orange-600 mt-2">
                                ⚠️ Share this OTP with the vendor to complete your service
                              </p>
                            </div>
                          )}
                          
                          {/* Completed OTP indicator */}
                          {booking.status === 'completed' && booking.otpVerifiedAt && (
                            <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-xs text-center text-green-700">
                                ✓ Service completed on {formatIstInstantDisplay(booking.otpVerifiedAt)}
                              </p>
                            </div>
                          )}

                          {booking.status === 'active' && (
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                                <span>{booking.completedSessions}/{booking.totalSessions} sessions</span>
                                <span>
                                  {Math.round(
                                    (booking.completedSessions / Math.max(booking.totalSessions, 1)) * 100
                                  )}
                                  %
                                </span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35]"
                                  style={{
                                    width: `${(booking.completedSessions / Math.max(booking.totalSessions, 1)) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="font-semibold text-[#FF8C42]">₹{booking.price}</span>
                            <span>•</span>
                            <span>{new Date(booking.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cart View */}
          {activeView === 'cart' && (
            <div className="p-5 pb-32">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">My Cart</h3>
              
              {loadingCart ? (
                <div className="text-center py-20">
                  <div className="w-14 h-14 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                </div>
              ) : cartItems.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl">
                  <ShoppingCart className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-gray-800 font-semibold text-lg mb-2">Your cart is empty</h3>
                  <p className="text-gray-600 mb-6">Add products to get started</p>
                  <Button
                    onClick={() => {
                      if (onNavigate) {
                        onNavigate('shop');
                      }
                      handleClose();
                    }}
                    className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white h-12 px-8"
                  >
                    Continue Shopping
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    {cartItems.map((item) => (
                      <div key={item.itemId} className="bg-white border border-gray-200 rounded-2xl p-4">
                        <div className="flex gap-3">
                          <div className="w-20 h-20 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
                            {item.photo && <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-800 mb-1.5">{item.name}</h4>
                            <p className="text-[#FF8C42] font-bold text-lg mb-3">₹{item.price}</p>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => updateCartQuantity(item.itemId, item.quantity - 1)}
                                className="w-9 h-9 bg-gray-200 rounded-lg flex items-center justify-center active:bg-gray-300 transition-colors"
                              >
                                <span className="text-lg font-bold">-</span>
                              </button>
                              <span className="font-semibold w-10 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateCartQuantity(item.itemId, item.quantity + 1)}
                                className="w-9 h-9 bg-gray-200 rounded-lg flex items-center justify-center active:bg-gray-300 transition-colors"
                              >
                                <span className="text-lg font-bold">+</span>
                              </button>
                              <button
                                onClick={() => removeFromCart(item.itemId)}
                                className="ml-auto text-red-500 active:text-red-700 p-2"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Spacing for checkout bar */}
                  <div className="h-8"></div>
                </>
              )}
            </div>
          )}

          {/* Saved Items View */}
          {activeView === 'saved' && (
            <div className="p-5 pb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Saved Items</h3>
              
              {loadingSaved ? (
                <div className="text-center py-20">
                  <div className="w-14 h-14 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : savedItems.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl">
                  <Heart className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-gray-800 font-semibold text-lg mb-2">No saved items</h3>
                  <p className="text-gray-600">Save your favorite products and services</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {savedItems.map((item) => (
                    <div key={item.storageKey} className="bg-white border border-gray-200 rounded-2xl p-3">
                      <div className="w-full aspect-square bg-gray-200 rounded-xl overflow-hidden mb-3">
                        <SavedItemThumbnail
                          image={item.image}
                          emoji={item.emoji}
                          name={item.name}
                        />
                      </div>
                      <h4 className="font-semibold text-gray-800 text-sm mb-1 line-clamp-2 min-h-[40px]">{item.name}</h4>
                      <p className="text-sm text-[#FF8C42] font-medium mb-3">
                        {item.missing ? 'Unavailable' : `₹${Math.round(item.price)}`}
                      </p>
                      <button
                        onClick={() => removeFromSaved(item)}
                        className="w-full py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl active:bg-red-100 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Addresses View */}
          {activeView === 'addresses' && (
            <div className="p-5 pb-32">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800">My Addresses</h3>
                {!showAddressForm && (
                  <Button 
                    onClick={() => setShowAddressForm(true)} 
                    className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white h-11 px-5 gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add
                  </Button>
                )}
              </div>

              {showAddressForm ? (
                <AddressForm
                  address={editingAddress}
                  onSave={saveAddress}
                  onCancel={() => {
                    setShowAddressForm(false);
                    setEditingAddress(null);
                  }}
                />
              ) : loadingAddresses ? (
                <div className="text-center py-20">
                  <div className="w-14 h-14 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : addresses.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl">
                  <HomeIcon className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-gray-800 font-semibold text-lg mb-2">No saved addresses</h3>
                  <p className="text-gray-600">Add delivery addresses for faster checkout</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-gray-800 text-lg">{addr.label}</h4>
                            {addr.isDefault && (
                              <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-lg">Default</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 mb-1">{addr.name}</p>
                          <p className="text-sm text-gray-600">{addr.addressLine1}</p>
                          {addr.addressLine2 && <p className="text-sm text-gray-600">{addr.addressLine2}</p>}
                          <p className="text-sm text-gray-600">{addr.city}, {addr.state} - {addr.pincode}</p>
                          {addr.houseNo && <p className="text-sm text-gray-600 mt-1">House / Flat: {addr.houseNo}</p>}
                          {addr.floor && <p className="text-sm text-gray-600">Floor: {addr.floor}</p>}
                          <p className="text-sm text-gray-600 mt-1.5">📞 {addr.phone}</p>
                        </div>
                      </div>
                      <div className="flex gap-2.5 pt-3 border-t border-gray-200">
                        <Button 
                          variant="outline" 
                          className="flex-1 h-11"
                          onClick={() => {
                            setEditingAddress(addr);
                            setShowAddressForm(true);
                          }}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1 h-11 text-red-600 hover:bg-red-50 border-red-200"
                          onClick={() => deleteAddress(addr.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payment Methods View */}
          {activeView === 'payments' && (
            <div className="p-5 pb-32">
              {!showPaymentForm ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-800">Payment Methods</h3>
                    <Button 
                      className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white h-11 px-5 gap-2"
                      onClick={() => setShowPaymentForm(true)}
                    >
                      <Plus className="w-5 h-5" />
                      Add
                    </Button>
                  </div>
              
              {loadingPayments ? (
                <div className="text-center py-20">
                  <div className="w-14 h-14 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : paymentMethods.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl">
                  <CreditCard className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-gray-800 font-semibold text-lg mb-2">No payment methods</h3>
                  <p className="text-gray-600">Add a card for faster payments</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentMethods.map((pm) => {
                    const kind = effectivePaymentDisplayKind(pm);
                    const last4Digits = (pm.cardNumber || '').replace(/\D/g, '').slice(-4);
                    const brandRaw = pm.cardType ? String(pm.cardType).replace(/_/g, ' ').trim() : '';
                    const brandPretty =
                      brandRaw.length > 0 && brandRaw.length <= 24 ? brandRaw.toUpperCase() : '';
                    const cardHeadline =
                      last4Digits.length > 0
                        ? `${brandPretty ? `${brandPretty} · ` : ''}•••• ${last4Digits}`
                        : brandPretty || 'Saved card';

                    const typeMeta =
                      kind === 'card'
                        ? {
                            label: 'Card',
                            sub: 'Debit or credit card',
                            Icon: CreditCard,
                            badgeClass: 'bg-orange-500 text-white',
                          }
                        : kind === 'upi'
                          ? {
                              label: 'UPI',
                              sub: 'Unified Payments',
                              Icon: Smartphone,
                              badgeClass: 'bg-violet-600 text-white',
                            }
                          : {
                              label: 'Net banking',
                              sub: 'Bank account',
                              Icon: Building2,
                              badgeClass: 'bg-sky-600 text-white',
                            };

                    const TypeIcon = typeMeta.Icon;

                    return (
                    <div
                      key={pm.id}
                      className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
                    >
                      <div className="flex gap-3 mb-3">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${typeMeta.badgeClass}`}
                          aria-hidden
                        >
                          <TypeIcon className="h-6 w-6 text-white" strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${typeMeta.badgeClass}`}>
                              {typeMeta.label}
                            </span>
                            {pm.isDefault && (
                              <span className="px-2.5 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-lg">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mb-1">{typeMeta.sub}</p>
                          <h4 className="font-bold text-gray-900 text-base break-all leading-snug">
                            {kind === 'card'
                              ? cardHeadline
                              : kind === 'upi'
                                ? pm.upiId || 'UPI ID on file'
                                : pm.bankName || 'Bank on file'}
                          </h4>
                          {kind === 'card' && pm.cardHolderName ? (
                            <p className="text-sm text-gray-600 mt-1">{pm.cardHolderName}</p>
                          ) : null}
                          {kind === 'card' && (pm.expiryMonth || pm.expiryYear) ? (
                            <p className="text-sm text-gray-600">
                              Expires {pm.expiryMonth || '—'}/{pm.expiryYear || '—'}
                            </p>
                          ) : null}
                          {kind === 'upi' && pm.upiId ? (
                            <p className="text-sm text-gray-500 mt-1">Pay with this UPI ID at checkout.</p>
                          ) : null}
                          {kind === 'netbanking' && pm.bankName ? (
                            <p className="text-sm text-gray-600 mt-1">Net banking · {pm.bankName}</p>
                          ) : null}
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full h-11 text-red-600 hover:bg-red-50 border-red-200"
                        onClick={() => deletePaymentMethod(pm.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  );
                  })}
                </div>
              )}
                </>
              ) : (
                /* Add Payment Form */
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-800">Add Payment Method</h3>
                    <button 
                      onClick={() => setShowPaymentForm(false)}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Payment Type Selector */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Payment Type</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setNewPayment({ ...newPayment, type: 'card' })}
                        className={`p-4 border-2 rounded-xl text-center transition-all ${
                          newPayment.type === 'card' 
                            ? 'border-[#FF8C42] bg-orange-50' 
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <CreditCard className={`w-6 h-6 mx-auto mb-2 ${newPayment.type === 'card' ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
                        <span className={`text-sm font-semibold ${newPayment.type === 'card' ? 'text-[#FF8C42]' : 'text-gray-600'}`}>Card</span>
                      </button>
                      <button
                        onClick={() => setNewPayment({ ...newPayment, type: 'upi' })}
                        className={`p-4 border-2 rounded-xl text-center transition-all ${
                          newPayment.type === 'upi' 
                            ? 'border-[#FF8C42] bg-orange-50' 
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <span className={`text-2xl mb-2 block ${newPayment.type === 'upi' ? 'opacity-100' : 'opacity-40'}`}>📱</span>
                        <span className={`text-sm font-semibold ${newPayment.type === 'upi' ? 'text-[#FF8C42]' : 'text-gray-600'}`}>UPI</span>
                      </button>
                      <button
                        onClick={() => setNewPayment({ ...newPayment, type: 'netbanking' })}
                        className={`p-4 border-2 rounded-xl text-center transition-all ${
                          newPayment.type === 'netbanking' 
                            ? 'border-[#FF8C42] bg-orange-50' 
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <span className={`text-2xl mb-2 block ${newPayment.type === 'netbanking' ? 'opacity-100' : 'opacity-40'}`}>🏦</span>
                        <span className={`text-sm font-semibold ${newPayment.type === 'netbanking' ? 'text-[#FF8C42]' : 'text-gray-600'}`}>Net Banking</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Form */}
                  {newPayment.type === 'card' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Card Number</label>
                        <input
                          type="text"
                          placeholder="1234 5678 9012 3456"
                          maxLength={19}
                          value={newPayment.cardNumber}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
                            const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
                            setNewPayment({ ...newPayment, cardNumber: formatted });
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Card Holder Name</label>
                        <input
                          type="text"
                          placeholder="John Doe"
                          value={newPayment.cardHolderName}
                          onChange={(e) => setNewPayment({ ...newPayment, cardHolderName: e.target.value.toUpperCase() })}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Month</label>
                          <input
                            type="text"
                            placeholder="MM"
                            maxLength={2}
                            value={newPayment.expiryMonth}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 12)) {
                                setNewPayment({ ...newPayment, expiryMonth: value });
                              }
                            }}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Year</label>
                          <input
                            type="text"
                            placeholder="YYYY"
                            maxLength={4}
                            inputMode="numeric"
                            value={newPayment.expiryYear}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                              setNewPayment({ ...newPayment, expiryYear: value });
                            }}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">CVV</label>
                          <input
                            type="password"
                            placeholder="123"
                            maxLength={3}
                            value={newPayment.cvv}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              setNewPayment({ ...newPayment, cvv: value });
                            }}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Card Type</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {(['visa', 'mastercard', 'rupay', 'amex'] as const).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setNewPayment({ ...newPayment, cardType: type })}
                              className={`flex min-h-[3rem] items-center justify-center px-2 py-2 border-2 rounded-xl text-center text-xs sm:text-sm font-semibold leading-snug transition-all ${
                                newPayment.cardType === type
                                  ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                                  : 'border-gray-200 bg-white text-gray-600'
                              }`}
                            >
                              {CARD_TYPE_SELECTOR_LABELS[type]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* UPI Form */}
                  {newPayment.type === 'upi' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">UPI ID</label>
                        <input
                          type="text"
                          placeholder="yourname@upi"
                          value={newPayment.upiId}
                          onChange={(e) => setNewPayment({ ...newPayment, upiId: e.target.value.toLowerCase() })}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Net Banking Form */}
                  {newPayment.type === 'netbanking' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Select Bank</label>
                        <select
                          value={newPayment.bankName}
                          onChange={(e) => setNewPayment({ ...newPayment, bankName: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                        >
                          <option value="">Choose a bank</option>
                          <option value="HDFC Bank">HDFC Bank</option>
                          <option value="ICICI Bank">ICICI Bank</option>
                          <option value="State Bank of India">State Bank of India</option>
                          <option value="Axis Bank">Axis Bank</option>
                          <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                          <option value="Punjab National Bank">Punjab National Bank</option>
                          <option value="Bank of Baroda">Bank of Baroda</option>
                          <option value="Yes Bank">Yes Bank</option>
                          <option value="IDFC First Bank">IDFC First Bank</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Default Checkbox */}
                  <div className="mt-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPayment.isDefault}
                        onChange={(e) => setNewPayment({ ...newPayment, isDefault: e.target.checked })}
                        className="w-5 h-5 text-[#FF8C42] border-gray-300 rounded focus:ring-[#FF8C42]"
                      />
                      <span className="text-sm font-semibold text-gray-700">Set as default payment method</span>
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-8 space-y-3">
                    <Button 
                      onClick={savePaymentMethod}
                      className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white h-14 text-lg"
                    >
                      Save Payment Method
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowPaymentForm(false)}
                      className="w-full h-14 text-lg"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notifications View */}
          {activeView === 'notifications' && (
            <div className="p-5 pb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Notifications</h3>
              
              {loadingNotifications ? (
                <div className="text-center py-20">
                  <div className="w-14 h-14 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  <NotificationToggle
                    label="Push Notifications"
                    description="Receive booking updates instantly"
                    enabled={notificationSettings.push}
                    onToggle={() => toggleNotification('push')}
                  />
                  <NotificationToggle
                    label="Email Notifications"
                    description="Receive offers via email"
                    enabled={notificationSettings.email}
                    onToggle={() => toggleNotification('email')}
                  />
                  <NotificationToggle
                    label="SMS Notifications"
                    description="Get booking confirmations via SMS"
                    enabled={notificationSettings.sms}
                    onToggle={() => toggleNotification('sms')}
                  />
                  <NotificationToggle
                    label="Booking Updates"
                    description="Get notified about your bookings"
                    enabled={notificationSettings.bookingUpdates}
                    onToggle={() => toggleNotification('bookingUpdates')}
                  />
                  <NotificationToggle
                    label="Promotions & Offers"
                    description="Special deals and discounts"
                    enabled={notificationSettings.promotions}
                    onToggle={() => toggleNotification('promotions')}
                  />
                </div>
              )}
            </div>
          )}

          {/* Help & Support View */}
          {activeView === 'help' && (
            <div className="p-5 pb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Help & Support</h3>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    prepareSupportHelpFromSidebar('faq');
                    onNavigate?.('support_help');
                  }}
                  className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl active:scale-[0.98] active:bg-gray-50 transition-all shadow-sm"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <HelpCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-800">FAQ</p>
                    <p className="text-sm text-gray-600">Find answers to common questions</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    prepareSupportHelpFromSidebar('contact');
                    onNavigate?.('support_help');
                  }}
                  className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl active:scale-[0.98] active:bg-gray-50 transition-all shadow-sm"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-800">Chat with Us</p>
                    <p className="text-sm text-gray-600">Get instant support</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.location.href = `mailto:${CUSTOMER_SUPPORT_EMAIL}`;
                    }
                  }}
                  className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl active:scale-[0.98] active:bg-gray-50 transition-all shadow-sm"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-800">Email Support</p>
                    <p className="text-sm text-gray-600">{CUSTOMER_SUPPORT_EMAIL}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    prepareSupportHelpFromSidebar('contact', { openContactForm: true });
                    onNavigate?.('support_help');
                  }}
                  className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl active:scale-[0.98] active:bg-gray-50 transition-all shadow-sm"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-800">Report an Issue</p>
                    <p className="text-sm text-gray-600">Let us know about problems</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Checkout Bar - Only visible in Cart view */}
        {activeView === 'cart' && cartItems.length > 0 && (
          <div className="flex-shrink-0 bg-white border-t-2 border-gray-200 p-5 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold text-lg">Total:</span>
              <span className="text-3xl font-bold text-[#FF8C42]">₹{cartTotal}</span>
            </div>
            <Button className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white h-14 text-lg">
              Proceed to Checkout
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components
function NotificationToggle({ label, description, enabled, onToggle }: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl">
      <div className="flex-1">
        <p className="font-semibold text-gray-800">{label}</p>
        <p className="text-sm text-gray-600 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        className={`w-14 h-8 rounded-full relative transition-colors flex-shrink-0 ml-4 ${
          enabled ? 'bg-[#FF8C42]' : 'bg-gray-300'
        }`}
      >
        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow-md ${
          enabled ? 'right-1' : 'left-1'
        }`} />
      </button>
    </div>
  );
}

function AddressForm({ address, onSave, onCancel }: {
  address: Address | null;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const addrWithGeo = address as (Address & { latitude?: number; longitude?: number }) | null;
  const initialCoords =
    address?.coordinates ??
    (addrWithGeo?.latitude != null && addrWithGeo?.longitude != null
      ? { lat: Number(addrWithGeo.latitude), lng: Number(addrWithGeo.longitude) }
      : null);
  const [formData, setFormData] = useState({
    label: address?.label || 'Home',
    name: address?.name || '',
    phone: address?.phone || '',
    addressLine1: address?.addressLine1 || '',
    city: (address?.city || '').replace(/\s*\d{6}\s*$/, '').trim(),
    state: (address?.state || '').replace(/\s*\d{6}\s*$/, '').trim(),
    pincode: address?.pincode || '',
    houseNo: address?.houseNo || '',
    floor: address?.floor || '',
    isDefault: address?.isDefault || false,
    coordinates: initialCoords as { lat: number; lng: number } | null,
    latitude: initialCoords?.lat ?? null,
    longitude: initialCoords?.lng ?? null,
  });

  const [addressCountryCode, setAddressCountryCode] = useState('+91');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.houseNo?.trim()) {
      alert('Please enter House No / Flat No');
      return;
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <UseCurrentLocationButton
        variant="solid"
        label="Detect My Current Location"
        onSuccess={(result: AddressFromGeolocationResult) => {
          setFormData((prev) => ({
            ...prev,
            addressLine1: result.addressLine1 ?? prev.addressLine1,
            city: result.city ?? prev.city,
            state: result.state ?? prev.state,
            pincode: result.pincode ?? prev.pincode,
            coordinates: result.coordinates,
            latitude: result.latitude,
            longitude: result.longitude,
          }));
        }}
      />

      <div className="relative">
        <div className="absolute inset-x-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-4 text-sm text-gray-500">or enter manually</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2.5">Label</label>
        <select
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
        >
          <option value="Home">Home</option>
          <option value="Work">Work</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2.5">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2.5">Phone</label>
        <div className="flex items-stretch border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-[#FF8C42] transition-all bg-white">
          <CountryCodeSelector
            selectedCode={addressCountryCode}
            onSelect={setAddressCountryCode}
            disabled={false}
          />
          <input
            type="tel"
            inputMode="numeric"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, '') })}
            maxLength={10}
            className="flex-1 px-4 py-3.5 outline-none"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2.5">Address Line 1</label>
        <EnhancedAddressAutocomplete
          value={formData.addressLine1}
          onChange={(address: string, components?: AddressComponents) => {
            setFormData(prev => {
              const next = { ...prev, addressLine1: address };
              if (components) {
                if (components.city && !prev.city) next.city = components.city;
                if (components.state && !prev.state) next.state = components.state;
                if (components.pincode && !prev.pincode) next.pincode = components.pincode;
                if (components.coordinates) {
                  next.coordinates = {
                    lat: components.coordinates.lat,
                    lng: components.coordinates.lng,
                  };
                  next.latitude = components.coordinates.lat;
                  next.longitude = components.coordinates.lng;
                }
              }
              return next;
            });
          }}
          placeholder="Search address, landmark, city..."
          className="w-full"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2.5">City</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2.5">State</label>
          <input
            type="text"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2.5">Pincode</label>
        <input
          type="text"
          value={formData.pincode}
          onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
          maxLength={6}
          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2.5">House No / Flat No *</label>
        <input
          type="text"
          value={formData.houseNo}
          onChange={(e) => setFormData({ ...formData, houseNo: e.target.value })}
          placeholder="e.g., A-101, Flat 12B"
          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2.5">Floor</label>
        <input
          type="text"
          value={formData.floor}
          onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
          placeholder="e.g., 1st Floor"
          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
        <input
          type="checkbox"
          id="isDefault"
          checked={formData.isDefault}
          onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
          className="w-5 h-5 accent-[#FF8C42]"
        />
        <label htmlFor="isDefault" className="text-sm font-medium text-gray-700">Make this my default address</label>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-12">
          Cancel
        </Button>
        <Button type="submit" className="flex-1 h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white">
          {address ? 'Update' : 'Add'} Address
        </Button>
      </div>
    </form>
  );
}
