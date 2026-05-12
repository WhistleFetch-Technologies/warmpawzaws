'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Camera, Edit2, Save, X, User, Calendar, 
  MessageSquare, Heart, Settings, ChevronRight, Package, Package2,
  Clock, MapPin, Star, Bell, CreditCard, HelpCircle, LogOut,
  ShoppingCart, Home as HomeIcon, FileText, Shield, AlertCircle, Mail,
  Trash2, Plus, Check, Wallet, ShoppingBag,
  Gift, Users, Award, Smartphone, Building2
} from 'lucide-react';
// Uses apiClient with Cognito auth
import { apiClient, isUatMode } from '@/lib/api-client';
import { urlCustomerAddressesByPhone } from '@/lib/customer-service-list-urls';
import { stripDuplicatePincodeFromState } from '@/lib/address-field-sanitize';
import { getGoogleMapsBrowserApiKey } from '@/lib/google-maps-browser-key';
import { EnhancedAddressAutocomplete, AddressComponents } from '@/components/shared/EnhancedAddressAutocomplete';
import { CountryCodeSelector } from '@/components/ui/CountryCodeSelector';
import { validateEmail } from '@/lib/validation';
import { PresignableImage } from '@/components/shared/PresignableImage';
import {
  normalizeCustomerProfileFields,
  overlayCustomerProfileAfterSave,
  patchCustomerProfileKeysInLocalStorage,
} from '@/lib/normalize-customer-profile-api';
import {
  inferCityStateFromCommaAddress,
  mergeStreetAddressLineOnly,
} from '@/lib/profile-address-format';
import { SUPPORT_INITIAL_TAB_KEY } from '@/lib/support-contact';
import { WARMPAWZ_ACCOUNT_SIDEBAR_ACTIVE_VIEW_KEY } from '@/lib/go-back-or-replace';
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';

const CUSTOMER_SUPPORT_EMAIL = 'support@warmpawz.com';

function setSupportInitialTab(tab: 'faq' | 'contact' | 'tickets') {
  try {
    sessionStorage.setItem(SUPPORT_INITIAL_TAB_KEY, tab);
  } catch {
    /* ignore */
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

interface SavedItem {
  itemId: string;
  type: 'product' | 'service' | 'vendor';
  name: string;
  photo?: string;
  savedAt: string;
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
  createdAt: string;
  updatedAt: string;
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
  onNavigate?: (path: string) => void;
}

export function UserAccountSidebar({
  phone,
  onClose,
  onNavigateHome,
  onViewBooking,
  onViewAppointments,
  onViewWallet,
  onViewMyPackages,
  onNavigate,
}: UserAccountSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeView, setActiveView] = useState<
    'menu' | 'profile' | 'bookings' | 'cart' | 'saved' | 'addresses' | 'payments' | 'notifications' | 'help'
  >('menu');
  
  // Profile states
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Bookings states
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  
  // Cart states
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loadingCart, setLoadingCart] = useState(true);
  const [cartTotal, setCartTotal] = useState(0);
  
  // Saved items states
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  
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
  const [saving, setSaving] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => setIsOpen(true), 50);
    loadProfile();
    loadBookings();
    try {
      const v = sessionStorage.getItem(WARMPAWZ_ACCOUNT_SIDEBAR_ACTIVE_VIEW_KEY);
      if (v === 'bookings') {
        setActiveView('bookings');
        sessionStorage.removeItem(WARMPAWZ_ACCOUNT_SIDEBAR_ACTIVE_VIEW_KEY);
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
    if (activeView === 'saved') loadSaved();
    if (activeView === 'addresses') loadAddresses();
    if (activeView === 'payments') loadPayments();
    if (activeView === 'notifications') loadNotificationSettings();
    if (activeView === 'bookings') loadBookings(); // Reload bookings when viewing bookings tab
  }, [activeView]);

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
        const rawState = (ist ?? base.state ?? '').trim();
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
          state: stripDuplicatePincodeFromState(rawState, base.pincode),
          photo: base.photo,
        };
        setProfile(next);
        setPhotoPreview(base.photo);
        setOriginalProfile({ ...next });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && profile) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      
      // Show preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Upload to S3
      try {
        setSaving(true);
        const { uploadCustomerPhoto } = await import('@/lib/photo-upload');
        const result = await uploadCustomerPhoto(file, phone);
        
        if (result.success && result.publicUrl) {
          setProfile({ ...profile, photo: result.publicUrl });
          console.log('✅ Customer photo uploaded to S3:', result.publicUrl);
        } else {
          console.error('Failed to upload photo:', result.error);
          // Fallback to base64 if S3 upload fails
          const base64Reader = new FileReader();
          base64Reader.onloadend = () => {
            setProfile({ ...profile, photo: base64Reader.result as string });
          };
          base64Reader.readAsDataURL(file);
        }
      } catch (error) {
        console.error('Error uploading photo to S3:', error);
        // Fallback to base64
        const base64Reader = new FileReader();
        base64Reader.onloadend = () => {
          setProfile({ ...profile, photo: base64Reader.result as string });
        };
        base64Reader.readAsDataURL(file);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    if (!profile.firstName || !profile.lastName || !profile.email || !profile.address || !profile.pincode) {
      alert('Please fill in all required fields');
      return;
    }

    if (!profile.houseNo?.trim()) {
      alert('Please enter House No / Flat No');
      return;
    }

    if (!validateEmail(profile.email)) {
      alert('Please enter a valid email address');
      return;
    }

    if (!/^\d{6}$/.test(profile.pincode)) {
      alert('Please enter a valid 6-digit pincode');
      return;
    }

    setSaving(true);
    try {
      const addr = profile.address.trim();
      const { city: inferredCity, state: inferredState } = inferCityStateFromCommaAddress(addr);
      const cityResolved = (profile.city?.trim() || inferredCity || '').trim();
      const stateResolved = (profile.state?.trim() || inferredState || '').trim();
      const payload: UserProfile = {
        ...profile,
        address: addr,
        city: cityResolved || profile.city,
        state: stateResolved || profile.state,
        houseNo: profile.houseNo.trim(),
        floor: (profile.floor || '').trim(),
      };
      await apiClient.post(`/customer/profile?phone=${encodeURIComponent(phone)}`, { phone: phone, profile: payload });
      patchCustomerProfileKeysInLocalStorage({
        pincode: payload.pincode,
        address: payload.address,
        city: payload.city,
        state: payload.state,
      });
      alert('✅ Profile updated successfully!');
      await loadProfile();
      setProfile((prev) => overlayCustomerProfileAfterSave(prev, payload));
      setOriginalProfile((prev) => overlayCustomerProfileAfterSave(prev, payload));
      setEditMode(false);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      alert(`❌ Error saving profile: ${error?.message || 'Network error. Please try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (originalProfile) {
      setProfile(originalProfile);
      setPhotoPreview(originalProfile.photo || '');
    }
    setEditMode(false);
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
  // SAVED ITEMS FUNCTIONS
  // ============================================
  
  const loadSaved = async () => {
    try {
      setLoadingSaved(true);
      const result = await apiClient.get<{ savedItems?: SavedItem[] }>(`/customer/saved/${phone}`);
      setSavedItems(result.savedItems || []);
    } catch (error) {
      console.error('Error loading saved items:', error);
    } finally {
      setLoadingSaved(false);
    }
  };

  const removeFromSaved = async (itemId: string, type: string) => {
    try {
      await apiClient.delete(`/customer/saved/${phone}/items/${itemId}`);
      await loadSaved();
    } catch (error) {
      console.error('Error removing from saved:', error);
    }
  };

  // ============================================
  // ADDRESS FUNCTIONS
  // ============================================
  
  const loadAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const result = await apiClient.get<{ addresses?: Address[] }>(
        urlCustomerAddressesByPhone(phone)
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
      const payload = {
        ...addressData,
        flatNo: null,
        addressLine2: null,
      };
      let data: any;
      if (editingAddress) {
        data = await apiClient.put(`/customer/${phone}/addresses/${editingAddress.id}`, payload) as any;
      } else {
        data = await apiClient.post(`/customer/${phone}/addresses`, payload) as any;
      }

      if (data && data.success) {
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
      setEditMode(false);
      setShowAddressForm(false);
      setShowPaymentForm(false);
      setEditingAddress(null);
    }
  };

  const showProfileMenuBack = activeView !== 'menu' || showAddressForm || showPaymentForm;

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

  const menuItems = [
    { icon: User, label: 'My Profile', color: 'from-blue-100 to-blue-200 text-blue-600', view: 'profile' as const },
    {
      icon: Package2,
      label: 'My packages',
      color: 'from-orange-100 to-orange-200 text-orange-600',
      action: 'my-packages' as const,
      isExternal: true,
    },
    { icon: ShoppingBag, label: 'My Orders', color: 'from-orange-100 to-orange-200 text-orange-600', action: 'orders', isExternal: true, comingSoon: true },
    { icon: Wallet, label: 'My Wallet', color: 'from-emerald-100 to-emerald-200 text-emerald-600', action: 'wallet', isExternal: true },
    { icon: Award, label: 'Rewards & Loyalty', color: 'from-amber-100 to-amber-200 text-amber-600', action: 'rewards-loyalty', isExternal: true },
    { icon: Users, label: 'Refer & Earn', color: 'from-cyan-100 to-cyan-200 text-cyan-600', action: 'referral-system', isExternal: true },
    { icon: Calendar, label: 'My Appointments', color: 'from-purple-100 to-purple-200 text-purple-600', action: 'appointments', isExternal: true },
    { icon: MapPin, label: 'Address Book', color: 'from-green-100 to-green-200 text-green-600', action: 'addresses', isExternal: true },
    { icon: Package, label: 'My Bookings', color: 'from-teal-100 to-teal-200 text-teal-600', view: 'bookings' as const, badge: activeBookings.length },
    { icon: ShoppingCart, label: 'My Cart', color: 'from-pink-100 to-pink-200 text-pink-600', view: 'cart' as const, badge: cartItems.length, comingSoon: true },
    { icon: Heart, label: 'Saved Items', color: 'from-red-100 to-red-200 text-red-600', view: 'saved' as const, badge: savedItems.length, comingSoon: true },
    { icon: CreditCard, label: 'Payment Settings', color: 'from-yellow-100 to-yellow-200 text-yellow-600', view: 'payments' as const },
    { icon: Bell, label: 'Notifications', color: 'from-indigo-100 to-indigo-200 text-indigo-600', view: 'notifications' as const },
    { icon: HelpCircle, label: 'Help & Support', color: 'from-gray-100 to-gray-200 text-gray-600', view: 'help' as const },
  ];

  return (
    <div 
      className={`fixed inset-0 bg-gray-50 z-50 transition-transform duration-300 ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      {/* Full Screen Mobile Container */}
      <div className="w-full max-w-customer mx-auto h-full bg-gray-50 flex flex-col">
        <ServiceDashboardHeader
          serviceName={
            loading
              ? 'Account'
              : [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() || 'Account'
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

        {/* Scrollable Content Area - Fixed Height with Proper Overflow */}
        <div 
          ref={scrollContainerRef}
          className="-mt-1 flex-1 min-h-0 overflow-y-auto overscroll-contain relative pb-24" 
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {activeView === 'menu' && (
            <div className="p-5 space-y-3">
              {menuItems.map((item, index) => {
                const isComingSoon = 'comingSoon' in item && item.comingSoon;
                return (
                <button
                  key={index}
                  type="button"
                  disabled={isComingSoon}
                  aria-disabled={isComingSoon || undefined}
                  onClick={() => {
                    if (isComingSoon) return;
                    if (item.isExternal) {
                      if (item.action === 'appointments' && onViewAppointments) {
                        onViewAppointments();
                        handleClose();
                      } else if (item.action === 'my-packages' && onViewMyPackages) {
                        onViewMyPackages();
                        handleClose();
                      } else if (item.action === 'wallet' && onViewWallet) {
                        onViewWallet();
                        handleClose();
                      } else if (item.action && onNavigate) {
                        // Handle new navigation actions: rewards-loyalty, referral-system, orders, addresses
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
                  className={`w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl transition-all shadow-sm text-left ${
                    isComingSoon
                      ? 'opacity-60 cursor-not-allowed'
                      : 'active:scale-[0.98] active:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-14 h-14 shrink-0 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center`}>
                      <item.icon className="w-7 h-7" />
                    </div>
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="font-semibold text-gray-800 text-[15px]">{item.label}</span>
                      {isComingSoon && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200/80 shrink-0">
                          Coming Soon
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {item.badge !== undefined && item.badge > 0 && !isComingSoon && (
                      <span className="min-w-[26px] h-[26px] px-2 bg-[#FF8C42] text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className={`w-5 h-5 ${isComingSoon ? 'text-gray-300' : 'text-gray-400'}`} />
                  </div>
                </button>
              );
              })}

              {/* Logout Button */}
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-between p-4 bg-white border-2 border-red-200 rounded-2xl active:scale-[0.98] active:bg-red-50 transition-all shadow-sm mt-6"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center">
                    <LogOut className="w-7 h-7 text-red-600" />
                  </div>
                  <span className="font-semibold text-red-600 text-[15px]">Logout</span>
                </div>
                <ChevronRight className="w-5 h-5 text-red-400" />
              </button>
            </div>
          )}

          {/* Profile View */}
          {activeView === 'profile' && (
            <div className="p-5 pb-32">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">My Profile</h3>
              
              {loading ? (
                <div className="text-center py-20">
                  <div className="w-14 h-14 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : !profile ? (
                <p className="text-center text-gray-600 py-20">Profile not found</p>
              ) : (
                <>
                  {/* Edit/Save Buttons */}
                  <div className="flex justify-end mb-6">
                    {editMode ? (
                      <div className="flex gap-3 w-full">
                        <Button
                          onClick={handleCancelEdit}
                          variant="outline"
                          className="flex-1 h-12 gap-2"
                        >
                          <X className="w-5 h-5" />
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveProfile}
                          disabled={saving}
                          className="flex-1 h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white gap-2"
                        >
                          {saving ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Save className="w-5 h-5" />
                          )}
                          Save
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => setEditMode(true)}
                        variant="outline"
                        className="h-12 gap-2 px-6"
                      >
                        <Edit2 className="w-5 h-5" />
                        Edit Profile
                      </Button>
                    )}
                  </div>

                  {/* Photo */}
                  <div className="flex flex-col items-center mb-10">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 border-4 border-white shadow-lg">
                        {photoPreview ? (
                          <PresignableImage src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-16 h-16 text-gray-400" />
                          </div>
                        )}
                      </div>
                      {editMode && (
                        <>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-0 right-0 w-12 h-12 bg-[#FF8C42] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                          >
                            <Camera className="w-6 h-6 text-white" />
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Profile Fields */}
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-2.5">First Name</label>
                        {editMode ? (
                          <input
                            type="text"
                            value={profile.firstName}
                            onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                            className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                          />
                        ) : (
                          <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">{profile.firstName || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-2.5">Last Name</label>
                        {editMode ? (
                          <input
                            type="text"
                            value={profile.lastName}
                            onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                            className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                          />
                        ) : (
                          <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">{profile.lastName || '-'}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2.5">Phone Number</label>
                      <p className="text-black font-medium px-4 py-3.5 bg-gray-100 rounded-xl">{profile.phone}</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2.5">Email</label>
                      {editMode ? (
                        <input
                          type="email"
                          value={profile.email}
                          onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                        />
                      ) : (
                        <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">{profile.email || '-'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2.5">Address</label>
                      {editMode ? (
                        <>
                          <EnhancedAddressAutocomplete
                            value={profile.address}
                            onChange={(address: string, components?: AddressComponents) => {
                              setProfile((prev) => {
                                const updated: UserProfile = { ...prev, address };
                                if (components?.pincode) {
                                  updated.pincode = components.pincode;
                                }
                                if (components?.city) {
                                  updated.city = components.city;
                                }
                                const pin = updated.pincode;
                                if (components?.state) {
                                  updated.state = stripDuplicatePincodeFromState(components.state, pin);
                                }
                                return updated;
                              });
                            }}
                            placeholder="Search address, landmark, city..."
                            className="w-full"
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1.5">
                            Type to search for your address, landmark or area
                          </p>
                        </>
                      ) : (
                        <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl whitespace-pre-wrap">
                          {profile.address || '-'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2.5">
                        House No / Flat No <span className="text-red-500">*</span>
                      </label>
                      {editMode ? (
                        <input
                          type="text"
                          value={profile.houseNo}
                          onChange={(e) => setProfile({ ...profile, houseNo: e.target.value })}
                          placeholder="e.g., A-101, Flat 12B"
                          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                        />
                      ) : (
                        <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">
                          {profile.houseNo?.trim() || '—'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2.5">Floor</label>
                      {editMode ? (
                        <input
                          type="text"
                          value={profile.floor}
                          onChange={(e) => setProfile({ ...profile, floor: e.target.value })}
                          placeholder="e.g., 1st Floor"
                          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                        />
                      ) : (
                        <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">
                          {profile.floor?.trim() || '—'}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-2.5">City</label>
                        {editMode ? (
                          <input
                            type="text"
                            value={profile.city || ''}
                            onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                            placeholder="City"
                            className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                          />
                        ) : (
                          <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">
                            {profile.city?.trim() || '—'}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-2.5">State</label>
                        {editMode ? (
                          <input
                            type="text"
                            value={profile.state || ''}
                            onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                            placeholder="State"
                            className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                          />
                        ) : (
                          <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">
                            {profile.state?.trim() || '—'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2.5">Pincode</label>
                      {editMode ? (
                        <input
                          type="text"
                          value={profile.pincode}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              pincode: e.target.value.replace(/\D/g, '').slice(0, 6),
                            })
                          }
                          maxLength={6}
                          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                        />
                      ) : (
                        <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">{profile.pincode || '-'}</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
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
                                ✓ Service completed on {new Date(booking.otpVerifiedAt).toLocaleString('en-IN', { 
                                  day: 'numeric', 
                                  month: 'short', 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
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
                    <div key={`${item.itemId}-${item.type}`} className="bg-white border border-gray-200 rounded-2xl p-3">
                      <div className="w-full aspect-square bg-gray-200 rounded-xl overflow-hidden mb-3">
                        {item.photo && <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />}
                      </div>
                      <h4 className="font-semibold text-gray-800 text-sm mb-3 line-clamp-2 min-h-[40px]">{item.name}</h4>
                      <button
                        onClick={() => removeFromSaved(item.itemId, item.type)}
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
                    setSupportInitialTab('faq');
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
                    setSupportInitialTab('contact');
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
                    setSupportInitialTab('contact');
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
  const [formData, setFormData] = useState({
    label: address?.label || 'Home',
    name: address?.name || '',
    phone: address?.phone || '',
    addressLine1: address?.addressLine1 || '',
    city: address?.city || '',
    state: stripDuplicatePincodeFromState(address?.state, address?.pincode) || '',
    pincode: address?.pincode || '',
    houseNo: address?.houseNo || '',
    floor: address?.floor || '',
    isDefault: address?.isDefault || false
  });

  const [detectingLocation, setDetectingLocation] = useState(false);
  const [addressCountryCode, setAddressCountryCode] = useState('+91');

  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('❌ Geolocation is not supported by your browser');
      return;
    }

    setDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log('📍 Location detected:', { latitude, longitude });

        // Reverse geocode using Google Maps
        try {
          const apiKey =
            (await getGoogleMapsBrowserApiKey()) ||
            process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
            '';
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
          );
          const data = await response.json();

          if (data.results && data.results[0]) {
            const result = data.results[0];
            const addressComponents = result.address_components;

            // Extract address details
            let street = '';
            let locality = '';
            let city = '';
            let state = '';
            let pincode = '';

            addressComponents.forEach((component: any) => {
              if (component.types.includes('street_number') || component.types.includes('route')) {
                street += component.long_name + ' ';
              }
              if (component.types.includes('sublocality') || component.types.includes('locality')) {
                locality = component.long_name;
              }
              if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                city = component.long_name;
              }
              if (component.types.includes('administrative_area_level_1')) {
                state = component.long_name;
              }
              if (component.types.includes('postal_code')) {
                pincode = component.long_name;
              }
            });

            setFormData(prev => ({
              ...prev,
              addressLine1: street.trim() || locality,
              city: city,
              state: stripDuplicatePincodeFromState(state, pincode),
              pincode: pincode
            }));

            alert('✅ Location detected successfully!');
          }
        } catch (error) {
          console.error('Error reverse geocoding:', error);
          alert('⚠️ Location detected but could not fetch address details');
        } finally {
          setDetectingLocation(false);
        }
      },
      (error) => {
        setDetectingLocation(false);
        
        // Log user-friendly message instead of error object
        if (error.code === 1) { // PERMISSION_DENIED
          console.log('💡 Location permission denied by user');
          alert('📍 Location access denied. Please enable location permissions in your browser settings or enter your address manually.');
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          console.log('💡 Location information unavailable');
          alert('📍 Location information unavailable. Please try again or enter your address manually.');
        } else if (error.code === 3) { // TIMEOUT
          console.log('💡 Location request timeout');
          alert('📍 Location request timeout. Please try again or enter your address manually.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

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
      {/* Detect Location Button */}
      <button
        type="button"
        onClick={detectCurrentLocation}
        disabled={detectingLocation}
        className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {detectingLocation ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Detecting Location...</span>
          </>
        ) : (
          <>
            <MapPin className="w-5 h-5" />
            <span>📍 Detect My Current Location</span>
          </>
        )}
      </button>

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
            setFormData((prev) => {
              const next = { ...prev, addressLine1: address };
              if (!components) return next;
              if (components.city && !prev.city) {
                next.city = components.city;
              }
              if (components.state && !prev.state) {
                next.state = components.state;
              }
              if (components.pincode && !prev.pincode) {
                next.pincode = components.pincode;
              }
              const pin = next.pincode || components.pincode;
              if (next.state && pin) {
                next.state = stripDuplicatePincodeFromState(next.state, pin);
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
