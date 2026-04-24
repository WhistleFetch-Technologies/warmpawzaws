'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { buildWhatsNewAnnouncements, navigateWhatsNewFromFullPage } from '@/lib/whats-new-announcements';
import { WhatsNewAnnouncementList } from '@/components/customer/whats-new/WhatsNewAnnouncementList';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Bell, Heart, Plus, ChevronRight, Star, MapPin, Clock,
  Scissors, Stethoscope, Home as HomeIcon, ShoppingBag, Users,
  GraduationCap, Coffee, Shield, Sparkles, TrendingUp,
  Phone, Video, Building2, Bone, BookOpen, Wheat, Bot, Menu, Settings, Palmtree, Pill,
  Navigation, AlertCircle, FlaskConical, MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { sanitizeCustomerAllowedServiceStyles } from '@/lib/sanitize-customer-allowed-service-styles';
import { ServiceDescriptionInline } from '../shared/ServiceDescriptionInline';
import { EnhancedSearchBar } from '../EnhancedSearchBar';
import { ProblemGridNavigation } from '../ProblemGridNavigation';
import { ForYouSection } from '../ForYouSection';
import { ServicesByProblem } from '../ServicesByProblem';
import { TrendingProblems } from '../TrendingProblems';
import { WalletIcon } from '../WalletIcon';
import { CustomerNotificationModal } from '../CustomerNotificationModal';
import { EnhancedAddPetModal } from '../EnhancedAddPetModal';
import { getServiceStyleIcon, getPetIcon } from '@/lib/icon-utils';
import { Dog, Cat, UtensilsCrossed, Package as PackageIcon, Shirt, Watch, Bed, Store } from 'lucide-react';
import { useActiveGpsTracking, ActiveTrackingSession } from '@/hooks/useActiveGpsTracking';
import { useCustomerCategories } from '@/hooks/useCustomerCategories';
// Re-export type for VendorOnTheWayPopup
import type { TrackingStatus } from '../VendorOnTheWayPopup';
import { CustomerHomeCompleteProps, Pet, UserData } from './constants/interface';
import { defaultBanners, defaultGroomingServices, defaultHotDeals, defaultVetServices, PREMIUM_PET_FOOD_HERO_MATCH_SUBTITLE, quickServices, serviceNavigationMap, serviceScreenMap } from './constants';
import { adoptionOptions, petFoodSpotlightBrands, serviceBaseOnpincode } from './constants/helpers';
import { useActiveVideoCall } from '@/hooks/useActiveTeleTracking';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { SUPPORT_INITIAL_TAB_KEY } from '@/lib/support-contact';
import { customerPathToScreen, resolveFeaturedVendorDestination } from '@/lib/promotion-navigation';
import { buildTeleInstantAutoPayBookingUrl } from '@/lib/tele-direct-booking';
import {
  mapCatalogSlugToLaunchServiceId,
  mapLaunchServiceIdToCustomerHomeScreen,
  mapCatalogCategoryIdToCustomerHomeScreen,
} from '@warmpawz/service-launch-mappings';
import { toast } from 'sonner';

// ============================================================================
// PERFORMANCE OPTIMIZATION: Lazy load conditionally rendered widgets
// These widgets only appear based on user state (active tracking, incoming calls, etc.)
// Lazy loading reduces initial bundle size significantly (~30-50KB savings)
// ============================================================================

// AI Chatbot - only shown when user opens chat
const AIChatbotWidget = dynamic(
  () => import('../AIChatbotWidget').then(mod => ({ default: mod.AIChatbotWidget })),
  { ssr: false }
);

// Live tracking widget - only shown during active GPS tracking
const LiveTrackingWidget = dynamic(
  () => import('../tracking/LiveTrackingWidget').then(mod => ({ default: mod.LiveTrackingWidget })),
  { ssr: false }
);

// Rating popup - only shown after completed bookings
const RatingReviewPopup = dynamic(
  () => import('../RatingReviewPopup').then(mod => ({ default: mod.RatingReviewPopup })),
  { ssr: false }
);

// Vendor on the way popup - only shown during active delivery/service
const VendorOnTheWayPopup = dynamic(
  () => import('../VendorOnTheWayPopup').then(mod => ({ default: mod.VendorOnTheWayPopup })),
  { ssr: false }
);

// Appointment tracker - only shown when appointments exist
const UnifiedAppointmentTracker = dynamic(
  () => import('../booking/UnifiedAppointmentTracker').then(mod => ({ default: mod.UnifiedAppointmentTracker })),
  { ssr: false }
);

// Tele consultation reminder - only shown 5 min before call
const TeleConsultationReminderNotification = dynamic(
  () => import('../TeleConsultationReminderNotification').then(mod => ({ default: mod.TeleConsultationReminderNotification })),
  { ssr: false }
);

// Chat interface from notification - only shown when opening chat from notification
const ChatInterfaceFromNotification = dynamic(
  () => import('../ChatInterfaceFromNotification').then(mod => ({ default: mod.ChatInterfaceFromNotification })),
  { ssr: false }
);

// Order tracking widget - only shown during active order tracking
const OrderTrackingWidget = dynamic(
  () => import('../OrderTrackingWidget').then(mod => ({ default: mod.OrderTrackingWidget })),
  { ssr: false }
);

// Tele call notification - WhatsApp-like incoming call UI
const TeleCallNotification = dynamic(
  () => import('../TeleCallNotification').then(mod => ({ default: mod.TeleCallNotification })),
  { ssr: false }
);

const TeleTracker = dynamic(
  () => import('./TeleTracker').then(mod => ({ default: mod.default })),
  { ssr: false }
);

/** Quick service tiles shown as non-interactive until launch. */
const COMING_SOON_HOME_SERVICE_SCREENS = new Set(['mating-dating-hub', 'cafes']);

/**
 * Horizontal policy — Option A while dragging: left edge ≥ parentWidth/2 - HORIZONTAL_MARGIN.
 * On drag release (and when restoring from storage / viewport resize), X snaps to extreme right
 * (`maxX` in translate space); Y follows the user within vertical clamps.
 */
const AI_FAB_HORIZONTAL_MARGIN = 12;

function getAiFabClampViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 400, height: 800 };
  const vv = window.visualViewport;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  };
}

function getCustomerAiFabBounds() {
  const { width: w, height: h } = getAiFabClampViewportSize();
  const margin = AI_FAB_HORIZONTAL_MARGIN;
  const fab = 64;
  const rightInset = 24;
  const bottomInset = 96;

  const minXKeepOnScreen = margin - w + rightInset + fab;
  const minXRightHalf = w / 2 - margin - w + rightInset + fab;
  const minX = Math.max(minXKeepOnScreen, minXRightHalf);
  const maxX = rightInset - margin;
  const minY = margin - h + bottomInset + fab;
  const maxY = bottomInset - margin;
  return { minX, maxX, minY, maxY };
}

/** While dragging: Option A on X; Y clamped above bottom nav. */
function clampCustomerAiFabOffset(nx: number, ny: number): { x: number; y: number } {
  const { minX, maxX, minY, maxY } = getCustomerAiFabBounds();
  let x: number;
  if (minX > maxX) {
    x = minX;
  } else {
    x = Math.max(minX, Math.min(maxX, nx));
  }
  return {
    x,
    y: Math.max(minY, Math.min(maxY, ny)),
  };
}

/** Dock X to the rightmost valid translateX; clamp Y only. */
function snapCustomerAiFabToRight(ny: number): { x: number; y: number } {
  const { minX, maxX, minY, maxY } = getCustomerAiFabBounds();
  const snapX = minX > maxX ? minX : maxX;
  return {
    x: snapX,
    y: Math.max(minY, Math.min(maxY, ny)),
  };
}

export function CustomerHomeComplete({
  phone,
  onNavigate,
  onProfileClick,
  onPetClick,
  onAddPet,
  onViewBooking,
  onOpenMenu,
  onOpenCategoryMapper,
  refreshKey = 0,
  hideHeaderFooter = false // ✅ NEW: Default to showing header/footer
}: CustomerHomeCompleteProps) {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData>({
    name: 'User',
    phone: '',
    pets: []
  });
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'home' | 'profile' | 'pet-details' | 'add-pet'>('home');
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [userProfilePhoto, setUserProfilePhoto] = useState<string>('');
  const [currentBanner, setCurrentBanner] = useState(0);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [newPetData, setNewPetData] = useState({ name: '', type: 'Dog', breed: '', age: '', gender: 'male' });
  const [savingPet, setSavingPet] = useState(false);
  const [dashboardConfig, setDashboardConfig] = useState<any>(null);
  const [filteredQuickServices, setFilteredQuickServices] = useState<any[]>([]);
  /** After a successful geography launch-config fetch, the grid uses `filteredQuickServices` even when empty (all hidden). Before that, show the full catalog. */
  const [serviceLaunchTilesResolved, setServiceLaunchTilesResolved] = useState(false);

  // Dynamic service data from API (replacing hardcoded mock data)
  const [groomingServices, setGroomingServices] = useState<any[]>([]);
  const [vetServicesData, setVetServicesData] = useState<any[]>([]);
  const [hotDeals, setHotDeals] = useState<any[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [activeBookings, setActiveBookings] = useState<any[]>([]); // For "Attention" section

  // ✅ Live Tracking & Review State
  const [showTrackingWidget, setShowTrackingWidget] = useState<string | null>(null); // bookingId to track
  const [trackingBooking, setTrackingBooking] = useState<any | null>(null);

  // ✅ NEW: Vendor On The Way popup state
  const [vendorOnTheWay, setVendorOnTheWay] = useState<{
    bookingId: string;
    vendorName: string;
    vendorPhoto?: string;
    vendorPhone?: string;
    serviceName: string;
    petName?: string;
    eta: number;
    distance?: number;
    status?: TrackingStatus;
    serviceStyle?: 'at_home' | 'at_center' | 'tele' | 'clinic'; // ✅ NEW: For tele vs home service handling
    meetingId?: string; // ✅ NEW: For tele consultations
  } | null>(null);
  const [dismissedTrackingSessions, setDismissedTrackingSessions] = useState<Set<string>>(new Set());
  const [pendingReview, setPendingReview] = useState<{
    isOpen: boolean;
    bookingId: string;
    vendorId: string;
    vendorName: string;
    serviceName: string;
    serviceStyle: 'at_home' | 'at_center' | 'tele';
    staffId?: string;
    staffName?: string;
  } | null>(null);
  const [customerId, setCustomerId] = useState<string>('');
  const [aiFabDragOffset, setAiFabDragOffset] = useState({ x: 0, y: 0 });
  const aiFabOffsetRef = useRef(aiFabDragOffset);
  const aiFabDragMovedRef = useRef(false);

  useEffect(() => {
    aiFabOffsetRef.current = aiFabDragOffset;
  }, [aiFabDragOffset]);

  const aiFabStorageKey = useMemo(
    () =>
      `warmpawz_customer_home_ai_fab_drag_${(customerId || phone || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    [customerId, phone]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(aiFabStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { x?: number; y?: number };
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setAiFabDragOffset(snapCustomerAiFabToRight(parsed.y));
        }
      }
    } catch {
      /* ignore */
    }
  }, [aiFabStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reclamp = () => {
      setAiFabDragOffset((prev) => snapCustomerAiFabToRight(prev.y));
    };
    window.addEventListener('resize', reclamp);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', reclamp);
    vv?.addEventListener('scroll', reclamp);
    return () => {
      window.removeEventListener('resize', reclamp);
      vv?.removeEventListener('resize', reclamp);
      vv?.removeEventListener('scroll', reclamp);
    };
  }, []);

  const persistAiFabOffset = useCallback(
    (o: { x: number; y: number }) => {
      try {
        localStorage.setItem(aiFabStorageKey, JSON.stringify(o));
      } catch {
        /* ignore */
      }
    },
    [aiFabStorageKey]
  );

  const startAiFabDrag = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== undefined && e.button !== 0) {
        return;
      }
      aiFabDragMovedRef.current = false;
      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startY = e.clientY;
      const orig = aiFabOffsetRef.current;

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          aiFabDragMovedRef.current = true;
          ev.preventDefault();
        }
        if (!aiFabDragMovedRef.current) return;
        const next = clampCustomerAiFabOffset(orig.x + dx, orig.y + dy);
        setAiFabDragOffset(next);
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        const wasDrag = aiFabDragMovedRef.current;
        setAiFabDragOffset((current) => {
          const next = wasDrag ? snapCustomerAiFabToRight(current.y) : clampCustomerAiFabOffset(current.x, current.y);
          persistAiFabOffset(next);
          return next;
        });
      };

      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [persistAiFabOffset]
  );

  /** Unread inbox count for header bell; refreshed infrequently (same API as useNotificationService). */
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  /** Bumps when inbox changes (modal read/delete) so the header badge refetches. */
  const [notificationInboxVersion, setNotificationInboxVersion] = useState(0);

  // ✅ FIX GAP-6.2: 5-minute notification state
  const [upcomingCall, setUpcomingCall] = useState<{
    id: string;
    vendorName: string;
    vendorPhoto?: string;
    serviceName: string;
    petName?: string;
    scheduledAt: string;
    minutesUntil: number;
    meetingId?: string;
  } | null>(null);

  // ✅ CRITICAL FIX: Incoming/Outgoing call notification state (WhatsApp-like)
  const [incomingCall, setIncomingCall] = useState<{
    bookingId: string;
    meetingId?: string;
    provider: {
      id: string;
      name: string;
      photo?: string;
      role?: string;
    };
    serviceName?: string;
    petName?: string;
  } | null>(null);

  // ✅ FIX GAP-6.3: Chat from notification state
  const [chatFromNotification, setChatFromNotification] = useState<{
    isOpen: boolean;
    bookingId: string;
    vendorName: string;
    vendorPhoto?: string;
  } | null>(null);

  // ✅ FIX GAP-8.4: Active order tracking state
  const [activeOrderTracking, setActiveOrderTracking] = useState<any | null>(null);

  // Dynamic content from CMS
  const [dynamicBanners, setDynamicBanners] = useState<any[]>([]);
  const [dynamicArticles, setDynamicArticles] = useState<any[]>([]);
  const [dynamicAnnouncements, setDynamicAnnouncements] = useState<any[]>([]);
  const [featuredVendors, setFeaturedVendors] = useState<any[]>([]); // Spotlight/featured from admin
  const [adoptionStats, setAdoptionStats] = useState({ adoptablePets: 50, rehomingListings: 20 });

  /** Featured spotlight vendor CTA → internal route or external URL. */
  const navigateFromFeaturedVendorMeta = useCallback(
    (v: Record<string, unknown>, extraNavigateData?: Record<string, unknown>) => {
      const dest = resolveFeaturedVendorDestination(v);
      const rawId = v.vendorId ?? v.vendor_id ?? v.id;
      const base =
        rawId != null && String(rawId).trim() !== ''
          ? { ...v, vendorId: String(rawId) }
          : { ...v };
      const data =
        extraNavigateData != null && Object.keys(extraNavigateData).length > 0
          ? { ...base, ...extraNavigateData }
          : base;

      if (dest.kind === 'external') {
        window.location.assign(dest.url);
        return;
      }
      if (dest.kind === 'router') {
        const path = dest.path.startsWith('/') ? dest.path : `/${dest.path}`;
        router.push(path);
        return;
      }
      onNavigate?.(dest.screen, data);
    },
    [onNavigate, router]
  );

  /** Single entry for home CTAs: internal screens → onNavigate; paths → router; http(s) / mailto / tel → window. */
  const handleNavigation = useCallback(
    (dest: string, data?: Parameters<NonNullable<CustomerHomeCompleteProps['onNavigate']>>[1]) => {
      const d = (dest ?? '').trim();
      if (!d) return;
      if (/^https?:\/\//i.test(d) || d.startsWith('//')) {
        const url = d.startsWith('//') ? `https:${d}` : d;
        window.location.assign(url);
        return;
      }
      if (/^(mailto:|tel:)/i.test(d)) {
        window.location.href = d;
        return;
      }
      if (d.startsWith('/')) {
        const screenFromPath = customerPathToScreen(d);
        if (screenFromPath) {
          onNavigate?.(screenFromPath, data);
          return;
        }
        router.push(d);
        return;
      }
      onNavigate?.(d, data);
    },
    [onNavigate, router]
  );

  const whatsNewAnnouncements = useMemo(
    () => buildWhatsNewAnnouncements(dynamicAnnouncements),
    [dynamicAnnouncements]
  );

  // ✅ GPS Tracking Hook - Polls for active vendor tracking sessions
  const {
    activeSessions: gpsActiveSessions,
    hasActiveTracking: hasGpsTracking,
    refresh: refreshGpsTracking,
  } = useActiveGpsTracking(phone, {
    pollingIntervalMs: 10000, // Poll every 10 seconds
    enabled: !!phone,
    onSessionStart: (session: ActiveTrackingSession) => {
      // Show popup when a new tracking session starts
      if (!dismissedTrackingSessions.has(session.sessionId)) {
        setVendorOnTheWay({
          bookingId: session.bookingId,
          vendorName: session.vendorName,
          vendorPhoto: session.vendorPhoto,
          vendorPhone: session.vendorPhone,
          serviceName: session.serviceName,
          petName: session.petName,
          eta: Number(session.eta || 15),
          distance: session.distance !== undefined && session.distance !== null ? Number(session.distance) : undefined,
          status: session.status as TrackingStatus,
          serviceStyle: (session as any).serviceStyle || 'at_home', // ✅ Include service style
          meetingId: (session as any).meetingId, // ✅ Include meeting ID for tele
        });
      }
    },
    onSessionUpdate: (session: ActiveTrackingSession) => {
      // Update popup with new ETA/status
      if (vendorOnTheWay?.bookingId === session.bookingId) {
        setVendorOnTheWay((prev) => prev ? {
          ...prev,
          eta: Number(session.eta || prev.eta),
          distance: session.distance !== undefined && session.distance !== null ? Number(session.distance) : prev.distance,
          status: session.status as TrackingStatus,
          serviceStyle: (session as any).serviceStyle || prev.serviceStyle, // ✅ Preserve/update service style
          meetingId: (session as any).meetingId || prev.meetingId, // ✅ Preserve meeting ID
        } : null);
      }
    },
    onVendorArrived: (session: ActiveTrackingSession) => {
      // Show/update popup when vendor arrives
      if (!dismissedTrackingSessions.has(session.sessionId)) {
        setVendorOnTheWay({
          bookingId: session.bookingId,
          vendorName: session.vendorName,
          vendorPhoto: session.vendorPhoto,
          vendorPhone: session.vendorPhone,
          serviceName: session.serviceName,
          petName: session.petName,
          eta: 0,
          distance: 0,
          status: 'arrived',
          serviceStyle: (session as any).serviceStyle || 'at_home', // ✅ Include service style
          meetingId: (session as any).meetingId, // ✅ Include meeting ID for tele
        });
      }
    },
  });



  const {
    activeSessions: activeVideoCalls,
    hasActiveCall: hasActiveVideoCall,
    joinCall: joinVideoCall,
  } = useActiveVideoCall(customerId, {
    enabled: !!customerId,
    pollingIntervalMs: 10000,
  });

  // Dynamic categories from admin catalog (fallback to hardcoded list if API fails or returns empty)
  const { quickServiceTiles } = useCustomerCategories(phone);

  // Define quickServices constant (fallback when API has no categories)
  // Training / trainer labels come from API `service_categories.name` when present (not hardcoded here).

  // Canonical display names: avoid duplicate-sounding labels (Lab Test vs Diagnostics, etc.)
  const SERVICE_LABEL_OVERRIDE: Record<string, string> = {
    // ✅ FIX: Merge emergency and ambulance to "Emergency Care"
    emergency: 'Emergency Care',
    ambulance: 'Emergency Care',
    'emergency_care': 'Emergency Care',
    // ✅ FIX: Merge all diagnostics variants to "Diagnostics / Lab Tests"
    'lab-diagnostics': 'Diagnostics / Lab Tests',
    diagnostic: 'Diagnostics / Lab Tests',
    diagnostics: 'Diagnostics / Lab Tests',
    lab: 'Diagnostics / Lab Tests',
    // ✅ FIX: Merge all nutrition variants to "Nutritionist"
    nutrition: 'Nutritionist',
    nutritionist: 'Nutritionist',
    wellness: 'Nutritionist',
    // ✅ FIX: Rename specialty to "Pet Insurance"
    specialty: 'Pet Insurance',
    speciality: 'Pet Insurance',
    veterinary: 'Vet Care',
    vet: 'Vet Care',
    walking: 'Dog Walker',
    walker: 'Dog Walker',
    shop: 'Pet Shop',
    marketplace: 'Pet Shop',
    'pet-sitter': 'Pet Sitter',
    pet_sitter: 'Pet Sitter',
    sitting: 'Pet Sitter',
  };

  // Use API-driven categories when available; otherwise fallback to hardcoded quickServices
  // Ensure key flows (Pharmacy, Lab Test, Nutritionist) are always in the grid even if API omits them
  const baseQuickServices = quickServiceTiles.length > 0 ? quickServiceTiles : quickServices;
  const hasPharmacy = baseQuickServices.some((s: any) => ((s.categoryId || s.screen || '') as string).toLowerCase() === 'pharmacy');
  const hasLabDiagnostics = baseQuickServices.some((s: any) => ((s.categoryId || s.screen || '') as string).toLowerCase() === 'lab-diagnostics' || (s.screen as string) === 'lab-diagnostics');
  const nutritionCatalogIds = new Set(['nutritionist', 'nutrition', 'wellness']);
  const hasNutritionist = baseQuickServices.some((s: any) => {
    const raw = ((s.categoryId || s.screen || '') as string).toLowerCase();
    if (nutritionCatalogIds.has(raw)) return true;
    return mapCatalogSlugToLaunchServiceId(s.categoryId || s.screen) === 'nutritionist';
  });
  const hasTrainingAggregate = baseQuickServices.some((s: any) => {
    if (((s.screen || '') as string).toLowerCase() === 'training') return true;
    return mapCatalogSlugToLaunchServiceId(s.categoryId || '') === 'training';
  });
  const hasBehaviorist = baseQuickServices.some((s: any) => {
    const raw = ((s.categoryId || s.screen || '') as string).toLowerCase();
    return raw === 'behaviorist' || raw === 'behavioral';
  });
  let sourceQuickServices = baseQuickServices;
  if (!hasPharmacy) sourceQuickServices = [...sourceQuickServices, { icon: Pill, label: 'Pharmacy', color: 'bg-red-100 text-red-600', screen: 'pharmacy', categoryId: 'pharmacy' }];
  if (!hasLabDiagnostics) sourceQuickServices = [...sourceQuickServices, { icon: FlaskConical, label: 'Diagnostics / Lab Tests', color: 'bg-teal-100 text-teal-600', screen: 'lab-diagnostics', categoryId: 'lab-diagnostics' }];
  if (!hasNutritionist) sourceQuickServices = [...sourceQuickServices, { icon: Wheat, label: 'Nutritionist', color: 'bg-green-100 text-green-600', screen: 'nutritionist', categoryId: 'nutritionist' }];
  if (!hasBehaviorist && !hasTrainingAggregate) {
    sourceQuickServices = [
      ...sourceQuickServices,
      { icon: Heart, label: 'Behaviorist', color: 'bg-indigo-100 text-indigo-600', screen: 'behaviorist', categoryId: 'behaviorist' },
    ];
  }

  // Deduplicate services by screen and apply label overrides
  const seenScreens = new Set<string>();
  const deduplicatedServices = sourceQuickServices
    .map((service: any) => {
      const screen = service.screen || service.categoryId || '';
      const categoryId = (service.categoryId || service.screen || '').toLowerCase();
      const launchId = mapCatalogSlugToLaunchServiceId(service.categoryId || service.screen || '').toLowerCase();

      // Prefer tile's own label (from catalog); only apply overrides for merged non-training buckets.
      const overrideKey = Object.keys(SERVICE_LABEL_OVERRIDE).find(
        (key) => categoryId === key.toLowerCase() || screen.toLowerCase() === key.toLowerCase()
      );
      const label =
        launchId === 'training'
          ? service.label
          : overrideKey
            ? SERVICE_LABEL_OVERRIDE[overrideKey]
            : service.label;

      return { ...service, label, screen };
    })
    .filter((service: any) => {
      const screen = service.screen || '';
      if (seenScreens.has(screen)) {
        return false; // Duplicate - skip
      }
      seenScreens.add(screen);
      return true; // Keep first occurrence
    });

  sourceQuickServices = deduplicatedServices;

  useEffect(() => {
    loadUserData();
    loadServicesFromAPI();
    loadDynamicContent();
  }, [phone, refreshKey]); // Add refreshKey to dependencies

  // Load dynamic content (banners, articles, announcements)
  const loadDynamicContent = async () => {
    try {
      // Fetch all content in parallel with better error handling
      const [bannersResp, articlesResp, announcementsResp, adoptionResp, featuredResp] = await Promise.allSettled([
        apiClient.get<any>('/customer/banners?position=home_top&limit=20'),
        apiClient.getCustomerArticlesList<any>('/customer/articles?limit=3&featured=true'),
        apiClient.get<any>('/customer/announcements?limit=3'),
        apiClient.get<any>('/customer/adoption-stats'),
        apiClient.get<any>('/customer/featured-vendors?limit=6'),
      ]);

      // Handle banners (support alternate response shapes; dedupe by id)
      if (bannersResp.status === 'fulfilled') {
        const v = bannersResp.value as Record<string, unknown> | null | undefined;
        const rawList =
          (Array.isArray(v?.banners) && v.banners) ||
          (Array.isArray((v?.data as Record<string, unknown>)?.banners) &&
            (v!.data as { banners: unknown[] }).banners) ||
          [];
        if (rawList.length > 0) {
          const seen = new Set<string>();
          const unique = (rawList as unknown[]).filter((item) => {
            const id =
              item &&
              typeof item === 'object' &&
              'id' in item &&
              (item as { id: unknown }).id != null
                ? String((item as { id: unknown }).id)
                : '';
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          setDynamicBanners(unique as any[]);
        }
      } else if (bannersResp.status === 'rejected') {
        const error = bannersResp.reason;
        // Only log non-CORS errors to reduce console noise
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load banners:', error.message);
        }
      }

      // Handle articles
      if (articlesResp.status === 'fulfilled' && articlesResp.value?.articles?.length > 0) {
        setDynamicArticles(articlesResp.value.articles);
      } else if (articlesResp.status === 'rejected') {
        const error = articlesResp.reason;
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load articles:', error.message);
        }
      }

      // Handle announcements
      if (announcementsResp.status === 'fulfilled' && announcementsResp.value?.announcements?.length > 0) {
        setDynamicAnnouncements(announcementsResp.value.announcements);
      } else if (announcementsResp.status === 'rejected') {
        const error = announcementsResp.reason;
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load announcements:', error.message);
        }
      }

      // Handle adoption stats (home row is adoption-only; ignore legacy breeder counts from API)
      if (adoptionResp.status === 'fulfilled' && adoptionResp.value?.stats) {
        const s = adoptionResp.value.stats as Record<string, unknown>;
        setAdoptionStats((prev) => ({
          adoptablePets: (s.adoptablePets as string | number | undefined) ?? prev.adoptablePets,
          rehomingListings: (s.rehomingListings as string | number | undefined) ?? prev.rehomingListings,
        }));
      } else if (adoptionResp.status === 'rejected') {
        const error = adoptionResp.reason;
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load adoption stats:', error.message);
        }
      }

      // Featured/spotlight vendors (admin-configured)
      if (featuredResp.status === 'fulfilled' && featuredResp.value?.vendors?.length > 0) {
        setFeaturedVendors(featuredResp.value.vendors);
      }
    } catch (error: any) {
      // Only log if it's not a CORS error
      if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.error('Error loading dynamic content:', error);
      }
      // Fallback to defaults already set in state
    }
  };

  // Load real services from API
  const loadServicesFromAPI = async () => {
    try {
      setServicesLoading(true);

      let locationParams = '';
      if (typeof window !== 'undefined') {
        try {
          const customerLat = localStorage.getItem('customer_latitude');
          const customerLng = localStorage.getItem('customer_longitude');
          if (customerLat && customerLng) {
            locationParams = `&latitude=${encodeURIComponent(customerLat)}&longitude=${encodeURIComponent(customerLng)}`;
          }
        } catch {
          /* ignore */
        }
      }
      const phoneParam = phone ? `&phone=${encodeURIComponent(phone)}` : '';

      // discover-services requires serviceStyle (backend 400 if omitted)
      const [groomingResult, vetResult, productsResult] = await Promise.allSettled([
        apiClient.get<any>(
          `/customer/discover-services?category=grooming&serviceStyle=at_center${locationParams}${phoneParam}`
        ),
        apiClient.get<any>(
          `/customer/discover-services?category=vet&serviceStyle=at_center${locationParams}${phoneParam}`
        ),
        apiClient.get<any>('/products?featured=true&limit=3'),
      ]);

      // Handle grooming services
      if (groomingResult.status === 'fulfilled') {
        const groomingResp = groomingResult.value;
        if (groomingResp?.services || groomingResp?.vendors) {
          const services = groomingResp.services || groomingResp.vendors || [];
          const mappedGrooming = services.slice(0, 3).map((s: any) => ({
            id: s.id || s.vendorServiceId,
            title: s.serviceName || s.name || 'Grooming Service',
            price: `₹${s.price || s.basePrice || 999}`,
            rating: s.rating || 4.8,
            serviceStyle: s.serviceStyle || 'at_center',
            description: s.description || 'Professional grooming service',
            vendorId: s.vendorId
          }));
          if (mappedGrooming.length > 0) setGroomingServices(mappedGrooming);
        }
      } else if (groomingResult.status === 'rejected') {
        const error = groomingResult.reason;
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load grooming services:', error.message);
        }
      }

      // Handle vet services
      if (vetResult.status === 'fulfilled') {
        const vetResp = vetResult.value;
        if (vetResp?.services || vetResp?.vendors) {
          const services = vetResp.services || vetResp.vendors || [];
          const mappedVet = services.slice(0, 3).map((s: any) => ({
            id: s.id || s.vendorServiceId,
            title: s.serviceName || s.name || 'Vet Service',
            price: `₹${s.price || s.basePrice || 499}`,
            serviceStyle: s.serviceStyle || 'clinic',
            description: s.description || 'Veterinary service',
            type: s.serviceStyle === 'at_home' ? 'visit' : s.serviceStyle === 'tele' ? 'video' : 'clinic',
            vendorId: s.vendorId
          }));
          if (mappedVet.length > 0) setVetServicesData(mappedVet);
        }
      } else if (vetResult.status === 'rejected') {
        const error = vetResult.reason;
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load vet services:', error.message);
        }
      }

      // Handle products/deals — only vendor-flagged featured products (matches GET /products?featured=true)
      if (productsResult.status === 'fulfilled') {
        const productsResp = productsResult.value;
        const raw = productsResp?.products;
        if (raw && Array.isArray(raw) && raw.length > 0) {
          const featuredProducts = raw.filter(
            (p: any) => p.is_featured === true || p.isFeatured === true
          );
          if (featuredProducts.length > 0) {
            const mappedDeals = featuredProducts.slice(0, 3).map((p: any) => ({
              id: p.id,
              title: p.name || 'Pet Product',
              price: `₹${p.salePrice || p.price || 999}`,
              originalPrice: p.originalPrice ? `₹${p.originalPrice}` : null,
              discount: p.discountPercent ? `${p.discountPercent}% OFF` : null,
              iconType: 'product',
              rating: p.rating || 4.5
            }));
            setHotDeals(mappedDeals);
          } else {
            setHotDeals([]);
          }
        } else {
          setHotDeals([]);
        }
      } else if (productsResult.status === 'rejected') {
        setHotDeals([]);
        const error = productsResult.reason;
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load products:', error.message);
        }
      }
    } catch (error: any) {
      if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.error('Error loading services:', error);
      }
    } finally {
      setServicesLoading(false);
    }
  };

  // Load service launch config - controls service visibility based on GEOGRAPHY
  // Services can be: hidden, coming_soon, beta, or launched per state/city
  // Until the customer endpoint succeeds, the grid shows the full catalog; after success,
  // `filteredQuickServices` is authoritative (may be empty when nothing is launched).
  // Get customer's location from default address (most accurate) or profile fallback
  useEffect(() => {
    const loadServiceLaunchConfig = async () => {
      try {
        setServiceLaunchTilesResolved(false);

        let customerCity = '';
        let customerState = '';

        // ✅ PRIORITY 1: Fetch default address for accurate location detection
        // Default address is the most reliable source for customer's current location
        try {
          const addressesResponse = (await apiClient
            .get(`/customer/addresses?phone=${encodeURIComponent(phone)}`)
            .catch(() => null)) as any;
          
          const addresses = addressesResponse?.addresses || [];
          
          // Use default address first, then fall back to first address
          const defaultAddress = addresses.find((a: any) => a.isDefault) || addresses[0];
          
          if (defaultAddress) {
            customerCity = defaultAddress.city || '';
            customerState = defaultAddress.state || '';
            
            console.log('[ServiceLaunchConfig] Using default address location:', {
              city: customerCity,
              state: customerState,
              addressId: defaultAddress.id,
            });
          }
        } catch (error) {
          console.warn('[ServiceLaunchConfig] Could not fetch addresses for location detection:', error);
        }

        // ✅ PRIORITY 2: Fall back to profile data if no address found
        if (!customerCity || !customerState) {
          try {
            const profileResponse = await apiClient
              .get(`/customer/profile?phone=${encodeURIComponent(phone)}`)
              .catch(() => null);
            
            const profile = profileResponse as any;
            const profileLocation = serviceBaseOnpincode(profile, profile?.pincode || '');
            
            if (profileLocation.city) customerCity = profileLocation.city;
            if (profileLocation.state) customerState = profileLocation.state;
            
            console.log('[ServiceLaunchConfig] Using profile location fallback:', {
              city: customerCity,
              state: customerState,
            });
          } catch (error) {
            console.warn('[ServiceLaunchConfig] Could not fetch profile for location detection:', error);
          }
        }

        // Fetch service launch config based on customer's location
        const params = new URLSearchParams();
        if (customerState) params.append('state', customerState);
        if (customerCity) params.append('city', customerCity);

        console.log('[ServiceLaunchConfig] Fetching config with location:', {
          state: customerState || '(none)',
          city: customerCity || '(none)',
          params: params.toString(),
        });

        const configResponse = await apiClient.get(`/config/service-launch/customer?${params.toString()}`).catch(() => null);

        if (configResponse && (configResponse as any).success) {
          const { services, buttons } = configResponse as any;

          // Store config for reference (using buttons for backward compatibility)
          if (buttons) {
            setDashboardConfig({ buttons });
          }


          const visibleLaunch = (services?.visible || []) as any[];
          const comingSoonLaunch = (services?.comingSoon || []) as any[];

          if (services && (visibleLaunch.length > 0 || comingSoonLaunch.length > 0)) {
            // PRIMARY PATH: Build tiles from geography launch lists (visible + coming soon).
            // Match each serviceId to catalog tiles first, then static quickServices fallback.
            const allTilePool = [...sourceQuickServices, ...quickServices];
            const seenScreens = new Set<string>();
            const resultTiles: any[] = [];

            const findMatchingTileForLaunchId = (svcIdRaw: string) => {
              const svcId = (svcIdRaw || '').toLowerCase();
              const targetScreen = mapLaunchServiceIdToCustomerHomeScreen(svcId).toLowerCase();
              return allTilePool.find((tile: any) => {
                const catId = (tile.categoryId || '').toLowerCase();
                const tileScreen = (tile.screen || '').toLowerCase();
                const catalogScreen = mapCatalogCategoryIdToCustomerHomeScreen(
                  tile.categoryId || ''
                ).toLowerCase();
                const screenAsCatalog = mapCatalogCategoryIdToCustomerHomeScreen(
                  tile.screen || ''
                ).toLowerCase();
                const launchFromCat = mapLaunchServiceIdToCustomerHomeScreen(catId).toLowerCase();
                return (
                  catId === svcId ||
                  tileScreen === svcId ||
                  catalogScreen === targetScreen ||
                  screenAsCatalog === targetScreen ||
                  launchFromCat === targetScreen ||
                  tileScreen === targetScreen
                );
              });
            };

            const appendFromLaunchList = (list: any[], isComingSoon: boolean) => {
              for (const entry of list) {
                const svcId = (entry.serviceId || '').toLowerCase();
                const matchingTile = findMatchingTileForLaunchId(svcId);
                if (matchingTile && !seenScreens.has(matchingTile.screen)) {
                  seenScreens.add(matchingTile.screen);
                  resultTiles.push({
                    ...matchingTile,
                    isComingSoon,
                  });
                }
              }
            };

            appendFromLaunchList(visibleLaunch, false);
            appendFromLaunchList(comingSoonLaunch, true);

            console.log(
              '[ServiceFilter] launch tiles resolved:',
              resultTiles.map((t: any) => ({ screen: t.screen, comingSoon: !!t.isComingSoon }))
            );
            setFilteredQuickServices(resultTiles);
            setServiceLaunchTilesResolved(true);
          } else {
            // FALLBACK PATH: No visible list — use hidden list as block list (backward compat)
            const blockedCategoryIds = new Set<string>();
            const comingSoonCategoryIds = new Set<string>();
            const blockedServiceIds = new Set<string>();
            const comingSoonServiceIds = new Set<string>();

            if (services) {
              (services.hidden || []).forEach((svc: any) => {
                const svcId = (svc.serviceId || '').toLowerCase();
                blockedCategoryIds.add(svcId);
                for (const [key, screens] of Object.entries(serviceScreenMap)) {
                  if (svcId.includes(key) || key.includes(svcId)) {
                    screens.forEach(screen => blockedServiceIds.add(screen));
                  }
                }
              });
              (services.comingSoon || []).forEach((svc: any) => {
                const svcId = (svc.serviceId || '').toLowerCase();
                comingSoonCategoryIds.add(svcId);
                for (const [key, screens] of Object.entries(serviceScreenMap)) {
                  if (svcId.includes(key) || key.includes(svcId)) {
                    screens.forEach(screen => comingSoonServiceIds.add(screen));
                  }
                }
              });
            }

            if (buttons && Array.isArray(buttons)) {
              buttons.forEach((btn: any) => {
                const btnId = (btn.id || '').toLowerCase();
                if (btn.enabled === false) {
                  blockedCategoryIds.add(btnId);
                  for (const [key, screens] of Object.entries(serviceScreenMap)) {
                    if (btnId.includes(key) || key.includes(btnId)) {
                      screens.forEach(screen => blockedServiceIds.add(screen));
                    }
                  }
                } else if (btn.launchPhase === 'coming_soon') {
                  comingSoonCategoryIds.add(btnId);
                  for (const [key, screens] of Object.entries(serviceScreenMap)) {
                    if (btnId.includes(key) || key.includes(btnId)) {
                      screens.forEach(screen => comingSoonServiceIds.add(screen));
                    }
                  }
                }
              });
            }

            if (blockedCategoryIds.size > 0 || comingSoonCategoryIds.size > 0 || blockedServiceIds.size > 0 || comingSoonServiceIds.size > 0) {
              const filtered = sourceQuickServices.filter((service: any) => {
                const catId = (service.categoryId || '').toLowerCase();
                const screen = (service.screen || '').toLowerCase();
                return !blockedCategoryIds.has(catId) && !blockedCategoryIds.has(screen) && !blockedServiceIds.has(screen);
              });
              const withComingSoon = filtered.map((service: any) => ({
                ...service,
                isComingSoon: comingSoonCategoryIds.has((service.categoryId || '').toLowerCase()) || comingSoonServiceIds.has(service.screen),
              }));
              setFilteredQuickServices(withComingSoon);
              setServiceLaunchTilesResolved(true);
            } else {
              setFilteredQuickServices(sourceQuickServices);
              setServiceLaunchTilesResolved(true);
            }
          }
        }

        // Fallback: Try legacy role-based config if new endpoint fails
        // This ensures backward compatibility during migration
        if (!configResponse || !(configResponse as any).success) {
          console.log('New service launch config not available, falling back to legacy config');
          // Legacy config loading removed - new geography-based config is primary
          setFilteredQuickServices(sourceQuickServices);
          setServiceLaunchTilesResolved(true);
        }
      } catch (error) {
        console.error('Error loading service launch config:', error);
        setFilteredQuickServices(sourceQuickServices);
        setServiceLaunchTilesResolved(true);
      }
    };

    if (phone) {
      loadServiceLaunchConfig();
    } else {
      // No phone means not logged in, show all services (use dynamic list when available)
      setFilteredQuickServices(sourceQuickServices);
      setServiceLaunchTilesResolved(true);
    }
  }, [phone, refreshKey, quickServiceTiles.length]);

  /** Map API + defaults for hero; dedupe defaults by CTA vertical; icons from CTA / metadata */
  const homeCarouselBanners = useMemo(() => {
    const normalizeBannerTarget = (link: unknown): string => {
      const raw = String(link ?? '').toLowerCase().trim();
      if (!raw) return '';
      const path = raw.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '');
      const segments = path.split(/[/?#]/).map((s) => s.toLowerCase());
      const hay = `${path} ${segments.join(' ')}`;

      const pick = (slug: string) => (hay.includes(slug) ? slug : '');

      if (pick('grooming') || pick('groom')) return 'grooming';
      if (pick('lab-diagnostics') || pick('diagnostics') || pick('diagnostic')) return 'lab-diagnostics';
      if ((pick('vet') || pick('veterinary')) && !hay.includes('walker')) return 'vet';
      if (pick('walker') || pick('walking')) return 'walker';
      if (pick('training') || pick('trainer')) return 'training';
      if (pick('boarding') || pick('board')) return 'boarding';
      if (pick('adoption') || pick('breeder')) return 'adoption';
      if (pick('cafes') || pick('cafe')) return 'cafes';
      if (pick('insurance')) return 'insurance';
      if (pick('photography') || pick('photo')) return 'photography';
      if (pick('pharmacy') || pick('shop') || pick('ecom')) return 'shop';
      if (pick('relocation')) return 'relocation';
      if (pick('resort')) return 'resort';
      if (pick('holiday')) return 'holiday';
      if (pick('sunset')) return 'sunset';
      if (pick('ambulance') || pick('emergency')) return 'ambulance';
      if (pick('nutritionist') || pick('nutrition')) return 'nutritionist';
      if (pick('behaviorist') || pick('behavior')) return 'behaviorist';
      if (pick('mating')) return 'mating-dating-hub';

      const head = (segments[0] || path).toLowerCase();
      return head || raw;
    };

    const iconForTarget = (target: string): LucideIcon => {
      switch (target) {
        case 'shop':
          return Bone;
        case 'grooming':
          return Scissors;
        case 'vet':
          return Stethoscope;
        case 'training':
          return GraduationCap;
        case 'walker':
          return Dog;
        case 'boarding':
          return HomeIcon;
        case 'adoption':
          return Heart;
        case 'cafes':
          return Coffee;
        case 'insurance':
          return Shield;
        case 'photography':
          return Users;
        case 'lab-diagnostics':
          return FlaskConical;
        case 'relocation':
          return MapPin;
        case 'resort':
        case 'holiday':
          return Palmtree;
        case 'ambulance':
          return Phone;
        case 'nutritionist':
          return Wheat;
        case 'behaviorist':
          return Heart;
        case 'mating-dating-hub':
          return Heart;
        case 'sunset':
          return Sparkles;
        default:
          return Sparkles;
      }
    };

    const iconForApiBanner = (b: Record<string, unknown>): LucideIcon => {
      const target = normalizeBannerTarget(b.ctaLink ?? b.cta_link);
      return iconForTarget(target || 'generic');
    };

    if (dynamicBanners.length === 0) {
      return defaultBanners;
    }

    const premiumPetFoodSubtitleNorm = PREMIUM_PET_FOOD_HERO_MATCH_SUBTITLE.toLowerCase().trim();

    const fromApi = dynamicBanners.map((b: any) => {
      const rawCta = String(b.ctaLink ?? b.cta_link ?? '').trim();
      const screenFromSlash = rawCta.startsWith('/') ? customerPathToScreen(rawCta) : null;
      const ctaLink = screenFromSlash ?? rawCta;
      const titleNorm = String(b.title || '').toLowerCase().trim();
      const subtitleNorm = String(b.subtitle || '').toLowerCase().trim();
      const normalizedTarget = normalizeBannerTarget(rawCta);
      const duplicatesPremiumPetFoodHero =
        titleNorm === 'premium pet food' ||
        (normalizedTarget === 'shop' && subtitleNorm === premiumPetFoodSubtitleNorm);
      const explicitComingSoonFalse = b.comingSoon === false || b.coming_soon === false;
      const comingSoon = explicitComingSoonFalse
        ? false
        : Boolean(b.comingSoon || b.coming_soon) || duplicatesPremiumPetFoodHero;
      return {
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        gradientFrom: b.gradientFrom || '#FF8C42',
        gradientTo: b.gradientTo || '#FF6B35',
        Icon: iconForApiBanner(b),
        ctaText: b.ctaText || b.cta_text || 'Learn More',
        ctaLink,
        comingSoon,
      };
    });

    const coveredTargets = new Set(
      fromApi.map((b) => normalizeBannerTarget(b.ctaLink)).filter(Boolean)
    );
    const coveredTitles = new Set(
      fromApi.map((b) => String(b.title || '').toLowerCase().trim()).filter(Boolean)
    );

    const defaultsNotInApi = defaultBanners.filter((d) => {
      const key = normalizeBannerTarget(d.ctaLink);
      if (key && coveredTargets.has(key)) return false;
      if (coveredTitles.has(String(d.title || '').toLowerCase().trim())) return false;
      return true;
    });

    return [...fromApi, ...defaultsNotInApi].slice(0, 20);
  }, [dynamicBanners]);

  const homeBannerCount = homeCarouselBanners.length;

  useEffect(() => {
    setCurrentBanner((prev) =>
      homeBannerCount > 0 ? prev % homeBannerCount : 0
    );
  }, [homeBannerCount]);

  useEffect(() => {
    if (homeBannerCount <= 1) return undefined;
    const id = window.setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % homeBannerCount);
    }, 4000);
    return () => window.clearInterval(id);
  }, [homeBannerCount]);

  // Load active bookings with tracking for "Attention" section
  useEffect(() => {
    if (phone) {
      // ✅ Set customerId early so incoming-call poll uses UUID (backend matches recipient_id to UUID)
      apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(phone)}`).then((r) => {
        if (r?.customer?.id) setCustomerId(r.customer.id);
      }).catch(() => { });
      loadActiveBookings();
      checkPendingReviews(); // ✅ Check for pending reviews on load
      checkUpcomingCalls(); // ✅ FIX GAP-6.2: Check for upcoming calls
      checkActiveOrderTracking(); // ✅ FIX GAP-8.4: Check for active orders
      checkIncomingCalls(); // ✅ WhatsApp-style: Check for incoming video call
      const interval = setInterval(() => {
        loadActiveBookings();
        checkUpcomingCalls();
        checkActiveOrderTracking();
        checkIncomingCalls(); // Incoming call notification (Accept/Reject)
      }, 15000); // Poll every 15s so 5-min-away calls show quickly
      const incomingCallInterval = setInterval(checkIncomingCalls, 5000); // Poll every 5s for incoming call (like vendor)
      return () => {
        clearInterval(interval);
        clearInterval(incomingCallInterval);
      };
    }
  }, [phone, refreshKey]);

  useEffect(() => {
    const clean = (phone || '').replace(/[^0-9]/g, '');
    if (clean.length < 10) {
      setNotificationUnreadCount(0);
      return;
    }
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const data = await apiClient.get<{ notifications?: { is_read?: boolean; read?: boolean }[] }>(
          `/customer/notifications?phone=${encodeURIComponent(clean)}&limit=50`
        );
        if (cancelled) return;
        const list = data.notifications ?? [];
        const unread = list.filter((n) => !(n.is_read ?? n.read)).length;
        setNotificationUnreadCount(unread);
      } catch {
        if (!cancelled) setNotificationUnreadCount(0);
      }
    };
    void fetchUnread();
    const interval = setInterval(fetchUnread, 90_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [phone, refreshKey, notificationInboxVersion]);

  const loadActiveBookings = async () => {
    try {
      // Rule 1: Include vendor_on_way so customer sees "track provider" when vendor has started travel
      const response = await apiClient.get<any>(`/customer/bookings?phone=${encodeURIComponent(phone)}&status=in_progress,vendor_on_way`);
      const bookings = response.bookings || response.data || [];

      // Filter bookings that have tracking enabled (home services)
      // Rule 1: Include vendor_on_way (set by backend when vendor clicks Start Travel); when vendor_on_way, tracking is active
      const bookingsWithTracking = bookings.filter((booking: any) =>
        booking.serviceStyle === 'at_home' &&
        (booking.status === 'in_progress' || booking.status === 'active' || booking.status === 'on_way' || booking.status === 'in_transit' || booking.status === 'vendor_on_way') &&
        (booking.trackingEnabled || booking.tracking_enabled || booking.status === 'vendor_on_way')
      );

      setActiveBookings(bookingsWithTracking);

      // ✅ Auto-show popup if vendor is on the way (fallback when GPS hook doesn't have data)
      // GPS hook is primary source, this is fallback for bookings API data
      if (!hasGpsTracking && !vendorOnTheWay) {
        const onWayBooking = bookingsWithTracking.find((b: any) =>
          b.status === 'on_way' ||
          b.status === 'in_transit' ||
          b.status === 'vendor_on_way' ||
          b.tracking_status === 'on_way' ||
          b.tracking_status === 'in_transit' ||
          b.trackingStatus === 'on_way' ||
          b.vendorStatus === 'traveling'
        );
        if (onWayBooking) {
          const sessionId = onWayBooking.tracking_session_id || onWayBooking.sessionId;
          // Check if this session was dismissed
          if (!sessionId || !dismissedTrackingSessions.has(sessionId)) {
            // Show the "Vendor On The Way" popup
            setVendorOnTheWay({
              bookingId: onWayBooking.id || onWayBooking.bookingId,
              vendorName: onWayBooking.vendorName || onWayBooking.staffName || 'Provider',
              vendorPhoto: onWayBooking.vendorPhoto || onWayBooking.staffPhoto,
              vendorPhone: onWayBooking.vendorPhone || onWayBooking.staffPhone,
              serviceName: onWayBooking.serviceName || onWayBooking.service_name || 'Service',
              petName: onWayBooking.petName || onWayBooking.pet_name,
              eta: Number(onWayBooking.eta_minutes || onWayBooking.eta || 15),
              distance: onWayBooking.distance_km || onWayBooking.distance ? Number(onWayBooking.distance_km || onWayBooking.distance) : undefined,
              status: (onWayBooking.status === 'arrived' ? 'arrived' : 'en_route') as TrackingStatus,
              serviceStyle: onWayBooking.serviceStyle || onWayBooking.service_style || 'at_home', // ✅ Include service style
              meetingId: onWayBooking.meetingId || onWayBooking.meeting_id, // ✅ Include meeting ID for tele
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading active bookings:', error);
      setActiveBookings([]);
    }
  };

  // ✅ Check for joinable tele calls: from 5 min before until appointment completed (includeLive=true)
  const checkUpcomingCalls = async () => {
    try {
      const response = await apiClient.get<any>(
        `/customer/${phone}/bookings/upcoming-calls?minutes=5&includeLive=true`
      );

      if (response.success && response.bookings && response.bookings.length > 0) {
        const nextCall = response.bookings[0];
        const scheduledAt = new Date(nextCall.scheduledAt || nextCall.bookingDate);
        const now = new Date();
        const minutesUntil = Math.round((scheduledAt.getTime() - now.getTime()) / 60000);
        // Show banner: within 5 min before, or live (scheduled passed, not completed)
        const isJoinable = minutesUntil <= 5 && nextCall.status !== 'completed' && nextCall.status !== 'cancelled';
        if (isJoinable) {
          setUpcomingCall({
            id: nextCall.id || nextCall.bookingId,
            vendorName: nextCall.vendorName || nextCall.staffName || 'Provider',
            vendorPhoto: nextCall.vendorPhoto || nextCall.staffPhoto,
            serviceName: nextCall.serviceName || 'Consultation',
            petName: nextCall.petName,
            scheduledAt: scheduledAt.toISOString(),
            minutesUntil: Math.max(-60, minutesUntil), // Allow negative for "live" display
            meetingId: nextCall.meetingId || nextCall.video_call_meeting_id,
          });
        } else {
          setUpcomingCall(null);
        }
      } else {
        setUpcomingCall(null);
      }
    } catch (error) {
      console.error('Error checking upcoming calls:', error);
      setUpcomingCall(null);
    }
  };

  // ✅ CRITICAL FIX: Check for incoming call notifications (instant tele)
  const checkIncomingCalls = async () => {
    if (!customerId && !phone) return;

    try {
      // Check for unread call notifications
      // ✅ CRITICAL FIX: Use correct query parameters (userId and userType, not userType and type)
      const notificationsResponse = await apiClient.get<any>(
        `/notifications?userId=${customerId || phone}&userType=customer&isRead=false`
      );

      if (notificationsResponse.success && notificationsResponse.notifications?.length > 0) {
        // Filter for tele_call_incoming type
        const callNotifications = notificationsResponse.notifications.filter((n: any) =>
          (n.notification_type === 'tele_call_incoming' || n.type === 'tele_call_incoming') && !n.is_read
        );

        if (callNotifications.length === 0) return;

        const callNotification = callNotifications[0];
        const notificationData = typeof callNotification.data === 'string'
          ? JSON.parse(callNotification.data)
          : callNotification.data || {};

        if (notificationData.booking_id && notificationData.call_type === 'incoming') {
          // Show incoming call immediately from notification data (don't block on GET /bookings 404)
          const baseIncoming = {
            bookingId: notificationData.booking_id,
            meetingId: notificationData.meeting_id,
            provider: {
              id: notificationData.staff_id || notificationData.vendor_id || '',
              name: notificationData.staff_name || notificationData.vendor_name || 'Provider',
              photo: undefined as string | undefined,
              role: undefined as string | undefined,
            },
            serviceName: undefined as string | undefined,
            petName: undefined as string | undefined,
          };
          setIncomingCall(baseIncoming);

          // Enrich with booking details if GET /bookings succeeds (pass phone for backend auth)
          try {
            const bookingResponse = await apiClient.get<any>(
              `/bookings/${notificationData.booking_id}?phone=${encodeURIComponent(phone)}`
            );
            if (bookingResponse?.success && bookingResponse?.booking) {
              const booking = bookingResponse.booking;
              setIncomingCall({
                ...baseIncoming,
                provider: {
                  id: notificationData.staff_id || booking.vendor_id || baseIncoming.provider.id,
                  name: notificationData.staff_name || booking.vendor_name || baseIncoming.provider.name,
                  photo: booking.staff_photo || booking.vendor_photo,
                  role: booking.staff_role || booking.vendor_role,
                },
                serviceName: booking.service_name,
                petName: booking.pet_name,
              });
            }
          } catch (_) {
            // Keep base incoming call; UI already shows Accept/Reject
          }

          await apiClient.put(`/notifications/${callNotification.id}/read`, {}).catch(() => { });
        }
      }
    } catch (error) {
      console.error('Error checking incoming calls:', error);
    }
  };

  // ✅ FIX GAP-8.4 + ChunkLoadError resilience: Check for active order tracking
  // Call pharmacy and meals APIs separately so a failing meals/active (e.g. 404/HTML) does not break the screen
  const checkActiveOrderTracking = async () => {
    let pharmacyOrders: any[] = [];
    let mealOrders: any[] = [];
    try {
      const pharmacyResponse = await apiClient.get<any>(
        `/customer/${phone}/orders/pharmacy/active`
      );
      pharmacyOrders = Array.isArray(pharmacyResponse?.orders) ? pharmacyResponse.orders : [];
    } catch (e) {
      console.warn('Pharmacy active orders check failed (non-fatal):', (e as Error)?.message);
    }
    try {
      const mealResponse = await apiClient.get<any>(
        `/customer/${phone}/orders/meals/active`
      );
      mealOrders = Array.isArray(mealResponse?.orders) ? mealResponse.orders : [];
    } catch (e) {
      console.warn('Meals active orders check failed (non-fatal):', (e as Error)?.message);
    }
    const activeOrders = [
      ...pharmacyOrders,
      ...mealOrders,
    ].filter((order: any) =>
      order && order.status !== 'delivered' && order.status !== 'cancelled' && order.status !== 'refunded' &&
      (order.trackingStatus ?? order.tracking_status ?? ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'].includes(order.status))
    );
    if (activeOrders.length > 0) {
      setActiveOrderTracking(activeOrders[0]);
    } else {
      setActiveOrderTracking(null);
    }
  };

  // ✅ Check for pending reviews on completed bookings
  const checkPendingReviews = async () => {
    try {
      // Get customer ID first
      const customerRes = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(phone)}`);
      const custId = customerRes.customer?.id;
      if (custId) {
        setCustomerId(custId);

        // Check for pending review
        const reviewRes = await apiClient.get<any>(`/reviews/pending/${custId}`);
        if (reviewRes.hasPending && reviewRes.booking) {
          const pendingBookingId = reviewRes.booking.bookingId;
          if (pendingBookingId) {
            try {
              const id = String(pendingBookingId);
              const submittedRaw = localStorage.getItem('warmpawz_review_submitted_booking_ids');
              const skippedRaw = localStorage.getItem('warmpawz_review_skipped_booking_ids');
              const submittedIds: string[] = submittedRaw ? JSON.parse(submittedRaw) : [];
              const skippedIds: string[] = skippedRaw ? JSON.parse(skippedRaw) : [];
              if (submittedIds.includes(id) || skippedIds.includes(id)) return;
            } catch {
              /* ignore */
            }
          }
          setPendingReview({
            isOpen: true,
            bookingId: reviewRes.booking.bookingId,
            vendorId: reviewRes.booking.vendorId,
            vendorName: reviewRes.booking.vendorName || 'Service Provider',
            serviceName: reviewRes.booking.serviceName || 'Service',
            serviceStyle: reviewRes.booking.serviceStyle || 'at_center',
            staffId: reviewRes.booking.staffId,
            staffName: reviewRes.booking.staffName,
          });
        }
      }
    } catch (error) {
      console.log('No pending reviews');
    }
  };

  const loadUserData = async () => {
    try {
      setLoading(true);

      // Load profile and pets in parallel using phone-based endpoints with better error handling
      const [profileResult, petsResult] = await Promise.allSettled([
        apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`),
        apiClient.get(`/customer/pets/${encodeURIComponent(phone)}`)
      ]);

      // Handle profile response
      if (profileResult.status === 'fulfilled') {
        const profileResp = profileResult.value as any;
        if (profileResp && (profileResp.success || profileResp.profile)) {
          const profile = profileResp.profile || profileResp;
          setUserData(prev => ({
            ...prev,
            name: profile.firstName || profile.name || 'User',
            phone: phone,
            journeyType: profile.journeyType || ''
          }));
          setUserProfilePhoto(profile.photo || profile.profile_photo_url || '');

          // Profile already includes pets if available
          if (profile.pets && Array.isArray(profile.pets) && profile.pets.length > 0) {
            setUserData(prev => ({
              ...prev,
              pets: profile.pets
            }));
            if (!selectedPet) {
              setSelectedPet(profile.pets[0]);
            }
          }
        }
      } else if (profileResult.status === 'rejected') {
        const error = profileResult.reason;
        // Only log non-CORS errors to reduce console noise
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load profile:', error.message);
        }
        // Try to use cached data if available
        const cachedProfile = localStorage.getItem('customerData');
        if (cachedProfile) {
          try {
            const profile = JSON.parse(cachedProfile);
            setUserData(prev => ({
              ...prev,
              name: profile.firstName || profile.name || 'User',
              phone: phone,
            }));
          } catch (e) {
            // Ignore parse errors
          }
        }
      }

      // Handle pets response
      if (petsResult.status === 'fulfilled') {
        const petsResp = petsResult.value as any;
        if (petsResp && (petsResp.success || petsResp.pets)) {
          // ✅ Robust response parsing
          let pets: Pet[] = [];
          if (Array.isArray(petsResp)) {
            pets = petsResp;
          } else if (Array.isArray(petsResp.pets)) {
            pets = petsResp.pets;
          } else if (petsResp.pets?.pets && Array.isArray(petsResp.pets.pets)) {
            pets = petsResp.pets.pets;
          } else if (petsResp.success && Array.isArray(petsResp.data)) {
            pets = petsResp.data;
          }

          if (pets.length > 0) {
            setUserData(prev => ({
              ...prev,
              pets: pets
            }));
            if (!selectedPet) {
              setSelectedPet(pets[0]);
            }
          }
        }
      } else if (petsResult.status === 'rejected') {
        const error = petsResult.reason;
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load pets:', error.message);
        }
        // Try to use cached pets if available
        const cachedPets = localStorage.getItem('customerPets');
        if (cachedPets) {
          try {
            const pets = JSON.parse(cachedPets);
            if (Array.isArray(pets) && pets.length > 0) {
              setUserData(prev => ({
                ...prev,
                pets: pets
              }));
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    } catch (error: any) {
      if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.error('Error loading user data:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddPet = () => {
    // Show add pet modal directly instead of navigating
    setShowAddPetModal(true);
    setNewPetData({ name: '', type: 'Dog', breed: '', age: '', gender: 'male' });
  };

  const handleSavePet = async () => {
    if (!newPetData.name.trim()) {
      alert('Please enter a pet name');
      return;
    }

    setSavingPet(true);
    try {
      const response = await apiClient.post('/customer/pets', {
        phone: phone,
        pets: [{
          name: newPetData.name,
          type: newPetData.type,
          breed: newPetData.breed,
          age: newPetData.age,
          gender: newPetData.gender,
        }]
      });

      if (response) {
        // Reload user data to get the new pet
        await loadUserData();
        setShowAddPetModal(false);
        setNewPetData({ name: '', type: 'Dog', breed: '', age: '', gender: 'male' });
      }
    } catch (error) {
      console.error('Error saving pet:', error);
      alert('Failed to save pet. Please try again.');
    } finally {
      setSavingPet(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-customer mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const banners = homeCarouselBanners;




  // Use API data or fallback to defaults
  const displayGroomingServices = groomingServices.length > 0 ? groomingServices : defaultGroomingServices;
  const displayVetServices = vetServicesData.length > 0 ? vetServicesData : defaultVetServices;
  /** Homepage carousel: real featured products only in production; optional mock strip in development. */
  const carouselHotDeals =
    hotDeals.length > 0
      ? hotDeals
      : typeof process !== 'undefined' && process.env.NODE_ENV === 'development'
        ? defaultHotDeals
        : [];

  // ✅ FIX: Remove dummy articles - show only admin-created articles
  const articles = dynamicArticles.map((a: any) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    category: a.category || 'Tips',
    readTime: a.readTime || '5 min',
    Icon: a.category === 'Nutrition' ? UtensilsCrossed
      : a.category === 'Insurance' ? Shield
        : a.category === 'Health' ? Heart
          : Dog,
    url: a.url,
    content: a.content,
    description: a.description
  }));


  /** When shell uses CustomerScreenWrapper, avoid nested min-h-screen vs padded min-dvh (iOS overflow / tab bar glitches). */
  const containerClassName = hideHeaderFooter
    ? 'min-h-screen min-h-[100dvh] bg-gray-50'
    : 'min-h-0 bg-gray-50 w-full max-w-customer mx-auto';

  return (
    <div className={containerClassName}>
      {/* Header Section - Compact Professional Design - Only show if not using standardized layout */}
      {!hideHeaderFooter && (
        <div className="bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] cw-header-safe-top cw-header-safe-x pb-3 sm:pb-4">
          {/* Top Row - User Info & Actions */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onProfileClick && onProfileClick()}
                className="w-11 h-11 bg-white rounded-full flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-white/60 transition-all shadow-md"
              >
                {userProfilePhoto ? (
                  <PresignableImage src={userProfilePhoto} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-base font-bold">
                    {userData.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <h1 className="text-white text-lg font-bold tracking-tight">Hi, {userData.name}!</h1>
                  <span className="text-base" role="img" aria-label="wave">👋</span>
                </div>
                <p className="text-white/65 text-xs font-normal tracking-wide">Explore Warmpawz Services</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Wallet Icon - Gold coin style with balance */}
              <WalletIcon
                customerPhone={phone}
                onClick={() => handleNavigation('wallet')}
                size="sm"
                showBalance={true}
              />
              <button
                type="button"
                onClick={() => handleNavigation('booking-messages')}
                className="relative w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                aria-label="Messages"
              >
                <MessageSquare className="w-[18px] h-[18px] text-white" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setNotificationModalOpen(true)}
                className="relative w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-[18px] h-[18px] text-white" strokeWidth={2} />
                {notificationUnreadCount > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => handleNavigation('wishlist')}
                className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                aria-label="Wishlist"
              >
                <Heart className="w-[18px] h-[18px] text-white" />
              </button>
            </div>
          </div>

          {/* Pet Selector - Compact horizontal layout */}
          {userData.pets.length > 0 ? (
            <div className="flex items-center gap-3">
              <span className="text-white/90 text-[11px] font-semibold tracking-wider uppercase shrink-0">Your Pets</span>
              <div className="flex min-w-0 gap-2.5 overflow-x-auto scrollbar-hide flex-1 py-1 -my-1 px-2">
                {userData.pets.map((pet) => (
                  <div key={pet.id} className="relative flex-shrink-0">
                    <button
                      onClick={() => setSelectedPet(pet)}
                      className="flex flex-col items-center gap-1"
                    >
                      <div
                        className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-all duration-200 ${selectedPet?.id === pet.id
                          ? 'bg-white shadow-md ring-2 ring-inset ring-[#FF8C42]'
                          : 'overflow-hidden bg-white/25 backdrop-blur-sm hover:bg-white/35'
                          }`}
                      >
                        {pet.photo || pet.image ? (
                          <div className="h-full w-full overflow-hidden rounded-full">
                            <PresignableImage src={pet.photo || pet.image} alt={pet.name} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          pet.type === 'Dog' ? <Dog className={`w-5 h-5 ${selectedPet?.id === pet.id ? 'text-[#FF8C42]' : 'text-white'}`} /> : pet.type === 'Cat' ? <Cat className={`w-5 h-5 ${selectedPet?.id === pet.id ? 'text-[#FF8C42]' : 'text-white'}`} /> : <Heart className={`w-5 h-5 ${selectedPet?.id === pet.id ? 'text-[#FF8C42]' : 'text-white'}`} />
                        )}
                      </div>
                      <span className={`text-[10px] font-semibold max-w-[44px] truncate ${selectedPet?.id === pet.id ? 'text-white' : 'text-white/80'}`}>
                        {pet.name}
                      </span>
                    </button>

                    {/* Edit/View Button - Only show for selected pet */}
                    {selectedPet?.id === pet.id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPetClick?.(pet.id);
                        }}
                        className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] bg-blue-500 rounded-full flex items-center justify-center shadow-md hover:bg-blue-600 transition-colors"
                        title="View / edit pet"
                      >
                        <ChevronRight className="w-2.5 h-2.5 text-white" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Add Pet Button */}
                <button
                  onClick={handleAddPet}
                  className="flex-shrink-0 flex flex-col items-center gap-1"
                >
                  <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-full flex items-center justify-center border-[1.5px] border-white/50 border-dashed hover:bg-white/25 transition-colors">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-[10px] text-white/80 font-semibold">Add</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleAddPet}
              className="w-full bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-3 border border-white/35 border-dashed flex items-center gap-2.5 hover:bg-white/25 transition-colors"
            >
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                <Heart className="w-4 h-4 text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="text-white text-sm font-semibold tracking-tight">Add Your Pet</p>
                <p className="text-white/60 text-[11px] font-normal">Unlock personalized services</p>
              </div>
              <Plus className="w-4 h-4 text-white/80" />
            </button>
          )}
        </div>
      )}

      {/* Main Scrollable Content */}
      <div
        className={`bg-white ${hideHeaderFooter ? 'pt-4' : 'rounded-t-[24px] -mt-3 pt-4'} ${hideHeaderFooter ? 'pb-4' : 'pb-6'}`}
      >
        {/* ✅ Attention Section - Active Bookings with Tracking */}
        {activeBookings.length > 0 && (
          <div className="px-6 mb-4">
            <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">Active Service</h3>
                  <p className="text-sm text-gray-600">Provider is on the way</p>
                </div>
              </div>

              {activeBookings.map((booking: any) => (
                <div key={booking.id} className="bg-white rounded-xl p-4 mb-2 last:mb-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{booking.serviceName || 'Service'}</h4>
                      <p className="text-xs text-gray-500">{booking.vendorName || 'Provider'}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onViewBooking?.(booking.id)}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      <Navigation className="w-4 h-4 mr-1" />
                      Track
                    </Button>
                  </div>
                  {booking.estimatedArrival && (
                    <div className="flex items-center gap-2 text-sm text-orange-600">
                      <Clock className="w-4 h-4" />
                      <span>ETA: {booking.estimatedArrival}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Universal search bar - top of landing */}
        <div className="px-4 mb-3">
          <EnhancedSearchBar
            placeholder="Search services, products, vets, groomers..."
            customerId={customerId || undefined}
            onSearch={(searchQuery) => {
              if (searchQuery?.trim()) {
                router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
              }
            }}
            onResultSelect={(result) => {
              console.log('Search result selected:', result);
              if (result.type === 'symptom') {
                // Symptom search: drive to problem_grid_flow with specialization so user picks service style then books
                const d = result.data || {};
                handleNavigation('services_by_problem', {
                  problemId: d.specializationId || result.id,
                  problemTitle: d.name || 'Consult',
                  roleId: d.roleId || 'vet_solo',
                  category: d.categoryId,
                  problem: {
                    allowedServiceStyles: sanitizeCustomerAllowedServiceStyles(d.allowedServiceStyles, {
                      roleId: d.roleId || 'vet_solo',
                      specializationId: d.specializationId || result.id,
                      categoryHint: d.categoryId,
                    }),
                    name: d.name,
                    roleId: d.roleId,
                    category: d.categoryId,
                  },
                });
                return;
              }
              if (result.type === 'service' || result.category) {

                const category = result.category || result.data?.serviceType || result.data?.category || '';
                const targetScreen = serviceNavigationMap[category.toLowerCase()] || 'services';
                handleNavigation(targetScreen);
              } else if (result.type === 'product') {
                handleNavigation('shop');
              } else if (result.type === 'staff' || result.type === 'vendor' || result.type === 'center') {
                const serviceType = result.data?.serviceType || result.data?.services?.[0] || 'vet';
                handleNavigation(serviceType);
              }
            }}
          />
        </div>

        {/* What's your pet needs? - directly below search (clean landing) */}
        <div className="mb-4 w-full overflow-hidden">
          <div className="px-4 flex items-center justify-between mb-2">
            <h2 className="text-gray-900 text-sm font-semibold">What&apos;s your pet needs?</h2>
            <button
              onClick={() => handleNavigation('/services/all')}
              className="text-[11px] text-[#FF8C42] font-medium"
            >
              View All
            </button>
          </div>
          <ProblemGridNavigation
            onProblemSelect={(problemId, problem) => {
              handleNavigation('services_by_problem', {
                problemId,
                problemTitle: problem?.title || (problem as any)?.name || 'Service',
                roleId: (problem as any)?.roleId || (problem as any)?.vendorType,
                problem: problem,
              });
            }}
            showTrending={false}
            compact={true}
          />
        </div>

        {/* Hero Banner Carousel */}
        <div className="px-4 mb-4">
          <div className="relative h-28 rounded-2xl overflow-hidden shadow-md">
            {banners.map((banner, index) => {
              const heroComingSoon = Boolean((banner as { comingSoon?: boolean }).comingSoon);
              return (
                <div
                  key={banner.id || index}
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    currentBanner === index
                      ? 'z-[1] opacity-100'
                      : 'z-0 opacity-0 pointer-events-none'
                  }`}
                  style={{ background: `linear-gradient(135deg, ${banner.gradientFrom} 0%, ${banner.gradientTo} 100%)` }}
                  aria-hidden={currentBanner !== index}
                >
                  {heroComingSoon && (
                    <span
                      className="absolute top-2 right-3 z-[1] text-[7px] font-bold uppercase bg-amber-500 text-white px-1 rounded-full leading-none py-0.5 shadow-sm"
                      aria-label="Coming soon"
                    >
                      SOON
                    </span>
                  )}
                  <div
                    className={`h-full flex items-center justify-between px-4 ${heroComingSoon ? 'opacity-90 pointer-events-none select-none' : ''}`}
                  >
                    <div>
                      <h2 className="text-white text-base font-bold mb-0.5">{banner.title}</h2>
                      <p className="text-white/90 text-xs mb-2">{banner.subtitle}</p>
                      {heroComingSoon ? (
                        <span
                          role="button"
                          aria-disabled
                          tabIndex={-1}
                          className="inline-block bg-white/85 text-[#FF8C42]/70 px-3 py-1.5 rounded-full text-xs font-medium cursor-not-allowed"
                        >
                          {banner.ctaText || 'Claim Now'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="bg-white text-[#FF8C42] px-3 py-1.5 rounded-full text-xs font-medium"
                          onClick={() => {
                            // Track banner click
                            if (banner.id) {
                              apiClient.post(`/banners/${banner.id}/click`, {
                                source: 'home_carousel'
                              }).catch(() => { }); // Silent fail for tracking
                            }
                            // Navigate (screen id, path, or external URL)
                            banner.ctaLink && handleNavigation(String(banner.ctaLink));
                          }}
                        >
                          {banner.ctaText || 'Claim Now'}
                        </button>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <banner.Icon className="w-7 h-7 text-white" />
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Banner Indicators */}
            <div
              className="absolute bottom-3 left-0 right-0 z-[2] flex justify-center gap-2"
              role="tablist"
              aria-label="Promotional offers"
            >
              {banners.map((banner, index) => (
                <button
                  key={banner.id || index}
                  type="button"
                  role="tab"
                  aria-selected={currentBanner === index}
                  aria-label={`Offer ${index + 1} of ${banners.length}`}
                  className={`h-1.5 min-w-[6px] rounded-full transition-all ${
                    currentBanner === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'
                  }`}
                  onClick={() => setCurrentBanner(index)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Shop Categories - Horizontal Slider (shop catalog coming soon) */}
        <div className="mb-4">
          <div className="flex items-center gap-3 px-4 mb-2">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#FF8C42]" />
              <h2 className="text-gray-900 text-sm font-semibold">Shop</h2>
            </div>
            <div className="flex-1 h-px bg-gray-100" aria-hidden />
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 py-1 scrollbar-hide">
            {[
              { id: 'food', label: 'Food', icon: <Bone className="w-5 h-5 text-orange-500" /> },
              { id: 'toys', label: 'Toys', icon: <Dog className="w-5 h-5 text-blue-500" /> },
              { id: 'clothes', label: 'Clothes', icon: <Shirt className="w-5 h-5 text-teal-500" /> },
              { id: 'accessories', label: 'Accessories', icon: <Watch className="w-5 h-5 text-pink-500" /> },
              { id: 'medicine', label: 'Medicine', icon: <Pill className="w-5 h-5 text-red-500" /> },
              { id: 'grooming', label: 'Grooming', icon: <Scissors className="w-5 h-5 text-purple-500" /> },
              { id: 'beds', label: 'Beds', icon: <Bed className="w-5 h-5 text-indigo-500" /> },
              { id: 'bowls', label: 'Bowls', icon: <UtensilsCrossed className="w-5 h-5 text-green-500" /> },
            ].map((category) => (
              <div
                key={category.id}
                className="flex-shrink-0 flex flex-col items-center gap-1 pointer-events-none select-none opacity-75"
                aria-label={`${category.label} — coming soon`}
              >
                <div className="relative w-12 h-12 bg-white rounded-full border border-gray-200 flex items-center justify-center shadow-sm">
                  {category.icon}
                  <span className="absolute -top-1 -right-1 text-[7px] font-bold uppercase bg-amber-500 text-white px-1 rounded-full leading-none py-0.5">
                    Soon
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 text-center font-medium leading-tight">{category.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Services Grid - Compact */}
        <div className="px-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-black text-sm font-semibold">All Services</h2>
            <span className="text-[10px] text-gray-500">
              {(serviceLaunchTilesResolved ? filteredQuickServices : sourceQuickServices).length} services
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {(serviceLaunchTilesResolved ? filteredQuickServices : sourceQuickServices).map((service, index) => {
              const key = ((service.categoryId || service.screen || '') as string).toLowerCase();
              const displayLabel = SERVICE_LABEL_OVERRIDE[key] ?? service.label;
              const serviceComingSoon =
                COMING_SOON_HOME_SERVICE_SCREENS.has(String(service.screen || '').toLowerCase()) ||
                COMING_SOON_HOME_SERVICE_SCREENS.has(key);
              if (serviceComingSoon) {
                return (
                  <div
                    key={service.screen || index}
                    className="flex flex-col items-center gap-1 pointer-events-none select-none opacity-75"
                    aria-label={`${displayLabel} — coming soon`}
                  >
                    <div className={`relative w-11 h-11 ${service.color} rounded-xl flex items-center justify-center shadow-sm`}>
                      <service.icon className="w-5 h-5" />
                      <span className="absolute -top-1 -right-1 text-[7px] font-bold uppercase bg-amber-500 text-white px-1 rounded-full leading-none py-0.5">
                        Soon
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 text-center leading-tight line-clamp-1">{displayLabel}</span>
                  </div>
                );
              }
              const isComingSoonTile = !!(service as { isComingSoon?: boolean }).isComingSoon;
              return (
                <button
                  type="button"
                  key={service.screen || index}
                  className={`flex flex-col items-center gap-1 group ${
                    isComingSoonTile ? 'cursor-default' : ''
                  }`}
                  aria-label={
                    isComingSoonTile
                      ? `${displayLabel}, coming soon in your area`
                      : `${displayLabel}, open service`
                  }
                  onClick={() => {
                    if (isComingSoonTile) {
                      toast.info('This service is coming soon in your area.');
                      return;
                    }
                    handleNavigation(service.screen);
                  }}
                >
                  <div
                    className={`relative w-11 h-11 ${service.color} rounded-xl flex items-center justify-center transition-transform shadow-sm ${
                      isComingSoonTile ? 'opacity-75 saturate-75' : 'group-hover:scale-105'
                    }`}
                  >
                    {isComingSoonTile && (
                      <span className="absolute -top-0.5 -right-0.5 z-[1] rounded-md bg-amber-500 px-1 py-0.5 text-[7px] font-bold uppercase leading-none text-white shadow-sm">
                        Soon
                      </span>
                    )}
                    <service.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] text-gray-700 text-center leading-tight line-clamp-1">{displayLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Spotlight: Grooming Services */}
        <div className="mb-6">
          <div className="px-6 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FF8C42]" />
              <h2 className="text-black font-semibold">Grooming Services</h2>
            </div>
            <button
              onClick={() => handleNavigation('grooming')}
              className="text-xs text-[#FF8C42] font-medium flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide px-6">
            {displayGroomingServices.map((service: any, index) => {
              const ServiceIcon = service.Icon || getServiceStyleIcon(service.serviceStyle);
              return (
                <div
                  key={index}
                  className="flex-shrink-0 w-64 bg-gradient-to-br from-orange-50 to-pink-50 rounded-3xl p-5 border border-orange-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleNavigation('grooming')}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                      <ServiceIcon className="w-6 h-6 text-orange-500" />
                    </div>
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-full">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-medium">{service.rating}</span>
                    </div>
                  </div>
                  <h3 className="text-black font-semibold mb-1">{service.title}</h3>
                  <div onClick={(e) => e.stopPropagation()} className="mb-3">
                    <ServiceDescriptionInline
                      description={service.description}
                      title={service.title}
                      className="m-0 text-xs leading-snug text-gray-600"
                      linkClassName="inline cursor-pointer align-baseline text-[10px] font-semibold text-[#FF8C42] hover:underline"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#FF8C42] font-medium">{service.price}</span>
                    <button
                      className="bg-[#FF8C42] text-white px-4 py-2 rounded-full text-xs font-medium hover:bg-[#FF7A2E] transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigation('grooming');
                      }}
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vet Services */}
        <div className="mb-6">
          <div className="px-6 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-blue-600" />
              <h2 className="text-black font-semibold">Veterinary Care</h2>
            </div>
            <button
              onClick={() => handleNavigation('vet')}
              className="text-xs text-blue-600 font-medium flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 grid grid-cols-3 gap-3" data-testid="vet-services-grid" style={{ pointerEvents: 'auto' }}>
            <button
              type="button"
              data-testid="tele-consultation-button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = buildTeleInstantAutoPayBookingUrl();
                console.log('[CustomerHomeComplete] Tele Consult CTA →', url);
                router.push(url);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-100 text-center hover:shadow-lg transition-shadow cursor-pointer active:scale-95 relative z-10"
              style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
            >
              <div className="w-10 h-10 mx-auto mb-2 bg-blue-100 rounded-xl flex items-center justify-center pointer-events-none">
                <Video className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-xs font-semibold text-gray-800 mb-1 pointer-events-none">Tele Consult</h3>
              <p className="text-blue-600 font-medium text-sm pointer-events-none">₹299</p>
            </button>
            <button
              onClick={() => handleNavigation('vet')}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-100 text-center hover:shadow-lg transition-shadow"
            >
              <div className="w-10 h-10 mx-auto mb-2 bg-green-100 rounded-xl flex items-center justify-center">
                <HomeIcon className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-xs font-semibold text-gray-800 mb-1">Vet at Home</h3>
              <p className="text-blue-600 font-medium text-sm">₹599</p>
            </button>
            <button
              onClick={() => handleNavigation('vet')}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-100 text-center hover:shadow-lg transition-shadow"
            >
              <div className="w-10 h-10 mx-auto mb-2 bg-purple-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-xs font-semibold text-gray-800 mb-1">Clinic Visit</h3>
              <p className="text-blue-600 font-medium text-sm">₹399</p>
            </button>
          </div>
        </div>

        {carouselHotDeals.length > 0 && (
        <div className="mb-6">
          <div className="px-6 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-pink-600" />
              <h2 className="text-black font-semibold">Hot Deals</h2>
            </div>
            <button
              onClick={() => handleNavigation('shop')}
              className="text-xs text-pink-600 font-medium flex items-center gap-1"
            >
              Shop All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide px-6">
            {carouselHotDeals.map((deal: any, index) => {
              const DealIcon = deal.Icon || PackageIcon;
              return (
                <div key={deal.id ?? index} className="flex-shrink-0 w-40 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="h-32 bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center relative">
                    <DealIcon className="w-12 h-12 text-pink-500" />
                    {deal.discount && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                        {deal.discount}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-gray-800 mb-1 line-clamp-2">{deal.title}</h3>
                    <div className="flex items-center gap-1 mb-2">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs text-gray-600">{deal.rating}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#FF8C42] font-bold text-sm">{deal.price}</span>
                      <span className="text-gray-400 line-through text-xs">{deal.originalPrice}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigation('shop');
                      }}
                      className="w-full bg-[#FF8C42] text-white py-2 rounded-lg text-xs font-medium mt-2"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Featured Services Mix - Square Boxes */}
        <div className="mb-6">
          <div className="px-6 mb-4">
            <h2 className="text-black font-semibold mb-1">Featured Services</h2>
            <p className="text-xs text-gray-600">Popular choices for your pet</p>
          </div>
          <div className="px-6 grid grid-cols-2 gap-3">
            {/* Large Featured Item - Spans 2 columns */}
            <div className="col-span-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">TRENDING</span>
                    <h3 className="text-lg font-bold mt-2">Complete Health Package</h3>
                    <p className="text-sm text-white/90 mb-3">Full checkup + vaccination + grooming</p>
                  </div>
                  <Sparkles className="w-8 h-8" />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-xs line-through text-white/70">₹3,999</span>
                    <div className="text-2xl font-bold">₹2,499</div>
                  </div>
                  <button
                    onClick={() => {
                      const url = buildTeleInstantAutoPayBookingUrl({
                        offerName: 'Complete Health Package',
                        price: 2499,
                        desc: 'Full checkup + vaccination + grooming',
                      });
                      console.log('[CustomerHomeComplete] Complete Health Package Book Now →', url);
                      router.push(url);
                    }}
                    className="bg-white text-purple-600 px-4 py-2 rounded-full text-sm font-semibold"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            </div>

            {/* Training */}
            <button
              onClick={() => handleNavigation('training')}
              className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100 text-left hover:shadow-lg transition-all"
            >
              <GraduationCap className="w-8 h-8 text-indigo-600 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Training</h3>
              <p className="text-xs text-gray-600 mb-2">Expert trainers</p>
              <span className="text-indigo-600 font-bold text-sm">From ₹999</span>
            </button>

            {/* Boarding */}
            <button
              onClick={() => handleNavigation('boarding')}
              className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-4 border border-cyan-100 text-left hover:shadow-lg transition-all"
            >
              <HomeIcon className="w-8 h-8 text-cyan-600 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Boarding</h3>
              <p className="text-xs text-gray-600 mb-2">Safe stay</p>
              <span className="text-cyan-600 font-bold text-sm">₹499/day</span>
            </button>

            {/* Insurance — coming soon (not launched) */}
            <div
              className="relative bg-gradient-to-br from-green-50/90 to-emerald-50/90 rounded-2xl p-4 border border-green-100/80 text-left opacity-[0.88] pointer-events-none select-none grayscale-[0.15]"
              aria-label="Insurance — coming soon"
            >
              <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wide bg-amber-500 text-white px-2 py-0.5 rounded-full">
                Soon
              </span>
              <Shield className="w-8 h-8 text-green-600/80 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Insurance</h3>
              <p className="text-xs text-gray-600 mb-2">Full coverage</p>
              <span className="text-green-700 font-bold text-sm">Coming soon</span>
            </div>

            {/* Walker */}
            <button
              onClick={() => handleNavigation('walker')}
              className="bg-gradient-to-br from-lime-50 to-green-50 rounded-2xl p-4 border border-lime-100 text-left hover:shadow-lg transition-all"
            >
              <Dog className="w-8 h-8 text-lime-600 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Dog Walker</h3>
              <p className="text-xs text-gray-600 mb-2">Daily walks</p>
              <span className="text-lime-600 font-bold text-sm">₹299/walk</span>
            </button>
          </div>
        </div>

        {/* What's New Section */}
        <div className="mb-6">
          <div className="px-6 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FF8C42]" />
              <h2 className="text-black font-semibold">What's New</h2>
            </div>
            <button
              type="button"
              onClick={() => handleNavigation('whats-new')}
              className="text-xs text-[#FF8C42] font-medium"
            >
              See all
            </button>
          </div>
          <div className="px-6">
            <WhatsNewAnnouncementList
              announcements={whatsNewAnnouncements}
              interactionMode="hub"
              onRowPress={(a) => {
                if (a.announcementType === 'emergency') return;
                // AI Pet Assistant: open chat widget
                if (a.id === 'ai' || (a.announcementType === 'feature' && !a.ctaLink?.trim())) {
                  setShowAIChat(true);
                  return;
                }
                navigateWhatsNewFromFullPage(router, a, 'row');
              }}
              onSosPress={(a) => {
                if (a.comingSoon && a.announcementType === 'emergency') return;
                handleNavigation(a.ctaLink?.trim() || 'ambulance');
              }}
            />
          </div>
        </div>

        {/* Discover more: For you & Trending - lower on page so landing stays clean */}
        <div className="mb-6 mx-4 p-4 rounded-2xl bg-gray-50/80 border border-gray-100">
          <h2 className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-4">Discover more</h2>
          <ForYouSection
            phone={phone}
            hotDeals={hotDeals}
            banners={dynamicBanners}
            onNavigate={handleNavigation}
          />
          <div className="mt-4 pt-4 border-t border-gray-100">
            <TrendingProblems
              onProblemSelect={(problemId, title) => {
                handleNavigation('services_by_problem', { problemId, problemTitle: title });
              }}
              limit={5}
            />
          </div>
        </div>

        {/* Featured providers (spotlight from admin) */}
        {featuredVendors.length > 0 && (
          <div className="mb-6">
            <div className="px-6 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h2 className="text-black font-semibold">Featured providers</h2>
              </div>
              <p className="text-xs text-gray-600">Hand-picked by us</p>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide px-6">
              {featuredVendors.map((v: any) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => navigateFromFeaturedVendorMeta(v)}
                  className="flex-shrink-0 w-36 bg-white rounded-2xl border border-gray-200 p-4 text-left shadow-sm hover:shadow-md hover:border-amber-200 transition-all"
                >
                  <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 mb-3 overflow-hidden">
                    {v.imageUrl ? (
                      <img src={v.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Star className="w-8 h-8 text-amber-400" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800 truncate">{v.vendorName || v.title}</h3>
                  {v.subtitle && <p className="text-xs text-gray-600 truncate mt-0.5">{v.subtitle}</p>}
                  <span className="text-xs text-amber-600 font-medium mt-2 inline-flex items-center gap-1">
                    {v.ctaText || 'Book'} <ChevronRight className="w-3 h-3" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Adoption — full section coming soon (not launched) */}
        <div className="mb-6" aria-label="Adoption — coming soon">
          <div className="px-6 mb-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Heart className="w-5 h-5 text-red-600 shrink-0" />
                <h2 className="text-black font-semibold">Adoption</h2>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-500 text-white px-2 py-0.5 rounded-full shrink-0">
                Soon
              </span>
            </div>
            <p className="text-xs text-gray-600">
              Coming soon — adoption and rehoming when we launch. Find your perfect companion then.
            </p>
          </div>
          <div className="px-6 space-y-3 pointer-events-none select-none">
            {adoptionOptions({ adoptablePets: adoptionStats.adoptablePets, rehomingListings: adoptionStats.rehomingListings }).map((option, index) => (
              <div
                key={index}
                className="bg-gradient-to-r from-red-50/90 to-pink-50/90 rounded-2xl p-4 border border-red-100/90 flex items-center justify-between w-full text-left opacity-[0.92] grayscale-[0.08]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 bg-white/90 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                    <option.Icon className="w-6 h-6 text-red-500/90" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800">{option.title}</h3>
                    <p className="text-xs text-gray-600">{option.description}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <span className="text-xs font-semibold text-amber-600">Coming soon</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Premium Pet Food — full section coming soon (shop wiring deferred) */}
        <div className="mb-6" aria-label="Premium Pet Food — coming soon">
          <div className="px-6 mb-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Wheat className="w-5 h-5 text-yellow-600 shrink-0" />
                <h2 className="text-black font-semibold">Premium Pet Food</h2>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-500 text-white px-2 py-0.5 rounded-full shrink-0">
                Soon
              </span>
            </div>
            <p className="text-xs text-gray-600">
              Coming soon — trusted brands and vendor deals when we launch. Browse the shop for food then.
            </p>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide px-6 pointer-events-none select-none">
            {petFoodSpotlightBrands().map((vendor, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-32 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-4 border border-yellow-100 text-center opacity-[0.92] grayscale-[0.08]"
              >
                <div className="w-12 h-12 mx-auto mb-2 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <vendor.Icon className="w-6 h-6 text-yellow-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">{vendor.name}</h3>
                <span className="text-xs font-semibold text-amber-600 inline-block">Coming soon</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pet Articles - ✅ FIX: Only show if admin-created articles exist */}
        {articles.length > 0 && (
          <div className="mb-6">
            <div className="px-6 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-teal-600" />
                <h2 className="text-black font-semibold">Pet Care Articles</h2>
              </div>
              <button
                type="button"
                onClick={() => handleNavigation('articles')}
                className="text-xs text-teal-600 font-medium flex items-center gap-1"
              >
                Read more <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 space-y-3">
              {articles.map((article, index) => (
                <button
                  key={article.id || index}
                  onClick={() => {
                    // ✅ FIX: Navigate to content page by slug
                    if (article.slug) {
                      router.push(`/articles?slug=${encodeURIComponent(article.slug)}`);
                    } else if (article.url) {
                      window.open(article.url, '_blank');
                    } else {
                      handleNavigation('article-detail', { articleId: article.id, article: { id: article.id, slug: article.slug } });
                    }
                  }}
                  className="w-full bg-white rounded-2xl border border-gray-200 p-4 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow text-left"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <article.Icon className="w-8 h-8 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                        {article.category}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {article.readTime}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800">{article.title}</h3>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Other Services Highlight */}
        <div className="px-6 mb-6">
          <h2 className="text-black font-semibold mb-4">More Services</h2>
          <div className="grid grid-cols-2 gap-3">
            <div
              className="relative bg-gradient-to-br from-rose-50/90 to-pink-50/90 rounded-2xl p-4 border border-rose-100/80 text-left opacity-[0.88] pointer-events-none select-none w-full grayscale-[0.12]"
              aria-label="Mating and Dating — coming soon"
            >
              <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wide bg-amber-500 text-white px-2 py-0.5 rounded-full">
                Soon
              </span>
              <Users className="w-8 h-8 text-rose-600/80 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Mating & Dating</h3>
              <p className="text-xs text-gray-600 mb-3">Find perfect match for your pet</p>
              <span className="text-xs text-amber-600 font-semibold">Coming soon</span>
            </div>
            <div
              className="relative bg-gradient-to-br from-cyan-50/90 to-blue-50/90 rounded-2xl p-4 border border-cyan-100/80 text-left opacity-[0.88] pointer-events-none select-none w-full grayscale-[0.15]"
              aria-label="Pet Insurance — coming soon"
            >
              <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wide bg-amber-500 text-white px-2 py-0.5 rounded-full">
                Soon
              </span>
              <Shield className="w-8 h-8 text-cyan-600/80 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Pet Insurance</h3>
              <p className="text-xs text-gray-600 mb-3">Protect your furry friend</p>
              <span className="text-xs text-amber-600 font-semibold">Coming soon</span>
            </div>
            <button
              type="button"
              onClick={() => handleNavigation('walker')}
              className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100 text-left hover:shadow-md transition-shadow w-full"
            >
              <Dog className="w-8 h-8 text-green-600 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Dog Walkers</h3>
              <p className="text-xs text-gray-600 mb-3">Trusted & verified walkers</p>
              <span className="text-xs text-green-600 font-medium inline-flex items-center gap-1">
                Book Now <ChevronRight className="w-3 h-3" />
              </span>
            </button>
            <div
              className="relative bg-gradient-to-br from-amber-50/90 to-yellow-50/90 rounded-2xl p-4 border border-amber-100/80 text-left opacity-[0.88] pointer-events-none select-none w-full grayscale-[0.1]"
              aria-label="Pet Cafes — coming soon"
            >
              <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wide bg-amber-500 text-white px-2 py-0.5 rounded-full">
                Soon
              </span>
              <Coffee className="w-8 h-8 text-amber-600/80 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Pet Cafes</h3>
              <p className="text-xs text-gray-600 mb-3">Pet-friendly dining spots</p>
              <span className="text-xs text-amber-600 font-semibold">Coming soon</span>
            </div>
          </div>
        </div>

        {/* Training Services */}
        <div className="px-6 mb-6">
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-3xl p-6 text-white">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg mb-2">Pet Training Programs</h2>
                <p className="text-sm text-white/90 mb-4">
                  Professional trainers for obedience, agility & behavior
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">✓</div>
                    Basic Obedience - ₹2,999
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">✓</div>
                    Advanced Training - ₹4,999
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">✓</div>
                    Behavior Correction - ₹3,499
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => handleNavigation('training')}
                  className="mt-4 bg-white text-purple-600 px-5 py-2.5 rounded-full text-sm font-medium"
                >
                  View Programs
                </button>
              </div>
              <GraduationCap className="w-16 h-16 text-white/80" />
            </div>
          </div>
        </div>

        {/* Boarding Services */}
        <div className="px-6 mb-6">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-lg mb-2">Pet Boarding</h2>
                <p className="text-sm text-white/90 mb-4">
                  Safe & comfortable stay for your pets
                </p>
                <div className="flex items-center gap-4 mb-4">
                  <div>
                    <span className="text-2xl font-bold">₹499</span>
                    <p className="text-xs text-white/80">per day</p>
                  </div>
                  <div className="h-8 w-px bg-white/20"></div>
                  <div>
                    <p className="text-lg font-semibold">4.9★</p>
                    <p className="text-xs text-white/80">250+ reviews</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleNavigation('boarding')}
                  className="bg-white text-indigo-600 px-5 py-2.5 rounded-full text-sm font-medium"
                >
                  Book Boarding
                </button>
              </div>
              <HomeIcon className="w-16 h-16 text-white/80" />
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="px-6">
          <div className="bg-gradient-to-r from-orange-100 to-pink-100 rounded-3xl p-6 border-2 border-[#FF8C42] text-center">
            <h2 className="text-black font-bold text-lg mb-2">Need Help? 🤝</h2>
            <p className="text-gray-700 text-sm mb-4">
              Our support team is available 24/7 for you
            </p>
            <div className="flex justify-center">
              <button
                type="button"
                className="bg-[#FF8C42] text-white py-3 px-10 rounded-full font-medium text-sm inline-flex items-center justify-center gap-2 active:opacity-90 shadow-sm"
                onClick={() => {
                  try {
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem(SUPPORT_INITIAL_TAB_KEY, 'contact');
                    }
                    handleNavigation('support_help', { initialTab: 'contact' });
                  } catch {
                    toast.error('Could not open support. Please try again.');
                  }
                }}
              >
                <Video className="w-4 h-4" /> Live Chat
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Assistant Floating Action Button (draggable; tap opens chat) */}
      {!hideHeaderFooter && (
        <div
          className="fixed right-6 z-40 pointer-events-none bottom-[var(--customer-floater-bottom)]"
          style={{ transform: `translate(${aiFabDragOffset.x}px, ${aiFabDragOffset.y}px)` }}
        >
          <button
            type="button"
            onPointerDown={startAiFabDrag}
            onClick={() => {
              if (aiFabDragMovedRef.current) {
                aiFabDragMovedRef.current = false;
                return;
              }
              setShowAIChat(true);
            }}
            className="pointer-events-auto touch-manipulation relative w-16 h-16 bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform mx-auto animate-pulse"
            aria-label="Open AI assistant"
          >
            <Bot className="w-8 h-8 text-white" />
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
          </button>
        </div>
      )}

      {/* ✅ NEW: Category Mapper Button (Development Tool) */}
      {onOpenCategoryMapper && !hideHeaderFooter && (
        <button
          onClick={onOpenCategoryMapper}
          className="fixed left-6 w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-40 max-w-customer mx-auto bottom-[var(--customer-floater-bottom)]"
          title="Open Category Mapper"
        >
          <Settings className="w-7 h-7 text-white" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center">
            <span className="text-[10px] font-bold text-gray-800">🧪</span>
          </div>
        </button>
      )}

      {/* AI Assistant Chat Modal */}
      {showAIChat && (
        <AIChatbotWidget
          customerId={customerId || undefined}
          customerPhone={phone}
          petId={selectedPet?.id}
          onClose={() => setShowAIChat(false)}
          onNavigate={handleNavigation}
        />
      )}

      {/* Add Pet Modal - Enhanced with Photo & Vaccinations */}
      <EnhancedAddPetModal
        phone={phone}
        isOpen={showAddPetModal}
        onClose={() => setShowAddPetModal(false)}
        onSuccess={() => {
          loadUserData();
          setShowAddPetModal(false);
        }}
      />

      {/* ✅ Live Tracking Widget - Shows when vendor is on the way */}
      {showTrackingWidget && trackingBooking && (
        <div className="fixed left-4 right-4 z-40 max-w-md mx-auto bottom-[calc(var(--customer-tabbed-nav-offset)+0.5rem)]">
          <LiveTrackingWidget
            bookingId={showTrackingWidget}
            onClose={() => {
              setShowTrackingWidget(null);
              setTrackingBooking(null);
            }}
            onCallProvider={() => {
              // Call vendor phone
              if (trackingBooking.vendorPhone) {
                window.location.href = `tel:${trackingBooking.vendorPhone}`;
              }
            }}
            onChatProvider={() => {
              // ✅ FIX: Use onViewBooking instead of onNavigate to prevent navigation issues
              if (onViewBooking && showTrackingWidget) {
                onViewBooking(showTrackingWidget);
              }
            }}
            minimizable={true}
          />
        </div>
      )}

      {/* ✅ FIX #6: Unified Appointment Tracker Widget - Shows upcoming appointments and active bookings */}
      {/* ✅ FIX: Chat opens chat window with vendor (not My Bookings); View Details handled by wrapper → my-bookings with booking detail modal */}
      <UnifiedAppointmentTracker
        customerPhone={phone}
        onJoinCall={(bookingId, meetingId) => {
          handleNavigation('video-call', { bookingId, meetingId });
          if (!onNavigate) {
            if (phone) {
              localStorage.setItem('customerPhone', phone);
              localStorage.setItem('phone', phone);
            }
            router.push(`/video/${bookingId}`);
          }
        }}
        onOpenChat={async (bookingId) => {
          try {
            const data = await apiClient.get<{ booking?: { vendorName?: string; vendorPhoto?: string }; vendorName?: string }>(`/customer/bookings/${bookingId}`) as any;
            const booking = data?.booking || data;
            const vendorName = booking?.vendorName || data?.vendorName || 'Service Provider';
            const vendorPhoto = booking?.vendorPhoto || booking?.vendorPhoto;
            setChatFromNotification({ isOpen: true, bookingId, vendorName, vendorPhoto });
          } catch {
            if (onViewBooking) onViewBooking(bookingId);
            else handleNavigation('my-bookings', { bookingId });
          }
        }}
        onCallProvider={(phone) => {
          window.open(`tel:${phone}`, '_self');
        }}
        onNavigate={handleNavigation}
        className={hideHeaderFooter ? 'bottom-6' : ''}
      />

      {/* ✅ NEW: Vendor On The Way Popup - Shows when vendor is en-route or has arrived */}
      {vendorOnTheWay && (
        <VendorOnTheWayPopup
          booking={{
            ...vendorOnTheWay,
            status: vendorOnTheWay.status || 'en_route',
          }}
          onTrack={(bookingId) => {
            // ✅ FIX: Navigate to dedicated GPS tracking screen for better experience
            handleNavigation('gps-tracking', { bookingId });
            if (!onNavigate) {
              window.location.href = `/tracking/${bookingId}`;
            }
          }}
          onJoinCall={(bookingId, meetingId) => {
            // ✅ NEW: For tele consultations, navigate to video call
            handleNavigation('video-call', { bookingId, meetingId });
            if (!onNavigate) {
              if (phone) {
                localStorage.setItem('customerPhone', phone);
                localStorage.setItem('phone', phone);
              }
              router.push(`/video/${bookingId}`);
            }
          }}
          onCall={(vendorPhone) => {
            window.open(`tel:${vendorPhone}`, '_self');
          }}
          onChat={async (bookingId) => {
            try {
              const data = await apiClient.get<{ booking?: { vendorName?: string; vendorPhoto?: string }; vendorName?: string }>(`/customer/bookings/${bookingId}`) as any;
              const booking = data?.booking || data;
              const vendorName = booking?.vendorName || data?.vendorName || vendorOnTheWay?.vendorName || 'Service Provider';
              const vendorPhoto = booking?.vendorPhoto || booking?.vendorPhoto || vendorOnTheWay?.vendorPhoto;
              setChatFromNotification({ isOpen: true, bookingId, vendorName, vendorPhoto });
            } catch {
              if (onViewBooking) onViewBooking(bookingId);
              else {
                handleNavigation('my-bookings', { bookingId });
                if (!onNavigate) window.location.href = `/bookings/${bookingId}`;
              }
            }
          }}
          onDismiss={() => {
            // Add to dismissed set so it doesn't reappear immediately
            const session = gpsActiveSessions.find(s => s.bookingId === vendorOnTheWay.bookingId);
            if (session) {
              setDismissedTrackingSessions(prev => new Set(prev).add(session.sessionId));
            }
            setVendorOnTheWay(null);
          }}
          minimizable={true}
          autoMinimizeAfterMs={15000} // Auto minimize after 15 seconds
        />
      )}

      {/* ✅ Rating/Review Popup - Shows after booking completion */}
      {pendingReview && (
        <RatingReviewPopup
          isOpen={pendingReview.isOpen}
          onClose={() => setPendingReview(null)}
          bookingId={pendingReview.bookingId}
          vendorId={pendingReview.vendorId}
          vendorName={pendingReview.vendorName}
          serviceName={pendingReview.serviceName}
          serviceStyle={pendingReview.serviceStyle}
          staffId={pendingReview.staffId}
          staffName={pendingReview.staffName}
          customerPhone={phone}
          customerId={customerId}
          onSubmit={() => {
            setPendingReview(null);
            // Optionally refresh data
            loadActiveBookings();
          }}
        />
      )}

      {/* ✅ FIX GAP-6.2: 5-Minute Notification Before Scheduled Call */}
      {/* GAP FIX: Use modal variant when call is imminent (within 2 minutes) for better visibility */}
      {upcomingCall && (
        <TeleConsultationReminderNotification
          booking={upcomingCall}
          onOpenChat={(bookingId) => {
            setChatFromNotification({
              isOpen: true,
              bookingId,
              vendorName: upcomingCall.vendorName,
              vendorPhoto: upcomingCall.vendorPhoto,
            });
          }}
          onStartCall={(bookingId, meetingId) => {
            handleNavigation('video-call', { bookingId, meetingId });
            if (!onNavigate) {
              if (phone) {
                localStorage.setItem('customerPhone', phone);
                localStorage.setItem('phone', phone);
              }
              router.push(`/video/${bookingId}`);
            }
            setUpcomingCall(null);
          }}
          onDismiss={() => setUpcomingCall(null)}
          variant={upcomingCall.minutesUntil <= 2 ? 'modal' : 'banner'}
        />
      )}

      {/* ✅ CRITICAL FIX: Incoming/Outgoing Call Notification (WhatsApp-like) */}
      {incomingCall && (
        <TeleCallNotification
          callType="incoming"
          provider={incomingCall.provider}
          bookingId={incomingCall.bookingId}
          meetingId={incomingCall.meetingId}
          serviceName={incomingCall.serviceName}
          petName={incomingCall.petName}
          onAccept={(bookingId, meetingId) => {
            handleNavigation('video-call', { bookingId, meetingId });
            if (!onNavigate) {
              if (phone) {
                localStorage.setItem('customerPhone', phone);
                localStorage.setItem('phone', phone);
              }
              router.push(`/video/${bookingId}`);
            }
            setIncomingCall(null);
          }}
          onReject={() => {
            setIncomingCall(null);
          }}
          onDismiss={() => setIncomingCall(null)}
        />
      )}

      {/* ✅ FIX GAP-6.3: Chat Interface Opening from Notification */}
      {chatFromNotification && (
        <ChatInterfaceFromNotification
          isOpen={chatFromNotification.isOpen}
          bookingId={chatFromNotification.bookingId}
          vendorName={chatFromNotification.vendorName}
          vendorPhoto={chatFromNotification.vendorPhoto}
          onClose={() => setChatFromNotification(null)}
          onStartVideoCall={(bookingId) => {
            handleNavigation('video-call', { bookingId });
            if (!onNavigate) {
              if (phone) {
                localStorage.setItem('customerPhone', phone);
                localStorage.setItem('phone', phone);
              }
              router.push(`/video/${bookingId}`);
            }
            setChatFromNotification(null);
          }}
        />
      )}

      {/* ✅ FIX GAP-8.4: Live Tracking Widget (Zomato-like) on Customer Home Screen */}
      {activeOrderTracking && (
        <OrderTrackingWidget
          orderId={activeOrderTracking.id || activeOrderTracking.orderId}
          orderType={activeOrderTracking.orderType || 'pharmacy'}
          onClose={() => setActiveOrderTracking(null)}
          onTrackLive={() => {
            const orderId = activeOrderTracking.id || activeOrderTracking.orderId;
            handleNavigation('order-tracking', { orderId, orderType: activeOrderTracking.orderType });
            if (!onNavigate) {
              window.location.href = `/track/${orderId}`;
            }
          }}
        />
      )}

      {/* ✅ Video Call Tracker - Shows active video call sessions */}
      {hasActiveVideoCall && (
        <TeleTracker
          hasActiveCall={hasActiveVideoCall}
          activeVideoCalls={activeVideoCalls.map(session => ({
            sessionId: session.sessionId,
            bookingId: session.bookingId,
            vendorName: session.vendorName,
            serviceName: session.serviceName,
            petName: session.petName,
          }))}
          joinCall={(call) => {
            const session = activeVideoCalls.find(s => s.bookingId === call.bookingId);
            if (session) {
              joinVideoCall(session);
            }
          }}
        />
      )}

      <CustomerNotificationModal
        open={notificationModalOpen}
        phone={phone}
        onClose={() => {
          setNotificationModalOpen(false);
          setNotificationInboxVersion((v) => v + 1);
        }}
        onNotificationsRead={() => setNotificationInboxVersion((v) => v + 1)}
        onNotificationClick={(n) => {
          const raw = n.data?.bookingId ?? n.data?.booking_id;
          const bookingId = typeof raw === 'string' ? raw : raw != null ? String(raw) : '';
          if (bookingId && onViewBooking) {
            setNotificationModalOpen(false);
            onViewBooking(bookingId);
          }
        }}
      />
    </div>
  );
}
