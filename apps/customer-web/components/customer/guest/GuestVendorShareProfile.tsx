'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Shield, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VendorProfileDashboardHeader } from '@/components/customer/shared/VendorProfileDashboardHeader';
import { VendorHeroPhotoCarousel } from '@/components/customer/shared/VendorHeroPhotoCarousel';
import { StarRating } from '@/components/customer/shared/StarRating';
import { AmenitiesSection } from '@/components/customer/shared/AmenitiesSection';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import {
  fetchGuestVendorProfile,
  fetchGuestVendorServices,
  guestVendorServiceId,
  guestVendorServiceLabel,
  guestVendorServicePrice,
  type GuestVendorProfileResponse,
  type GuestVendorProfileService,
} from '@/lib/guest-vendor-profile-api';
import { VENDOR_SERVICES_PROFILE_PAGE_SIZE } from '@/lib/customer-vendor-services-merge';
import {
  buildGuestBookingLoginUrl,
  type VendorShareNavigationParams,
} from '@/lib/vendor-profile-share';
import { resolveVendorProfileHeroGallery } from '@/lib/vendor-display-media';

export type GuestVendorShareProfileProps = {
  vendorId: string;
  shareParams: VendorShareNavigationParams;
};

function guestPersonaTitle(persona: string | null | undefined): string {
  const p = String(persona ?? '').toLowerCase();
  if (p === 'boarding') return 'Pet boarding';
  if (p === 'walker') return 'Pet walking';
  if (p === 'grooming') return 'Grooming';
  if (p === 'training') return 'Training';
  if (p === 'nutritionist' || p === 'nutrition') return 'Pet nutrition';
  if (p === 'behaviorist' || p === 'behaviourist') return 'Pet behaviour';
  if (p === 'sitter' || p === 'pet_sitter') return 'Pet sitting';
  return 'Veterinary care';
}

export function GuestVendorShareProfile({ vendorId, shareParams }: GuestVendorShareProfileProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<GuestVendorProfileResponse | null>(null);
  const [guestServices, setGuestServices] = useState<GuestVendorProfileService[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      const [data, servicesPage] = await Promise.all([
        fetchGuestVendorProfile(vendorId),
        fetchGuestVendorServices(vendorId, {
          limit: VENDOR_SERVICES_PROFILE_PAGE_SIZE,
          offset: 0,
          serviceStyle: shareParams.serviceStyle || undefined,
        }),
      ]);
      if (cancelled) return;
      if (!data) {
        setProfile(null);
        setGuestServices([]);
        setLoadError(true);
      } else {
        setProfile(data);
        setGuestServices(servicesPage?.services ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId, shareParams.serviceStyle]);

  const vendor = profile?.vendor;
  const displayName =
    String(shareParams.vendorName ?? '').trim() ||
    String(vendor?.businessName ?? '').trim() ||
    'Service provider';

  const heroGallery = useMemo(() => {
    if (!vendor) return [] as string[];
    return resolveVendorProfileHeroGallery({
      vendor: vendor as Record<string, unknown>,
      facility: null,
      profileProvider: {
        photo: vendor.photoUrl,
        photoUrl: vendor.photoUrl,
      },
    });
  }, [vendor]);

  const amenities = useMemo(() => {
    const list = [
      ...(Array.isArray(vendor?.amenities) ? vendor!.amenities! : []),
      ...(Array.isArray(vendor?.customAmenities) ? vendor!.customAmenities! : []),
    ].filter(Boolean);
    return [...new Set(list.map((a) => String(a).trim()).filter(Boolean))];
  }, [vendor]);

  const services = useMemo(() => {
    const rows = guestServices;
    const styleFilter = String(shareParams.serviceStyle ?? '').toLowerCase();
    if (!styleFilter) return rows;
    return rows.filter((row) => {
      const st = String(row.service_style ?? (row as any).serviceStyle ?? '').toLowerCase();
      if (!st) return true;
      return st === styleFilter;
    });
  }, [guestServices, shareParams.serviceStyle]);

  const handleBook = (service?: GuestVendorProfileService) => {
    const serviceId = service ? guestVendorServiceId(service) : undefined;
    router.push(
      buildGuestBookingLoginUrl(vendorId, shareParams, {
        serviceId: serviceId || undefined,
      })
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (loadError || !vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-white">
        <p className="text-gray-600 text-center">This profile is unavailable right now.</p>
      </div>
    );
  }

  const rating = Number(vendor.rating ?? 0);
  const reviewCount = Number(vendor.totalReviews ?? profile?.reviews?.length ?? 0);
  const subtitle = guestPersonaTitle(shareParams.persona);

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <VendorProfileDashboardHeader
        serviceName={subtitle}
        serviceSubtitle="View profile"
        serviceIcon={Stethoscope}
        iconColor="text-white"
        onBack={() => router.push('/')}
        showBackButton
        bottomEdge="flat"
      />

      <div className="relative w-full -mt-3">
        <div className="overflow-hidden rounded-t-[24px] bg-gray-200">
          <VendorHeroPhotoCarousel
            photos={heroGallery.length ? heroGallery : vendor.photoUrl ? [vendor.photoUrl] : []}
            name={displayName}
            frameClassName="relative aspect-[5/4] w-full max-h-[420px] overflow-hidden sm:aspect-auto sm:h-[280px] sm:max-h-none"
          />
        </div>
      </div>

      <div className="relative z-10 -mt-8 px-4">
        <div className="rounded-2xl bg-white shadow-md border border-gray-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{displayName}</h1>
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            </div>
            {vendor.vendorType === 'business' && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                <Shield className="w-3.5 h-3.5" />
                Verified
              </span>
            )}
          </div>

          <div className="mt-3">
            <StarRating rating={rating} reviewCount={reviewCount} />
          </div>

          {(vendor.address || vendor.city) && (
            <p className="mt-3 text-sm text-gray-600 flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
              <span>
                {[vendor.address, vendor.city, vendor.pincode].filter(Boolean).join(', ')}
              </span>
            </p>
          )}

          {vendor.description && (
            <p className="mt-3 text-sm text-gray-700 leading-relaxed">{vendor.description}</p>
          )}
        </div>
      </div>

      {amenities.length > 0 && (
        <div className="px-4 mt-4">
          <AmenitiesSection amenities={amenities} />
        </div>
      )}

      <div className="px-4 mt-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Services</h2>
        {services.length === 0 ? (
          <p className="text-sm text-gray-500">No services listed yet.</p>
        ) : (
          <ul className="space-y-3">
            {services.map((service, index) => {
              const sid = guestVendorServiceId(service) || `service-${index}`;
              const label = guestVendorServiceLabel(service);
              const price = guestVendorServicePrice(service);
              return (
                <li
                  key={sid}
                  className="rounded-xl border border-gray-100 bg-white p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{label}</p>
                    {service.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{service.description}</p>
                    )}
                    <p className="text-sm font-medium text-primary mt-1">
                      {price > 0 ? formatPriceWithSymbol(price) : 'Price on request'}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => handleBook(service)}>
                    Book
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(profile.reviews?.length ?? 0) > 0 && (
        <div className="px-4 mt-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Reviews</h2>
          <ul className="space-y-3">
            {(profile.reviews ?? []).slice(0, 5).map((review, index) => (
              <li key={String(review.id ?? index)} className="rounded-xl bg-white border border-gray-100 p-4">
                <div className="mb-1">
                  <StarRating
                    rating={Number(review.rating ?? 0)}
                    reviewCount={1}
                    showNumericRating={false}
                  />
                  <span className="text-sm text-gray-600 ml-2">{review.customer_name || 'Customer'}</span>
                </div>
                {review.comment && <p className="text-sm text-gray-700">{review.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 z-20 p-4 bg-white/95 border-t border-gray-100 backdrop-blur">
        <Button className="w-full" size="lg" onClick={() => handleBook()}>
          Sign in to book
        </Button>
        <p className="text-xs text-center text-gray-500 mt-2">
          Sign in to book with this provider.
        </p>
      </div>
    </div>
  );
}
