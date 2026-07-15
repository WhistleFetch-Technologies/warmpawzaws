'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { apiClient } from '@/lib/api-client';
import { launchSearchServiceBooking } from '@/lib/search-booking-launch';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';
import type { ClinicServiceRow } from '@/lib/clinic-service-row-mapper';

interface BookingPageClientProps {
  serviceId: string;
}

/** `generateStaticParams` uses this for `output: 'export'` — never treat as a real service id. */
const BOOKING_STATIC_SENTINEL = 'placeholder';

function serviceIdFromParams(params: ReturnType<typeof useParams>): string {
  const raw = params?.serviceId;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0] && String(raw[0]).trim()) return String(raw[0]).trim();
  return '';
}

function serviceIdFromPathname(pathname: string): string {
  const m = /^\/booking\/([^/]+)/.exec(pathname || '');
  return m?.[1] ? decodeURIComponent(m[1]).trim() : '';
}

/** Prefer URL path (correct on client navigations); RSC `params` can stay `placeholder` on static export. */
function resolveBookingServiceId(pathname: string, params: ReturnType<typeof useParams>, serverProp: string) {
  const fromPath = serviceIdFromPathname(pathname);
  const fromParams = serviceIdFromParams(params);
  const fromProp = String(serverProp || '').trim();
  for (const c of [fromPath, fromParams, fromProp]) {
    if (c && c !== BOOKING_STATIC_SENTINEL) return c;
  }
  return fromPath || fromParams || fromProp;
}

type ResolvedService = {
  id: string;
  name: string;
  price: number;
  duration: number;
  description?: string;
  category?: string;
  serviceStyle?: string;
  vendorId?: string;
  vendorName?: string;
  vendorAddress?: string;
  catalogId?: string;
  metadata?: unknown;
};

function normalizeServiceResponse(res: unknown): ResolvedService | null {
  if (res == null || typeof res !== 'object') return null;
  const flat = res as Record<string, unknown>;
  const svc = (flat.service && typeof flat.service === 'object' ? flat.service : flat) as Record<string, unknown>;
  const id = String(svc.id ?? svc.serviceId ?? '').trim();
  if (!id) return null;
  return {
    id,
    name: String(svc.name ?? svc.serviceName ?? svc.displayName ?? 'Service'),
    price: Number(svc.price ?? svc.basePrice ?? 0) || 0,
    duration: Number(svc.duration ?? svc.durationMinutes ?? 30) || 30,
    description: typeof svc.description === 'string' ? svc.description : undefined,
    category: String(svc.category ?? svc.categoryName ?? svc.categoryId ?? '').trim() || undefined,
    serviceStyle: String(svc.service_style ?? svc.serviceStyle ?? '').trim() || undefined,
    vendorId: svc.vendor_id != null && String(svc.vendor_id).trim() ? String(svc.vendor_id).trim() : undefined,
    vendorName: typeof svc.vendor_name === 'string' ? svc.vendor_name : undefined,
    vendorAddress: typeof svc.vendor_address === 'string' ? svc.vendor_address : undefined,
    catalogId: svc.catalogId != null && String(svc.catalogId).trim() ? String(svc.catalogId).trim() : undefined,
    metadata: svc.metadata,
  };
}

/**
 * Legacy `/booking/[serviceId]` deep-link resolver.
 *
 * The old page rendered the legacy `BookingFlow`, which charged the raw service
 * price with no GST/fees (no `/tax/calculate` call — see prod booking 6b49e9bd).
 * This resolver instead looks the service up and hands off to the category
 * booking routers via `launchSearchServiceBooking`, whose flows all check out
 * through `UniversalPaymentPage` (server-calculated GST + platform fees).
 */
export function BookingPageClient({ serviceId: serviceIdProp }: BookingPageClientProps) {
  const params = useParams();
  const pathname = usePathname() || '';
  const router = useRouter();
  const nav = useCustomerNavigation();
  const serviceId = useMemo(
    () => resolveBookingServiceId(pathname, params, serviceIdProp),
    [pathname, params, serviceIdProp]
  );

  const [phone, setPhone] = useState<string | null>(null);
  const [phoneChecked, setPhoneChecked] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const launchedForId = useRef<string | null>(null);

  // Redirecting the resolver must REPLACE history: Back from the target flow
  // should not land here and immediately redirect forward again (back-loop).
  const replacingRouter = useMemo<AppRouterInstance>(
    () => ({ ...router, push: router.replace }),
    [router]
  );

  useEffect(() => {
    setPhone(localStorage.getItem('customerPhone'));
    setPhoneChecked(true);
  }, []);

  useEffect(() => {
    if (!phoneChecked || !phone) return;
    if (!serviceId || serviceId === BOOKING_STATIC_SENTINEL) return;
    if (launchedForId.current === serviceId) return;
    launchedForId.current = serviceId;

    // Legacy tele-chat deep link (`/booking/<bookingId>?chat=true`) carries a
    // booking id, not a service id — send it to the bookings list instead of 404.
    const isChatLink =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('chat') === 'true';
    if (isChatLink) {
      nav.goToBookings({ replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      let service: ResolvedService | null = null;
      try {
        const res = await apiClient.get<unknown>(`/services/${encodeURIComponent(serviceId)}`);
        service = normalizeServiceResponse(res);
      } catch {
        service = null;
      }
      if (cancelled) return;

      if (!service) {
        setNotFound(true);
        return;
      }

      if (!service.vendorId) {
        // Catalog-only row (no vendor attached) — let the customer pick a provider.
        router.replace(`/search?q=${encodeURIComponent(service.name)}`);
        return;
      }

      const serviceRow: ClinicServiceRow = {
        stableKey: service.id,
        name: service.name,
        price: service.price,
        duration: service.duration,
        description: service.description,
        category: service.category,
        catalogServiceId: service.catalogId ?? null,
        vendorServiceId: service.id,
        metadata: service.metadata,
      };

      launchSearchServiceBooking({
        vendorId: service.vendorId,
        vendorName: service.vendorName || 'Provider',
        service: serviceRow,
        category: service.category || '',
        serviceStyle: service.serviceStyle,
        address: service.vendorAddress || '',
        router: replacingRouter,
        returnSearchUrl: '/search',
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [phoneChecked, phone, serviceId, router, replacingRouter, nav]);

  if (phoneChecked && !phone) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Please login to book a service</p>
          <a href="/auth" className="mt-4 inline-block px-6 py-2 bg-orange-500 text-white rounded-full">
            Login
          </a>
        </div>
      </div>
    );
  }

  if (notFound || (phoneChecked && (!serviceId || serviceId === BOOKING_STATIC_SENTINEL))) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center bg-stone-100 px-6 text-center">
        <p className="text-lg font-semibold text-gray-900">
          {notFound ? 'This service is no longer available' : 'Pick a service to book'}
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Use search and choose a service — this page needs a valid booking link.
        </p>
        <Link
          href="/search"
          className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#FF8C42] px-8 py-3 font-medium text-white"
        >
          Search services
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4" />
        <p className="text-gray-600">Preparing your booking…</p>
      </div>
    </div>
  );
}
