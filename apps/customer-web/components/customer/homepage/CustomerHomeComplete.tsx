'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { buildWhatsNewAnnouncements, navigateWhatsNewFromFullPage } from '@/lib/whats-new-announcements';
import { WhatsNewAnnouncementList } from '@/components/customer/whats-new/WhatsNewAnnouncementList';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Bell, Heart, Plus, ChevronRight, Star, MapPin, Clock,
  Scissors, Stethoscope, Home as HomeIcon, ShoppingBag, Users,
  GraduationCap, Coffee, Shield, Sparkles,
  Phone, Video, Building2, Bone, BookOpen, Wheat, Bot, Menu, Settings, Palmtree, Pill,
  Navigation, AlertCircle, FlaskConical, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { fetchCustomerMessageUnreadBreakdown } from '@/lib/customer-message-unread';
import { useCustomerBookingMessagesModal } from '../messaging/CustomerBookingMessagesModalProvider';
import { getCustomerArticleCategoryLabel } from '@/lib/article-category-label';
import { sanitizeCustomerAllowedServiceStyles } from '@/lib/sanitize-customer-allowed-service-styles';
import { ServiceDescriptionInline } from '../shared/ServiceDescriptionInline';
import { PromotionBanner } from '../shared/PromotionBanner';
import { EnhancedSearchBar } from '../EnhancedSearchBar';
import { ProblemGridNavigation } from '../ProblemGridNavigation';
import { ForYouSection } from '../ForYouSection';
import { ServicesByProblem } from '../ServicesByProblem';
import { TrendingProblems, type TrendingProblem } from '../TrendingProblems';
import { CustomerNotificationModal } from '../CustomerNotificationModal';
import { EnhancedAddPetModal } from '../EnhancedAddPetModal';
import { getServiceStyleIcon, getPetIcon } from '@/lib/icon-utils';
import { Dog, Cat, UtensilsCrossed, Shirt, Watch, Bed, Store } from 'lucide-react';
import { useActiveGpsTracking, ActiveTrackingSession } from '@/hooks/useActiveGpsTracking';
import { useCustomerCategories } from '@/hooks/useCustomerCategories';
// Re-export type for VendorOnTheWayPopup
import type { TrackingStatus } from '../VendorOnTheWayPopup';
import { CustomerHomeCompleteProps, Pet, UserData } from './constants/interface';
import { defaultBanners, defaultGroomingServices, defaultVetServices, quickServices, serviceNavigationMap, serviceScreenMap } from './constants';
import { adoptionOptions, petFoodSpotlightBrands } from './constants/helpers';
import { useActiveVideoCall } from '@/hooks/useActiveTeleTracking';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { SUPPORT_INITIAL_TAB_KEY } from '@/lib/support-contact';
import { customerPathToScreen } from '@/lib/promotion-navigation';
import { iconForCustomerHomeApiBanner, normalizeCustomerBannerTarget } from '@/lib/customer-banner-icons';
import {
  isBannerInformationalNonClickable,
  parseBannerInformationalFromMetadata,
} from '@/lib/banner-cta-target';
import { navigateBannerCta } from '@/lib/banner-cta-navigation';
import { isVendorBannerCta } from '@/lib/banner-cta-parse';
import { buildTeleInstantAutoPayBookingUrl } from '@/lib/tele-direct-booking';
import { mapCatalogSlugToLaunchServiceId } from '@warmpawz/service-launch-mappings';
import { buildCustomerLaunchTiles } from '@/lib/customer-launch-tiles';
import { resolveEffectiveMealDeliveryState, isTerminalMealDeliveryState } from '@warmpawz/shared-types';
import { toast } from 'sonner';
import { hasRatings, normalizeRatingCount } from '@/lib/rating-display';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { isNewHomeUiEnabled } from '@/lib/customer-new-home-ui-flag';
import { CustomerHomePageContent, CustomerHomePageHeader } from '../home/CustomerHomePage';
import { MoreServicesSection } from '../home/sections/MoreServicesSection';
import {
  hydrateInitialUserData,
  readCachedPetsFromStorage,
  readCachedProfileName,
} from '../home/hooks/useHomePageData';
import { HOME_CONTENT_SHELL_CLASS } from '../home/shared/HomeContentShell';
import { buildHomeTopCarouselBanners } from '../home/utils/banner-utils';
import { ShopCategoryGrid } from '@/components/shop/ShopCategoryGrid';
import { mapApiCategoriesToShop } from '@/lib/shop-category-display';
import { STATIC_SHOP_DISPLAY_CATEGORIES } from '@/lib/shop-category-static-images';
import type { QuickServiceTile } from '../home/types';
import { resolveCustomerLocation } from '@/lib/customer-location';
import type { CustomerLocation } from '@/lib/customer-location';
import {
  readHomeSessionCache,
  writeHomeSessionCache,
  rehydrateLaunchTilesFromCache,
  serializeLaunchTiles,
  type CachedHomeDynamicContent,
  type CachedHomeServices,
} from '@/lib/home-session-cache';
import { scheduleIdleWork } from '@/lib/schedule-idle';
import {
  ensureCustomerProfileAndPets,
  getHomeBootstrapReady,
  refreshHomeDynamicContent,
  scheduleHomeDeferredWork,
} from '@/lib/customer-home-bootstrap';

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

function normalizeHexColor(value: unknown, fallback: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;
  if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return `#${raw}`;
  return fallback;
}

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

/** Trending API `category` is role_id; map to problem-grid category slug. */
function trendingRoleIdToCategorySlug(roleId: string): string {
  const r = roleId.toLowerCase();
  if (r.includes('groom')) return 'grooming';
  if (r.includes('train')) return 'training';
  if (r.includes('walk')) return 'walker';
  if (r.includes('board')) return 'boarding';
  if (r.includes('behav')) return 'behavioral';
  if (r.includes('nutrition')) return 'nutrition';
  if (r.includes('vet')) return 'vet';
  return 'vet';
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
  const [userData, setUserData] = useState<UserData>(() => hydrateInitialUserData(phone));
  const [selectedPet, setSelectedPet] = useState<Pet | null>(() => {
    const pets = readCachedPetsFromStorage();
    return pets[0] ?? null;
  });
  const [petsLoading, setPetsLoading] = useState(() => readCachedPetsFromStorage().length === 0);
  const [currentView, setCurrentView] = useState<'home' | 'profile' | 'pet-details' | 'add-pet'>('home');
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [userProfilePhoto, setUserProfilePhoto] = useState<string>(() => readCachedProfileName(phone).photo || '');
  const [currentBanner, setCurrentBanner] = useState(0);
  const [currentMiddleBanner, setCurrentMiddleBanner] = useState(0);
  const heroBannerTouchStartX = useRef<number | null>(null);
  const middleBannerTouchStartX = useRef<number | null>(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [newPetData, setNewPetData] = useState({ name: '', type: 'Dog', breed: '', age: '', gender: 'male' });
  const [savingPet, setSavingPet] = useState(false);
  const [dashboardConfig, setDashboardConfig] = useState<any>(null);
  const [filteredQuickServices, setFilteredQuickServices] = useState<any[]>(() =>
    rehydrateLaunchTilesFromCache(
      readHomeSessionCache<{ tiles: ReturnType<typeof serializeLaunchTiles> }>(phone, 'launch_tiles')?.tiles
    )
  );
  /** After a successful geography launch-config fetch, the grid uses `filteredQuickServices` even when empty (all hidden). Before that, show the full catalog. */
  const [serviceLaunchTilesResolved, setServiceLaunchTilesResolved] = useState(() => {
    const cached = readHomeSessionCache<{ tiles: unknown[] }>(phone, 'launch_tiles');
    return (cached?.tiles?.length ?? 0) > 0;
  });

  // Dynamic service data from API (replacing hardcoded mock data)
  const cachedHomeServices = readHomeSessionCache<CachedHomeServices>(phone, 'services');
  const [groomingServices, setGroomingServices] = useState<any[]>(
    () => cachedHomeServices?.groomingServices ?? []
  );
  const [vetServicesData, setVetServicesData] = useState<any[]>(
    () => cachedHomeServices?.vetServicesData ?? []
  );
  const [hotDeals, setHotDeals] = useState<any[]>(() => cachedHomeServices?.hotDeals ?? []);
  const [servicesLoading, setServicesLoading] = useState(() => {
    if (!cachedHomeServices) return true;
    return !(
      (cachedHomeServices.groomingServices?.length ?? 0) > 0 ||
      (cachedHomeServices.vetServicesData?.length ?? 0) > 0 ||
      (cachedHomeServices.hotDeals?.length ?? 0) > 0
    );
  });
  /** Live min price across vendors offering tele consultation (for the home Tele Consult tile). */
  const [teleMinPrice, setTeleMinPrice] = useState<number | null>(null);
  /** Live min price across vendors offering at-home vet visits (for the home Vet at Home tile). */
  const [vetHomeMinPrice, setVetHomeMinPrice] = useState<number | null>(null);
  /** Live min price across vendors offering clinic visits (for the home Clinic Visit tile). */
  const [clinicMinPrice, setClinicMinPrice] = useState<number | null>(null);
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

  /**
   * Live min price for the Veterinary Care home tiles (Tele Consult / Vet at Home / Clinic Visit).
   * Reuses the same endpoint as VetServicesByStyle so we don't introduce a new backend.
   */
  useEffect(() => {
    let cancelled = false;
    const cancelIdle = scheduleIdleWork(() => {
      const fetchMinPrice = async (style: 'tele' | 'at_home' | 'at_center'): Promise<number | null> => {
        try {
          const res = await apiClient.get<any>(
            `/customer/services/by-style?style=${style}&category=vet`
          );
          const providers = res?.providers || res?.vendors || [];
          const prices: number[] = [];
          for (const p of providers) {
            for (const s of (p?.services || [])) {
              const n = Number(s?.price ?? s?.custom_price);
              if (Number.isFinite(n) && n > 0) prices.push(n);
            }
          }
          return prices.length > 0 ? Math.min(...prices) : null;
        } catch (e) {
          console.warn(`[CustomerHomeComplete] vet ${style} min price fetch failed`, e);
          return null;
        }
      };
      void (async () => {
        const [tele, atHome, atCenter] = await Promise.all([
          fetchMinPrice('tele'),
          fetchMinPrice('at_home'),
          fetchMinPrice('at_center'),
        ]);
        if (cancelled) return;
        if (tele != null) setTeleMinPrice(tele);
        if (atHome != null) setVetHomeMinPrice(atHome);
        if (atCenter != null) setClinicMinPrice(atCenter);
      })();
    });
    return () => {
      cancelled = true;
      cancelIdle();
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

  const { messagesInboxVersion } = useCustomerBookingMessagesModal();

  /** Unread inbox count for header bell; refreshed infrequently (same API as useNotificationService). */
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  /** Bumps when inbox changes (modal read/delete) so the header badge refetches. */
  const [notificationInboxVersion, setNotificationInboxVersion] = useState(0);

  /** Vendor booking chat + support ticket threads (see `fetchCustomerMessageUnreadBreakdown`). */
  const [combinedMessageUnreadCount, setCombinedMessageUnreadCount] = useState(0);

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

  // ✅ FIX GAP-8.4: Active order tracking state (pharmacy widget; meals use MealOrderFooterToast in shell)
  const [activeOrderTracking, setActiveOrderTracking] = useState<any | null>(null);

  // Dynamic content from CMS
  const cachedHomeDynamic = readHomeSessionCache<CachedHomeDynamicContent>(phone, 'dynamic_content');
  const [dynamicBanners, setDynamicBanners] = useState<any[]>(
    () => cachedHomeDynamic?.dynamicBanners ?? []
  );
  const [dynamicMiddleBanners, setDynamicMiddleBanners] = useState<any[]>(
    () => cachedHomeDynamic?.dynamicMiddleBanners ?? []
  );
  const [dynamicLowerBanners, setDynamicLowerBanners] = useState<any[]>(
    () => cachedHomeDynamic?.dynamicLowerBanners ?? []
  );
  const [dynamicArticles, setDynamicArticles] = useState<any[]>(
    () => cachedHomeDynamic?.dynamicArticles ?? []
  );
  const [dynamicAnnouncements, setDynamicAnnouncements] = useState<any[]>(
    () => cachedHomeDynamic?.dynamicAnnouncements ?? []
  );
  const [adoptionStats, setAdoptionStats] = useState(() => {
    const cached = cachedHomeDynamic?.adoptionStats;
    return {
      adoptablePets: cached?.adoptablePets ?? 50,
      rehomingListings: cached?.rehomingListings ?? 20,
    };
  });
  const [ecommerceShopCategories, setEcommerceShopCategories] = useState<
    Array<{ id: string; name: string; image_url?: string; display_order?: number }>
  >([]);
  // Evaluated lazily so runtime-config.js (which runs before hydration) is already applied.
  const [customerCommerceEnabled] = useState<boolean>(() => isCustomerEcommerceEnabled());
  const [newHomeUi] = useState<boolean>(() => isNewHomeUiEnabled());

  useEffect(() => {
    if (!customerCommerceEnabled) return;
    let cancelled = false;
    const cancelIdle = scheduleIdleWork(() => {
      void (async () => {
        try {
          const res = await apiClient.get<{ categories?: Array<Record<string, unknown>> }>('/ecommerce/categories');
          const raw = res?.categories;
          if (cancelled || !Array.isArray(raw)) return;
          const mapped = mapApiCategoriesToShop(
            raw.map((c) => (c && typeof c === 'object' ? c : {}) as Record<string, unknown>)
          );
          if (!cancelled) setEcommerceShopCategories(mapped);
        } catch {
          if (!cancelled) setEcommerceShopCategories([]);
        }
      })();
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [customerCommerceEnabled]);

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
        const pathOnly = d.split('?')[0]?.split('#')[0] ?? d;
        if (pathOnly === '/shop') {
          onNavigate?.('shop', data);
          return;
        }
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

  const handleSearchSubmit = useCallback(
    (searchQuery: string) => {
      if (searchQuery?.trim()) {
        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      }
    },
    [router]
  );

  const handleSearchResultSelect = useCallback(
    (result: Parameters<NonNullable<React.ComponentProps<typeof EnhancedSearchBar>['onResultSelect']>>[0]) => {
      if (result.type === 'symptom') {
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
      if (result.type === 'staff' || result.type === 'vendor' || result.type === 'center') {
        const vendorId = String(result.id || '').trim();
        if (vendorId) {
          router.push(`/search?vendorId=${encodeURIComponent(vendorId)}`);
        } else {
          const serviceType = result.data?.serviceType || result.data?.services?.[0] || 'vet';
          handleNavigation(serviceType);
        }
        return;
      }
      if (result.type === 'service') {
        const sid = String(result.id || '').trim();
        if (sid) {
          router.push(`/booking/${encodeURIComponent(sid)}`);
        }
        return;
      }
      if (result.type === 'product') {
        if (!isCustomerEcommerceEnabled()) {
          toast.info('Shop is coming soon.');
          return;
        }
        handleNavigation('shop');
        return;
      }
      const category = result.category || result.data?.serviceType || result.data?.category || '';
      if (category) {
        const targetScreen = serviceNavigationMap[category.toLowerCase()] || 'services';
        handleNavigation(targetScreen);
      }
    },
    [handleNavigation, router]
  );

  const handleBannerClick = useCallback(
    async (banner: {
      ctaLink?: string;
      title?: string;
      subtitle?: string;
      metadata?: unknown;
      isInformational?: boolean;
      navTarget?: { kind: string; screen?: string; path?: string; data?: Record<string, unknown> };
    }) => {
      if (isBannerInformationalNonClickable(banner)) return;
      if (!banner?.ctaLink && !banner?.navTarget && !banner?.metadata) return;
      await navigateBannerCta(
        {
          ctaLink: banner.ctaLink,
          title: banner.title,
          subtitle: banner.subtitle,
          metadata: banner.metadata,
          navTarget: banner.navTarget as Parameters<typeof navigateBannerCta>[0]['navTarget'],
          returnScreen: 'home',
        },
        onNavigate,
        router
      );
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
    shop: 'Pet Products',
    marketplace: 'Pet Products',
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

  const persistLaunchTilesCache = (tiles: any[]) => {
    writeHomeSessionCache(phone, 'launch_tiles', { tiles: serializeLaunchTiles(tiles) });
  };

  // Load dynamic content (banners, articles, announcements)
  const loadDynamicContent = async (location: CustomerLocation) => {
    try {
      const { city: customerCity, state: customerState } = location;
      const bannerQuery = new URLSearchParams({ limit: '20' });
      if (customerState) bannerQuery.append('state', customerState);
      if (customerCity) bannerQuery.append('city', customerCity);
      const homeTopQuery = new URLSearchParams(bannerQuery);
      homeTopQuery.append('position', 'home_top');
      const homeMiddleQuery = new URLSearchParams(bannerQuery);
      homeMiddleQuery.append('position', 'home_middle');
      const homeLowerQuery = new URLSearchParams(bannerQuery);
      homeLowerQuery.append('position', 'home_lower');

      // Fetch all content in parallel with better error handling
      const [bannersResp, middleBannersResp, lowerBannersResp, articlesResp, announcementsResp, adoptionResp] =
        await Promise.allSettled([
          apiClient.get<any>(`/customer/banners?${homeTopQuery.toString()}`),
          apiClient.get<any>(`/customer/banners?${homeMiddleQuery.toString()}`),
          apiClient.get<any>(`/customer/banners?${homeLowerQuery.toString()}`),
          apiClient.getCustomerArticlesList<any>('/customer/articles?limit=3&featured=true'),
          apiClient.get<any>('/customer/announcements?limit=3'),
          apiClient.get<any>('/customer/adoption-stats'),
        ]);

      const dedupeBannerList = (rawList: unknown[]): any[] => {
        const seen = new Set<string>();
        return (rawList as unknown[]).filter((item) => {
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
        }) as any[];
      };

      let nextTopBanners: any[] | undefined;
      let nextMiddleBanners: any[] | undefined;
      let nextLowerBanners: any[] | undefined;
      let nextArticles: any[] | undefined;
      let nextAnnouncements: any[] | undefined;
      let nextAdoptionStats: { adoptablePets: number; rehomingListings: number } | undefined;

      // Handle banners (support alternate response shapes; dedupe by id)
      if (bannersResp.status === 'fulfilled') {
        const v = bannersResp.value as Record<string, unknown> | null | undefined;
        const rawList =
          (Array.isArray(v?.banners) && v.banners) ||
          (Array.isArray((v?.data as Record<string, unknown>)?.banners) &&
            (v!.data as { banners: unknown[] }).banners) ||
          [];
        if (rawList.length > 0) {
          nextTopBanners = dedupeBannerList(rawList);
          setDynamicBanners(nextTopBanners);
        }
      } else if (bannersResp.status === 'rejected') {
        const error = bannersResp.reason;
        // Only log non-CORS errors to reduce console noise
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load banners:', error.message);
        }
      }

      if (middleBannersResp.status === 'fulfilled') {
        const v = middleBannersResp.value as Record<string, unknown> | null | undefined;
        const rawList =
          (Array.isArray(v?.banners) && v.banners) ||
          (Array.isArray((v?.data as Record<string, unknown>)?.banners) &&
            (v!.data as { banners: unknown[] }).banners) ||
          [];
        const middleList = rawList.length > 0 ? dedupeBannerList(rawList) : [];
        nextMiddleBanners = middleList;
        setDynamicMiddleBanners(middleList);
      } else if (middleBannersResp.status === 'rejected') {
        const error = middleBannersResp.reason;
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load home_middle banners:', error.message);
        }
      }

      if (lowerBannersResp.status === 'fulfilled') {
        const v = lowerBannersResp.value as Record<string, unknown> | null | undefined;
        const rawList =
          (Array.isArray(v?.banners) && v.banners) ||
          (Array.isArray((v?.data as Record<string, unknown>)?.banners) &&
            (v!.data as { banners: unknown[] }).banners) ||
          [];
        const lowerList = rawList.length > 0 ? dedupeBannerList(rawList) : [];
        nextLowerBanners = lowerList;
        setDynamicLowerBanners(lowerList);
      } else if (lowerBannersResp.status === 'rejected') {
        const error = lowerBannersResp.reason;
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load home_lower banners:', error.message);
        }
      }

      // Handle articles
      if (articlesResp.status === 'fulfilled' && articlesResp.value?.articles?.length > 0) {
        nextArticles = articlesResp.value.articles;
        setDynamicArticles(nextArticles);
      } else if (articlesResp.status === 'rejected') {
        const error = articlesResp.reason;
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load articles:', error.message);
        }
      }

      // Handle announcements
      if (announcementsResp.status === 'fulfilled' && announcementsResp.value?.announcements?.length > 0) {
        nextAnnouncements = announcementsResp.value.announcements;
        setDynamicAnnouncements(nextAnnouncements);
      } else if (announcementsResp.status === 'rejected') {
        const error = announcementsResp.reason;
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load announcements:', error.message);
        }
      }

      // Handle adoption stats (home row is adoption-only; ignore legacy breeder counts from API)
      if (adoptionResp.status === 'fulfilled' && adoptionResp.value?.stats) {
        const s = adoptionResp.value.stats as Record<string, unknown>;
        setAdoptionStats((prev) => {
          const ap = Number(s.adoptablePets);
          const rh = Number(s.rehomingListings);
          nextAdoptionStats = {
            adoptablePets: Number.isFinite(ap) ? ap : prev.adoptablePets,
            rehomingListings: Number.isFinite(rh) ? rh : prev.rehomingListings,
          };
          return nextAdoptionStats;
        });
      } else if (adoptionResp.status === 'rejected') {
        const error = adoptionResp.reason;
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load adoption stats:', error.message);
        }
      }

      const previousDynamic =
        readHomeSessionCache<CachedHomeDynamicContent>(phone, 'dynamic_content') ?? {};
      writeHomeSessionCache(phone, 'dynamic_content', {
        ...previousDynamic,
        ...(nextTopBanners?.length ? { dynamicBanners: nextTopBanners } : {}),
        ...(nextMiddleBanners ? { dynamicMiddleBanners: nextMiddleBanners } : {}),
        ...(nextLowerBanners ? { dynamicLowerBanners: nextLowerBanners } : {}),
        ...(nextArticles?.length ? { dynamicArticles: nextArticles } : {}),
        ...(nextAnnouncements?.length ? { dynamicAnnouncements: nextAnnouncements } : {}),
        ...(nextAdoptionStats ? { adoptionStats: nextAdoptionStats } : {}),
      });

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
    const hadCachedServices = Boolean(readHomeSessionCache<CachedHomeServices>(phone, 'services'));
    try {
      if (!hadCachedServices) setServicesLoading(true);

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
      const productRequest = isCustomerEcommerceEnabled()
        ? apiClient.get<any>('/products?featured=true&limit=3')
        : Promise.resolve({ products: [] });
      const [groomingResult, vetResult, productsResult] = await Promise.allSettled([
        apiClient.get<any>(
          `/customer/discover-services?category=grooming&serviceStyle=at_center${locationParams}${phoneParam}`
        ),
        apiClient.get<any>(
          `/customer/discover-services?category=vet&serviceStyle=at_center${locationParams}${phoneParam}`
        ),
        productRequest,
      ]);

      let nextGrooming: any[] | undefined;
      let nextVet: any[] | undefined;
      let nextHotDeals: any[] | undefined;

      // Handle grooming services
      if (groomingResult.status === 'fulfilled') {
        const groomingResp = groomingResult.value;
        if (groomingResp?.services || groomingResp?.vendors) {
          const services = groomingResp.services || groomingResp.vendors || [];
          const mappedGrooming = services.slice(0, 3).map((s: any) => ({
            id: s.id || s.vendorServiceId,
            title: s.serviceName || s.name || 'Grooming Service',
            price: `₹${s.price || s.basePrice || 999}`,
            rating: s.rating != null ? Number(s.rating) : undefined,
            reviewCount: Number(s.reviewCount ?? s.review_count ?? 0) || 0,
            serviceStyle: s.serviceStyle || 'at_center',
            description: s.description || 'Professional grooming service',
            vendorId: s.vendorId
          }));
          if (mappedGrooming.length > 0) {
            nextGrooming = mappedGrooming;
            setGroomingServices(mappedGrooming);
          }
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
          if (mappedVet.length > 0) {
            nextVet = mappedVet;
            setVetServicesData(mappedVet);
          }
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
            const mappedDeals = featuredProducts.slice(0, 3).map((p: any) => {
              const rc = Number(p.reviewCount ?? p.review_count ?? 0) || 0;
              const rt = p.rating != null && p.rating !== '' ? Number(p.rating) : NaN;
              const salePrice = Number(p.salePrice ?? p.price);
              const priceValue = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : 999;
              const images = p.images as string[] | undefined;
              return {
                id: p.id,
                title: p.name || 'Pet Products',
                price: `₹${priceValue}`,
                priceValue,
                originalPrice: p.originalPrice ? `₹${p.originalPrice}` : null,
                discount: p.discountPercent ? `${p.discountPercent}% OFF` : null,
                iconType: 'product',
                rating: rc > 0 && Number.isFinite(rt) && rt > 0 ? rt : undefined,
                reviewCount: rc,
                image: Array.isArray(images) && images[0] ? String(images[0]) : undefined,
              };
            });
            nextHotDeals = mappedDeals;
            setHotDeals(mappedDeals);
          } else {
            nextHotDeals = [];
            setHotDeals([]);
          }
        } else {
          nextHotDeals = [];
          setHotDeals([]);
        }
      } else if (productsResult.status === 'rejected') {
        nextHotDeals = [];
        setHotDeals([]);
        const error = productsResult.reason;
        if (error?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn('Failed to load products:', error.message);
        }
      }

      if (nextGrooming || nextVet || nextHotDeals) {
        const previousServices = readHomeSessionCache<CachedHomeServices>(phone, 'services') ?? {};
        writeHomeSessionCache(phone, 'services', {
          ...previousServices,
          ...(nextGrooming?.length ? { groomingServices: nextGrooming } : {}),
          ...(nextVet?.length ? { vetServicesData: nextVet } : {}),
          ...(nextHotDeals ? { hotDeals: nextHotDeals } : {}),
        });
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
  const runServiceLaunchConfig = async (location: CustomerLocation, resetTiles: boolean) => {
    try {
      if (resetTiles) {
        setServiceLaunchTilesResolved(false);
      }

      const customerCity = location.city;
      const customerState = location.state;

      const params = new URLSearchParams();
      if (customerState) params.append('state', customerState);
      if (customerCity) params.append('city', customerCity);

      const configResponse = await apiClient.get(`/config/service-launch/customer?${params.toString()}`).catch(() => null);

      const applyLaunchTiles = (tiles: any[]) => {
        setFilteredQuickServices(tiles);
        setServiceLaunchTilesResolved(true);
        persistLaunchTilesCache(tiles);
      };

      if (configResponse && (configResponse as any).success) {
        const { services, buttons } = configResponse as any;

        if (buttons) {
          setDashboardConfig({ buttons });
        }

        const visibleLaunch = (services?.visible || []) as any[];
        const comingSoonLaunch = (services?.comingSoon || []) as any[];
        const hiddenLaunch = (services?.hidden || []) as any[];
        const launchCatalog = (services?.catalog || []) as any[];

        const launchTiles = buildCustomerLaunchTiles({
          tilePool: [...sourceQuickServices, ...quickServices],
          catalog: launchCatalog.map((c: any) => ({
            serviceId: c.serviceId || '',
            displayName: c.displayName,
            effectiveStatus: c.effectiveStatus,
          })),
          visible: visibleLaunch,
          comingSoon: comingSoonLaunch,
          hidden: hiddenLaunch,
          includeHiddenAsComingSoon: false,
          dedupeByLaunchServiceId: false,
        });

        if (launchTiles.length > 0) {
          applyLaunchTiles(launchTiles);
        } else {
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
                  screens.forEach((screen) => blockedServiceIds.add(screen));
                }
              }
            });
            (services.comingSoon || []).forEach((svc: any) => {
              const svcId = (svc.serviceId || '').toLowerCase();
              comingSoonCategoryIds.add(svcId);
              for (const [key, screens] of Object.entries(serviceScreenMap)) {
                if (svcId.includes(key) || key.includes(svcId)) {
                  screens.forEach((screen) => comingSoonServiceIds.add(screen));
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
                    screens.forEach((screen) => blockedServiceIds.add(screen));
                  }
                }
              } else if (btn.launchPhase === 'coming_soon') {
                comingSoonCategoryIds.add(btnId);
                for (const [key, screens] of Object.entries(serviceScreenMap)) {
                  if (btnId.includes(key) || key.includes(btnId)) {
                    screens.forEach((screen) => comingSoonServiceIds.add(screen));
                  }
                }
              }
            });
          }

          if (
            blockedCategoryIds.size > 0 ||
            comingSoonCategoryIds.size > 0 ||
            blockedServiceIds.size > 0 ||
            comingSoonServiceIds.size > 0
          ) {
            const filtered = sourceQuickServices.filter((service: any) => {
              const catId = (service.categoryId || '').toLowerCase();
              const screen = (service.screen || '').toLowerCase();
              return (
                !blockedCategoryIds.has(catId) &&
                !blockedCategoryIds.has(screen) &&
                !blockedServiceIds.has(screen)
              );
            });
            const withComingSoon = filtered.map((service: any) => ({
              ...service,
              isComingSoon:
                comingSoonCategoryIds.has((service.categoryId || '').toLowerCase()) ||
                comingSoonServiceIds.has(service.screen),
            }));
            applyLaunchTiles(withComingSoon);
          } else {
            applyLaunchTiles(sourceQuickServices);
          }
        }
      }

      if (!configResponse || !(configResponse as any).success) {
        applyLaunchTiles(sourceQuickServices);
      }
    } catch (error) {
      console.error('Error loading service launch config:', error);
      setFilteredQuickServices(sourceQuickServices);
      setServiceLaunchTilesResolved(true);
      persistLaunchTilesCache(sourceQuickServices);
    }
  };

  useEffect(() => {
    if (!phone) {
      setFilteredQuickServices(sourceQuickServices);
      setServiceLaunchTilesResolved(true);
      return;
    }

    let cancelled = false;

    const bootstrapHome = async () => {
      const { profile: cachedProfile, pets: cachedPets, refreshPromise } =
        ensureCustomerProfileAndPets(phone, { force: refreshKey > 0 });
      const locationPromise = resolveCustomerLocation(phone);
      const resetLaunchTiles = refreshKey > 0;

      const applyProfilePets = (result: {
        profile: Record<string, unknown> | null;
        pets: Pet[];
      }) => {
        if (cancelled) return;
        const profile = result.profile;
        if (profile) {
          setUserData((prev) => ({
            ...prev,
            name: String(profile.firstName || profile.name || 'User'),
            phone,
            journeyType: String(profile.journeyType || ''),
          }));
          setUserProfilePhoto(
            String(profile.photo || profile.profile_photo_url || profile.profilePhoto || '')
          );
        }
        if (result.pets.length > 0) {
          setUserData((prev) => ({ ...prev, pets: result.pets }));
          setSelectedPet((prev) => prev ?? result.pets[0]);
        }
        setPetsLoading(false);
      };

      applyProfilePets({ profile: cachedProfile, pets: cachedPets });

      await Promise.allSettled([
        refreshPromise.then(applyProfilePets),
        loadServicesFromAPI(),
        (async () => {
          const location = await locationPromise;
          if (cancelled) return;
          const dynamic = await refreshHomeDynamicContent(phone, location);
          if (cancelled) return;
          if (dynamic.dynamicBanners?.length) setDynamicBanners(dynamic.dynamicBanners);
          if (dynamic.dynamicMiddleBanners?.length) setDynamicMiddleBanners(dynamic.dynamicMiddleBanners);
          if (dynamic.dynamicLowerBanners?.length) setDynamicLowerBanners(dynamic.dynamicLowerBanners);
          if (dynamic.dynamicArticles?.length) setDynamicArticles(dynamic.dynamicArticles);
          if (dynamic.dynamicAnnouncements?.length) setDynamicAnnouncements(dynamic.dynamicAnnouncements);
          if (dynamic.adoptionStats) setAdoptionStats(dynamic.adoptionStats);
          await runServiceLaunchConfig(location, resetLaunchTiles);
        })(),
      ]);
    };

    void bootstrapHome();
    return () => {
      cancelled = true;
    };
  }, [phone, refreshKey, quickServiceTiles.length]);

  /** Map API + defaults for hero; dedupe defaults by CTA vertical; icons from CTA / metadata */
  const homeCarouselBanners = useMemo(
    () => buildHomeTopCarouselBanners(dynamicBanners),
    [dynamicBanners]
  );

  /** Featured Services wide slot — home_middle only; not merged into hero or ForYouSection */
  const featuredMiddleCarouselBanners = useMemo(() => {
    if (dynamicMiddleBanners.length === 0) return [];
    return dynamicMiddleBanners.map((b: any) => {
      const rawCta = String(b.ctaLink ?? b.cta_link ?? '').trim();
      const screenFromSlash =
        rawCta.startsWith('/') && !isVendorBannerCta(rawCta) ? customerPathToScreen(rawCta) : null;
      const ctaLink = screenFromSlash ?? rawCta;
      const explicitComingSoonFalse = b.comingSoon === false || b.coming_soon === false;
      const comingSoon = explicitComingSoonFalse ? false : Boolean(b.comingSoon || b.coming_soon);
      const isInformational = parseBannerInformationalFromMetadata(b.metadata);
      return {
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: b.imageUrl || b.image_url || '',
        gradientFrom: b.gradientFrom || b.gradient_from || '#9333ea',
        gradientTo: b.gradientTo || b.gradient_to || '#ec4899',
        Icon: iconForCustomerHomeApiBanner(b),
        ctaText: b.ctaText || b.cta_text || 'Learn More',
        ctaLink,
        navTarget: b.navTarget ?? null,
        metadata: b.metadata ?? null,
        comingSoon,
        isInformational,
      };
    });
  }, [dynamicMiddleBanners]);

  const featuredLowerBanners = useMemo(() => {
    if (dynamicLowerBanners.length === 0) return [];
    return dynamicLowerBanners.map((b: any) => {
      const rawCta = String(b.ctaLink ?? b.cta_link ?? '').trim();
      const screenFromSlash =
        rawCta.startsWith('/') && !isVendorBannerCta(rawCta) ? customerPathToScreen(rawCta) : null;
      const ctaLink = screenFromSlash ?? rawCta;
      const explicitComingSoonFalse = b.comingSoon === false || b.coming_soon === false;
      const comingSoon = explicitComingSoonFalse ? false : Boolean(b.comingSoon || b.coming_soon);
      const isInformational = parseBannerInformationalFromMetadata(b.metadata);
      return {
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: b.imageUrl || b.image_url || '',
        gradientFrom: normalizeHexColor(b.gradientFrom || b.gradient_from, '#6366f1'),
        gradientTo: normalizeHexColor(b.gradientTo || b.gradient_to, '#9333ea'),
        Icon: iconForCustomerHomeApiBanner(b),
        ctaText: b.ctaText || b.cta_text || 'Learn More',
        ctaLink,
        navTarget: b.navTarget ?? null,
        metadata: b.metadata ?? null,
        comingSoon,
        isInformational,
      };
    });
  }, [dynamicLowerBanners]);

  const homeBannerCount = homeCarouselBanners.length;
  const middleBannerCount = featuredMiddleCarouselBanners.length;

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

  useEffect(() => {
    setCurrentMiddleBanner((prev) =>
      middleBannerCount > 0 ? prev % middleBannerCount : 0
    );
  }, [middleBannerCount]);

  useEffect(() => {
    if (middleBannerCount <= 1) return undefined;
    const id = window.setInterval(() => {
      setCurrentMiddleBanner((prev) => (prev + 1) % middleBannerCount);
    }, 4000);
    return () => window.clearInterval(id);
  }, [middleBannerCount]);

  // Load active bookings with tracking for "Attention" section (deferred — not needed for first paint)
  useEffect(() => {
    if (!phone) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let incomingCallInterval: ReturnType<typeof setInterval> | undefined;

    const runPollingTick = () => {
      if (cancelled || document.hidden) return;
      loadActiveBookings();
      checkPendingReviews();
      checkUpcomingCalls();
      checkActiveOrderTracking();
      checkIncomingCalls();
    };

    const runIncomingCallTick = () => {
      if (cancelled || document.hidden) return;
      checkIncomingCalls();
    };

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(runPollingTick, 15000);
      incomingCallInterval = setInterval(runIncomingCallTick, 5000);
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = undefined;
      }
      if (incomingCallInterval) {
        clearInterval(incomingCallInterval);
        incomingCallInterval = undefined;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        runPollingTick();
        startPolling();
      }
    };

    let cancelDeferred: (() => void) | undefined;

    void getHomeBootstrapReady().then(() => {
      if (cancelled) return;
      cancelDeferred = scheduleHomeDeferredWork({
        loadBookings: () => {
          if (cancelled) return;
          apiClient
            .get<any>(`/customer/by-phone?phone=${encodeURIComponent(phone)}`)
            .then((r) => {
              if (r?.customer?.id) setCustomerId(r.customer.id);
            })
            .catch(() => {});
          loadActiveBookings();
          checkPendingReviews();
          checkUpcomingCalls();
          checkActiveOrderTracking();
          checkIncomingCalls();
        },
      });
      if (!document.hidden) {
        runPollingTick();
        startPolling();
      }
      document.addEventListener('visibilitychange', onVisibilityChange);
    });

    return () => {
      cancelled = true;
      cancelDeferred?.();
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [phone, refreshKey]);

  useEffect(() => {
    const clean = (phone || '').replace(/[^0-9]/g, '');
    if (clean.length < 10) {
      setNotificationUnreadCount(0);
      return;
    }
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const fetchUnread = async () => {
      if (document.hidden) return;
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

    const startInterval = () => {
      if (interval) return;
      interval = setInterval(fetchUnread, 90_000);
    };

    const stopInterval = () => {
      if (interval) {
        clearInterval(interval);
        interval = undefined;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopInterval();
      } else {
        void fetchUnread();
        startInterval();
      }
    };

    let cancelDeferred: (() => void) | undefined;

    void getHomeBootstrapReady().then(() => {
      if (cancelled) return;
      cancelDeferred = scheduleHomeDeferredWork({ loadNotifications: () => void fetchUnread() });
      if (!document.hidden) {
        startInterval();
      }
      document.addEventListener('visibilitychange', onVisibilityChange);
    });

    return () => {
      cancelled = true;
      cancelDeferred?.();
      stopInterval();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [phone, refreshKey, notificationInboxVersion]);

  useEffect(() => {
    const clean = (phone || '').replace(/[^0-9]/g, '');
    if (clean.length < 10) {
      setCombinedMessageUnreadCount(0);
      return;
    }
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const b = await fetchCustomerMessageUnreadBreakdown({
          customerId: customerId || undefined,
          phoneForApi: phone,
        });
        if (!cancelled) setCombinedMessageUnreadCount(b.total);
      } catch {
        if (!cancelled) setCombinedMessageUnreadCount(0);
      }
    };
    const cancelIdle = scheduleIdleWork(() => {
      void fetchUnread();
    });
    const interval = setInterval(fetchUnread, 90_000);
    return () => {
      cancelled = true;
      cancelIdle();
      clearInterval(interval);
    };
  }, [phone, refreshKey, customerId, messagesInboxVersion]);

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
    try {
      const pharmacyResponse = await apiClient.get<any>(
        `/customer/${phone}/orders/pharmacy/active`
      );
      pharmacyOrders = Array.isArray(pharmacyResponse?.orders) ? pharmacyResponse.orders : [];
    } catch (e) {
      console.warn('Pharmacy active orders check failed (non-fatal):', (e as Error)?.message);
    }
    const activeOrders = pharmacyOrders.filter((order: any) => {
      if (!order) return false;
      return (
        order.status !== 'delivered' &&
        order.status !== 'cancelled' &&
        order.status !== 'refunded' &&
        (order.trackingStatus ??
          order.tracking_status ??
          ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'].includes(order.status))
      );
    });
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
    const hadCachedPets = readCachedPetsFromStorage().length > 0;
    if (!hadCachedPets) setPetsLoading(true);
    try {
      const { refreshPromise } = ensureCustomerProfileAndPets(phone);
      const result = await refreshPromise;
      const profile = result.profile;
      if (profile) {
        setUserData((prev) => ({
          ...prev,
          name: String(profile.firstName || profile.name || 'User'),
          phone,
          journeyType: String(profile.journeyType || ''),
        }));
        setUserProfilePhoto(String(profile.photo || profile.profile_photo_url || ''));
      } else {
        const cachedProfile = readCachedProfileName(phone);
        setUserData((prev) => ({ ...prev, name: cachedProfile.name, phone }));
        if (cachedProfile.photo) setUserProfilePhoto(cachedProfile.photo);
      }
      if (result.pets.length > 0) {
        setUserData((prev) => ({ ...prev, pets: result.pets }));
        setSelectedPet((prev) => prev ?? result.pets[0]);
      }
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.error('Error loading user data:', err.message);
      }
    } finally {
      setPetsLoading(false);
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

  const banners = homeCarouselBanners;




  // Use API data or fallback to defaults
  const displayGroomingServices = groomingServices.length > 0 ? groomingServices : defaultGroomingServices;
  const displayVetServices = vetServicesData.length > 0 ? vetServicesData : defaultVetServices;
  // ✅ FIX: Remove dummy articles - show only admin-created articles
  const articles = dynamicArticles.map((a: any) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    category: a.category || 'Tips',
    readTime: a.readTime || '5 min',
    excerpt: a.excerpt,
    featured: a.featured,
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
      {!hideHeaderFooter && newHomeUi ? (
        <CustomerHomePageHeader
          userName={userData.name}
          userProfilePhoto={userProfilePhoto}
          phone={phone}
          onProfileClick={onProfileClick}
          onNavigate={handleNavigation}
          onOpenNotifications={() => setNotificationModalOpen(true)}
          notificationUnreadCount={notificationUnreadCount}
          combinedMessageUnreadCount={combinedMessageUnreadCount}
          pets={userData.pets}
          selectedPet={selectedPet}
          onSelectPet={setSelectedPet}
          onPetClick={onPetClick}
          onAddPet={handleAddPet}
          petsLoading={petsLoading}
        />
      ) : !hideHeaderFooter ? (
        <div className="bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] cw-header-safe-top cw-header-safe-x pb-3 sm:pb-4">
          {/* Top Row - User Info & Actions */}
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                onClick={() => onProfileClick && onProfileClick()}
                className="w-11 h-11 shrink-0 bg-white rounded-full flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-white/60 transition-all shadow-md"
              >
                {userProfilePhoto ? (
                  <PresignableImage src={userProfilePhoto} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-base font-bold">
                    {userData.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 items-center gap-1">
                  <h1 className="min-w-0 truncate text-white text-lg font-bold tracking-tight">
                    Hi, {userData.name}!
                  </h1>
                  <span className="shrink-0 text-base" role="img" aria-label="wave">👋</span>
                </div>
                <p className="truncate text-white/65 text-xs font-normal tracking-wide">
                  Explore Warmpawz Services
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleNavigation('booking-messages')}
                className="relative w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                aria-label="Messages"
              >
                <MessageSquare className="w-[18px] h-[18px] text-white" strokeWidth={2} />
                {combinedMessageUnreadCount > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {combinedMessageUnreadCount > 99 ? '99+' : combinedMessageUnreadCount}
                  </span>
                ) : null}
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
            </div>
          </div>

          {/* Pet Selector - Compact horizontal layout */}
          {petsLoading && userData.pets.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span className="text-white/80 text-xs">Loading pets...</span>
            </div>
          ) : userData.pets.length > 0 ? (
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
      ) : null}

      {/* Main Scrollable Content */}
      <div
        className={
          hideHeaderFooter
            ? 'bg-white pt-4 pb-4'
            : newHomeUi
              ? `${HOME_CONTENT_SHELL_CLASS} pb-6`
              : 'bg-white rounded-t-[24px] -mt-3 pt-4 pb-6'
        }
      >
        {/* ✅ Attention Section - Active Bookings with Tracking (legacy layout only) */}
        {!newHomeUi && activeBookings.length > 0 && (
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

        {newHomeUi ? (
          <CustomerHomePageContent
            customerId={customerId || undefined}
            onSearch={handleSearchSubmit}
            onSearchResultSelect={handleSearchResultSelect}
            services={
              (serviceLaunchTilesResolved ? filteredQuickServices : sourceQuickServices) as QuickServiceTile[]
            }
            serviceLabelOverride={SERVICE_LABEL_OVERRIDE}
            onNavigate={handleNavigation}
            homeCarouselBanners={homeCarouselBanners}
            activeBookings={activeBookings}
            onViewBooking={onViewBooking}
            phone={phone}
            hotDeals={hotDeals}
            ecommerceShopCategories={ecommerceShopCategories}
            customerCommerceEnabled={customerCommerceEnabled}
            featuredLowerBanners={featuredLowerBanners}
            whatsNewAnnouncements={whatsNewAnnouncements}
            onWhatsNewSeeAll={() => handleNavigation('whats-new')}
            onWhatsNewRowPress={(a) => {
              if (a.announcementType === 'emergency') return;
              if (a.id === 'ai' || (a.announcementType === 'feature' && !a.ctaLink?.trim())) {
                setShowAIChat(true);
                return;
              }
              navigateWhatsNewFromFullPage(router, a, 'row');
            }}
            onWhatsNewSosPress={(a) => {
              if (a.comingSoon && a.announcementType === 'emergency') return;
              handleNavigation(a.ctaLink?.trim() || 'ambulance');
            }}
            adoptionStats={adoptionStats}
            petCareArticles={articles}
            onPetCareArticlesSeeAll={() => handleNavigation('articles')}
            onPetCareArticleClick={(article) => {
              if (article.slug) {
                router.push(`/articles?slug=${encodeURIComponent(article.slug)}`);
              } else if (article.url) {
                window.open(article.url, '_blank');
              } else {
                handleNavigation('article-detail', {
                  articleId: article.id,
                  article: { id: article.id, slug: article.slug },
                });
              }
            }}
          />
        ) : (
        <>
        {/* Universal search bar - legacy layout */}
        <div className="px-4 mb-3">
          <EnhancedSearchBar
            placeholder="Search services, products, vets, groomers..."
            customerId={customerId || undefined}
            onSearch={handleSearchSubmit}
            onResultSelect={handleSearchResultSelect}
          />
        </div>
        </>
        )}

        {!newHomeUi ? (
        <>
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
                category: (problem as any)?.category,
                problem: problem,
              });
            }}
            showTrending={false}
            compact={true}
          />
        </div>

        {/* Hero Banner Carousel */}
        <div className="px-4 mb-4">
          <div
            className="relative h-28 rounded-2xl overflow-hidden shadow-md"
            onTouchStart={(e) => {
              heroBannerTouchStartX.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              const start = heroBannerTouchStartX.current;
              heroBannerTouchStartX.current = null;
              if (start == null || homeBannerCount <= 1) return;
              const end = e.changedTouches[0]?.clientX ?? start;
              const dx = end - start;
              if (dx < -48) {
                setCurrentBanner((prev) => (prev + 1) % homeBannerCount);
              } else if (dx > 48) {
                setCurrentBanner((prev) => (prev - 1 + homeBannerCount) % homeBannerCount);
              }
            }}
          >
            {banners.map((banner, index) => {
              const heroComingSoon = Boolean((banner as { comingSoon?: boolean }).comingSoon);
              const heroNonClickable =
                heroComingSoon || Boolean((banner as { isInformational?: boolean }).isInformational);
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
                    className={`h-full flex items-center justify-between px-4 ${heroNonClickable ? 'opacity-90 pointer-events-none select-none' : ''}`}
                  >
                    <div>
                      <h2 className="text-white text-base font-bold mb-0.5">{banner.title}</h2>
                      <p className="text-white/90 text-xs mb-2">{banner.subtitle}</p>
                      {heroNonClickable ? (
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
                            banner.ctaLink && void handleBannerClick(banner);
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
        </>
        ) : null}

        {/* Shop — gated until customerEcommerceEnabled / NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED */}
        {!newHomeUi ? (
        <div className="mb-4">
          <div className="flex items-center gap-3 px-4 mb-2">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#FF8C42]" />
              <h2 className="text-gray-900 text-sm font-semibold">Shop</h2>
            </div>
            <div className="flex-1 h-px bg-gray-100" aria-hidden />
            {customerCommerceEnabled ? (
              <button
                type="button"
                onClick={() => handleNavigation('shop')}
                className="text-[11px] text-[#FF8C42] font-medium shrink-0"
              >
                View all
              </button>
            ) : null}
          </div>
          <ShopCategoryGrid
            embedded
            disabled={!customerCommerceEnabled}
            categories={
              ecommerceShopCategories.length > 0
                ? ecommerceShopCategories
                : STATIC_SHOP_DISPLAY_CATEGORIES
            }
            onSelectCategory={
              customerCommerceEnabled
                ? (id) => handleNavigation('shop', { category: id })
                : () => {}
            }
          />
        </div>
        ) : null}

        {!newHomeUi ? (
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
        ) : null}

        {/* Spotlight: Grooming Services */}
        {!newHomeUi ? (
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
                    {hasRatings(normalizeRatingCount(service.reviewCount)) &&
                    service.rating != null &&
                    Number(service.rating) > 0 ? (
                      <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-full">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs font-medium">
                          {Number(service.rating).toFixed(1)}
                        </span>
                      </div>
                    ) : null}
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
        ) : null}

        {!newHomeUi ? (
        <>
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
                handleNavigation('vet-tele-consultation', { startStep: 'scheduled' });
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
              <p className="text-blue-600 font-medium text-sm pointer-events-none">₹{teleMinPrice ?? 299}</p>
            </button>
            <button
              onClick={() => handleNavigation('vet-home-visit', { startStep: 'home' })}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-100 text-center hover:shadow-lg transition-shadow"
            >
              <div className="w-10 h-10 mx-auto mb-2 bg-green-100 rounded-xl flex items-center justify-center">
                <HomeIcon className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-xs font-semibold text-gray-800 mb-1">Vet at Home</h3>
              <p className="text-blue-600 font-medium text-sm">₹{vetHomeMinPrice ?? 599}</p>
            </button>
            <button
              onClick={() => handleNavigation('vet-clinic-list', { startStep: 'home' })}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-100 text-center hover:shadow-lg transition-shadow"
            >
              <div className="w-10 h-10 mx-auto mb-2 bg-purple-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-xs font-semibold text-gray-800 mb-1">Clinic Visit</h3>
              <p className="text-blue-600 font-medium text-sm">₹{clinicMinPrice ?? 399}</p>
            </button>
          </div>
        </div>
        </>
        ) : null}

        {!newHomeUi ? (
        <div className="mb-6">
          <div className="px-6 mb-4">
            <h2 className="text-black font-semibold">Special Offers</h2>
          </div>
          <div className="px-6">
            <PromotionBanner service="all" maxPromotions={3} onNavigate={handleNavigation} />
          </div>
        </div>
        ) : null}

        {/* Featured Services Mix - Square Boxes */}
        {!newHomeUi ? (
        <div className="mb-6">
          <div className="px-6 mb-4">
            <h2 className="text-black font-semibold mb-1">Featured Services</h2>
            <p className="text-xs text-gray-600">Popular choices for your pet</p>
          </div>
          <div className="px-6 grid grid-cols-2 gap-3">
            {/* Large Featured Item - Spans 2 columns: CMS home_middle carousel or static Complete Health Package */}
            {featuredMiddleCarouselBanners.length > 0 ? (
              <div
                className="col-span-2 relative min-h-[188px] rounded-3xl overflow-hidden shadow-md text-white"
                onTouchStart={(e) => {
                  middleBannerTouchStartX.current = e.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={(e) => {
                  const start = middleBannerTouchStartX.current;
                  middleBannerTouchStartX.current = null;
                  if (start == null || middleBannerCount <= 1) return;
                  const end = e.changedTouches[0]?.clientX ?? start;
                  const dx = end - start;
                  if (dx < -48) {
                    setCurrentMiddleBanner((prev) => (prev + 1) % middleBannerCount);
                  } else if (dx > 48) {
                    setCurrentMiddleBanner((prev) => (prev - 1 + middleBannerCount) % middleBannerCount);
                  }
                }}
              >
                {featuredMiddleCarouselBanners.map((banner, index) => {
                  const slotComingSoon = Boolean((banner as { comingSoon?: boolean }).comingSoon);
                  const slotNonClickable =
                    slotComingSoon || Boolean((banner as { isInformational?: boolean }).isInformational);
                  return (
                    <div
                      key={String(banner.id ?? index)}
                      className={`absolute inset-0 transition-opacity duration-500 ${
                        currentMiddleBanner === index
                          ? 'z-[1] opacity-100'
                          : 'z-0 opacity-0 pointer-events-none'
                      }`}
                      style={{
                        backgroundImage: (banner as { imageUrl?: string }).imageUrl
                          ? `linear-gradient(135deg, rgba(17,24,39,0.75) 0%, rgba(17,24,39,0.45) 100%), url(${(banner as { imageUrl?: string }).imageUrl})`
                          : `linear-gradient(135deg, ${banner.gradientFrom} 0%, ${banner.gradientTo} 100%)`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                      aria-hidden={currentMiddleBanner !== index}
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 pointer-events-none" />
                      <div
                        className={`relative z-10 h-full min-h-[188px] p-6 flex flex-col justify-between ${
                          slotNonClickable ? 'opacity-90 pointer-events-none select-none' : ''
                        }`}
                      >
                        {slotComingSoon && (
                          <span
                            className="absolute top-4 right-4 z-[1] text-[7px] font-bold uppercase bg-amber-500 text-white px-1 rounded-full leading-none py-0.5 shadow-sm"
                            aria-label="Coming soon"
                          >
                            SOON
                          </span>
                        )}
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <div className="min-w-0">
                            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">FEATURED</span>
                            <h3 className="text-lg font-bold mt-2 line-clamp-2">{banner.title}</h3>
                            {banner.subtitle ? (
                              <p className="text-sm text-white/90 mt-1 line-clamp-2">{banner.subtitle}</p>
                            ) : null}
                          </div>
                          {(banner as { imageUrl?: string }).imageUrl ? null : (
                            <banner.Icon className="w-8 h-8 shrink-0 text-white/95" aria-hidden />
                          )}
                        </div>
                        <div className="flex items-end justify-end pt-2">
                          {slotNonClickable ? (
                            <span
                              role="button"
                              aria-disabled
                              tabIndex={-1}
                              className="inline-block bg-white/85 text-[#FF8C42]/70 px-4 py-2 rounded-full text-sm font-semibold cursor-not-allowed"
                            >
                              {banner.ctaText || 'Learn More'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="bg-white text-[#FF8C42] px-4 py-2 rounded-full text-sm font-semibold shadow-sm"
                              onClick={() => {
                                if (banner.id) {
                                  apiClient
                                    .post(`/banners/${banner.id}/click`, { source: 'home_middle_featured' })
                                    .catch(() => {});
                                }
                                banner.ctaLink && void handleBannerClick(banner);
                              }}
                            >
                              {banner.ctaText || 'Learn More'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {middleBannerCount > 1 ? (
                  <div
                    className="absolute bottom-3 left-0 right-0 z-[2] flex justify-center gap-2"
                    role="tablist"
                    aria-label="Featured service offers"
                  >
                    {featuredMiddleCarouselBanners.map((banner, index) => (
                      <button
                        key={String(banner.id ?? index)}
                        type="button"
                        role="tab"
                        aria-selected={currentMiddleBanner === index}
                        aria-label={`Featured offer ${index + 1} of ${middleBannerCount}`}
                        className={`h-1.5 min-w-[6px] rounded-full transition-all ${
                          currentMiddleBanner === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'
                        }`}
                        onClick={() => setCurrentMiddleBanner(index)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
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
                        if (url) {
                          console.log('[CustomerHomeComplete] Complete Health Package Book Now →', url);
                          router.push(url);
                          return;
                        }
                        handleNavigation('vet-tele-consultation', { startStep: 'scheduled' });
                      }}
                      className="bg-white text-purple-600 px-4 py-2 rounded-full text-sm font-semibold"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              </div>
            )}

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
        ) : null}

        {/* What's New Section — legacy layout only (new home uses CustomerHomePageContent) */}
        {!newHomeUi ? (
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
        ) : null}

        {/* Discover more: For you & Trending - lower on page so landing stays clean */}
        {!newHomeUi ? (
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
              onProblemSelect={(item: TrendingProblem) => {
                const roleId = (item.category || 'veterinarian').trim();
                const category = trendingRoleIdToCategorySlug(roleId);
                handleNavigation('services_by_problem', {
                  problemId: item.problemId,
                  problemTitle: item.title,
                  roleId,
                  category,
                  problem: {
                    problemId: item.problemId,
                    title: item.title,
                    name: item.title,
                    roleId,
                    category,
                  },
                });
              }}
              limit={5}
            />
          </div>
        </div>
        ) : null}

        {!newHomeUi ? (
        <>
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
                      <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium capitalize">
                        {getCustomerArticleCategoryLabel(article.category)}
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

        <MoreServicesSection onNavigate={handleNavigation} />
        </>
        ) : null}

        {!newHomeUi && featuredLowerBanners.length > 0 ? (
          <div className="px-6 mb-6 space-y-4">
            {featuredLowerBanners.map((banner, index) => {
              const slotComingSoon = Boolean((banner as { comingSoon?: boolean }).comingSoon);
              const slotNonClickable =
                slotComingSoon || Boolean((banner as { isInformational?: boolean }).isInformational);
              return (
                <div
                  key={String(banner.id ?? index)}
                  className="rounded-3xl p-6 text-white relative overflow-hidden"
                  style={{
                    backgroundImage: banner.imageUrl
                      ? `linear-gradient(135deg, rgba(17,24,39,0.75) 0%, rgba(17,24,39,0.45) 100%), url(${banner.imageUrl})`
                      : `linear-gradient(135deg, ${banner.gradientFrom} 0%, ${banner.gradientTo} 100%)`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-bold text-lg mb-2 line-clamp-2">{banner.title}</h2>
                      {banner.subtitle ? (
                        <p className="text-sm text-white/90 mb-4 line-clamp-3">{banner.subtitle}</p>
                      ) : null}
                      {slotNonClickable ? (
                        <span className="inline-block bg-white/85 text-[#FF8C42]/70 px-5 py-2.5 rounded-full text-sm font-medium cursor-not-allowed">
                          {banner.ctaText || 'Learn More'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (banner.id) {
                              apiClient
                                .post(`/banners/${banner.id}/click`, { source: 'home_lower_featured' })
                                .catch(() => {});
                            }
                            banner.ctaLink && void handleBannerClick(banner);
                          }}
                          className="bg-white text-indigo-600 px-5 py-2.5 rounded-full text-sm font-medium"
                        >
                          {banner.ctaText || 'Learn More'}
                        </button>
                      )}
                    </div>
                    <banner.Icon className="w-14 h-14 text-white/80 shrink-0" aria-hidden />
                  </div>
                </div>
              );
            })}
          </div>
        ) : !newHomeUi ? (
          <>
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
                        <p className="text-lg font-semibold">Verified hosts</p>
                        <p className="text-xs text-white/80">Book with confidence</p>
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
          </>
        ) : null}

        {/* Bottom CTA — legacy layout only */}
        {!newHomeUi ? (
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
        ) : null}
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

      {/* Pharmacy live tracking widget (meals use MealOrderFooterToast in CustomerScreenWrapper) */}
      {activeOrderTracking && (activeOrderTracking.orderType || 'pharmacy') !== 'meal' && (
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
