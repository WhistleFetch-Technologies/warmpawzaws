"use client";

import { useState, useEffect, useRef, useCallback, type MouseEvent } from 'react';
import { Dog, Star, MapPin, Clock, Search, Navigation, Radio, Eye, Play, Package, Footprints, Plus, RefreshCw, ChevronRight } from 'lucide-react';
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
import { toast } from 'sonner';
import { PromotionBanner } from './shared/PromotionBanner';
import { WALKING_NEEDS } from './ProblemGridSection';
import { useProblemGridByRole } from './useProblemGridByRole';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';

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
  id: string;
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
  const v = walker?.vendorId ?? walker?.providerId ?? walker?.id;
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
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
    <div className="h-48 bg-gradient-to-br from-orange-100 to-amber-100 relative overflow-hidden">
      {url && !failed ? (
        <img
          src={url}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
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

export function WalkerService({ phone, onBack, onNavigate, pendingWalkSession }: WalkerServiceProps) {
  const walkingNeeds = useProblemGridByRole('walker');
  const [loading, setLoading] = useState(true);
  const [walkers, setWalkers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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

  useEffect(() => {
    loadActiveWalks();
    loadActivePackages();
    loadPreviousWalker();
  }, []);

  const loadPreviousWalker = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/previous-providers?serviceType=walking`).catch(() => null);
      if (response?.provider) {
        setPreviousWalker({ id: response.provider.id, name: response.provider.businessName || response.provider.name, photo: response.provider.photo, rating: response.provider.rating || 4.8, lastVisit: response.provider.lastVisit, sessionsCount: response.provider.sessionsCount || 1 });
      } else {
        const pkgRes = await apiClient.get<any>(`/customer/${phone}/packages?serviceType=walking`).catch(() => null);
        if (pkgRes?.packages?.length > 0) {
          const pkg = pkgRes.packages[0];
          if (pkg.vendorId && pkg.vendorName) setPreviousWalker({ id: pkg.vendorId, name: pkg.vendorName, photo: null, rating: 4.8, lastVisit: pkg.lastUsed || '3 weeks ago', sessionsCount: pkg.sessionsUsed || 1 });
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
      const response = await apiClient.get<any>(`/customer/${phone}/packages?serviceType=walking`);
      if (response?.packages && Array.isArray(response.packages)) {
        setActivePackages(response.packages);
      } else {
        setActivePackages([]);
      }
    } catch (error: any) {
      // Silently fail - no packages is not an error
      console.log('No active packages or error loading:', error?.message);
      setActivePackages([]);
    }
  };

  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  /** Full discover list for current location — search filters this in-memory (vendors/search uses stricter status rules and often returns nothing). */
  const walkersDiscoverCacheRef = useRef<{ key: string; list: any[] } | null>(null);
  /** Matches `walkersDiscoverCacheRef.current.key` after last successful discover fetch (for instant in-memory search without re-awaiting geo/profile). */
  const lastDiscoverLocationKeyRef = useRef<string | null>(null);
  /** Drop stale async results when a newer search/load started. */
  const loadWalkersGenRef = useRef(0);

  const getLocationQuerySuffix = useCallback(async (): Promise<string> => {
    try {
      const lat = typeof localStorage !== 'undefined' && localStorage.getItem('customer_latitude');
      const lng = typeof localStorage !== 'undefined' && localStorage.getItem('customer_longitude');
      if (lat && lng) return `&latitude=${lat}&longitude=${lng}`;
    } catch (_) {}
    if (typeof phone !== 'undefined' && phone) {
      try {
        const profileRes = (await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`)) as any;
        const profile = profileRes?.profile || profileRes;
        if (profile?.latitude != null && profile?.longitude != null) {
          return `&latitude=${encodeURIComponent(String(profile.latitude))}&longitude=${encodeURIComponent(String(profile.longitude))}`;
        }
      } catch (_) {}
    }
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 300000 });
        });
        return `&latitude=${encodeURIComponent(String(pos.coords.latitude))}&longitude=${encodeURIComponent(String(pos.coords.longitude))}`;
      } catch (_) {}
    }
    return '';
  }, [phone]);

  const fetchDiscoverWalkers = useCallback(
    async (locationParams: string): Promise<any[]> => {
      let walkerList: any[] = [];
      try {
        const endpoint = `/customer/discover-services?category=walker&serviceStyle=at_home&roleId=walker${locationParams}`;
        const data = await apiClient.get<{
          success?: boolean;
          vendors?: any[];
          providers?: any[];
          services?: any[];
          staff?: any[];
        }>(endpoint);
        walkerList = data.vendors || data.providers || data.services || data.staff || [];
        if (walkerList.length === 0) {
          const fallbackUrl = `/customer/discover-services?category=walker&serviceStyle=at_home${locationParams}`;
          const fallback = await apiClient.get<{ vendors?: any[]; providers?: any[] }>(fallbackUrl);
          walkerList = fallback.vendors || fallback.providers || [];
        }
      } catch (_) {
        try {
          const params = new URLSearchParams({ roleId: 'pet_walker', serviceStyle: 'at_home', limit: '50' });
          const data = await apiClient.get<{ vendors?: any[]; services?: any[]; staff?: any[] }>(
            `/customer/vendors/search?${params.toString()}${locationParams}`
          );
          walkerList = data.vendors || data.services || data.staff || [];
        } catch (__) {
          walkerList = [];
        }
      }
      return walkerList;
    },
    []
  );

  const loadWalkers = useCallback(async () => {
    const gen = ++loadWalkersGenRef.current;
    const q = searchQueryRef.current.trim();

    if (q) {
      const snap = walkersDiscoverCacheRef.current;
      if (
        snap?.list?.length &&
        snap.key === lastDiscoverLocationKeyRef.current
      ) {
        const filtered = snap.list.filter((w: any) =>
          walkerRowMatchesQuery(w as Record<string, unknown>, q)
        );
        if (gen !== loadWalkersGenRef.current) return;
        if (filtered.length === 0 && snap.list.length > 0) {
          toast.info('No walkers match that search. Try a name, area, or service.');
        }
        setWalkers(filtered);
        return;
      }
    }

    try {
      const locationParams = await getLocationQuerySuffix();
      if (gen !== loadWalkersGenRef.current) return;

      const locationCacheKey = locationParams || '__no_geo__';

      if (!q) {
        setLoading(true);
        const all = await fetchDiscoverWalkers(locationParams);
        if (gen !== loadWalkersGenRef.current) return;
        walkersDiscoverCacheRef.current = { key: locationCacheKey, list: all };
        lastDiscoverLocationKeyRef.current = locationCacheKey;
        setWalkers(all);
        return;
      }

      const cached = walkersDiscoverCacheRef.current;
      const cacheOk = Boolean(cached?.key === locationCacheKey && Array.isArray(cached?.list));
      const needNetwork = !cacheOk || (cached?.list?.length ?? 0) === 0;

      if (needNetwork) {
        setLoading(true);
        const base = await fetchDiscoverWalkers(locationParams);
        if (gen !== loadWalkersGenRef.current) return;
        walkersDiscoverCacheRef.current = { key: locationCacheKey, list: base };
        lastDiscoverLocationKeyRef.current = locationCacheKey;
        const filtered = base.filter((w: any) => walkerRowMatchesQuery(w as Record<string, unknown>, q));
        if (gen !== loadWalkersGenRef.current) return;
        if (filtered.length === 0 && base.length > 0) {
          toast.info('No walkers match that search. Try a name, area, or service.');
        }
        setWalkers(filtered);
        return;
      }

      const base = cached?.list ?? [];
      const filtered = base.filter((w: any) => walkerRowMatchesQuery(w as Record<string, unknown>, q));
      if (gen !== loadWalkersGenRef.current) return;
      if (filtered.length === 0 && base.length > 0) {
        toast.info('No walkers match that search. Try a name, area, or service.');
      }
      setWalkers(filtered);
    } catch (error) {
      console.error('Error loading walkers:', error);
      if (gen === loadWalkersGenRef.current) setWalkers([]);
    } finally {
      if (gen === loadWalkersGenRef.current) setLoading(false);
    }
  }, [fetchDiscoverWalkers, getLocationQuerySuffix]);

  useEffect(() => {
    const delayMs = searchQuery.trim() ? 350 : 0;
    const t = setTimeout(() => {
      void loadWalkers();
    }, delayMs);
    return () => clearTimeout(t);
  }, [searchQuery, loadWalkers]);

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

  const collectVendorServicePackages = (svcRes: Record<string, any> | null | undefined): any[] => {
    if (!svcRes || typeof svcRes !== 'object') return [];
    const pkgs = Array.isArray(svcRes.packages) ? svcRes.packages : [];
    const services = Array.isArray(svcRes.services) ? svcRes.services : [];
    const fromServices = services.filter((s: any) => s?.isPackage);
    return [...pkgs, ...fromServices];
  };

  const handleViewWalkerPackages = async (walker: any, e: MouseEvent) => {
    e.stopPropagation();
    const vid = resolveWalkerVendorId(walker);
    if (!vid) {
      toast.error('Packages unavailable for this walker.');
      return;
    }
    setPackagesDialogWalker(walker);
    setPackagesWalkerName(String(walker.name || walker.businessName || walker.business_name || 'Walker').trim());
    setPackagesDialogOpen(true);
    setPackagesLoading(true);
    setWalkerPackagesList([]);
    try {
      const phoneParam = phone
        ? `&customerPhone=${encodeURIComponent(phone)}&phone=${encodeURIComponent(phone)}`
        : '';
      const servicesUrl = `/customer/vendor/${encodeURIComponent(vid)}/services?serviceStyle=at_home&category=walking${phoneParam}`;
      const [svcRes, spRes] = await Promise.allSettled([
        apiClient.get(servicesUrl) as Promise<Record<string, any>>,
        apiClient.get(`/vendor/${encodeURIComponent(vid)}/packages`) as Promise<{ packages?: any[] }>,
      ]);

      const vendorRows: any[] =
        svcRes.status === 'fulfilled' ? collectVendorServicePackages(svcRes.value) : [];
      const tableRows: any[] =
        spRes.status === 'fulfilled' && Array.isArray(spRes.value?.packages) ? spRes.value.packages : [];

      const seen = new Set<string>();
      const merged: { kind: 'vendor_service' | 'service_package'; raw: any; dedupeKey: string }[] = [];

      for (const r of vendorRows) {
        if (!r) continue;
        const key = `vs:${r.id ?? r.service_id ?? r.serviceId ?? ''}`;
        if (!key.endsWith(':') && !seen.has(key)) {
          seen.add(key);
          merged.push({ kind: 'vendor_service', raw: r, dedupeKey: key });
        }
      }
      for (const r of tableRows) {
        if (!r) continue;
        const key = `sp:${r.id ?? ''}`;
        if (!key.endsWith(':') && !seen.has(key)) {
          seen.add(key);
          merged.push({ kind: 'service_package', raw: r, dedupeKey: key });
        }
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
    if (entry.kind === 'vendor_service') {
      const serviceUuid = (r.serviceId || r.service_id || '').toString().trim();
      const vsId = r.id != null ? String(r.id) : '';
      onNavigate?.('walker-booking', {
        vendorId: vid,
        walker: buildWalkerPayload(walker),
        serviceType: 'walking',
        serviceStyle: 'at_home',
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
        serviceStyle: 'at_home',
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

  // Prepare stats for ServiceDashboardHeader
  const dashboardStats = stats ? [
    { value: `${stats.walkers}+`, label: 'Walkers' },
    { value: stats.walks, label: 'Walks' },
    { value: `*${stats.rating}`, label: 'Rating' }
  ] : [
    { value: '30+', label: 'Walkers' },
    { value: '2K+', label: 'Walks' },
    { value: '*4.8', label: 'Rating' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ FIX: Use ServiceDashboardHeader to match vet service UI frame */}
      <ServiceDashboardHeader
        serviceName="Dog Walking"
        serviceSubtitle="Professional pet walking services"
        serviceIcon={Dog}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />
      
      {/* Search: maps to GET /customer/vendors/search?query=… + explicit Search / Enter */}
      <div className="max-w-md mx-auto px-4 pt-4 pb-4 bg-white">
        <div className="flex gap-2 items-stretch">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="search"
              enterKeyHint="search"
              placeholder="Search walkers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void loadWalkers();
                }
              }}
              className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              aria-label="Search walkers by name or area"
            />
          </div>
          <Button
            type="button"
            className="shrink-0 px-4 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white rounded-xl font-semibold"
            onClick={() => void loadWalkers()}
          >
            Search
          </Button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
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
                onClick={() => onNavigate?.('walk-live-tracking', { sessionId: activeWalks[0].id })}
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
                      {pkg.remainingSessions === 'unlimited' ? 'Unlimited' : `${pkg.remainingSessions} sessions left`}
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

        {/* Hero Banner */}
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Professional Pet Walking</h2>
              <p className="text-gray-700 mb-4">Exercise, companionship & care</p>
            </div>
            <div className="flex-shrink-0 w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center">
              <Dog className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </Card>

        {/* Promotion Banner - Phase 0.1 Integration */}
        <PromotionBanner service="walking" maxPromotions={3} onNavigate={onNavigate} />

        {/* Problem Grid - Walk by Need */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-orange-50 rounded-lg">
                <Footprints className="w-4 h-4 text-orange-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Walk by Need</h2>
            </div>
            <button 
              onClick={() => onNavigate?.('problem_grid')}
              className="text-sm text-orange-500 font-medium hover:text-orange-600 transition-colors"
            >
              View All
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(walkingNeeds.length > 0 ? walkingNeeds : WALKING_NEEDS).map((need) => {
              const isViewAll = need.id === 'view_all';
              const hasAdminTint = Boolean((need as { iconBg?: string }).iconBg) && !isViewAll;
              return (
                <button
                  key={need.id}
                  onClick={() => {
                    if (isViewAll) {
                      onNavigate?.('problem_grid');
                    } else {
                      onNavigate?.('problem_selected', { problemId: need.id, problemTitle: need.name });
                    }
                  }}
                  className="group relative flex flex-col items-center"
                >
                  <div className={`
                    w-full aspect-square rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-2 p-2
                    ${isViewAll 
                      ? 'bg-orange-50 border-orange-100 text-orange-600 hover:bg-orange-100' 
                      : 'bg-white border-slate-100 text-slate-600 hover:border-orange-200 hover:shadow-md hover:-translate-y-0.5'
                    }
                  `}>
                    <div
                      className={`
                      w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110
                      ${
                        isViewAll
                          ? 'bg-white/50'
                          : hasAdminTint
                            ? `${(need as { iconBg?: string }).iconBg} group-hover:opacity-90`
                            : 'bg-slate-50 group-hover:bg-orange-50'
                      }
                    `}
                    >
                      {typeof need.icon === 'string' ? (
                        <span className="text-xl">{need.icon}</span>
                      ) : (
                        <div
                          className={
                            hasAdminTint ? '' : 'text-slate-600 group-hover:text-orange-500'
                          }
                        >
                          {need.icon}
                        </div>
                      )}
                    </div>
                    <p className={`
                      text-[10px] font-medium text-center leading-tight line-clamp-2
                      ${isViewAll ? 'text-orange-600' : 'text-slate-600 group-hover:text-orange-600'}
                    `}>
                      {need.name}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

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
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
          ) : walkers.length === 0 ? (
            <Card className="p-8 text-center">
              <Dog className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Walkers Found</h3>
              <p className="text-sm text-gray-500">Try adjusting your search or check back later</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {walkers.map((walker, index) => (
                <Card 
                  key={walker.id || walker.vendorId || index} 
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleWalkerSelect(walker)}
                >
                  <div className="relative">
                    <WalkerListCardHero walker={walker as Record<string, unknown>} />
                    <div className="absolute top-3 left-3 z-10 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                      <Star className="w-3 h-3 fill-white" />
                      {walker.rating || 4.5}
                    </div>
                    <button
                      type="button"
                      aria-label={`View ${walker.name || walker.businessName || 'walker'} profile`}
                      className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-white/95 text-orange-600 shadow-md flex items-center justify-center hover:bg-white transition-colors"
                      onClick={(e) => handleOpenWalkerProfile(walker, e)}
                    >
                      <ChevronRight className="w-5 h-5" aria-hidden />
                    </button>
                  </div>

                  {/* Walker Details */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{walker.name || walker.businessName || 'Pet Walker'}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <MapPin className="w-4 h-4" />
                        <span>{walker.location?.address || walker.address || walker.city || 'Location'}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="text-gray-600">{walker.reviewsCount || walker.reviewCount || 0} reviews</span>
                        {walker.priceRange && (
                          <span className="text-orange-500 font-semibold">{walker.priceRange}</span>
                        )}
                        {walker.experience && (
                          <span className="text-gray-500">• {walker.experience}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => void handleViewWalkerPackages(walker, e)}
                        className="flex-1 h-12 text-base font-semibold border-orange-200 text-orange-700 hover:bg-orange-50"
                      >
                        <Package className="w-4 h-4 mr-2 shrink-0" />
                        View packages
                      </Button>
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWalkerSelect(walker);
                        }}
                        className="flex-1 bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] hover:from-[#FF7A35] hover:to-[#FF5A25] text-white h-12 text-base font-semibold shadow-lg"
                      >
                        <Dog className="w-5 h-5 mr-2 shrink-0" />
                        Book Walker
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
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
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Packages{packagesWalkerName ? ` — ${packagesWalkerName}` : ''}</DialogTitle>
            <DialogDescription>
              Walk bundles and offers this walker has published.
            </DialogDescription>
          </DialogHeader>
          {packagesLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
            </div>
          ) : walkerPackagesList.length === 0 ? (
            <p className="text-sm text-gray-600 py-4 text-center">No packages listed yet for this walker.</p>
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
                    `Package ${i + 1}`;
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
                  return (
                    <li key={entry.dedupeKey}>
                      <Card className="p-3 border-orange-100">
                        <p className="font-semibold text-gray-900">{name}</p>
                        {desc ? <p className="text-sm text-gray-600 mt-1 line-clamp-3">{desc}</p> : null}
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
                          Book this package
                        </Button>
                      </Card>
                    </li>
                  );
                })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
