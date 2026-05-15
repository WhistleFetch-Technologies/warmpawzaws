'use client';

import { BookingFlow } from '@/components/customer/BookingFlow';
import { SearchFirstGuard } from '@/components/search/SearchFirstGuard';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

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

export function BookingPageClient({ serviceId: serviceIdProp }: BookingPageClientProps) {
  const params = useParams();
  const pathname = usePathname() || '';
  const serviceId = useMemo(
    () => resolveBookingServiceId(pathname, params, serviceIdProp),
    [pathname, params, serviceIdProp]
  );

  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const storedPhone = localStorage.getItem('customerPhone');
    setPhone(storedPhone);
  }, []);

  if (!phone) {
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

  if (!serviceId || serviceId === BOOKING_STATIC_SENTINEL) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center bg-stone-100 px-6 text-center">
        <p className="text-lg font-semibold text-gray-900">Pick a service to book</p>
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
    <SearchFirstGuard>
      <BookingFlow serviceId={serviceId} customerPhone={phone} />
    </SearchFirstGuard>
  );
}

