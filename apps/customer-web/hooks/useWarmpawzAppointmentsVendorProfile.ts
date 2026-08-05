'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { fetchDiscoveryProfileVendorRow } from '@/lib/discovery-profile-vendor-bootstrap';
import { mapDiscoveryRowBaseFields } from '@/lib/map-discovery-list-row';
import { mapVendorServicesForVetHub } from '@/lib/map-vendor-services-for-vet';
import { mapFacilityRecentReviews } from '@/lib/universal-provider-profile-enrichment';
import {
  mapWapptFacilityRating,
  type WapptFacilityRating,
} from '@/lib/map-wappt-facility-rating';
import {
  buildVendorServicesPageUrl,
  vendorServicesNextCursor,
  vendorServicesRowsFromResponse,
} from '@/lib/vendor-services-page';
import { resolveWapptVendorProfileConfig } from '@/lib/warmpawz-appointments/wappt-vendor-profile-config';

export type { WapptFacilityRating } from '@/lib/map-wappt-facility-rating';
export { mapWapptFacilityRating } from '@/lib/map-wappt-facility-rating';

export type WapptProfileService = {
  id: string;
  serviceId: string;
  name: string;
  description?: string;
  duration?: number;
  category?: string;
  price?: number;
};

export type WapptProfileProvider = {
  providerId: string;
  vendorId: string;
  name: string;
  address?: string;
  phone?: string;
  photo?: string;
  photoUrl?: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  experienceYears?: number;
  qualifications?: string;
  services: WapptProfileService[];
  servicesHydrated: boolean;
  servicesNextCursor?: string;
  servicesLoadingMore: boolean;
};

export type WapptProfileReview = {
  id: string;
  customerName?: string;
  rating: number;
  comment?: string;
  date: string;
};

type FacilityApiResponse = {
  success?: boolean;
  facility?: Record<string, unknown>;
  rating?: unknown;
  recentReviews?: unknown[];
};

function formatFacilitySpecializations(
  facility: Record<string, unknown> | null | undefined,
): string {
  const specs = facility?.specializations;
  if (!Array.isArray(specs) || specs.length === 0) return '';
  return specs.map((s) => String(s).trim()).filter(Boolean).join(', ');
}

function mapGenericServiceRow(row: Record<string, unknown>): WapptProfileService {
  return {
    id: String(row.id ?? row.serviceId ?? ''),
    serviceId: String(row.serviceId ?? row.id ?? ''),
    name: String(row.name ?? 'Service'),
    description: typeof row.description === 'string' ? row.description : undefined,
    duration: row.duration != null ? Number(row.duration) : undefined,
    category: typeof row.category === 'string' ? row.category : undefined,
  };
}

function parseExperienceYears(row: Record<string, unknown>): number | undefined {
  const raw = row.experienceYears ?? row.experience_years;
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function mapProviderRow(row: Record<string, unknown>): WapptProfileProvider {
  const base = mapDiscoveryRowBaseFields(row);
  return {
    providerId: base.providerId,
    vendorId: base.vendorId,
    name: base.name,
    address: base.address,
    phone: base.phone,
    photo: base.photo,
    photoUrl: base.photo,
    rating: base.rating,
    reviewCount: base.reviewCount,
    isVerified: base.isVerified,
    experienceYears: parseExperienceYears(row) ?? base.experienceYears,
    qualifications:
      (typeof row.qualifications === 'string' ? row.qualifications : undefined) ??
      base.qualifications,
    services: [],
    servicesHydrated: false,
    servicesLoadingMore: false,
  };
}

export function useWarmpawzAppointmentsVendorProfile(opts: {
  vendorId: string;
  category: string;
  serviceStyle: string;
  phone?: string;
  initialVendorName?: string;
}) {
  const { vendorId, category, serviceStyle, phone, initialVendorName } = opts;
  const config = resolveWapptVendorProfileConfig(category);

  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [vendor, setVendor] = useState<Record<string, unknown> | null>(null);
  const [facility, setFacility] = useState<Record<string, unknown> | null>(null);
  const [rating, setRating] = useState<WapptFacilityRating | null>(null);
  const [reviews, setReviews] = useState<WapptProfileReview[]>([]);
  const [provider, setProvider] = useState<WapptProfileProvider | null>(null);
  const [fetchingServices, setFetchingServices] = useState(false);
  const [overviewSpecializations, setOverviewSpecializations] = useState<string | null>(null);
  const [overviewEnrichmentLoading, setOverviewEnrichmentLoading] = useState(false);
  const providerRef = useRef<WapptProfileProvider | null>(null);
  const overviewEnrichmentLoadedRef = useRef(false);
  const overviewEnrichmentInflightRef = useRef(false);

  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  useEffect(() => {
    setProvider((prev) =>
      prev
        ? {
            ...prev,
            services: [],
            servicesHydrated: false,
            servicesNextCursor: undefined,
            servicesLoadingMore: false,
          }
        : prev,
    );
  }, [serviceStyle, vendorId]);

  useEffect(() => {
    setOverviewSpecializations(null);
    overviewEnrichmentLoadedRef.current = false;
    overviewEnrichmentInflightRef.current = false;
    setFacility(null);
    setRating(null);
    setReviews([]);
  }, [vendorId]);

  const applyFacilityResponse = useCallback((facilityRes: FacilityApiResponse | null) => {
    if (!facilityRes?.success) return false;

    if (facilityRes.facility) {
      setFacility(facilityRes.facility);
      const specStr = formatFacilitySpecializations(facilityRes.facility);
      if (specStr) {
        setOverviewSpecializations(specStr);
      }
    }

    const mappedRating = mapWapptFacilityRating(facilityRes.rating);
    if (mappedRating) {
      setRating(mappedRating);
    }

    const mappedReviews = mapFacilityRecentReviews(facilityRes.recentReviews);
    setReviews(mappedReviews);

    return true;
  }, []);

  const loadOverviewSpecializations = useCallback(async () => {
    const wantId = String(vendorId || '').trim();
    if (!wantId || overviewEnrichmentLoadedRef.current || overviewEnrichmentInflightRef.current) {
      return;
    }

    overviewEnrichmentInflightRef.current = true;
    setOverviewEnrichmentLoading(true);
    try {
      const facilityRes = (await apiClient
        .get(`/customer/facility/${encodeURIComponent(wantId)}`)
        .catch(() => null)) as FacilityApiResponse | null;

      applyFacilityResponse(facilityRes);
      overviewEnrichmentLoadedRef.current = true;
    } catch (e) {
      console.warn('[WAPPT profile] overview specializations fetch failed', e);
    } finally {
      overviewEnrichmentInflightRef.current = false;
      setOverviewEnrichmentLoading(false);
    }
  }, [applyFacilityResponse, vendorId]);

  const fetchServices = useCallback(
    async (append = false) => {
      const p = providerRef.current;
      if (!p) return;
      if (append) {
        if (!p.servicesNextCursor || p.servicesLoadingMore) return;
      } else if (p.servicesHydrated) {
        return;
      }

      const vid = p.vendorId || p.providerId;
      setFetchingServices(true);
      if (append) {
        setProvider((prev) => (prev ? { ...prev, servicesLoadingMore: true } : prev));
      }

      try {
        const url = buildVendorServicesPageUrl({
          vendorId: vid,
          serviceStyle,
          category: config.servicesApiCategory,
          customerPhone: phone || undefined,
          cursor: append ? p.servicesNextCursor : undefined,
        });
        const res = await apiClient.get(url);
        const rows = vendorServicesRowsFromResponse(
          res as { services?: unknown[]; packages?: unknown[] },
        );
        const services =
          config.category === 'vet'
            ? mapVendorServicesForVetHub(rows).map((s) => ({
                id: String(s.id ?? s.serviceId ?? ''),
                serviceId: String(s.serviceId ?? s.id ?? ''),
                name: String(s.name ?? 'Service'),
                description: s.description,
                duration: s.duration,
                category: s.category,
                ...(serviceStyle === 'tele' && s.price != null ? { price: Number(s.price) } : {}),
              }))
            : rows.map((row) => {
                const record = row as Record<string, unknown>;
                const mapped = mapGenericServiceRow(record);
                if (serviceStyle === 'tele' && record.price != null) {
                  return { ...mapped, price: Number(record.price) };
                }
                return mapped;
              });
        const nextCursor = vendorServicesNextCursor(res);

        setProvider((prev) => {
          if (!prev) return prev;
          const seen = new Set(append ? prev.services.map((s) => s.id || s.serviceId) : []);
          const merged = append ? [...prev.services] : [];
          for (const s of services) {
            const key = s.id || s.serviceId;
            if (key && seen.has(key)) continue;
            if (key) seen.add(key);
            merged.push(s);
          }
          return {
            ...prev,
            services: merged,
            servicesHydrated: true,
            servicesNextCursor: nextCursor || undefined,
            servicesLoadingMore: false,
          };
        });
      } catch (e) {
        console.warn('[WAPPT profile] services fetch failed', e);
        setProvider((prev) =>
          prev ? { ...prev, servicesHydrated: true, servicesLoadingMore: false } : prev,
        );
      } finally {
        setFetchingServices(false);
      }
    },
    [config.category, config.servicesApiCategory, phone, serviceStyle],
  );

  const loadMoreServices = useCallback(() => {
    void fetchServices(true);
  }, [fetchServices]);

  useEffect(() => {
    const wantId = String(vendorId || '').trim();
    if (!wantId) {
      setLoading(false);
      setLoadFailed(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);

    void (async () => {
      try {
        const [bootstrapRow, vendorRes, facilityRes] = await Promise.all([
          fetchDiscoveryProfileVendorRow(wantId),
          apiClient.get(`/customer/vendor/${encodeURIComponent(wantId)}`).catch(() => null),
          apiClient
            .get(`/customer/facility/${encodeURIComponent(wantId)}`)
            .catch(() => null) as Promise<FacilityApiResponse | null>,
        ]);

        if (cancelled) return;

        const vendorData = (() => {
          const raw = vendorRes as { vendor?: Record<string, unknown> } & Record<string, unknown>;
          return (raw?.vendor ?? raw) as Record<string, unknown> | null;
        })();

        if (vendorData && typeof vendorData === 'object') {
          const seeded =
            bootstrapRow &&
            (bootstrapRow as Record<string, unknown>).profile_image &&
            !(vendorData as Record<string, unknown>).profile_image
              ? {
                  ...vendorData,
                  profile_image: (bootstrapRow as Record<string, unknown>).profile_image,
                  photoUrl: (bootstrapRow as Record<string, unknown>).photoUrl,
                }
              : vendorData;
          setVendor(seeded);
        }

        if (applyFacilityResponse(facilityRes as FacilityApiResponse | null)) {
          overviewEnrichmentLoadedRef.current = true;
        }

        const row =
          bootstrapRow ??
          (vendorData
            ? {
                ...vendorData,
                id: vendorData.id ?? wantId,
                vendorId: vendorData.id ?? wantId,
                name:
                  vendorData.business_name ??
                  vendorData.businessName ??
                  vendorData.name ??
                  initialVendorName ??
                  'Provider',
                experienceYears:
                  vendorData.experience_years ??
                  vendorData.experienceYears ??
                  (bootstrapRow as Record<string, unknown> | null)?.experienceYears,
                reviewCount:
                  vendorData.review_count ??
                  vendorData.reviewCount ??
                  vendorData.totalReviews ??
                  (bootstrapRow as Record<string, unknown> | null)?.reviewCount,
                photoUrl:
                  vendorData.profile_photo_url ??
                  vendorData.photoUrl ??
                  vendorData.profile_image ??
                  (bootstrapRow as Record<string, unknown> | null)?.photoUrl,
                profile_image:
                  vendorData.profile_image ??
                  vendorData.profile_photo_url ??
                  (bootstrapRow as Record<string, unknown> | null)?.profile_image,
              }
            : null);

        if (!row) {
          setLoadFailed(true);
          setProvider(null);
          return;
        }

        const mapped = mapProviderRow(row);
        if (initialVendorName && !mapped.name) {
          mapped.name = initialVendorName;
        }
        if (mapped.experienceYears == null && vendorData) {
          const fromVendor = parseExperienceYears(vendorData);
          if (fromVendor != null) mapped.experienceYears = fromVendor;
        }
        setProvider(mapped);
      } catch (e) {
        console.error('[WAPPT profile] load failed', e);
        if (!cancelled) {
          setLoadFailed(true);
          setProvider(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyFacilityResponse, vendorId, initialVendorName]);

  useEffect(() => {
    if (!provider || provider.servicesHydrated || fetchingServices) return;
    void fetchServices(false);
  }, [provider, fetchingServices, fetchServices]);

  return {
    loading,
    loadFailed,
    vendor,
    facility,
    rating,
    reviews,
    provider,
    config,
    fetchingServices,
    loadMoreServices,
    overviewSpecializations,
    overviewEnrichmentLoading,
    loadOverviewSpecializations,
  };
}
