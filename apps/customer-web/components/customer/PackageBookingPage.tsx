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
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { petsFromApiResponse, type PetUi } from '@/lib/extract-pets-from-api';
import { fetchCheckoutEmailForPrefill } from '@/lib/razorpay/build-standard-checkout-options';
import { openStandardRazorpayCheckout } from '@/lib/razorpay/open-standard-razorpay-checkout';
import { toast } from 'sonner';
import { isVendorServicePackageRow } from '@/lib/vendor-package-purchase-nav';
import {
  findDuplicateSlotIndices,
  hasDuplicatePackageSlotTimes,
  isTimeTakenByOtherSlot,
} from '@/lib/ecommerce/package-slot-times';
import {
  BrowsePackagesPanel,
  MyPackagesPanel,
  ReviewPackagePanel,
  SchedulePackagePanel,
  ServicePackagesShell,
  WalkSessionBanner,
  type OwnedPackageCard,
} from '@/components/customer/packages/ServicePackagesExperience';

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
  remainingSessions: number;
  unlimited?: boolean;
  status: string;
  sessions: Session[];
  createdAt: string;
  expiresAt?: string;
  petName?: string;
  petPhoto?: string;
  petBreed?: string;
  serviceLabel: string;
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
  /** Shown once after a verified purchase. Cleared on dismiss or when leaving My Packages. */
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const router = useRouter();
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
        const params = new URLSearchParams({ phone: customerPhone, channel: 'appointment' });
        const vendorId = vendorPackageIntent?.vendorId;
        if (vendorId) params.set('vendorId', String(vendorId));
        const res = (await apiClient.get(`/customer/wallet?${params.toString()}`)) as any;
        if (cancelled) return;
        const bal = Number(res?.wallet?.spendableBalance ?? res?.wallet?.balance ?? res?.balance ?? 0);
        setWalletBalance(Number.isFinite(bal) ? bal : 0);
      } catch {
        if (!cancelled) setWalletBalance(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerPhone, vendorPackageIntent?.vendorId]);

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
          const unlimited = Boolean(p.isUnlimited || p.remainingSessions === 'unlimited');
          const rawRemaining = p.remainingSessions ?? p.remaining_sessions;
          const remaining = unlimited
            ? Number.MAX_SAFE_INTEGER
            : Number(rawRemaining ?? Math.max(0, total - used));
          const name = String(p.packageName || p.package_name || 'Package');
          const style = String(p.serviceStyle || p.service_style || p.packageType || p.package_type || '');
          const vendorName = String(p.vendorName || p.vendor_name || '');
          const blob = `${name} ${style}`.toLowerCase();
          const serviceLabel = blob.includes('walk')
            ? 'Private walker'
            : blob.includes('groom')
              ? 'Grooming'
              : blob.includes('train')
                ? 'Training'
                : blob.includes('vet') || blob.includes('clinic')
                  ? 'Vet care'
                  : blob.includes('nutri')
                    ? 'Nutrition'
                    : vendorName || 'Service package';
          return {
            id: String(p.id),
            packageId: String(p.packageId || p.id),
            packageName: name,
            totalSessions: unlimited ? Math.max(used, total, 0) : total,
            completedSessions: used,
            remainingSessions: Number.isFinite(remaining) ? remaining : 0,
            unlimited,
            status: String(p.status || p.computed_status || 'active'),
            sessions: [],
            createdAt: String(p.purchasedAt || p.purchased_at || p.createdAt || p.created_at || ''),
            expiresAt: p.expiresAt || p.expires_at || undefined,
            petName: p.petName || p.pet_name || undefined,
            petPhoto: p.petPhoto || p.pet_photo || undefined,
            petBreed: p.petBreed || p.pet_breed || undefined,
            serviceLabel,
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
                  const sessionCount =
                    confirm.purchase?.remainingSessions ??
                    confirm.purchase?.totalSessions ??
                    selectedPackage.totalSessions;
                  setPurchaseNotice(`Package purchased! ${sessionCount} sessions available.`);
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

        const sessionCount =
          res.purchase?.remainingSessions ?? res.purchase?.totalSessions ?? selectedPackage.totalSessions;
        setPurchaseNotice(`Package purchased! ${sessionCount} sessions available.`);
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
        setPurchaseNotice(res.message || 'Package purchased!');
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
      setError(null);
      return;
    }
    if (view === 'my-packages') {
      setPurchaseNotice(null);
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
      <div className="flex min-h-screen min-h-[100dvh] w-full max-w-customer items-center justify-center bg-[#FFF9F3] cw-header-safe-top">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#FF6B0B]" />
      </div>
    );
  }

  const sessionsPerDay = Math.max(1, Math.min(24, Number(selectedPackage?.sessionsPerDay) || 1));
  const intervalDays = Math.max(1, Number(selectedPackage?.sessionIntervalDays) || 7);
  const chosenPet = schedulePets.find((p) => p.id === chosenPetId);
  const ownedCards: OwnedPackageCard[] = myPackages.map((pkg) => ({
    id: pkg.id,
    packageName: pkg.packageName,
    serviceLabel: pkg.serviceLabel,
    petName: pkg.petName,
    petPhoto: pkg.petPhoto,
    purchasedAt: pkg.createdAt || undefined,
    expiresAt: pkg.expiresAt,
    status: pkg.status,
    totalSessions: pkg.totalSessions,
    completedSessions: pkg.completedSessions,
    remainingSessions: pkg.unlimited ? Number.MAX_SAFE_INTEGER : pkg.remainingSessions,
    unlimited: pkg.unlimited,
  }));

  const reviewLines: Array<{ label: string; value: string; emphasize?: boolean }> = [];
  if (selectedPackage?.vendorServiceId && priceQuote) {
    reviewLines.push({
      label: 'Service amount',
      value: `₹${Math.round(priceQuote.basePrice).toLocaleString('en-IN')}`,
    });
    if ((priceQuote.discount ?? 0) > 0) {
      reviewLines.push({
        label: 'Discount',
        value: `− ₹${Math.round(priceQuote.discount ?? 0).toLocaleString('en-IN')}`,
      });
    }
    if ((priceQuote.taxBreakdown?.length ?? 0) > 0) {
      for (const row of priceQuote.taxBreakdown ?? []) {
        const rate = row.rate != null && Number(row.rate) > 0 ? ` (${Number(row.rate)}%)` : '';
        reviewLines.push({
          label: `${row.name || 'GST'}${rate}`,
          value: `₹${Math.round(row.amount || 0).toLocaleString('en-IN')}`,
        });
      }
    } else if (priceQuote.tax > 0) {
      reviewLines.push({
        label: 'GST / taxes',
        value: `₹${Math.round(priceQuote.tax).toLocaleString('en-IN')}`,
      });
    }
    if (Number(priceQuote.platformFee) > 0) {
      reviewLines.push({
        label: 'Platform fee',
        value: `₹${Math.round(priceQuote.platformFee || 0).toLocaleString('en-IN')}`,
      });
    }
    if (Number(priceQuote.convenienceFee) > 0) {
      reviewLines.push({
        label: 'Convenience fee',
        value: `₹${Math.round(priceQuote.convenienceFee || 0).toLocaleString('en-IN')}`,
      });
    }
    if (Number(priceQuote.deliveryFee) > 0) {
      reviewLines.push({
        label: 'Delivery fee',
        value: `₹${Math.round(priceQuote.deliveryFee || 0).toLocaleString('en-IN')}`,
      });
    }
  } else if (selectedPackage) {
    reviewLines.push({
      label: 'Package total',
      value: `₹${selectedPackage.totalPrice.toLocaleString('en-IN')}`,
    });
  }

  const payableAmount = selectedPackage?.vendorServiceId && priceQuote
    ? Math.round(priceQuote.finalPrice)
    : Math.round(selectedPackage?.totalPrice ?? 0);
  const policyBody = [packagePolicy?.cancellationPolicy, packagePolicy?.refundPolicy]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n\n');

  return (
    <ServicePackagesShell
      onBack={onBack ? handleInternalBack : undefined}
      view={view}
      packageCount={myPackages.length}
      onBrowse={() => {
        setPurchaseNotice(null);
        setError(null);
        setView('browse');
      }}
      onMyPackages={() => {
        setError(null);
        setView('my-packages');
      }}
      error={error}
    >
      {view === 'browse' && (
        <BrowsePackagesPanel
          packages={packages}
          onBook={(id) => {
            const pkg = packages.find((item) => item.id === id);
            if (pkg) handlePackageSelect(pkg);
          }}
          walkBanner={
            walkSessionIntent && onContinueToChooseWalker ? (
              <WalkSessionBanner
                serviceName={walkSessionIntent.serviceName}
                price={walkSessionIntent.price}
                duration={walkSessionIntent.duration}
                onChoose={onContinueToChooseWalker}
              />
            ) : null
          }
        />
      )}

      {view === 'schedule' && selectedPackage && (
        <SchedulePackagePanel
          name={selectedPackage.name}
          totalSessions={selectedPackage.totalSessions}
          totalPrice={selectedPackage.totalPrice}
          vendorService={Boolean(selectedPackage.vendorServiceId)}
          sessionsPerDay={sessionsPerDay}
          intervalDays={intervalDays}
          pets={schedulePets}
          petsLoading={petsLoading}
          selectedPetId={chosenPetId}
          onSelectPet={pickPetAndRemember}
          date={startingSessionDate}
          minDate={getMinDate()}
          onDate={(value) => {
            setStartingSessionDate(value);
            setError(null);
          }}
          times={perDaySessionTimes}
          onTime={handlePerDaySlotTimeChange}
          slotHints={slotFieldHints}
          singleTime={startingSessionTime}
          onSingleTime={(value) => {
            setStartingSessionTime(value);
            setError(null);
          }}
          onBack={() => {
            setError(null);
            setView('browse');
          }}
          onContinue={continueToReview}
          canContinue={!booking && Boolean(chosenPetId) && isScheduleStepReady()}
        />
      )}

      {view === 'review' && selectedPackage && (
        <ReviewPackagePanel
          packageName={selectedPackage.name}
          petName={chosenPet?.name || '—'}
          petPhoto={chosenPet?.photo_url}
          sessions={selectedPackage.totalSessions}
          firstDayLabel={formatDateLabel(startingSessionDate)}
          slots={
            selectedPackage.vendorServiceId
              ? sessionsPerDay > 1
                ? perDaySessionTimes.slice(0, sessionsPerDay).map((time, idx) => ({
                    label: `Slot ${idx + 1}`,
                    time: formatTimeDisplay(time),
                  }))
                : [{ label: 'Time', time: formatTimeDisplay(startingSessionTime) }]
              : []
          }
          consecutiveDays={Boolean(selectedPackage.vendorServiceId) && sessionsPerDay > 1}
          quoteLoading={Boolean(selectedPackage.vendorServiceId) && quoteLoading}
          lines={reviewLines}
          totalLabel={`₹${payableAmount.toLocaleString('en-IN')}`}
          razorpayNote={
            useWallet
              ? 'Wallet amount will be used first. Remaining amount will be charged on Razorpay.'
              : 'This amount will be charged on Razorpay.'
          }
          wallet={
            canUseWalletInReview ? (
              <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-3">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    checked={useWallet}
                    onChange={(e) => setUseWallet(e.target.checked)}
                    aria-label="Use wallet balance"
                  />
                  <span className="text-sm text-[#101B35]">
                    Use wallet balance (available ₹{Math.round(walletBalance).toLocaleString('en-IN')})
                  </span>
                </label>
                {useWallet ? (
                  <div className="mt-2 space-y-1 text-sm text-[#5C6578]">
                    <div className="flex justify-between">
                      <span>Wallet applied</span>
                      <span>− ₹{Math.round(reviewWalletToUse).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-[#101B35]">
                      <span>Razorpay payable</span>
                      <span>₹{Math.round(reviewRazorpayPayable).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null
          }
          policyText={
            policyBody || 'Standard Warmpawz cancellation and refund terms apply for this package.'
          }
          policyRequired={Boolean(selectedPackage.vendorServiceId)}
          policyAccepted={policyAccepted}
          onPolicy={setPolicyAccepted}
          onBack={() => {
            setView('schedule');
            setError(null);
          }}
          onPay={createPackageBooking}
          paying={booking}
          payLabel={
            isWalletFullyCoveringReview
              ? 'Confirm booking'
              : reviewRazorpayPayable > 0.01
                ? `Proceed to payment (₹${Math.round(reviewRazorpayPayable).toLocaleString('en-IN')})`
                : 'Proceed to payment'
          }
          payDisabled={Boolean(selectedPackage.vendorServiceId) && !policyAccepted}
        />
      )}

      {view === 'my-packages' && (
        <MyPackagesPanel
          packages={ownedCards}
          notice={purchaseNotice}
          onDismissNotice={() => setPurchaseNotice(null)}
          onViewDetails={(id) => router.push(`/packages/${encodeURIComponent(id)}`)}
        />
      )}
    </ServicePackagesShell>
  );
}


export default PackageBookingPage;
