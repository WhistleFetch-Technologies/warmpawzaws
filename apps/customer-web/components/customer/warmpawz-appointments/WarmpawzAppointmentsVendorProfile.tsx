'use client';

import { useMemo, useState } from 'react';
import {
  Award,
  Building2,
  Calendar,
  Check,
  Clock,
  Home,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Search,
  Share2,
  Shield,
  Star,
  Video,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VendorProfileDashboardHeader } from '@/components/customer/shared/VendorProfileDashboardHeader';
import { VendorHeroPhotoCarousel } from '@/components/customer/shared/VendorHeroPhotoCarousel';
import { VendorRatingDisplay } from '@/components/customer/shared/VendorRatingDisplay';
import { ServiceDescriptionInline } from '@/components/customer/shared/ServiceDescriptionInline';
import { DiscoveryVendorFeedSentinel } from '@/components/customer/shared/DiscoveryVendorFeedSentinel';
import { filterServicesByQuery } from '@/lib/filter-services-by-query';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { resolveVendorProfileHeroGallery, shouldShowVendorAmenities } from '@/lib/vendor-display-media';
import { shareVendorProfile } from '@/lib/vendor-profile-share';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import {
  buildWarmpawzAppointmentsBookingNav,
  resolveWarmpawzBookingScreen,
} from '@/lib/warmpawz-appointments-customer';
import { resolveWapptStylePlaceholderIcon } from '@/lib/warmpawz-appointments/wappt-vendor-profile-config';
import { getWapptHubConfig } from '@/lib/wappt-hub-registry';
import { useWarmpawzAppointmentsVendorProfile } from '@/hooks/useWarmpawzAppointmentsVendorProfile';

type TabId = 'overview' | 'services' | 'reviews';

export type WarmpawzAppointmentsVendorProfileProps = {
  phone: string;
  vendorId: string;
  vendorName?: string;
  category: string;
  serviceStyle: string;
  profileBackScreen?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
};

const OUTLINE_ACTION_BTN =
  'flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-[#FF8C42]/35 bg-white p-3 transition-colors hover:bg-orange-50 group';

export function WarmpawzAppointmentsVendorProfile({
  phone,
  vendorId,
  vendorName,
  category,
  serviceStyle,
  onBack,
  onNavigate,
}: WarmpawzAppointmentsVendorProfileProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const {
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
  } = useWarmpawzAppointmentsVendorProfile({
    vendorId,
    category,
    serviceStyle,
    phone,
    initialVendorName: vendorName,
  });

  const providerName = useMemo(() => {
    const fromVendor = vendor?.business_name ?? vendor?.businessName ?? vendor?.name;
    return String(fromVendor ?? provider?.name ?? vendorName ?? 'Provider').trim();
  }, [vendor, provider?.name, vendorName]);

  const photos = useMemo(() => {
    const resolved = resolveVendorProfileHeroGallery({
      facility,
      vendor,
      profileProvider: provider ?? { name: providerName },
    });
    if (resolved.length > 0) return resolved;
    const fallback = getWapptHubConfig(category)?.tileImage;
    return fallback ? [fallback] : [];
  }, [facility, vendor, provider, providerName, category]);

  const amenities = (facility?.amenities ?? vendor?.amenities ?? []) as string[];
  const address =
    String(vendor?.address ?? facility?.address ?? provider?.address ?? '').trim() || '';
  const phoneNumber = String(vendor?.phone ?? facility?.phone ?? provider?.phone ?? '').trim();
  const description =
    String(vendor?.description || facility?.description || '').trim() ||
    config.aboutFallback(providerName);

  const profileVendorId = String(
    vendorId ??
      provider?.providerId ??
      pickCustomerVendorAccountId((vendor ?? {}) as Record<string, unknown>) ??
      '',
  ).trim();

  const StyleIcon = resolveWapptStylePlaceholderIcon(serviceStyle);
  const HeaderIcon = config.headerIcon;

  const filteredServices = useMemo(
    () => filterServicesByQuery(provider?.services ?? [], searchQuery),
    [provider?.services, searchQuery],
  );

  const handleShare = async () => {
    if (!profileVendorId) return;
    await shareVendorProfile({
      title: providerName,
      text: `Check out ${providerName} on Warmpawz`,
      vendorId: profileVendorId,
      persona: config.sharePersona,
      vendorName: providerName,
      serviceStyle,
    });
  };

  const handleBookAppointment = () => {
    const vid = String(provider?.vendorId || provider?.providerId || vendorId).trim();
    if (!vid) return;
    onNavigate(resolveWarmpawzBookingScreen(category), {
      ...buildWarmpawzAppointmentsBookingNav({
        vendorId: vid,
        vendorName: providerName,
        serviceStyle,
        category,
      }),
      appointmentsMode: true,
    });
  };

  const isTeleMarketplace = serviceStyle === 'tele';

  const handleBookTeleService = (service: {
    id?: string;
    serviceId?: string;
    name?: string;
    price?: number;
    duration?: number;
  }) => {
    const vid = String(provider?.vendorId || provider?.providerId || vendorId).trim();
    const sid = String(service.serviceId || service.id || '').trim();
    if (!vid || !sid) return;
    onNavigate('vet-booking', {
      vendorId: vid,
      vendorName: providerName,
      serviceType: 'tele',
      serviceStyle: 'tele',
      serviceId: sid,
      serviceName: service.name,
      price: service.price,
      duration: service.duration,
      appointmentsMode: false,
      category,
      returnScreen: 'wappt-vendor-profile',
    });
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-customer items-center justify-center bg-gray-50">
        <div className="px-4 text-center">
          <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-[#FF8C42]" />
          <p className="text-gray-600">Loading provider profile...</p>
        </div>
      </div>
    );
  }

  if (loadFailed || !provider) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-customer flex-col bg-gray-50">
        <VendorProfileDashboardHeader
          fullWidth
          serviceName="Provider"
          serviceSubtitle="Profile unavailable"
          serviceIcon={HeaderIcon}
          iconColor="text-white"
          onBack={onBack}
          showBackButton
          bottomEdge="flat"
        />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="mb-4 text-gray-600">We could not load this provider profile.</p>
          <Button onClick={onBack} variant="outline">
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const hasPhotos = photos.length > 0;
  const showDirections = Boolean(address) && serviceStyle !== 'tele';

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-customer flex-col overflow-x-hidden bg-gray-50">
      <VendorProfileDashboardHeader
        fullWidth
        className="!z-0 isolation-auto"
        serviceName={providerName}
        serviceSubtitle={config.styleSubtitle(serviceStyle)}
        serviceIcon={HeaderIcon}
        iconColor="text-white"
        onBack={onBack}
        showBackButton
        bottomEdge="flat"
      />

      <div className="relative z-0 w-full flex-1">
        {hasPhotos ? (
          <div className="relative w-full -mt-3">
            <div className="overflow-hidden rounded-t-[24px] bg-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] sm:rounded-t-[28px]">
              <VendorHeroPhotoCarousel
                photos={photos}
                name={providerName}
                frameClassName="relative aspect-[5/4] w-full max-h-[420px] overflow-hidden sm:aspect-auto sm:h-[280px] sm:max-h-none"
              />
            </div>
          </div>
        ) : (
          <div className="relative w-full -mt-3">
            <div className="overflow-hidden rounded-t-[24px] sm:rounded-t-[28px]">
              <div className="relative flex aspect-[5/4] w-full max-h-[420px] items-center justify-center bg-gradient-to-br from-[#FF8C42] to-[#FF7029] sm:aspect-auto sm:h-[280px] sm:max-h-none">
                <div className="text-center text-white">
                  <StyleIcon className="mx-auto mb-3 h-20 w-20 opacity-50" />
                  <p className="text-sm opacity-75">No photos available</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 pb-32">
          <div className="relative z-10 -mt-6 mb-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h1 className="mb-2 text-2xl font-bold text-gray-900">{providerName}</h1>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <VendorRatingDisplay
                  row={{
                    vendorId: profileVendorId,
                    vendorRating: rating?.averageRating ?? provider.rating,
                    vendorReviewCount: rating?.totalReviews ?? provider.reviewCount,
                  }}
                  vendorId={profileVendorId}
                  starsClassName="h-5 w-5"
                  textClassName="text-sm text-gray-700"
                />
                {facility?.isPremium ? (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    <Award className="h-3.5 w-3.5" />
                    Premium
                  </span>
                ) : null}
                {provider.isVerified ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                    <Shield className="h-3.5 w-3.5" />
                    Verified
                  </span>
                ) : null}
              </div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-1.5">
                  <StyleIcon className="h-4 w-4 text-[#FF8C42]" />
                  <span className="text-sm font-medium text-gray-700">
                    {config.styleBadgeLabel(serviceStyle)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => phoneNumber && window.open(`tel:${phoneNumber}`, '_self')}
                disabled={!phoneNumber}
                className={`${OUTLINE_ACTION_BTN} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <Phone className="h-5 w-5 text-[#FF8C42] group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-gray-700">Call</span>
              </button>
              {showDirections ? (
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
                      '_blank',
                    )
                  }
                  className={OUTLINE_ACTION_BTN}
                >
                  <Navigation className="h-5 w-5 text-[#FF8C42] group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium text-gray-700">Directions</span>
                </button>
              ) : (
                <div className={OUTLINE_ACTION_BTN} aria-hidden>
                  <Video className="h-5 w-5 text-[#FF8C42]/40" />
                  <span className="text-xs font-medium text-gray-400">Online</span>
                </div>
              )}
              <button type="button" onClick={() => void handleShare()} className={OUTLINE_ACTION_BTN}>
                <Share2 className="h-5 w-5 text-[#FF8C42] group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-gray-700">Share</span>
              </button>
            </div>

            <div className="space-y-2.5 border-t border-gray-100 pt-4">
              {address && serviceStyle !== 'tele' ? (
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                  <span className="leading-relaxed text-gray-700">{address}</span>
                </div>
              ) : null}
              {serviceStyle === 'tele' ? (
                <div className="flex items-center gap-3 text-sm">
                  <Video className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <span className="text-gray-700">Video consultation available</span>
                </div>
              ) : null}
            </div>

            {shouldShowVendorAmenities(serviceStyle) && amenities.length > 0 ? (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Features</h3>
                <div className="flex flex-wrap gap-2">
                  {amenities.slice(0, 6).map((amenity, idx) => (
                    <span
                      key={idx}
                      className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700"
                    >
                      {amenity}
                    </span>
                  ))}
                  {amenities.length > 6 ? (
                    <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
                      +{amenities.length - 6} more
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="sticky top-0 z-40 flex overflow-hidden rounded-t-2xl border-b-2 border-gray-200 bg-white shadow-sm">
            {(['overview', 'services', 'reviews'] as TabId[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative flex-1 py-4 text-sm font-semibold capitalize transition-all ${
                  activeTab === tab ? 'text-[#FF8C42]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'services'
                  ? `Services (${provider.services.length}${provider.servicesNextCursor ? '+' : ''})`
                  : tab}
                {activeTab === tab ? (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF8C42]" />
                ) : null}
              </button>
            ))}
          </div>

          <div className="mb-4 min-h-[400px] rounded-b-2xl bg-white p-5">
            {activeTab === 'overview' ? (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
                    <HeaderIcon className="h-5 w-5 text-[#FF8C42]" />
                    About
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-700">{description}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{provider.services.length}</div>
                    <div className="mt-1 text-xs text-gray-500">Services</div>
                  </div>
                  <div className="border-x border-gray-200 text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {provider.experienceYears != null
                        ? provider.experienceYears
                        : '5+'}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">Years Experience</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {rating?.totalReviews != null
                        ? rating.totalReviews
                        : provider.reviewCount != null
                          ? provider.reviewCount
                          : '10+'}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">Reviews</div>
                  </div>
                </div>
                {provider.qualifications ? (
                  <div>
                    <h3 className="mb-3 text-lg font-bold text-gray-900">Qualifications</h3>
                    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                      <p className="text-sm text-gray-600">{provider.qualifications}</p>
                    </div>
                  </div>
                ) : null}
                {shouldShowVendorAmenities(serviceStyle) && amenities.length > 0 ? (
                  <div>
                    <h3 className="mb-3 text-lg font-bold text-gray-900">All Features</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {amenities.map((amenity, idx) => (
                        <div key={idx} className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
                          <Check className="h-4 w-4 flex-shrink-0 text-green-500" />
                          <span className="text-sm text-gray-700">{amenity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === 'services' ? (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder={config.servicesSearchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>

                {filteredServices.length > 0 ? (
                  <div className="space-y-3">
                    {filteredServices.map((service) => (
                      <div
                        key={service.id || service.serviceId}
                        className="rounded-xl border border-gray-200 bg-white p-4"
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <h4 className="text-base font-bold text-gray-900">{service.name}</h4>
                          {isTeleMarketplace && service.price != null ? (
                            <span className="shrink-0 font-bold text-[#FF8C42]">
                              {formatPriceWithSymbol(service.price)}
                            </span>
                          ) : null}
                        </div>
                        {service.description?.trim() ? (
                          <ServiceDescriptionInline
                            description={service.description}
                            title={service.name}
                            className="m-0 mb-3 text-sm leading-5 text-gray-600"
                          />
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2">
                          {service.duration ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
                              <Clock className="h-3.5 w-3.5 text-gray-600" />
                              {service.duration} mins
                            </span>
                          ) : null}
                          {isTeleMarketplace ? (
                            <Button
                              type="button"
                              size="sm"
                              className="ml-auto bg-[#FF8C42] hover:bg-[#E67A35]"
                              onClick={() => handleBookTeleService(service)}
                            >
                              Book
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    <DiscoveryVendorFeedSentinel
                      hasMore={!!provider.servicesNextCursor}
                      loading={fetchingServices && !provider.servicesHydrated}
                      loadingMore={provider.servicesLoadingMore}
                      onLoadMore={loadMoreServices}
                    />
                  </div>
                ) : fetchingServices || !provider.servicesHydrated ? (
                  <div className="py-16 text-center">
                    <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-[#FF8C42]" />
                    <p className="text-gray-600">Loading services…</p>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-16 text-center">
                    <Building2 className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                    <p className="mb-1 font-medium text-gray-600">No services listed</p>
                    <p className="text-sm text-gray-500">Book an appointment to get started</p>
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === 'reviews' ? (
              <div className="space-y-4">
                {reviews.length > 0 && rating ? (
                  <div className="mb-6 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
                    <div className="flex items-center gap-2">
                      <Star className="h-6 w-6 fill-amber-500 text-amber-500" />
                      <span className="text-3xl font-bold text-gray-900">
                        {Number(rating.averageRating ?? provider.rating ?? 0).toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Based on {rating.totalReviews || provider.reviewCount || 0} reviews
                    </p>
                  </div>
                ) : null}
                {reviews.length > 0 ? (
                  reviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-5 transition-shadow hover:shadow-md"
                    >
                      <div className="mb-3 flex items-start gap-4">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-lg font-bold text-white shadow-md">
                          {review.customerName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="font-bold text-gray-900">
                              {review.customerName || 'Anonymous'}
                            </h4>
                            <span className="ml-2 flex-shrink-0 text-xs text-gray-500">
                              {new Date(review.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          <div className="mb-3 flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${i < review.rating ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}`}
                              />
                            ))}
                          </div>
                          {review.comment ? (
                            <p className="text-sm leading-relaxed text-gray-700">{review.comment}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-16 text-center">
                    <Star className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                    <p className="mb-1 font-medium text-gray-600">No reviews yet</p>
                    <p className="text-sm text-gray-500">Be the first to review this provider!</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {!isTeleMarketplace ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center">
          <div className="pointer-events-auto w-full max-w-customer border-t border-gray-200 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-lg">
            <div className="p-4">
              <Button
                onClick={handleBookAppointment}
                className="h-12 w-full bg-[#FF8C42] text-base text-white hover:bg-[#E67A35] sm:text-lg"
              >
                <Calendar className="mr-2 h-5 w-5" />
                Select Slot for Appointment
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
