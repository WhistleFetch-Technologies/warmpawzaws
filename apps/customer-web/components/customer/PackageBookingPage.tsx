'use client';

/**
 * PACKAGE BOOKING PAGE - COMPLETE IMPLEMENTATION
 * 
 * Features:
 * - Browse available packages (training, grooming bundles)
 * - View session breakdown
 * - Schedule multiple sessions
 * - Track package progress
 * - Session status management
 * 
 * Status: ✅ P0 IMPLEMENTATION
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { petsFromApiResponse, type PetUi } from '@/lib/extract-pets-from-api';
import { fetchCheckoutEmailForPrefill } from '@/lib/razorpay/build-standard-checkout-options';
import { openStandardRazorpayCheckout } from '@/lib/razorpay/open-standard-razorpay-checkout';
import { toast } from 'sonner';
import { Package, Check, ChevronRight, Info, Star, Users, Dog, Footprints, Receipt } from 'lucide-react';
import { isVendorServicePackageRow } from '@/lib/vendor-package-purchase-nav';
import {
  findDuplicateSlotIndices,
  hasDuplicatePackageSlotTimes,
  isTimeTakenByOtherSlot,
} from '@/lib/ecommerce/package-slot-times';

const scheduleFieldInputClassName =
  'w-full min-w-0 max-w-full box-border rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500';

function parseServiceMetadata(m: unknown): Record<string, unknown> {
  if (m == null) return {};
  if (typeof m === 'string') {
    try {
      const p = JSON.parse(m) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      return {};
    }
    return {};
  }
  if (typeof m === 'object' && !Array.isArray(m)) return m as Record<string, unknown>;
  return {};
}

/** GET /vendor/services/:vendorId returns `allServices` plus `services` grouped by style — flatten for browse. */
function flattenVendorServicesPayload(res: Record<string, unknown> | null | undefined): unknown[] {
  if (!res || typeof res !== 'object') return [];
  const out: unknown[] = [];
  const pushArr = (v: unknown) => {
    if (Array.isArray(v)) out.push(...v);
  };
  pushArr(res.allServices);
  pushArr(res.services);
  const nested = res.services;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    for (const key of Object.keys(nested)) {
      const bucket = (nested as Record<string, unknown>)[key];
      if (bucket && typeof bucket === 'object' && !Array.isArray(bucket)) {
        pushArr((bucket as Record<string, unknown>).services);
      }
    }
  }
  pushArr(res.disallowedLegacy);
  return out;
}

function vendorServicesRowPk(s: Record<string, unknown>): string {
  return String(s.id ?? s.vendorServiceId ?? s.vendor_service_id ?? '').trim();
}

function isPublishedVendorService(pub: string): boolean {
  // Backward compatibility: many older vendor_services rows are usable with null/empty status.
  return (
    pub === 'published' ||
    pub === 'auto_published' ||
    pub === 'active' ||
    pub === 'enabled' ||
    pub === ''
  );
}

export type VendorPackageIntent = {
  vendorId: string;
  /** When set, this row is pre-selected at top (from grooming/vet navigation). */
  vendorServiceId?: string;
  serviceName?: string;
  totalSessions?: number;
  price?: number;
  duration?: number;
  serviceType?: string;
  serviceStyle?: string;
  description?: string;
  vendorName?: string;
  /** Visits per calendar day (e.g. 2 → customer picks two times on the first day). */
  sessionsPerDay?: number;
  /** Days between day-blocks (default 7 = same weekday next week). */
  sessionIntervalDays?: number;
};

interface PackageItem {
  id: string;
  name: string;
  description: string;
  vendorId: string;
  vendorName: string;
  totalSessions: number;
  pricePerSession: number;
  totalPrice: number;
  discount?: number;
  duration: number; // per session in minutes
  category: string;
  popular?: boolean;
  /** When set, purchase uses POST /packages/purchase-from-vendor-service */
  vendorServiceId?: string;
  sessionsPerDay?: number;
  sessionIntervalDays?: number;
}

interface Session {
  id: string;
  sessionNumber: number;
  status: 'scheduled' | 'pending_schedule' | 'completed';
  scheduledDate?: string;
  completedAt?: string;
}

interface PackageBooking {
  id: string;
  packageId: string;
  packageName: string;
  totalSessions: number;
  completedSessions: number;
  status: 'active' | 'completed' | 'cancelled';
  sessions: Session[];
  createdAt: string;
}

export interface WalkSessionIntent {
  serviceId: string;
  serviceName: string;
  price: number;
  duration: number;
}

function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const w = window as unknown as { Razorpay?: unknown };
  if (w.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      const deadline = Date.now() + 15000;
      const tick = setInterval(() => {
        const win = window as unknown as { Razorpay?: unknown };
        if (win.Razorpay) {
          clearInterval(tick);
          resolve();
        } else if (Date.now() > deadline) {
          clearInterval(tick);
          reject(new Error('Razorpay script timeout'));
        }
      }, 80);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      const win = window as unknown as { Razorpay?: unknown };
      if (win.Razorpay) resolve();
      else reject(new Error('Razorpay unavailable'));
    };
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
}

interface PackageBookingPageProps {
  customerPhone: string;
  customerId: string;
  petId?: string;
  onBack?: () => void;
  /** Expose step-aware back for shell header / hardware back. */
  onInternalBackReady?: (handleBack: () => void) => void;
  /** Walker / home-service flow: custom vendor_services package + vendor catalog */
  vendorPackageIntent?: VendorPackageIntent | null;
  /** Single walk (30/60 min) chosen from dog walking — show summary + path back to pick a walker */
  walkSessionIntent?: WalkSessionIntent | null;
  onContinueToChooseWalker?: () => void;
}

export function PackageBookingPage({
  customerPhone,
  customerId,
  petId,
  onBack,
  onInternalBackReady,
  vendorPackageIntent,
  walkSessionIntent,
  onContinueToChooseWalker,
}: PackageBookingPageProps) {
  const [view, setView] = useState<'browse' | 'schedule' | 'review' | 'my-packages'>('browse');
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [myPackages, setMyPackages] = useState<PackageBooking[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PackageItem | null>(null);
  /** First session calendar date; all sessions use this cadence weekly at `startingSessionTime`. */
  const [startingSessionDate, setStartingSessionDate] = useState('');
  /** Same clock time for every session when `sessionsPerDay` is 1; otherwise first row only. */
  const [startingSessionTime, setStartingSessionTime] = useState('');
  /** When package has N sessions per day: N time values for the first calendar day (same order repeats each block). */
  const [perDaySessionTimes, setPerDaySessionTimes] = useState<string[]>(['']);
  /** Inline hint when user tries to pick a time already used by another first-day slot. */
  const [slotFieldHints, setSlotFieldHints] = useState<Record<number, string>>({});
  const [schedulePets, setSchedulePets] = useState<PetUi[]>([]);
  const [petsLoading, setPetsLoading] = useState(false);
  const [localPetId, setLocalPetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  /** Server pricing quote (GST + platform fee) — same shape as UniversalPaymentPage. */
  const [priceQuote, setPriceQuote] = useState<{
    basePrice: number;
    tax: number;
    discount?: number;
    finalPrice: number;
    taxBreakdown?: Array<{ name: string; rate: number; amount: number }>;
    platformFee?: number;
    convenienceFee?: number;
    deliveryFee?: number;
    packagingFee?: number;
    totalAmount?: number;
  } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [packagePolicy, setPackagePolicy] = useState<{
    cancellationPolicy: string;
    refundPolicy: string;
    version: string;
  } | null>(null);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const purchaseAttemptKeyRef = useRef<string | null>(null);

  useEffect(() => {
    loadPackages();
    loadMyPackages();
  }, [customerId, vendorPackageIntent?.vendorId, vendorPackageIntent?.vendorServiceId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!customerPhone) return;
      try {
        const res = (await apiClient.get(
          `/customer/wallet?phone=${encodeURIComponent(customerPhone)}`
        )) as any;
        if (cancelled) return;
        const bal = Number(res?.wallet?.balance ?? res?.balance ?? 0);
        setWalletBalance(Number.isFinite(bal) ? bal : 0);
      } catch {
        if (!cancelled) setWalletBalance(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerPhone]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!customerPhone) return;
      setPetsLoading(true);
      try {
        let res: unknown = null;
        try {
          res = await apiClient.get(`/customer/pets/${encodeURIComponent(customerPhone)}`);
        } catch {
          try {
            res = await apiClient.get(`/customer/pets?phone=${encodeURIComponent(customerPhone)}`);
          } catch {
            if (customerId && customerId !== customerPhone) {
              try {
                res = await apiClient.get(`/customer/${encodeURIComponent(customerId)}/pets`);
              } catch {
                res = null;
              }
            }
          }
        }
        if (cancelled) return;
        const list = petsFromApiResponse(res);
        setSchedulePets(list);
        setLocalPetId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          if (petId && list.some((p) => p.id === petId)) return petId;
          try {
            const last = sessionStorage.getItem(`warmpawz_last_pet_${customerPhone}`);
            if (last && list.some((p) => p.id === last)) return last;
          } catch {
            /* ignore */
          }
          if (list.length === 1) return list[0].id;
          return null;
        });
      } catch {
        if (!cancelled) setSchedulePets([]);
      } finally {
        if (!cancelled) setPetsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerPhone, customerId, petId]);

  useEffect(() => {
    if (!petId || localPetId) return;
    if (schedulePets.some((p) => p.id === petId)) setLocalPetId(petId);
  }, [petId, schedulePets, localPetId]);

  useEffect(() => {
    if (view !== 'review') {
      setPriceQuote(null);
      setPackagePolicy(null);
      setPolicyAccepted(false);
      return;
    }
    if (!selectedPackage?.vendorServiceId) return;
    let cancelled = false;
    (async () => {
      setQuoteLoading(true);
      try {
        // Server-of-truth: same pipeline (taxCalculationService + calculateFinalFees)
        // is used here AND for the Razorpay order amount, guaranteeing parity.
        const res = (await apiClient.post('/packages/quote', {
          customerId,
          vendorId: selectedPackage.vendorId,
          vendorServiceId: selectedPackage.vendorServiceId,
        })) as {
          success?: boolean;
          basePrice?: number;
          tax?: number;
          discount?: number;
          finalPrice?: number;
          totalAmount?: number;
          taxBreakdown?: Array<{ name: string; rate: number; amount: number }>;
          platformFee?: number;
          convenienceFee?: number;
          deliveryFee?: number;
          packagingFee?: number;
          policy?: { cancellationPolicy?: string; refundPolicy?: string; version?: string };
        };
        if (cancelled) return;
        if (res?.success && res.finalPrice != null) {
          setPriceQuote({
            basePrice: Number(res.basePrice) || 0,
            tax: Number(res.tax) || 0,
            discount: Number(res.discount) || 0,
            finalPrice: Number(res.finalPrice ?? res.totalAmount) || 0,
            taxBreakdown: Array.isArray(res.taxBreakdown) ? res.taxBreakdown : [],
            platformFee: Number(res.platformFee) || 0,
            convenienceFee: Number(res.convenienceFee) || 0,
            deliveryFee: Number(res.deliveryFee) || 0,
            packagingFee: Number(res.packagingFee) || 0,
            totalAmount: Number(res.totalAmount ?? res.finalPrice) || 0,
          });
          if (res.policy) {
            setPackagePolicy({
              cancellationPolicy: String(res.policy.cancellationPolicy || ''),
              refundPolicy: String(res.policy.refundPolicy || ''),
              version: String(res.policy.version || ''),
            });
          }
        } else {
          setPriceQuote(null);
          setPackagePolicy(null);
        }
      } catch {
        if (!cancelled) {
          setPriceQuote(null);
          setPackagePolicy(null);
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, selectedPackage?.vendorServiceId, selectedPackage?.vendorId, selectedPackage?.id, customerId]);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const itemMap = new Map<string, PackageItem>();
      const intent = vendorPackageIntent;
      const intentVendorId = String(intent?.vendorId ?? '').trim();
      const intentVsId = String(intent?.vendorServiceId ?? '').trim();
      const strictDedicatedIntent = Boolean(intentVendorId && intentVsId);

      const upsertItem = (item: PackageItem) => {
        const key = item.vendorServiceId
          ? `vs:${item.vendorServiceId}`
          : item.id.startsWith('vs-')
            ? item.id
            : `pkg:${item.id}`;
        if (!itemMap.has(key)) itemMap.set(key, item);
      };

      /** Single browse card from navigation intent when API row is missing or unusable (strict dedicated only). */
      const upsertDedicatedPackageFromNavigationIntent = (p: VendorPackageIntent & { vendorServiceId: string }) => {
        const sid = String(p.vendorServiceId || '').trim();
        const vid = String(p.vendorId || '').trim();
        if (!sid || !vid) return;
        const ts = Math.max(1, Number(p.totalSessions ?? 1));
        const price = Number(p.price ?? 0);
        const spd = Math.max(1, Math.min(24, Number(p.sessionsPerDay) || 1));
        const intv = Math.max(1, Math.min(366, Number(p.sessionIntervalDays) || 7));
        upsertItem({
          id: `vs-${sid}`,
          vendorServiceId: sid,
          vendorId: vid,
          name: p.serviceName ?? 'Package',
          description: p.description ?? '',
          vendorName: p.vendorName || 'Your provider',
          totalSessions: ts,
          pricePerSession: ts > 0 ? Math.round(price / ts) : price,
          totalPrice: price,
          duration: p.duration ?? 60,
          category: p.serviceType ?? 'walking',
          popular: true,
          sessionsPerDay: spd,
          sessionIntervalDays: intv,
        });
      };

      let dedicatedRowMatchedApi = false;
      const skippedBroadEndpoints = strictDedicatedIntent;

      console.info('[PackageBookingPage] loadPackages', {
        strictDedicatedIntent,
        vendorId: intentVendorId || undefined,
        vendorServiceId: intentVsId || undefined,
        skippedBroadEndpoints,
      });

      if (intentVendorId) {
        if (strictDedicatedIntent && intentVsId && intent) {
          try {
            const vsRes = (await apiClient.get(
              `/vendor/services/${encodeURIComponent(intentVendorId)}`
            )) as any;
            const all: unknown[] = flattenVendorServicesPayload(vsRes as Record<string, unknown>);
            const matched = all.find((raw) => vendorServicesRowPk(raw as Record<string, unknown>) === intentVsId) as
              | Record<string, unknown>
              | undefined;

            if (matched) {
              dedicatedRowMatchedApi = true;
              const pub = String(matched.publishStatus ?? matched.publish_status ?? '').toLowerCase();
              if (isPublishedVendorService(pub) && matched.isEnabled !== false && matched.is_enabled !== false) {
                const meta = parseServiceMetadata(matched.metadata);
                const pd = (matched.packageDetails ?? meta.packageDetails) as Record<string, unknown> | undefined;
                const ts = Math.max(
                  1,
                  Number(
                    pd?.totalSessions ??
                      pd?.total_sessions ??
                      meta.totalSessions ??
                      intent.totalSessions ??
                      1
                  ) || 1
                );
                const price =
                  Number(
                    pd?.packagePrice ??
                      pd?.price ??
                      matched.price ??
                      matched.custom_price ??
                      intent.price ??
                      0
                  ) || 0;
                const spd = Math.max(
                  1,
                  Math.min(
                    24,
                    Number(
                      pd?.sessionsPerDay ??
                        pd?.sessions_per_day ??
                        meta.sessionsPerDay ??
                        intent.sessionsPerDay ??
                        1
                    ) || 1
                  )
                );
                const intv = Math.max(
                  1,
                  Math.min(
                    366,
                    Number(
                      pd?.sessionIntervalDays ??
                        pd?.session_interval_days ??
                        meta.sessionIntervalDays ??
                        intent.sessionIntervalDays ??
                        7
                    ) || 7
                  )
                );
                const name = String(
                  matched.serviceName ?? matched.name ?? matched.service_name ?? intent.serviceName ?? 'Package'
                );
                const desc = String(matched.description ?? intent.description ?? '');
                const duration =
                  Number(
                    matched.duration ??
                      matched.duration_minutes ??
                      matched.custom_duration ??
                      intent.duration ??
                      60
                  ) || 60;
                const category = String(
                  matched.category ?? matched.categoryName ?? matched.subCategory ?? intent.serviceType ?? 'walking'
                );
                upsertItem({
                  id: `vs-${intentVsId}`,
                  vendorServiceId: intentVsId,
                  vendorId: intentVendorId,
                  name,
                  description: desc,
                  vendorName: String(intent.vendorName || 'Vendor'),
                  totalSessions: ts,
                  pricePerSession: ts > 0 ? Math.round(price / ts) : price,
                  totalPrice: price,
                  duration,
                  category,
                  popular: true,
                  sessionsPerDay: spd,
                  sessionIntervalDays: intv,
                });
              }
            }
          } catch (e) {
            console.warn('[PackageBookingPage] dedicated vendor_services lookup:', e);
          }

          const dedicatedKey = `vs:${intentVsId}`;
          if (!itemMap.has(dedicatedKey)) {
            console.info('[PackageBookingPage] loadPackages strict_fallback=intent_payload (no usable API row)');
            upsertDedicatedPackageFromNavigationIntent(intent as VendorPackageIntent & { vendorServiceId: string });
          }

          console.info('[PackageBookingPage] loadPackages strictDedicated summary', {
            dedicatedRowMatchedApi,
            skippedBroadEndpoints,
          });
        } else {
          try {
            const res = (await apiClient.get(`/vendor/${encodeURIComponent(intentVendorId)}/packages`)) as any;
            const rows = Array.isArray(res?.packages) ? res.packages : [];
            for (const p of rows) {
              const sc = Number(p.session_count ?? p.total_sessions ?? p.sessions_included);
              const ts =
                !Number.isFinite(sc) || sc <= 0 ? 1 : sc < 0 ? 1 : Math.min(365, Math.floor(sc));
              const price = Number(p.price ?? 0);
              const meta =
                p.metadata && typeof p.metadata === 'object' && !Array.isArray(p.metadata)
                  ? (p.metadata as Record<string, unknown>)
                  : undefined;
              const pd = (p.packageDetails ??
                p.package_details ??
                meta?.packageDetails) as Record<string, unknown> | undefined;
              const spd = Math.max(
                1,
                Math.min(
                  24,
                  Number(
                    p.sessions_per_day ??
                      p.sessionsPerDay ??
                      pd?.sessions_per_day ??
                      pd?.sessionsPerDay ??
                      meta?.sessions_per_day ??
                      meta?.sessionsPerDay
                  ) || 1
                )
              );
              const intv = Math.max(
                1,
                Math.min(
                  366,
                  Number(
                    p.session_interval_days ??
                      p.sessionIntervalDays ??
                      pd?.session_interval_days ??
                      pd?.sessionIntervalDays ??
                      pd?.frequencyDays ??
                      meta?.session_interval_days ??
                      meta?.sessionIntervalDays ??
                      meta?.frequencyDays
                  ) || 7
                )
              );
              upsertItem({
                id: String(p.id),
                vendorId: String(p.vendor_id ?? intentVendorId),
                name: String(p.name ?? p.package_name ?? 'Package'),
                description: String(p.description ?? ''),
                vendorName: String(intent?.vendorName || 'Vendor'),
                totalSessions: ts,
                pricePerSession: ts > 0 ? Math.round(price / ts) : price,
                totalPrice: price,
                duration: Number(p.duration_minutes ?? p.duration ?? intent?.duration ?? 60),
                category: String(p.service_type ?? 'walking'),
                popular: false,
                sessionsPerDay: spd,
                sessionIntervalDays: intv,
              });
            }
          } catch (e) {
            console.warn('[PackageBookingPage] vendor packages:', e);
          }

          try {
            const vsRes = (await apiClient.get(
              `/vendor/services/${encodeURIComponent(intentVendorId)}`
            )) as any;
            const all: unknown[] = flattenVendorServicesPayload(vsRes as Record<string, unknown>);
            for (const raw of all) {
              const s = raw as Record<string, unknown>;
              const pub = String(s.publishStatus ?? s.publish_status ?? '').toLowerCase();
              if (!isPublishedVendorService(pub)) continue;
              if (s.isEnabled === false || s.is_enabled === false) continue;
              const meta = parseServiceMetadata(s.metadata);
              const rowForCheck: Record<string, unknown> = {
                ...s,
                isPackage: s.isPackage ?? meta.isPackage,
                packageDetails: s.packageDetails ?? meta.packageDetails,
                metadata: meta,
              };
              if (!isVendorServicePackageRow(rowForCheck)) continue;
              const vsid = vendorServicesRowPk(s);
              if (!vsid) continue;
              const pd = (s.packageDetails ?? meta.packageDetails) as Record<string, unknown> | undefined;
              const ts = Math.max(
                1,
                Number(pd?.totalSessions ?? pd?.total_sessions ?? meta.totalSessions ?? 1) || 1
              );
              const price = Number(
                pd?.packagePrice ?? pd?.price ?? s.price ?? s.custom_price ?? 0
              ) || 0;
              const spd = Math.max(
                1,
                Math.min(
                  24,
                  Number(
                    pd?.sessionsPerDay ?? pd?.sessions_per_day ?? meta.sessionsPerDay ?? 1
                  ) || 1
                )
              );
              const intv = Math.max(
                1,
                Math.min(
                  366,
                  Number(
                    pd?.sessionIntervalDays ??
                      pd?.session_interval_days ??
                      meta.sessionIntervalDays ??
                      7
                  ) || 7
                )
              );
              const name = String(s.serviceName ?? s.name ?? s.service_name ?? 'Package');
              const desc = String(s.description ?? '');
              const duration =
                Number(s.duration ?? s.duration_minutes ?? s.custom_duration ?? 60) || 60;
              const category = String(s.category ?? s.categoryName ?? s.subCategory ?? 'walking');
              upsertItem({
                id: `vs-${vsid}`,
                vendorServiceId: vsid,
                vendorId: String(intentVendorId),
                name,
                description: desc,
                vendorName: String(intent?.vendorName || 'Vendor'),
                totalSessions: ts,
                pricePerSession: ts > 0 ? Math.round(price / ts) : price,
                totalPrice: price,
                duration,
                category,
                popular: false,
                sessionsPerDay: spd,
                sessionIntervalDays: intv,
              });
            }
          } catch (e) {
            console.warn('[PackageBookingPage] vendor_services package offerings:', e);
          }

          console.info('[PackageBookingPage] loadPackages vendor browse (broad)', {
            vendorId: intentVendorId,
          });
        }
      }

      let items = Array.from(itemMap.values());
      if (strictDedicatedIntent && intentVsId) {
        items = items.filter(
          (it) =>
            String(it.vendorServiceId || '').trim() === intentVsId || it.id === `vs-${intentVsId}`
        );
      }
      items.sort((a, b) => {
        if (a.popular !== b.popular) return a.popular ? -1 : 1;
        return a.totalPrice - b.totalPrice;
      });
      setPackages(items);
    } catch (err) {
      console.error('Error loading packages:', err);
      setError('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  const loadMyPackages = async () => {
    try {
      const res = await apiClient
        .get<any>(`/customer/${encodeURIComponent(customerPhone)}/packages`)
        .catch(() => null);
      const rows: any[] = Array.isArray(res?.packages) ? res.packages : [];
      setMyPackages(
        rows.map((p) => {
          const total = Number(p.totalSessions ?? p.total_sessions ?? 0);
          const used = Number(p.sessionsUsed ?? p.sessions_used ?? 0);
          const unlimited = p.isUnlimited || p.remainingSessions === 'unlimited';
          return {
            id: String(p.id),
            packageId: String(p.packageId || p.id),
            packageName: String(p.packageName || p.package_name || 'Package'),
            totalSessions: unlimited ? Math.max(used, 1) : total || Math.max(used, 1),
            completedSessions: unlimited ? used : used,
            status: (p.status === 'cancelled' || p.status === 'canceled'
              ? 'cancelled'
              : p.status === 'exhausted' || p.status === 'expired'
                ? 'completed'
                : 'active') as
              | 'active'
              | 'completed'
              | 'cancelled',
            sessions: [],
            createdAt: p.expiresAt || p.expires_at || new Date().toISOString(),
          };
        })
      );
    } catch (err) {
      console.error('Error loading my packages:', err);
      setMyPackages([]);
    }
  };

  const handlePackageSelect = (pkg: PackageItem) => {
    setSelectedPackage(pkg);
    setStartingSessionDate('');
    setStartingSessionTime('');
    const spd = Math.max(1, Math.min(24, Number(pkg.sessionsPerDay) || 1));
    setPerDaySessionTimes(Array.from({ length: spd }, () => ''));
    setSlotFieldHints({});
    setPriceQuote(null);
    purchaseAttemptKeyRef.current = null;
    setView('schedule');
    setError(null);
  };

  /** HH:mm for API (from `<input type="time" />`). */
  const normalizeTimeForApi = (t: string) => {
    const s = t.trim();
    if (!s) return '';
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return s.slice(0, 5);
    const hh = String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, '0');
    const mm = String(Math.min(59, Math.max(0, parseInt(m[2], 10)))).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const chosenPetId = localPetId || petId || null;
  const reviewGrossAmount = Number(
    priceQuote?.finalPrice ?? priceQuote?.totalAmount ?? selectedPackage?.totalPrice ?? 0
  );
  const reviewWalletToUse = useWallet ? Math.max(0, Math.min(walletBalance, reviewGrossAmount)) : 0;
  const reviewRazorpayPayable = Math.max(0, reviewGrossAmount - reviewWalletToUse);
  const isWalletFullyCoveringReview = useWallet && reviewRazorpayPayable <= 0.01;
  const canUseWalletInReview = walletBalance > 0.01;

  const validateScheduleForSubmit = (): string | null => {
    if (!selectedPackage) return 'Select a package';
    if (!chosenPetId) return 'Please select a pet first';
    const isVendorCatalog = Boolean(selectedPackage.vendorServiceId);
    const sessionsPerDay = Math.max(1, Math.min(24, Number(selectedPackage.sessionsPerDay) || 1));
    if (isVendorCatalog) {
      if (!startingSessionDate.trim()) return 'Please choose the first session date.';
      if (sessionsPerDay === 1) {
        if (!startingSessionTime.trim()) return 'Please choose a time for your sessions.';
      } else {
        const firstDayTimes = perDaySessionTimes.slice(0, sessionsPerDay);
        const missing = firstDayTimes.some((t) => !String(t || '').trim());
        if (missing) {
          return `This package has ${sessionsPerDay} sessions per day — please choose a time for each slot on the first day.`;
        }
        if (hasDuplicatePackageSlotTimes(firstDayTimes)) {
          return 'Each slot on the first day must use a different time.';
        }
      }
    } else if (!startingSessionDate.trim()) {
      return 'Please choose the first session date.';
    }
    return null;
  };

  /** True when date + time(s) are filled for the current package (vendor multi-slot uses perDaySessionTimes, not startingSessionTime). */
  const isScheduleStepReady = (): boolean => {
    if (!selectedPackage) return false;
    if (selectedPackage.vendorServiceId) {
      if (!startingSessionDate.trim()) return false;
      const spd = Math.max(1, Math.min(24, Number(selectedPackage.sessionsPerDay) || 1));
      if (spd === 1) return !!startingSessionTime.trim();
      const firstDayTimes = perDaySessionTimes.slice(0, spd);
      if (firstDayTimes.some((t) => !String(t || '').trim())) return false;
      return !hasDuplicatePackageSlotTimes(firstDayTimes);
    }
    return !!startingSessionDate.trim();
  };

  const formatDateLabel = (isoDate: string) => {
    const d = String(isoDate || '').trim();
    if (!d) return '—';
    const parsed = new Date(`${d}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTimeDisplay = (timeVal: string) => {
    const t = normalizeTimeForApi(String(timeVal || '').trim());
    if (!t) return '—';
    const [h, m] = t.split(':').map((x) => parseInt(x, 10));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return t;
    const dt = new Date();
    dt.setHours(h, m, 0, 0);
    return dt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const handlePerDaySlotTimeChange = (idx: number, rawValue: string) => {
    const spd = Math.max(1, Math.min(24, Number(selectedPackage?.sessionsPerDay) || 1));
    const currentTimes = perDaySessionTimes.slice(0, spd);
    if (rawValue.trim() && isTimeTakenByOtherSlot(currentTimes, idx, rawValue)) {
      setSlotFieldHints((prev) => ({
        ...prev,
        [idx]: 'This time is already used for another slot today. Pick a different time.',
      }));
      return;
    }
    const next = [...perDaySessionTimes];
    next[idx] = rawValue;
    setPerDaySessionTimes(next);
    setSlotFieldHints((prev) => {
      const updated = { ...prev };
      delete updated[idx];
      const dupes = findDuplicateSlotIndices(next.slice(0, spd));
      for (const i of Object.keys(updated).map(Number)) {
        if (!dupes.has(i)) delete updated[i];
      }
      return updated;
    });
    setError(null);
  };

  const continueToReview = () => {
    const err = validateScheduleForSubmit();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setView('review');
  };

  const pickPetAndRemember = (id: string) => {
    setLocalPetId(id);
    setError(null);
    try {
      sessionStorage.setItem(`warmpawz_last_pet_${customerPhone}`, id);
    } catch {
      /* ignore */
    }
  };

  const createPackageBooking = async () => {
    const vErr = validateScheduleForSubmit();
    if (vErr) {
      setError(vErr);
      return;
    }
    if (!selectedPackage) return;

    const isVendorCatalog = Boolean(selectedPackage.vendorServiceId);
    const sessionsPerDay = Math.max(1, Math.min(24, Number(selectedPackage.sessionsPerDay) || 1));

    // Hard gate: vendor packages require explicit policy acceptance before pay.
    if (isVendorCatalog && !policyAccepted) {
      setError('Please accept the cancellation and refund policy to continue.');
      return;
    }

    try {
      setBooking(true);
      setError(null);

      const timeForApi = normalizeTimeForApi(startingSessionTime);
      const sessionSchedule = (() => {
        if (!startingSessionDate.trim()) return [];
        if (!isVendorCatalog) {
          return [{ sessionNumber: 1, date: startingSessionDate.trim(), time: timeForApi || '09:00' }];
        }
        if (sessionsPerDay === 1) {
          return [{ sessionNumber: 1, date: startingSessionDate.trim(), time: timeForApi }];
        }
        const times = perDaySessionTimes.slice(0, sessionsPerDay).map((t) => normalizeTimeForApi(String(t)));
        return times.map((time, idx) => ({
          sessionNumber: idx + 1,
          date: startingSessionDate.trim(),
          time,
        }));
      })();

      if (selectedPackage.vendorServiceId) {
        const purchaseIdempotencyKey =
          purchaseAttemptKeyRef.current ||
          (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? `pkg_purchase_${crypto.randomUUID()}`
            : `pkg_purchase_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
        purchaseAttemptKeyRef.current = purchaseIdempotencyKey;

        const grossAmount = Number(
          priceQuote?.finalPrice ?? priceQuote?.totalAmount ?? selectedPackage.totalPrice ?? 0
        );
        const walletToUse = useWallet ? Math.max(0, Math.min(walletBalance, grossAmount)) : 0;
        const basePayload = {
          customerId,
          vendorId: selectedPackage.vendorId,
          vendorServiceId: selectedPackage.vendorServiceId,
          preferSameProvider: true,
          sessionSchedule,
          ...(chosenPetId ? { petId: chosenPetId } : {}),
          policyAccepted: true,
          ...(packagePolicy?.version ? { policyVersion: packagePolicy.version } : {}),
          useWallet,
          walletAmount: walletToUse,
          idempotencyKey: purchaseIdempotencyKey,
        };

        const res = (await apiClient.post('/packages/purchase-from-vendor-service', basePayload)) as any;
        if (!res?.success) {
          throw new Error(res?.error || 'Purchase failed');
        }

        if (res.requiresPayment && res.razorpayOrderId && res.razorpayKeyId) {
          await loadRazorpayCheckoutScript();
          const checkoutEmail = await fetchCheckoutEmailForPrefill(customerPhone);
          const amountRupees = Number(res.amount ?? selectedPackage.totalPrice ?? 0);
          const paymentIdFromOrder = String(res.paymentId || '').trim();

          let completed = false;
          await new Promise<void>((resolve) => {
            void openStandardRazorpayCheckout({
              key: res.razorpayKeyId,
              amountPaise: Math.max(1, Math.round(amountRupees * 100)),
              currency: res.currency || 'INR',
              name: 'Warmpawz',
              description: `Package — ${selectedPackage.name}`,
              order_id: res.razorpayOrderId,
              customerPhone,
              customerEmail: checkoutEmail,
              handler: async (response: any) => {
                try {
                  const walletApplied = Number(res?.walletApplied ?? walletToUse ?? 0) || 0;
                  const confirm = (await apiClient.post('/packages/purchase-from-vendor-service', {
                    ...basePayload,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    ...(paymentIdFromOrder ? { paymentId: paymentIdFromOrder } : {}),
                    useWallet: walletApplied > 0,
                    walletAmount: walletApplied,
                  })) as any;
                  if (!confirm?.success) {
                    throw new Error(confirm?.error || 'Purchase confirmation failed');
                  }
                  completed = true;
                  toast.success(
                    confirm.message ||
                      `Package purchased — ${confirm.purchase?.totalSessions ?? selectedPackage.totalSessions} sessions`
                  );
                  await loadMyPackages();
                  setView('my-packages');
                } catch (e: any) {
                  toast.error(e?.message || 'Could not confirm payment');
                } finally {
                  resolve();
                }
              },
              theme: { color: '#FF8C42' },
              modal: {
                ondismiss: () => resolve(),
              },
              onPaymentFailed: (err) => {
                toast.error(err.message);
                resolve();
              },
            }).catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Payment gateway not available');
              resolve();
            });
          });
          if (completed) return;
          return;
        }

        toast.success(
          res.message ||
            `Package purchased — ${res.purchase?.totalSessions ?? selectedPackage.totalSessions} sessions`
        );
        await loadMyPackages();
        setView('my-packages');
        return;
      }

      const pkgId = selectedPackage.id;
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pkgId)
      ) {
        const res = (await apiClient.post('/packages/convert-from-trial', {
          packageId: pkgId,
          customerId,
          preferSameProvider: true,
          sessionSchedule,
        })) as any;
        if (!res?.success) {
          throw new Error(res?.error || 'Purchase failed');
        }
        toast.success(res.message || 'Package purchased');
        await loadMyPackages();
        setView('my-packages');
        return;
      }

      setError('This package cannot be purchased from this screen. Try again after refresh.');
    } catch (err: any) {
      console.error('Error creating package booking:', err);
      setError(err.message || 'Failed to create booking');
    } finally {
      setBooking(false);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  /** review → schedule → browse → shell exit */
  const handleInternalBack = useCallback(() => {
    if (view === 'review') {
      setView('schedule');
      setError(null);
      return;
    }
    if (view === 'schedule') {
      setView('browse');
      setSelectedPackage(null);
      return;
    }
    if (view === 'my-packages') {
      setView('browse');
      return;
    }
    onBack?.();
  }, [view, onBack]);

  useEffect(() => {
    onInternalBackReady?.(handleInternalBack);
  }, [handleInternalBack, onInternalBackReady]);

  if (loading && view === 'browse') {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center cw-header-safe-top cw-header-safe-x max-w-customer mx-auto w-full bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full max-w-customer mx-auto overflow-x-hidden bg-gray-50 cw-header-safe-top cw-header-safe-x pb-24">
      {/* Header */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        {onBack && (
          <button
            type="button"
            onClick={handleInternalBack}
            className="mb-2 inline-flex min-h-11 min-w-11 items-center justify-start gap-2 rounded-lg px-1 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            aria-label="Go back"
          >
            <ChevronRight className="h-5 w-5 shrink-0 rotate-180" />
            <span className="text-sm font-medium">Back</span>
          </button>
        )}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Service Packages</h1>
        <p className="text-sm text-gray-600">
          Save more with multi-session packages
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {walkSessionIntent && onContinueToChooseWalker && (
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 shadow-sm mb-6">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-orange-100 flex items-center justify-center shrink-0">
              <Dog className="w-7 h-7 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 mb-1">Dog walking</p>
              <h2 className="text-lg font-bold text-gray-900">{walkSessionIntent.serviceName}</h2>
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-semibold text-orange-600">₹{walkSessionIntent.price}</span>
                {' / walk · '}
                {walkSessionIntent.duration} minutes
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Tap below to return to dog walking and pick a walker for this session.
              </p>
              <button
                type="button"
                onClick={onContinueToChooseWalker}
                className="mt-4 w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Footprints className="w-5 h-5" />
                Choose a walker
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setView('browse')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
            view === 'browse'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Browse Packages
        </button>
        <button
          type="button"
          onClick={() => setView('my-packages')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
            view === 'my-packages'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          My Packages ({myPackages.length})
        </button>
      </div>

      {/* Browse Packages View */}
      {view === 'browse' && (
        <div className="space-y-4">
          {packages.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-gray-200 shadow-sm">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden />
              <p className="text-gray-900 font-semibold mb-1">No packages available</p>
              <p className="text-sm text-gray-600 max-w-sm mx-auto">
                This provider has not published any multi-session packages yet. Check back later or choose
                another service.
              </p>
            </div>
          ) : null}
          {packages.map((pkg) => {
            const savings = pkg.discount || 0;
            const regularPrice = pkg.pricePerSession * pkg.totalSessions;
            
            return (
              <div
                key={pkg.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
              >
                {pkg.popular && (
                  <div className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold mb-3">
                    <Star className="w-3 h-3" />
                    Popular
                  </div>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">{pkg.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{pkg.description}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>{pkg.vendorName}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Sessions</div>
                    <div className="font-semibold text-gray-900">{pkg.totalSessions}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Per Session</div>
                    <div className="font-semibold text-gray-900">₹{pkg.pricePerSession}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Duration</div>
                    <div className="font-semibold text-gray-900">{pkg.duration}m</div>
                  </div>
                </div>

                {savings > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-green-700">You Save ₹{savings}</div>
                        <div className="text-xs text-green-600">Regular: <span className="cw-price-strike">₹{regularPrice}</span></div>
                      </div>
                      <div className="text-2xl font-bold text-green-700">₹{pkg.totalPrice}</div>
                    </div>
                  </div>
                )}

                {!savings && (
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-600">Total Package Price</span>
                    <span className="text-2xl font-bold text-gray-900">₹{pkg.totalPrice}</span>
                  </div>
                )}

                <button
                  onClick={() => handlePackageSelect(pkg)}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  Book Package
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Sessions View */}
      {view === 'schedule' && selectedPackage && (
        <div className="min-w-0 space-y-6 overflow-x-hidden">
          {/* Package Summary */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3">{selectedPackage.name}</h3>
            <p className="text-sm text-gray-800 mb-4 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2">
              <span className="font-semibold text-orange-800">
                You get {selectedPackage.totalSessions}{' '}
                {selectedPackage.totalSessions === 1 ? 'session' : 'sessions'}
              </span>{' '}
              with this package. You can book each session from your package later.
            </p>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-600">Sessions in package</span>
              <span className="font-semibold text-gray-900">{selectedPackage.totalSessions}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Amount</span>
              <span className="text-xl font-bold text-orange-600">₹{selectedPackage.totalPrice}</span>
            </div>
          </div>

          {/* Pet selection */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Dog className="w-5 h-5 text-orange-500 shrink-0" />
              Pet for this package
            </h3>
            <p className="text-xs text-gray-500 mb-3">Choose which pet this purchase is for.</p>
            {petsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600 py-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500" />
                Loading your pets…
              </div>
            ) : schedulePets.length === 0 ? (
              <p className="text-sm text-gray-600">
                No pets found on your account. Add a pet from your profile, then return here to book.
              </p>
            ) : (
              <div className="space-y-2">
                {schedulePets.map((p) => {
                  const selected = chosenPetId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickPetAndRemember(p.id)}
                      className={`w-full text-left rounded-lg border px-3 py-3 flex items-center gap-3 transition-colors ${
                        selected
                          ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-200'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          selected ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                        }`}
                      >
                        {selected ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900">{p.name}</div>
                        {(p.breed || p.species) && (
                          <div className="text-xs text-gray-500 truncate">
                            {[p.breed, p.species !== 'pet' ? p.species : null].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-semibold mb-1">
                  {selectedPackage.vendorServiceId ? 'Session schedule (required)' : 'Starting session (optional)'}
                </p>
                <p>
                  {selectedPackage.vendorServiceId ? (
                    <>
                      Pick the <strong>first day</strong> and{' '}
                      {(Number(selectedPackage.sessionsPerDay) || 1) > 1 ? (
                        <>
                          <strong>{Number(selectedPackage.sessionsPerDay) || 1} time slots</strong> on your first
                          day (multiple sessions that day). The next block of sessions uses the{' '}
                          <strong>next calendar day</strong>, then the day after that, and so on — same times each
                          day (e.g. sessions 1–2 on the 27th, 3–4 on the 28th, 5–6 on the 29th).
                        </>
                      ) : (
                        <>
                          the <strong>time</strong> for your visits. We repeat that time every{' '}
                          <strong>{Number(selectedPackage.sessionIntervalDays) || 7} days</strong> for each
                          remaining session.
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      Choose a date for your <strong>first</strong> session, or leave blank and schedule later
                      after payment where allowed.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-4 overflow-hidden rounded-xl bg-white p-4 shadow-sm">
            <div className="min-w-0">
              <h3 className="mb-1 font-semibold text-gray-900">
                {selectedPackage.vendorServiceId ? 'First session date' : 'First session date (optional)'}
              </h3>
              <p className="mb-3 text-xs text-gray-500">
                {selectedPackage.vendorServiceId
                  ? (Number(selectedPackage.sessionsPerDay) || 1) > 1
                    ? 'Required — first calendar day for sessions 1–N; later sessions move forward one day per block with the same daily times.'
                    : 'Required — later sessions repeat every calendar interval (e.g. weekly) at the same time.'
                  : 'Optional for some package types.'}
              </p>
              <div className="warmpawz-date-field-wrap">
                <input
                  type="date"
                  min={getMinDate()}
                  value={startingSessionDate}
                  onChange={(e) => {
                    setStartingSessionDate(e.target.value);
                    setError(null);
                  }}
                  className={scheduleFieldInputClassName}
                />
              </div>
            </div>
            {selectedPackage.vendorServiceId ? (
              (Number(selectedPackage.sessionsPerDay) || 1) > 1 ? (
                <div className="min-w-0 space-y-3">
                  <h3 className="mb-1 font-semibold text-gray-900">
                    Times on the first day ({Number(selectedPackage.sessionsPerDay) || 1} slots)
                  </h3>
                  <p className="mb-2 text-xs text-gray-500">
                    Each group of {Number(selectedPackage.sessionsPerDay) || 1} sessions stays on one calendar day;
                    the next group is the <strong>next day</strong>, until all {selectedPackage.totalSessions} sessions
                    are scheduled. Each slot on the first day must be a <strong>different time</strong>.
                  </p>
                  {perDaySessionTimes.slice(0, Number(selectedPackage.sessionsPerDay) || 1).map((t, idx) => (
                    <div key={idx} className="min-w-0">
                      <label className="mb-1 block text-xs text-gray-600">Session slot {idx + 1}</label>
                      <div className="warmpawz-time-field-wrap">
                        <input
                          type="time"
                          value={t}
                          onChange={(e) => handlePerDaySlotTimeChange(idx, e.target.value)}
                          className={`${scheduleFieldInputClassName}${
                            slotFieldHints[idx] ? ' border-red-400 focus:border-red-500 focus:ring-red-500' : ''
                          }`}
                          required
                        />
                      </div>
                      {slotFieldHints[idx] ? (
                        <p className="mt-1 text-xs text-red-600">{slotFieldHints[idx]}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="min-w-0">
                  <h3 className="mb-1 font-semibold text-gray-900">Time for every session</h3>
                  <p className="mb-3 text-xs text-gray-500">
                    Same clock time every {Number(selectedPackage.sessionIntervalDays) || 7} days for all{' '}
                    {selectedPackage.totalSessions} sessions.
                  </p>
                  <div className="warmpawz-time-field-wrap">
                    <input
                      type="time"
                      value={startingSessionTime}
                      onChange={(e) => {
                        setStartingSessionTime(e.target.value);
                        setError(null);
                      }}
                      className={scheduleFieldInputClassName}
                      required
                    />
                  </div>
                </div>
              )
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setView('browse')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={continueToReview}
              disabled={booking || !chosenPetId || !isScheduleStepReady()}
              className="bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              Continue to summary
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Booking summary — after schedule, before payment */}
      {view === 'review' && selectedPackage && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="w-5 h-5 text-orange-500 shrink-0" />
              <h2 className="text-lg font-bold text-gray-900">Booking summary</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {isWalletFullyCoveringReview
                ? 'Review your package and confirm booking. No online payment is required.'
                : 'Review your package and charges, then proceed to secure payment.'}
            </p>

            <div className="space-y-3 text-sm border-t border-gray-100 pt-3">
              <div className="flex justify-between gap-2">
                <span className="text-gray-600">Package</span>
                <span className="font-semibold text-gray-900 text-right">{selectedPackage.name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-600">Pet</span>
                <span className="font-medium text-gray-900 text-right">
                  {schedulePets.find((p) => p.id === chosenPetId)?.name || '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-600">Sessions</span>
                <span className="font-medium text-gray-900">{selectedPackage.totalSessions}</span>
              </div>
              {selectedPackage.vendorServiceId ? (
                <>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-600">First day</span>
                    <span className="font-medium text-gray-900 text-right">
                      {formatDateLabel(startingSessionDate)}
                    </span>
                  </div>
                  {(Number(selectedPackage.sessionsPerDay) || 1) > 1 ? (
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-2">
                      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Times on first day
                      </div>
                      {perDaySessionTimes
                        .slice(0, Number(selectedPackage.sessionsPerDay) || 1)
                        .map((t, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-600">Slot {idx + 1}</span>
                            <span className="font-medium text-gray-900">{formatTimeDisplay(t)}</span>
                          </div>
                        ))}
                      <p className="text-xs text-gray-500 pt-1">
                        Next sessions use <strong>consecutive calendar days</strong> (same times each day).
                      </p>
                    </div>
                  ) : (
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-600">Time (all sessions)</span>
                      <span className="font-medium text-gray-900">{formatTimeDisplay(startingSessionTime)}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between gap-2">
                  <span className="text-gray-600">First session</span>
                  <span className="font-medium text-gray-900 text-right">
                    {formatDateLabel(startingSessionDate)}{' '}
                    {startingSessionTime.trim()
                      ? `· ${formatTimeDisplay(startingSessionTime)}`
                      : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Price breakdown</h3>
            {selectedPackage.vendorServiceId && quoteLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600 py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500" />
                Calculating taxes…
              </div>
            ) : selectedPackage.vendorServiceId && priceQuote ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Service amount</span>
                  <span className="font-medium text-gray-900">₹{Math.round(priceQuote.basePrice).toLocaleString('en-IN')}</span>
                </div>
                {(priceQuote.discount ?? 0) > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Discount</span>
                    <span>− ₹{Math.round(priceQuote.discount ?? 0).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {(priceQuote.taxBreakdown?.length ?? 0) > 0 ? (
                  (priceQuote.taxBreakdown ?? []).map((row, i) => (
                    <div key={i} className="flex justify-between text-gray-700">
                      <span>
                        {row.name || 'GST'}
                        {row.rate != null && Number(row.rate) > 0 ? ` (${Number(row.rate)}%)` : ''}
                      </span>
                      <span>₹{Math.round(row.amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))
                ) : priceQuote.tax > 0 ? (
                  <div className="flex justify-between text-gray-700">
                    <span>GST / taxes</span>
                    <span>₹{Math.round(priceQuote.tax).toLocaleString('en-IN')}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-gray-600">
                    <span>GST / taxes</span>
                    <span className="text-gray-500">Included or nil</span>
                  </div>
                )}
                {/* Same fee categories as UniversalPaymentPage / normal bookings. */}
                {Number(priceQuote.platformFee) > 0 && (
                  <div className="flex justify-between text-gray-700 pt-2 border-t border-gray-100">
                    <span>Platform fee</span>
                    <span>₹{Math.round(priceQuote.platformFee || 0).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {Number(priceQuote.convenienceFee) > 0 && (
                  <div className="flex justify-between text-gray-700">
                    <span>Convenience fee</span>
                    <span>₹{Math.round(priceQuote.convenienceFee || 0).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {Number(priceQuote.deliveryFee) > 0 && (
                  <div className="flex justify-between text-gray-700">
                    <span>Delivery fee</span>
                    <span>₹{Math.round(priceQuote.deliveryFee || 0).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">Total payable</span>
                  <span className="text-xl font-bold text-orange-600">
                    ₹{Math.round(priceQuote.finalPrice).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Package total</span>
                  <span className="font-semibold text-gray-900">
                    ₹{selectedPackage.totalPrice.toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Detailed tax lines appear when available for your provider. Final amount is confirmed at payment.
                </p>
              </div>
            )}

            {canUseWalletInReview && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    checked={useWallet}
                    onChange={(e) => setUseWallet(e.target.checked)}
                    aria-label="Use wallet balance"
                  />
                  <span className="text-sm text-gray-800">
                    Use wallet balance (available ₹{Math.round(walletBalance).toLocaleString('en-IN')})
                  </span>
                </label>
                {useWallet && (
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-700">
                      <span>Wallet applied</span>
                      <span className="font-medium">− ₹{Math.round(reviewWalletToUse).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-gray-900">
                      <span>Razorpay payable</span>
                      <span>₹{Math.round(reviewRazorpayPayable).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-gray-500 mt-2">
              {useWallet
                ? 'Wallet amount will be used first. Remaining amount will be charged on Razorpay.'
                : 'This amount will be charged on Razorpay.'}
            </p>
          </div>

          {selectedPackage.vendorServiceId && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Cancellation & refund policy</h3>
              {packagePolicy?.cancellationPolicy || packagePolicy?.refundPolicy ? (
                <div className="space-y-2 text-sm text-gray-700">
                  {packagePolicy?.cancellationPolicy && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Cancellation
                      </div>
                      <p className="whitespace-pre-wrap leading-snug">
                        {packagePolicy.cancellationPolicy}
                      </p>
                    </div>
                  )}
                  {packagePolicy?.refundPolicy && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Refund
                      </div>
                      <p className="whitespace-pre-wrap leading-snug">
                        {packagePolicy.refundPolicy}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Standard Warmpawz cancellation and refund terms apply for this package.
                </p>
              )}
              <label className="mt-3 flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  checked={policyAccepted}
                  onChange={(e) => setPolicyAccepted(e.target.checked)}
                  aria-label="I have read and accept the cancellation and refund policy"
                />
                <span>
                  I have read and agree to the cancellation and refund policy for this package.
                </span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setView('schedule');
                setError(null);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={createPackageBooking}
              disabled={
                booking ||
                (Boolean(selectedPackage.vendorServiceId) && !policyAccepted)
              }
              title={
                Boolean(selectedPackage.vendorServiceId) && !policyAccepted
                  ? 'Accept the cancellation & refund policy to continue'
                  : undefined
              }
              className="bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {booking ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Processing…
                </>
              ) : (
                <>
                  {isWalletFullyCoveringReview
                    ? 'Confirm booking'
                    : reviewRazorpayPayable > 0.01
                      ? `Proceed to payment (₹${Math.round(reviewRazorpayPayable).toLocaleString('en-IN')})`
                      : 'Proceed to payment'}
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* My Packages View */}
      {view === 'my-packages' && (
        <div className="space-y-4">
          {myPackages.length === 0 ? (
            <div className="bg-white rounded-xl p-8 shadow-sm text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Active Packages</h3>
              <p className="text-sm text-gray-600 mb-4">
                You don't have any active packages yet. Browse and book packages to get started!
              </p>
              <button
                onClick={() => setView('browse')}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Browse Packages
              </button>
            </div>
          ) : (
            myPackages.map((pkg) => (
              <div key={pkg.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">{pkg.packageName}</h3>
                    <div className="text-sm text-gray-600">
                      {pkg.completedSessions} of {pkg.totalSessions} sessions completed
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    pkg.status === 'active' 
                      ? 'bg-green-100 text-green-700'
                      : pkg.status === 'cancelled'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}>
                    {pkg.status === 'active' ? 'In Progress' : pkg.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${(pkg.completedSessions / pkg.totalSessions) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>

                {/* Sessions */}
                <div className="space-y-2">
                  {pkg.sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          session.status === 'completed'
                            ? 'bg-green-500'
                            : session.status === 'scheduled'
                            ? 'bg-blue-500'
                            : 'bg-gray-300'
                        }`}>
                          {session.status === 'completed' && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          Session {session.sessionNumber}
                        </span>
                      </div>
                      
                      {session.scheduledDate && (
                        <span className="text-xs text-gray-600">
                          {new Date(session.scheduledDate).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default PackageBookingPage;
