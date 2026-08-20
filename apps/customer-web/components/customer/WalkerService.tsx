"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CachedImage } from '@/components/shared/CachedImage';
import { WarmpawzPayVendorCard } from '@/components/warmpawz-pay/vendor-card/WarmpawzPayVendorCard';
import { buildWapptDiscoveryVendorCardProps } from '@/lib/wappt-discovery-vendor-card';
import {
  Dog,
  Star,
  MapPin,
  Search,
  Navigation,
  Radio,
  Eye,
  Play,
  Package,
  Footprints,
  RefreshCw,
  ChevronRight,
  Shield,
  Heart,
  PawPrint,
  Check,
  Mountain,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';
import { discoveryVendorList } from '@/lib/discovery-list';
import { formatRatingNumberOrDash } from '@/lib/rating-display';
import { pickWalkerVendorId } from '@warmpawz/shared-types';
import { toast } from 'sonner';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';
import { resolveNextAvailableLabel } from '@/lib/available-slots-response';
import {
  fetchWalkerVendorCatalogMerged,
  firstServiceIdFromServicePackageRow,
  rowQualifiesForWalkingModal,
  servicePackageQualifiesForWalkingModal,
  vendorServiceRowDedupeKey,
} from '@/lib/walker-vendor-offerings';
import {
  isVendorServicePackageRow,
  buildWalkerServiceDataForVendorPackagePurchase,
  clearSkipPackageAutoRedirect,
} from '@/lib/vendor-package-purchase-nav';
import { useDiscoveryCount } from '@/hooks/useDiscoveryCount';
import { useDiscoveryVendorFeed } from '@/hooks/useDiscoveryVendorFeed';
import { resolveCustomerDiscoveryCoords } from '@/lib/customer-discovery-coords';
import { DiscoveryVendorFeedSentinel } from './shared/DiscoveryVendorFeedSentinel';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import { ServiceDescriptionInline } from './shared/ServiceDescriptionInline';
import { isWarmpawzAppointmentsHubEnabled } from '@/lib/warmpawz-appointments-customer';
import { buildWapptHubTile } from '@/lib/wappt-hub-registry';

const WALKING_IMG = '/images/home/Walking';

const WALKING_HEADER_TRAILING = `${WALKING_IMG}/ChatGPT_Image_May_30__2026__01_19_16_PM-removebg-preview.webp`;

const WALKING_BANNER_ILLUSTRATION = `${WALKING_IMG}/${encodeURIComponent('ChatGPT Image May 30, 2026, 01_15_12 PM.webp')}`;

const WALKING_HEADER_PILLS = [
  { icon: Shield, label: 'Verified Walkers' },
  { icon: MapPin, label: 'GPS Tracked' },
  { icon: Heart, label: 'Happy Pets' },
] as const;

const WALKING_BANNER_CHECKS = ['Safe Walks', 'Trusted Walkers', 'Real-time Updates'] as const;

const WALKING_NEED_CARDS: {
  id: string;
  name: string;
  subtitle: string;
  image: string;
  /** CSS object-position — tuned per photo aspect ratio */
  imagePosition: string;
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}[] = [
  {
    id: 'daily_walk',
    name: 'Daily Walking',
    subtitle: 'Regular exercise',
    image: `${WALKING_IMG}/daily-walk.jpg`,
    imagePosition: '50% 50%',
    Icon: Footprints,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
  },
  {
    id: 'puppy_walk',
    name: 'Puppy Walks',
    subtitle: 'Extra care & fun',
    image: `${WALKING_IMG}/puppy-walk.jpg`,
    imagePosition: '50% 38%',
    Icon: Dog,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
  },
  {
    id: 'multiple_dogs',
    name: 'Group Walks',
    subtitle: 'Social & active',
    image: `${WALKING_IMG}/group-walk.jpg`,
    imagePosition: '50% 54%',
    Icon: Users,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-100',
  },
  {
    id: 'senior_walk',
    name: 'Senior Dog Walks',
    subtitle: 'Gentle & safe',
    image: `${WALKING_IMG}/adult-walk.jpg`,
    imagePosition: '50% 52%',
    Icon: PawPrint,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100',
  },
  {
    id: 'long_walk',
    name: 'Adventure Walks',
    subtitle: 'Parks & trails',
    image: `${WALKING_IMG}/adventure-walk.jpg`,
    imagePosition: '50% 46%',
    Icon: Mountain,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
  },
];

const WALKING_HEADER_ICON =
  'fill-none stroke-current [&>path]:fill-none [&>circle]:fill-none [&>rect]:fill-none [&>polygon]:fill-none';

function WalkerHeaderBackground() {
  return (
    <>
      <PawPrint className={`absolute -left-1 top-4 h-16 w-16 rotate-12 ${WALKING_HEADER_ICON} sm:h-20 sm:w-20`} strokeWidth={1} />
      <PawPrint className={`absolute right-[22%] top-2 h-10 w-10 -rotate-12 ${WALKING_HEADER_ICON}`} strokeWidth={1} />
      <Footprints className={`absolute left-[38%] top-1 h-12 w-12 rotate-[25deg] ${WALKING_HEADER_ICON}`} strokeWidth={1} />
      <PawPrint className={`absolute right-2 bottom-6 h-14 w-14 rotate-[18deg] ${WALKING_HEADER_ICON} sm:h-16 sm:w-16`} strokeWidth={1} />
      <Footprints className={`absolute left-6 bottom-2 h-9 w-9 -rotate-[30deg] ${WALKING_HEADER_ICON}`} strokeWidth={1} />
      <PawPrint className={`absolute right-[42%] top-14 h-8 w-8 rotate-6 ${WALKING_HEADER_ICON}`} strokeWidth={1} />
      <Dog className={`absolute left-[18%] top-10 h-11 w-11 -rotate-6 ${WALKING_HEADER_ICON}`} strokeWidth={1} />
    </>
  );
}

export interface WalkerPendingWalkSession {
  serviceId: string;
  serviceName: string;
  price: number;
  duration: number;
}

interface WalkerServiceProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  /** After choosing a single walk from PackageBookingPage — merge into walker booking when a walker is tapped */
  pendingWalkSession?: WalkerPendingWalkSession | null;
}

interface ActiveWalk {
  /** Always the booking UUID for `/tracking/booking/:id` and `/customer/:id/track-walk`. */
  id: string;
  bookingId?: string;
  walkerName: string;
  petName: string;
  startTime: string;
  status: 'in_progress' | 'completed' | 'scheduled';
  distanceCovered?: number;
  currentLocation?: { latitude: number; longitude: number };
}

/** Single string blob for client-side walker search (discover shape + vendors/search shape). */
function collectWalkerSearchHaystack(w: Record<string, unknown>): string {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (v == null) return;
    if (typeof v === 'string' || typeof v === 'number') parts.push(String(v));
    else if (Array.isArray(v)) v.forEach(push);
  };
  push(w.name);
  push(w.businessName);
  push(w.business_name);
  push(w.owner_name);
  push(w.ownerName);
  push(w.address);
  push(w.city);
  push(w.state);
  const loc = w.location as { address?: string } | undefined;
  push(loc?.address);
  push(w.role);
  push(w.roleName);
  push(w.roleDisplayName);
  push(w.customerService);
  push(w.bestForProblem);
  push(w.specialization);
  const specs = w.specializations;
  if (Array.isArray(specs)) push(specs.join(' '));
  const services = w.services as unknown[] | undefined;
  if (Array.isArray(services)) {
    for (const s of services) {
      if (s && typeof s === 'object') {
        const o = s as Record<string, unknown>;
        push(o.serviceName);
        push(o.service_name);
        push(o.name);
        push(o.description);
      }
    }
  }
  try {
    const blob = JSON.stringify(w);
    if (blob) parts.push(blob.slice(0, 12000));
  } catch (_) {
    /* ignore */
  }
  return parts.join(' ').toLowerCase();
}

/** Canonical vendor id for API calls (prefer vendorId over staff/list id). */
function resolveWalkerVendorId(walker: any): string | undefined {
  const s = pickWalkerVendorId((walker || {}) as Record<string, unknown>);
  return s || undefined;
}

function resolveWalkerRowDisplayName(walker: Record<string, unknown>): string {
  return String(walker.name || walker.businessName || walker.business_name || 'Pet Walker').trim();
}

function walkerRowMatchesQuery(w: Record<string, unknown>, rawQuery: string): boolean {
  const needle = rawQuery.trim().toLowerCase();
  if (!needle) return true;
  const hay = collectWalkerSearchHaystack(w);
  if (hay.includes(needle)) return true;
  const tokens = needle.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) return tokens.every((t) => hay.includes(t));
  return false;
}

function walkerProfilePhotoUrl(w: Record<string, unknown>): string | undefined {
  for (const key of ['photoUrl', 'photo', 'profilePhotoUrl', 'profile_photo_url'] as const) {
    const v = w[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/** Discover-services list card: show profile photo when API provides a URL; Dog placeholder on miss or load error. */
function WalkerListCardHero({ walker }: { walker: Record<string, unknown> }) {
  const url = walkerProfilePhotoUrl(walker);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [url]);
  const showPlaceholder = !url || failed;
  const alt =
    String(walker.name || walker.businessName || walker.business_name || 'Pet walker').trim() ||
    'Walker profile';

  return (
    <div className="h-48 bg-gradient-to-br from-orange-100 to-amber-100 relative overflow-hidden z-0">
      {url && !failed ? (
        <img
          src={url}
          alt={alt}
          className="absolute inset-0 z-0 h-full w-full object-cover pointer-events-none"
          onError={() => setFailed(true)}
        />
      ) : null}
      {showPlaceholder ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Dog className="w-16 h-16 text-orange-400 opacity-30" aria-hidden />
        </div>
      ) : null}
    </div>
  );
}

function walkerRowKey(w: Record<string, unknown>): string {
  return String(w.vendorId || w.id || w.vendor_id || '').trim();
}

function mergeWalkerDiscoveryRows(...lists: Record<string, unknown>[][]): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>();
  for (const list of lists) {
    for (const row of list) {
      const key = walkerRowKey(row);
      if (!key || map.has(key)) continue;
      map.set(key, row);
    }
  }
  return Array.from(map.values());
}

function walkerCardAddress(w: Record<string, unknown>): string {
  const loc = w.location as { address?: string } | undefined;
  return (
    String(
      w.shortAddress ||
        w.short_address ||
        loc?.address ||
        w.address ||
        w.city ||
        ''
    ).trim() || 'Location'
  );
}

const WALKER_FEED_PAGE_SIZE = 3;

async function fetchWalkerVendorsSearchFallback(locationParams: string): Promise<any[]> {
  const params = new URLSearchParams({ roleId: 'walker', serviceStyle: 'at_home', limit: '50' });
  const searchData = await apiClient.get<{ vendors?: any[]; services?: any[]; staff?: any[] }>(
    `/customer/vendors/search?${params.toString()}${locationParams}`
  );
  return searchData.vendors || searchData.services || searchData.staff || [];
}

function walkerRowToWapptCardSource(walker: Record<string, unknown>) {
  const vendorId = resolveWalkerVendorId(walker) || String(walker.id || walker.vendorId || '').trim();
  const reviewCount =
    Number(walker.reviewCount ?? walker.reviewsCount ?? walker.totalReviews ?? 0) || 0;
  const ratingRaw = walker.rating != null ? Number(walker.rating) : NaN;
  const rating = Number.isFinite(ratingRaw) && ratingRaw > 0 ? ratingRaw : undefined;
  const photo =
    (typeof walker.photo === 'string' && walker.photo) ||
    (typeof walker.photoUrl === 'string' && walker.photoUrl) ||
    (typeof walker.profileImage === 'string' && walker.profileImage) ||
    (typeof walker.profile_image === 'string' && walker.profile_image) ||
    undefined;
  const nextSlot = resolveNextAvailableLabel(walker);

  return {
    name: resolveWalkerRowDisplayName(walker),
    photo,
    isVerified: Boolean(walker.isVerified),
    rating: rating ?? 0,
    reviewCount,
    nextAvailableSlot: nextSlot ?? undefined,
    providerType: 'vendor' as const,
    city: typeof walker.city === 'string' ? walker.city : undefined,
    vendorId: vendorId || undefined,
    providerId: vendorId || undefined,
  };
}

function resolveWalkerRowAddress(walker: Record<string, unknown>): string {
  const loc = walker.location as { address?: string } | undefined;
  const raw = String(loc?.address || walker.address || walker.city || '').trim();
  return raw || 'Location on booking';
}

export function WalkerService({ phone, onBack, onNavigate, pendingWalkSession }: WalkerServiceProps) {
  const router = useRouter();
  const wapptWalkerUi = isWarmpawzAppointmentsHubEnabled('walker');
  const wapptTile = buildWapptHubTile('walker');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFallbackList, setSearchFallbackList] = useState<any[] | null>(null);
  const [searchSupplement, setSearchSupplement] = useState<any[]>([]);
  const [activeWalks, setActiveWalks] = useState<ActiveWalk[]>([]);
  const [activePackages, setActivePackages] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [previousWalker, setPreviousWalker] = useState<any>(null);
  const [packagesDialogOpen, setPackagesDialogOpen] = useState(false);
  const [packagesWalkerName, setPackagesWalkerName] = useState('');
  const [packagesDialogWalker, setPackagesDialogWalker] = useState<any | null>(null);
  const [walkerPackagesList, setWalkerPackagesList] = useState<
    { kind: 'vendor_service' | 'service_package'; raw: any; dedupeKey: string }[]
  >([]);
  const [packagesLoading, setPackagesLoading] = useState(false);

  const walkerDiscovery = useDiscoveryCount({
    phone,
    serviceStyle: 'at_home',
    category: 'walker',
    roleId: 'walker',
  });

  useEffect(() => {
    loadActiveWalks();
    loadActivePackages();
    loadPreviousWalker();
  }, []);

  const loadPreviousWalker = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/previous-providers?serviceType=walking`).catch(() => null);
      if (response?.provider) {
        const p = response.provider;
        const prc = Number(p.totalReviews ?? p.reviewCount ?? 0) || 0;
        const praw = p.rating != null ? Number(p.rating) : NaN;
        const pr = prc > 0 && Number.isFinite(praw) && praw > 0 ? praw : 0;
        setPreviousWalker({ id: p.id, name: p.businessName || p.name, photo: p.photo, rating: pr, lastVisit: p.lastVisit, sessionsCount: p.sessionsCount || 1 });
      } else {
        const pkgRes = await apiClient.get<any>(`/customer/${encodeURIComponent(phone)}/packages`).catch(() => null);
        const pkgs = Array.isArray(pkgRes?.packages) ? pkgRes.packages : [];
        const walkish = pkgs.filter((p: any) => {
          const t = String(p.packageType || p.package_type || '').toLowerCase();
          return !t || t.includes('walk') || t === 'dog_walking' || t === 'walker';
        });
        if (walkish.length > 0) {
          const pkg = walkish[0];
          const used = Number(pkg.sessionsUsed ?? pkg.sessions_used ?? 0);
          const total = Number(pkg.totalSessions ?? pkg.total_sessions ?? 0);
          if (pkg.vendorId && pkg.vendorName) setPreviousWalker({ id: pkg.vendorId, name: pkg.vendorName, photo: null, rating: 0, lastVisit: pkg.lastUsed || '3 weeks ago', sessionsCount: total > 0 ? `${used}/${total}` : used || 1 });
        }
      }
    } catch { /* ignore */ }
  };

  const loadActiveWalks = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/active-walks`);
      if (response?.walks && Array.isArray(response.walks)) {
        setActiveWalks(response.walks);
      } else {
        setActiveWalks([]);
      }
    } catch (error: any) {
      // Silently fail - no active walks is not an error
      console.log('No active walks or error loading:', error?.message);
      setActiveWalks([]);
    }
  };

  const loadActivePackages = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${encodeURIComponent(phone)}/packages`);
      const raw = Array.isArray(response?.packages) ? response.packages : [];
      const walkish = raw.filter((p: any) => {
        const t = String(p.packageType || p.package_type || '').toLowerCase();
        return !t || t.includes('walk') || t === 'dog_walking' || t === 'walker';
      });
      setActivePackages(walkish);
    } catch (error: any) {
      // Silently fail - no packages is not an error
      console.log('No active packages or error loading:', error?.message);
      setActivePackages([]);
    }
  };

  const coordsRef = useRef<{ latitude?: string; longitude?: string }>({});
  const fallbackAttemptedRef = useRef(false);

  const buildWalkerFeedUrl = useCallback(
    ({ limit, cursor }: { limit: number; cursor?: string }) => {
      const { latitude, longitude } = coordsRef.current;
      const locationParams =
        latitude != null && longitude != null
          ? `&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
          : '';
      const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      return `/customer/discover-services?category=walker&serviceStyle=at_home&limit=${limit}${cursorParam}${locationParams}${phoneParam}`;
    },
    [phone]
  );

  const {
    vendors: feedWalkers,
    loading: feedLoading,
    loadingMore: feedLoadingMore,
    hasMore: feedHasMore,
    loadMore: feedLoadMore,
    reload: feedReload,
  } = useDiscoveryVendorFeed({
    buildUrl: buildWalkerFeedUrl,
    pageSize: WALKER_FEED_PAGE_SIZE,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const coords = await resolveCustomerDiscoveryCoords(phone);
      if (cancelled) return;
      coordsRef.current = coords;
      fallbackAttemptedRef.current = false;
      setSearchFallbackList(null);
      setSearchSupplement([]);
      await feedReload();
    })();
    return () => {
      cancelled = true;
    };
  }, [phone, feedReload]);

  useEffect(() => {
    if (feedLoading || feedLoadingMore || feedWalkers.length > 0 || feedHasMore) {
      if (feedWalkers.length > 0 && searchFallbackList) {
        setSearchFallbackList(null);
      }
      return;
    }
    if (fallbackAttemptedRef.current) return;
    fallbackAttemptedRef.current = true;

    void (async () => {
      const { latitude, longitude } = coordsRef.current;
      const locationParams =
        latitude != null && longitude != null
          ? `&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
          : '';
      try {
        const roleRetry = await apiClient.get<{ vendors?: any[]; providers?: any[] }>(
          `/customer/discover-services?category=walker&serviceStyle=at_home&roleId=walker&limit=50${locationParams}`
        );
        let list = discoveryVendorList(roleRetry);
        if (list.length === 0) {
          list = await fetchWalkerVendorsSearchFallback(locationParams);
        }
        if (list.length > 0) {
          setSearchFallbackList(list);
        }
      } catch {
        try {
          const list = await fetchWalkerVendorsSearchFallback(locationParams);
          if (list.length > 0) {
            setSearchFallbackList(list);
          }
        } catch {
          /* non-fatal */
        }
      }
    })();
  }, [feedLoading, feedLoadingMore, feedWalkers.length, feedHasMore, searchFallbackList]);

  /** vendors/search includes trainer_solo + walk catalog rows that paginated discover may omit on page 1. */
  useEffect(() => {
    if (feedLoading || searchFallbackList) return;
    let cancelled = false;
    void (async () => {
      const { latitude, longitude } = coordsRef.current;
      const locationParams =
        latitude != null && longitude != null
          ? `&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
          : '';
      try {
        const list = await fetchWalkerVendorsSearchFallback(locationParams);
        if (!cancelled) setSearchSupplement(list);
      } catch {
        if (!cancelled) setSearchSupplement([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [feedLoading, feedWalkers.length, phone, searchFallbackList]);

  const allWalkers = useMemo(
    () =>
      mergeWalkerDiscoveryRows(
        feedWalkers as Record<string, unknown>[],
        (searchFallbackList ?? []) as Record<string, unknown>[],
        searchSupplement as Record<string, unknown>[]
      ),
    [feedWalkers, searchFallbackList, searchSupplement]
  );

  const displayedWalkers = useMemo((): any[] => {
    const q = searchQuery.trim();
    let list: any[] = q
      ? allWalkers.filter((w) => walkerRowMatchesQuery(w, q))
      : [...allWalkers];
    if (!q && list.length > WALKER_FEED_PAGE_SIZE) {
      list = list.slice(0, WALKER_FEED_PAGE_SIZE);
    }
    return list;
  }, [allWalkers, searchQuery]);

  const walkersLoading =
    feedLoading && allWalkers.length === 0 && !searchFallbackList;

  const totalDiscoveryCount =
    typeof walkerDiscovery.data === 'number' ? walkerDiscovery.data : 0;

  const showViewAllButton =
    !searchQuery.trim() &&
    !walkersLoading &&
    (allWalkers.length > 0 || totalDiscoveryCount > 0);

  const handleSearchSubmit = useCallback(() => {
    const q = searchQuery.trim();
    if (!q) return;
    const filtered = allWalkers.filter((w) =>
      walkerRowMatchesQuery(w, q)
    );
    if (filtered.length === 0 && allWalkers.length > 0) {
      toast.info('No walkers match that search. Try a name, area, or service.');
    }
  }, [allWalkers, searchQuery]);

  const handleViewAllWalkers = useCallback(() => {
    onNavigate?.('walker_home');
  }, [onNavigate]);

  const buildWalkerPayload = (walker: any) => {
    const vid = resolveWalkerVendorId(walker);
    return {
      id: vid,
      name: walker.name || walker.businessName || 'Walker',
      ...walker,
    };
  };

  const handleOpenWalkerProfile = (walker: any, e?: MouseEvent) => {
    e?.stopPropagation();
    const vid = resolveWalkerVendorId(walker);
    if (!vid) {
      toast.error('Profile unavailable for this walker.');
      return;
    }
    onNavigate?.('walker-provider-profile', {
      vendorId: vid,
      walker: buildWalkerPayload(walker),
      serviceType: 'walking',
      serviceStyle: 'at_home',
    });
  };

  const handleViewWalkerPackages = async (walker: any, e: MouseEvent) => {
    e.stopPropagation();
    const vid = resolveWalkerVendorId(walker);
    if (!vid) {
      toast.error('Walk options unavailable for this walker.');
      return;
    }
    setPackagesDialogWalker(walker);
    setPackagesWalkerName(String(walker.name || walker.businessName || walker.business_name || 'Walker').trim());
    setPackagesDialogOpen(true);
    setPackagesLoading(true);
    setWalkerPackagesList([]);
    try {
      // Phone: backend uses for package inclusions; query shape must not drop rows on miss.
      const [catalog, spRes] = await Promise.allSettled([
        fetchWalkerVendorCatalogMerged((url) => apiClient.get(url), vid, phone),
        apiClient.get(`/vendor/${encodeURIComponent(vid)}/packages`) as Promise<{ packages?: any[] }>,
      ]);

      const vendorRows: any[] = [];
      const seen = new Set<string>();
      if (catalog.status === 'fulfilled') {
        const { services, packages } = catalog.value;
        const mergedCatalog = [...services, ...packages];
        for (let i = 0; i < mergedCatalog.length; i += 1) {
          const r = mergedCatalog[i];
          if (!r || !rowQualifiesForWalkingModal(r)) continue;
          const key = vendorServiceRowDedupeKey(r, i);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          vendorRows.push(r);
        }
      }

      const tableRows: any[] =
        spRes.status === 'fulfilled' && Array.isArray(spRes.value?.packages) ? spRes.value.packages : [];

      const merged: { kind: 'vendor_service' | 'service_package'; raw: any; dedupeKey: string }[] = [];

      for (let k = 0; k < vendorRows.length; k += 1) {
        const r = vendorRows[k];
        if (!r) continue;
        const key = vendorServiceRowDedupeKey(r, k);
        if (key) merged.push({ kind: 'vendor_service', raw: r, dedupeKey: key });
      }
      for (const r of tableRows) {
        if (!r || !servicePackageQualifiesForWalkingModal(r)) continue;
        const spId = r.id != null && String(r.id).trim() !== '' ? String(r.id).trim() : '';
        const key = spId ? `sp:${spId}` : '';
        if (!key) continue;
        const sid = firstServiceIdFromServicePackageRow(r);
        const sidKey = sid ? `vs_sid:${sid}` : '';
        if (sidKey && seen.has(sidKey)) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({ kind: 'service_package', raw: r, dedupeKey: key });
      }

      setWalkerPackagesList(merged);
    } catch {
      toast.error('Could not load packages. Try again later.');
      setWalkerPackagesList([]);
    } finally {
      setPackagesLoading(false);
    }
  };

  const handleBookPackageFromModal = (entry: { kind: 'vendor_service' | 'service_package'; raw: any }) => {
    const walker = packagesDialogWalker;
    const vid = resolveWalkerVendorId(walker);
    if (!walker || !vid) {
      toast.error('Unable to start booking.');
      return;
    }
    const r = entry.raw;
    const styleFromRow = String(r.serviceStyle ?? r.service_style ?? '').trim() || 'at_home';

    const isPackageRow =
      entry.kind === 'service_package' ||
      isVendorServicePackageRow(r as Record<string, unknown>);
    if (isPackageRow) {
      const walkerName = String(
        walker?.name ?? walker?.business_name ?? walker?.businessName ?? ''
      ).trim();
      const fallbackVsid = String(r.id ?? r.vendorServiceId ?? r.vendor_service_id ?? '').trim();
      const pkgNav =
        buildWalkerServiceDataForVendorPackagePurchase({
          vendorId: vid,
          vendorName: walkerName || undefined,
          serviceRow: r as Record<string, unknown>,
          serviceTypeCategory: 'walking',
          serviceStyle: styleFromRow,
        }) ||
        (fallbackVsid
          ? {
              vendorId: vid,
              vendorServiceId: fallbackVsid,
              serviceName: String(r.name || r.service_name || r.serviceName || 'Package').trim(),
              totalSessions: Number(r.totalSessions ?? r.packageDetails?.totalSessions ?? 1) || 1,
              price: Number(r.price ?? r.custom_price ?? 0) || 0,
              duration: Number(r.duration ?? r.durationMinutes ?? 30) || 30,
              serviceType: 'walking',
              serviceStyle: styleFromRow,
              ...(walkerName ? { walker: { name: walkerName } } : {}),
            }
          : null);
      if (pkgNav) {
        clearSkipPackageAutoRedirect(vid, String(pkgNav.vendorServiceId || fallbackVsid));
        onNavigate?.('purchase-package', pkgNav);
        setPackagesDialogOpen(false);
        return;
      }
    }

    if (entry.kind === 'vendor_service') {
      const serviceUuid = (r.serviceId || r.service_id || '').toString().trim();
      const vsId = r.id != null ? String(r.id) : '';
      onNavigate?.('walker-booking', {
        vendorId: vid,
        walker: buildWalkerPayload(walker),
        serviceType: 'walking',
        serviceStyle: styleFromRow,
        serviceId: serviceUuid || vsId,
        serviceName: String(r.name || r.service_name || r.serviceName || 'Walk package').trim(),
        price: Number(r.price ?? r.custom_price ?? 0) || 0,
        duration: Number(r.duration ?? r.durationMinutes ?? r.duration_minutes ?? 30) || 30,
      });
    } else {
      const ids = r.service_ids;
      let firstSid = '';
      if (Array.isArray(ids) && ids.length > 0) firstSid = String(ids[0]);
      else if (ids && typeof ids === 'string') {
        try {
          const parsed = JSON.parse(ids);
          if (Array.isArray(parsed) && parsed[0]) firstSid = String(parsed[0]);
        } catch {
          firstSid = String(ids);
        }
      }
      onNavigate?.('walker-booking', {
        vendorId: vid,
        walker: buildWalkerPayload(walker),
        serviceType: 'walking',
        serviceStyle: styleFromRow,
        serviceId: firstSid || undefined,
        serviceName: String(r.name || r.package_name || r.packageName || 'Walk package').trim(),
        price: Number(r.price ?? r.package_price ?? r.packagePrice ?? 0) || 0,
        duration: Number(r.duration_minutes ?? r.durationMinutes ?? 30) || 30,
      });
    }
    setPackagesDialogOpen(false);
  };

  const handleWalkerSelect = (walker: any) => {
    const vid = resolveWalkerVendorId(walker);
    if (!vid) {
      toast.error('Booking unavailable for this walker.');
      return;
    }
    const walkerPayload = buildWalkerPayload(walker);
    const base = {
      vendorId: vid,
      serviceType: 'walking' as const,
      serviceStyle: 'at_home' as const,
    };
    if (pendingWalkSession) {
      onNavigate?.('walker-booking', {
        ...base,
        walker: walkerPayload,
        serviceId: pendingWalkSession.serviceId,
        serviceName: pendingWalkSession.serviceName,
        price: pendingWalkSession.price,
        duration: pendingWalkSession.duration,
      });
      return;
    }
    onNavigate?.('walker-booking', base);
  };

  const walkersSectionRef = useRef<HTMLDivElement>(null);
  const pendingScrollDoneRef = useRef(false);

  useEffect(() => {
    if (!pendingWalkSession) {
      pendingScrollDoneRef.current = false;
      return;
    }
    if (pendingScrollDoneRef.current) return;
    pendingScrollDoneRef.current = true;
    const t = window.setTimeout(() => {
      walkersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
    return () => window.clearTimeout(t);
  }, [pendingWalkSession]);

  const dashboardStats = EMPTY_SERVICE_HEADER_STATS;

  return (
    <div className="min-h-screen bg-gray-50">
      <ServiceDashboardHeader
        fullWidth
        serviceName="Dog Walking"
        serviceSubtitle="Professional pet walking services"
        serviceIcon={Dog}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
        sheetToneClass="bg-gray-50"
        headerBackground={<WalkerHeaderBackground />}
        headerTrailingImage={WALKING_HEADER_TRAILING}
        headerTrailingImageAlt="Walker with golden retriever"
        headerTrailingImageClassName="pointer-events-none absolute bottom-2 right-0 top-0 z-[5] flex min-h-0 w-[56%] max-w-[240px] items-start justify-end sm:bottom-3 sm:max-w-[260px]"
        headerTrailingImageImgClassName="max-h-full w-auto max-w-full object-contain object-top drop-shadow-lg"
      />

      <div className="mx-auto w-full max-w-customer -mt-4 rounded-t-[1.75rem] bg-gray-50 px-4 pt-4 pb-2 sm:rounded-t-[2rem]">
        <div className="mb-4 flex flex-wrap gap-2">
          {WALKING_HEADER_PILLS.map((pill) => (
            <span
              key={pill.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm"
            >
              <pill.icon className="h-3.5 w-3.5 text-[#FF8C42]" aria-hidden />
              {pill.label}
            </span>
          ))}
        </div>

        <div className="flex items-stretch gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              enterKeyHint="search"
              placeholder="Search walkers, locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearchSubmit();
                }
              }}
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-gray-900 placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              aria-label="Search walkers by name or area"
            />
          </div>
          <Button
            type="button"
            className="shrink-0 rounded-xl bg-[#FF8C42] px-4 font-semibold text-white hover:bg-[#FF7A2E]"
            onClick={() => handleSearchSubmit()}
          >
            Search
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-customer space-y-6 p-4">
        {/* Professional Pet Walking banner — full illustration on right, cream + gradient on left */}
        <div className="relative min-h-[172px] overflow-hidden rounded-2xl border border-orange-100/80 bg-[#FFF9F0] shadow-sm sm:min-h-[180px]">
          <div className="absolute inset-y-0 right-0 z-0 w-[54%] bg-gradient-to-br from-orange-50/90 via-amber-50/70 to-orange-100/40 sm:w-[50%]">
            <CachedImage
              src={WALKING_BANNER_ILLUSTRATION}
              alt=""
              fill
              className="object-contain object-bottom object-right px-1 pb-0 pt-2 sm:px-2"
              sizes="(max-width: 640px) 50vw, 240px"
              loading="eager"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background:
                'linear-gradient(90deg, #FFF9F0 0%, #FFF9F0 34%, rgba(255, 249, 240, 0.97) 42%, rgba(255, 251, 246, 0.72) 52%, rgba(255, 245, 235, 0.25) 64%, transparent 78%)',
            }}
            aria-hidden
          />
          <div className="relative z-10 flex min-h-[172px] items-center sm:min-h-[180px]">
            <div className="flex max-w-[58%] flex-col justify-center gap-2 p-4 sm:max-w-[54%] sm:p-5">
              <h2 className="text-lg font-bold leading-tight text-slate-900 sm:text-xl">
                Professional Pet Walking
              </h2>
              <p className="text-xs text-slate-600 sm:text-sm">Exercise, companionship & care</p>
              <ul className="mt-1 space-y-1">
                {WALKING_BANNER_CHECKS.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-[11px] font-medium text-slate-700 sm:text-xs"
                  >
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#FF8C42]" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {wapptWalkerUi && wapptTile ? (
          <div>
            <h2 className="mb-3 text-lg font-bold text-slate-900">Choose Service Type</h2>
            <button
              type="button"
              onClick={() => onNavigate?.('wappt-discovery', { category: 'walker' })}
              className="group relative w-full overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-sm transition-all hover:shadow-md"
            >
              <div className="relative h-28 w-full sm:h-32">
                {wapptTile.image ? (
                  <CachedImage
                    src={wapptTile.image}
                    alt={wapptTile.name}
                    fill
                    className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                    sizes="(max-width: 640px) 90vw, 400px"
                  />
                ) : null}
                <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide ${wapptTile.badgeClass}`}>
                  {wapptTile.badge}
                </span>
              </div>
              <div className="relative p-3 pb-10">
                <h3 className="text-sm font-bold text-slate-900">{wapptTile.name}</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">{wapptTile.description}</p>
                <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                  <Heart className="h-3 w-3 text-orange-400" />
                  <span>{wapptTile.trustedBy}</span>
                </div>
                <div className={`absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md transition-transform group-hover:scale-110 ${wapptTile.arrowClass}`}>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </button>
          </div>
        ) : null}

        {/* Walk by Need */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-orange-50 p-1.5">
              <PawPrint className="h-4 w-4 text-[#FF8C42]" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Walk by Need</h2>
          </div>
          <div className="grid grid-cols-3 items-stretch gap-2 sm:gap-2.5">
            {WALKING_NEED_CARDS.map((need) => (
              <button
                key={need.id}
                type="button"
                onClick={() =>
                  onNavigate?.('problem_selected', { problemId: need.id, problemTitle: need.name })
                }
                className="group flex h-full min-w-0 flex-col text-left"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-100 shadow-sm transition-all group-hover:border-orange-200 group-hover:shadow-md">
                  <CachedImage
                    src={need.image}
                    alt={need.name}
                    fill
                    className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-[1.03]"
                    style={{ objectPosition: need.imagePosition }}
                    sizes="(max-width: 640px) 26vw, 100px"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent"
                    aria-hidden
                  />
                  <div
                    className={`absolute left-1.5 top-1.5 z-[1] flex h-7 w-7 items-center justify-center rounded-lg border border-white/60 ${need.iconBg} shadow-sm`}
                  >
                    <need.Icon className={`h-4 w-4 ${need.iconColor}`} aria-hidden />
                  </div>
                </div>
                <div className="mt-1 flex min-h-[2.25rem] flex-col items-center justify-start gap-px px-0.5 text-center">
                  <p className="w-full text-[9px] font-semibold leading-tight text-slate-800 sm:text-[10px]">
                    {need.name}
                  </p>
                  <p className="w-full text-[8px] leading-tight text-slate-500 sm:text-[9px]">
                    {need.subtitle}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Phase 1: Book again with previous walker */}
        {previousWalker && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-slate-900">Book again</h2>
            </div>
            <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 p-4">
              <div className="flex items-center gap-4">
                {previousWalker.photo ? (
                  <img src={previousWalker.photo} alt={previousWalker.name} className="w-16 h-16 rounded-xl object-cover border-2 border-orange-200" />
                ) : (
                  <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold text-xl border-2 border-orange-200">
                    {previousWalker.name?.charAt(0) || 'W'}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 text-lg">{previousWalker.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                    <div className="flex items-center gap-1 text-orange-600 font-bold">
                      <Star className="w-4 h-4 fill-orange-500" />
                      {previousWalker.rating}
                    </div>
                    <span>•</span>
                    <span>Last walk: {previousWalker.lastVisit || '3 weeks ago'}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{previousWalker.sessionsCount || 1} walk(s) with you</p>
                </div>
                <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white" onClick={() => handleWalkerSelect(previousWalker)}>
                  Book Now
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Active Walk in Progress - GPS Tracking */}
        {activeWalks.filter(w => w.status === 'in_progress').length > 0 && (
          <Card className="bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] text-white p-4 relative overflow-hidden">
            <div className="absolute top-2 right-2">
              <span className="flex items-center gap-1 bg-white/20 backdrop-blur px-2 py-1 rounded-full text-xs">
                <Radio className="w-3 h-3 animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                <Navigation className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">Walk in Progress</h3>
                <p className="text-white/90 text-sm">{activeWalks[0].petName} with {activeWalks[0].walkerName}</p>
                {activeWalks[0].distanceCovered && (
                  <p className="text-white/80 text-xs mt-1">{activeWalks[0].distanceCovered}km covered</p>
                )}
              </div>
              <Button 
                variant="secondary" 
                size="sm" 
                className="bg-white text-orange-500 hover:bg-white/90"
                onClick={() => {
                  const bid = activeWalks[0].bookingId || activeWalks[0].id;
                  if (bid) {
                    onNavigate?.('my-bookings', { bookingId: bid });
                  }
                }}
              >
                <Eye className="w-4 h-4 mr-1" />
                Track
              </Button>
            </div>
          </Card>
        )}

        {/* Active Walking Packages */}
        {activePackages.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Your Walking Packages</h3>
              </div>
            </div>
            <div className="space-y-2">
              {activePackages.slice(0, 2).map((pkg, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white rounded-lg p-3 border border-blue-100">
                  <div>
                    <p className="font-medium text-sm">{pkg.packageName || 'Walking Package'}</p>
                    <p className="text-xs text-gray-500">
                      {pkg.remainingSessions === 'unlimited' || pkg.isUnlimited
                        ? 'Unlimited'
                        : (() => {
                            const used = Number(pkg.sessionsUsed ?? pkg.sessions_used ?? 0);
                            const total = Number(pkg.totalSessions ?? pkg.total_sessions ?? 0);
                            const rem = pkg.remainingSessions;
                            const r = typeof rem === 'number' ? rem : Number(rem);
                            if (total > 0) return `${used}/${total} used${Number.isFinite(r) ? ` · ${r} left` : ''}`;
                            return `${pkg.remainingSessions ?? '—'} sessions left`;
                          })()}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-blue-600 border-blue-200"
                    onClick={() => onNavigate?.('schedule-walk', { packageId: pkg.id })}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Schedule
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {pendingWalkSession && (
          <Card className="p-4 mb-4 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 mb-1">Selected walk</p>
            <p className="font-bold text-gray-900">{pendingWalkSession.serviceName}</p>
            <p className="text-sm text-gray-600 mt-1">
              ₹{pendingWalkSession.price} · {pendingWalkSession.duration} min — choose a walker below to continue.
            </p>
          </Card>
        )}

        {/* Walkers List */}
        <div ref={walkersSectionRef}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Available Walkers</h2>
            {showViewAllButton ? (
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-[#FF8C42]"
                onClick={handleViewAllWalkers}
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          {walkersLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
          ) : displayedWalkers.length === 0 ? (
            <Card className="p-8 text-center">
              <Dog className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Walkers Found</h3>
              <p className="text-sm text-gray-500">Try adjusting your search or check back later</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {displayedWalkers.map((walker, index) => {
                const row = walker as Record<string, unknown>;
                if (wapptWalkerUi) {
                  const provider = walkerRowToWapptCardSource(row);
                  return (
                    <WarmpawzPayVendorCard
                      key={String(provider.vendorId || walker.id || index)}
                      {...buildWapptDiscoveryVendorCardProps({
                        provider,
                        subtitle: 'Pet Walker',
                        address: resolveWalkerRowAddress(row),
                        category: 'walker',
                        serviceKey: 'walker',
                        onPrimary: () => handleWalkerSelect(row),
                        onProfileClick: (e) => handleOpenWalkerProfile(row, e),
                        router,
                      })}
                    />
                  );
                }

                const name = resolveWalkerRowDisplayName(row);
                const address = resolveWalkerRowAddress(row);
                const ratingRaw = row.rating != null ? Number(row.rating) : NaN;
                const rating = Number.isFinite(ratingRaw) && ratingRaw > 0 ? ratingRaw : null;
                const reviewCount =
                  Number(row.reviewCount ?? row.reviewsCount ?? row.totalReviews ?? 0) || 0;
                const photo =
                  (typeof row.photo === 'string' && row.photo) ||
                  (typeof row.photoUrl === 'string' && row.photoUrl) ||
                  (typeof row.profileImage === 'string' && row.profileImage) ||
                  null;
                const nextSlot = resolveNextAvailableLabel(row);

                return (
                  <Card key={String(row.id || row.vendorId || index)} className="overflow-hidden border border-gray-100 bg-white shadow-sm">
                    <div className="flex gap-3 p-4">
                      {photo ? (
                        <img src={photo} alt={name} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-xl font-bold text-orange-600">
                          {name.charAt(0) || 'W'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold text-gray-900">{name}</h3>
                        <p className="text-sm text-gray-500">Pet Walker</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                          {rating != null && reviewCount > 0 ? (
                            <span className="flex items-center gap-1 font-medium text-orange-600">
                              <Star className="h-3.5 w-3.5 fill-orange-500 text-orange-500" />
                              {rating.toFixed(1)}
                            </span>
                          ) : null}
                          {nextSlot ? (
                            <span className="text-xs text-emerald-700">Next: {nextSlot}</span>
                          ) : null}
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{address}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                        onClick={(e) => void handleViewWalkerPackages(row, e)}
                      >
                        View Services
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="flex-1 text-gray-700"
                        onClick={(e) => handleOpenWalkerProfile(row, e)}
                      >
                        Details
                      </Button>
                    </div>
                  </Card>
                );
              })}

              {!searchQuery.trim() && !searchFallbackList ? (
                <DiscoveryVendorFeedSentinel
                  hasMore={feedHasMore}
                  loading={feedLoading}
                  loadingMore={feedLoadingMore}
                  onLoadMore={() => void feedLoadMore()}
                />
              ) : null}
            </div>
          )}
        </div>

        {/* Walking Features */}
        <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Why Choose Us?</h3>
          <div className="space-y-3">
            {[
              { icon: '📍', title: 'GPS Tracking', desc: 'Real-time location tracking' },
              { icon: '⏱️', title: 'Flexible Timing', desc: 'Book walks on your schedule' },
              { icon: '📸', title: 'Walk Reports', desc: 'Photos & activity updates' },
              { icon: '🛡️', title: 'Insured & Bonded', desc: 'Fully insured walkers' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{item.title}</h4>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Dialog
        open={packagesDialogOpen}
        onOpenChange={(open) => {
          setPackagesDialogOpen(open);
          if (!open) {
            setWalkerPackagesList([]);
            setPackagesWalkerName('');
            setPackagesDialogWalker(null);
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[min(90dvh,48rem)] w-[calc(100%-1.5rem)] flex flex-col overflow-hidden p-0 gap-0 sm:max-w-md">
          <div className="shrink-0 border-b border-gray-100 px-4 pt-5 pr-12 pb-3 sm:px-5">
            <DialogHeader>
              <DialogTitle>Walk options{packagesWalkerName ? ` — ${packagesWalkerName}` : ''}</DialogTitle>
              <DialogDescription>
                Single walks and bundles this walker has published.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] px-4 py-3 pb-5 sm:px-5">
          {packagesLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
            </div>
          ) : walkerPackagesList.length === 0 ? (
            <p className="text-sm text-gray-600 py-4 text-center">
              No walk options or bundles listed yet for this walker.
            </p>
          ) : (
            <ul className="space-y-3">
              {walkerPackagesList.map((entry, i) => {
                  const pkg = entry.raw;
                  const name =
                    pkg.package_name ||
                    pkg.packageName ||
                    pkg.name ||
                    pkg.service_name ||
                    pkg.serviceName ||
                    `Walk option ${i + 1}`;
                  const price =
                    pkg.package_price ??
                    pkg.packagePrice ??
                    pkg.price ??
                    pkg.original_price ??
                    pkg.originalPrice;
                  const sessions =
                    pkg.total_sessions ??
                    pkg.totalSessions ??
                    pkg.session_count ??
                    pkg.sessionCount ??
                    pkg.packageDetails?.totalSessions;
                  const desc =
                    pkg.description ||
                    pkg.package_description ||
                    pkg.longDescription ||
                    pkg.shortDescription ||
                    '';
                  const durationLabel =
                    pkg.duration ??
                    pkg.durationMinutes ??
                    pkg.duration_minutes ??
                    pkg.packageDetails?.sessionDuration;
                  const isPackage =
                    entry.kind === 'service_package' ||
                    Boolean(
                      pkg.isPackage ||
                        pkg.is_package ||
                        pkg.metadata?.isPackage ||
                        pkg.metadata?.type === 'package'
                    );
                  return (
                    <li key={entry.dedupeKey}>
                      <Card className="p-3 border-orange-100">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{name}</p>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              isPackage ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isPackage ? 'Package' : 'Service'}
                          </span>
                        </div>
                        {desc ? (
                          <ServiceDescriptionInline
                            description={String(desc)}
                            title={name}
                            className="m-0 text-sm leading-5 text-gray-600 mt-1"
                            dialogHint="Full description from the walker (vendor-provided)"
                          />
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
                          {price != null && price !== '' ? (
                            <span className="font-semibold text-orange-600">₹{Number(price).toLocaleString()}</span>
                          ) : null}
                          {sessions != null && sessions !== '' ? (
                            <span className="text-gray-500">{sessions} session(s)</span>
                          ) : null}
                          {durationLabel != null && durationLabel !== '' ? (
                            <span className="text-gray-500">{durationLabel} min</span>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          className="w-full mt-3 bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] hover:from-[#FF7A35] hover:to-[#FF5A25] text-white font-semibold"
                          onClick={() => handleBookPackageFromModal(entry)}
                        >
                          Book this option
                        </Button>
                      </Card>
                    </li>
                  );
                })}
            </ul>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
