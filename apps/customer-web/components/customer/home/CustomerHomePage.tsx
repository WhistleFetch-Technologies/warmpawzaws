'use client';

/**
 * New modular customer home page orchestrator.
 *
 * Phased rollout: sections are composed here as each phase lands.
 * Gated in CustomerHomeComplete when NEXT_PUBLIC_NEW_HOME_UI is enabled.
 */
import React, { memo, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { HomeHeaderSection } from './sections/HomeHeaderSection';
import { PetStripSection } from './sections/PetStripSection';
import { HomeHeaderShell } from './shared/HomeHeaderShell';
import { SearchFilterSection } from './sections/SearchFilterSection';
import type { SearchFilterSectionProps } from './sections/SearchFilterSection';
import { PremiumServiceCardsSection } from './sections/PremiumServiceCardsSection';
import { ServiceCategoryRow } from './sections/ServiceCategoryRow';
import { HeroBannerSection } from './sections/HeroBannerSection';
import { TrustFeatureBar } from './sections/TrustFeatureBar';
import { ActiveBookingsSection } from './sections/ActiveBookingsSection';
import type { ActiveBookingItem } from './sections/ActiveBookingsSection';
import { PopularServicesSection } from './sections/PopularServicesSection';
import { WalkInNearYouSection } from './sections/WalkInNearYouSection';
import type { ShopHotDeal } from './sections/ShopProductsSection';
import type { FeaturedLowerBanner } from './sections/FeaturedOfferSection';
import { OffersForYouSection } from './sections/OffersForYouSection';
import { DiscoverMoreSection } from './sections/DiscoverMoreSection';
import { WhatsNewSection } from './sections/WhatsNewSection';
import { AdoptionSection } from './sections/AdoptionSection';
import { PetCareArticlesSection } from './sections/PetCareArticlesSection';
import type { PetCareArticleItem } from './sections/PetCareArticlesSection';
import { NeedHelpSection } from './sections/NeedHelpSection';
import { ViewportSection } from './shared/ViewportSection';
import type { HomeNavigateFn } from './hooks/useHomeNavigation';
import type { HomeCarouselBanner, QuickServiceTile } from './types';
import type { Pet } from '../homepage/constants/interface';
import type { WhatsNewAnnouncement } from '@/lib/whats-new-announcements';
import { resolveShopCategoryParam } from '@/lib/shop-category-display';

const ShopProductsSection = dynamic(
  () => import('./sections/ShopProductsSection').then((mod) => ({ default: mod.ShopProductsSection })),
  { ssr: false }
);
const HelpWaysSection = dynamic(
  () => import('./sections/HelpWaysSection').then((mod) => ({ default: mod.HelpWaysSection })),
  { ssr: false }
);
const PremiumPetFoodSection = dynamic(
  () => import('./sections/PremiumPetFoodSection').then((mod) => ({ default: mod.PremiumPetFoodSection })),
  { ssr: false }
);
const MoreServicesSection = dynamic(
  () => import('./sections/MoreServicesSection').then((mod) => ({ default: mod.MoreServicesSection })),
  { ssr: false }
);
const HomeLowerBannersSection = dynamic(
  () => import('./sections/HomeLowerBannersSection').then((mod) => ({ default: mod.HomeLowerBannersSection })),
  { ssr: false }
);

type SearchResult = Parameters<NonNullable<SearchFilterSectionProps['onResultSelect']>>[0];

export interface CustomerHomePageHeaderProps {
  userName: string;
  userProfilePhoto?: string;
  phone: string;
  onProfileClick?: () => void;
  onNavigate: HomeNavigateFn;
  onOpenNotifications: () => void;
  notificationUnreadCount: number;
  combinedMessageUnreadCount: number;
  pets: Pet[];
  selectedPet: Pet | null;
  onSelectPet: (pet: Pet) => void;
  onPetClick?: (petId: string) => void;
  onAddPet: () => void;
  petsLoading?: boolean;
}

export interface CustomerHomePageContentProps {
  customerId?: string;
  onSearch: (query: string) => void;
  onSearchResultSelect: (result: SearchResult) => void;
  services: QuickServiceTile[];
  serviceLabelOverride: Record<string, string>;
  onNavigate: HomeNavigateFn;
  homeCarouselBanners: HomeCarouselBanner[];
  activeBookings: ActiveBookingItem[];
  onViewBooking?: (bookingId: string) => void;
  phone?: string;
  hotDeals: ShopHotDeal[];
  ecommerceShopCategories: Array<{ id: string; name: string; image_url?: string; display_order?: number }>;
  customerCommerceEnabled: boolean;
  featuredLowerBanners: FeaturedLowerBanner[];
  whatsNewAnnouncements: WhatsNewAnnouncement[];
  onWhatsNewSeeAll?: () => void;
  onWhatsNewRowPress?: (announcement: WhatsNewAnnouncement) => void;
  onWhatsNewSosPress?: (announcement: WhatsNewAnnouncement) => void;
  adoptionStats?: { adoptablePets: number | string; rehomingListings: number | string };
  petCareArticles?: PetCareArticleItem[];
  onPetCareArticleClick?: (article: PetCareArticleItem) => void;
  onPetCareArticlesSeeAll?: () => void;
  /** App Store review demo account — hides under-build sections entirely. */
  reviewDemoAccount?: boolean;
}

function CustomerHomePageHeaderComponent({
  userName,
  userProfilePhoto,
  phone,
  onProfileClick,
  onNavigate,
  onOpenNotifications,
  notificationUnreadCount,
  combinedMessageUnreadCount,
  pets,
  selectedPet,
  onSelectPet,
  onPetClick,
  onAddPet,
  petsLoading = false,
}: CustomerHomePageHeaderProps) {
  return (
    <HomeHeaderShell>
      <HomeHeaderSection
        userName={userName}
        userProfilePhoto={userProfilePhoto}
        phone={phone}
        onProfileClick={onProfileClick}
        onNavigate={onNavigate}
        onOpenNotifications={onOpenNotifications}
        notificationUnreadCount={notificationUnreadCount}
        combinedMessageUnreadCount={combinedMessageUnreadCount}
      />
      <PetStripSection
        pets={pets}
        selectedPet={selectedPet}
        onSelectPet={onSelectPet}
        onPetClick={onPetClick}
        onAddPet={onAddPet}
        petsLoading={petsLoading}
      />
    </HomeHeaderShell>
  );
}

function CustomerHomePageContentComponent({
  customerId,
  onSearch,
  onSearchResultSelect,
  services,
  serviceLabelOverride,
  onNavigate,
  homeCarouselBanners,
  activeBookings,
  onViewBooking,
  phone,
  hotDeals,
  ecommerceShopCategories,
  customerCommerceEnabled,
  featuredLowerBanners,
  whatsNewAnnouncements,
  onWhatsNewSeeAll,
  onWhatsNewRowPress,
  onWhatsNewSosPress,
  adoptionStats,
  petCareArticles = [],
  onPetCareArticleClick,
  onPetCareArticlesSeeAll,
  reviewDemoAccount = false,
}: CustomerHomePageContentProps) {
  const lowerHomeBanners = featuredLowerBanners.slice(1);
  const petFoodCategoryId = useMemo(
    () => resolveShopCategoryParam('pet-food', ecommerceShopCategories),
    [ecommerceShopCategories]
  );

  return (
    <>
      <SearchFilterSection
        customerId={customerId}
        phone={phone}
        onSearch={onSearch}
        onResultSelect={onSearchResultSelect}
      />
      <PremiumServiceCardsSection
        phone={phone}
        customerCommerceEnabled={customerCommerceEnabled}
        onNavigate={onNavigate}
        reviewDemoAccount={reviewDemoAccount}
      />
      <ViewportSection placeholderMinHeight={280}>
        <WalkInNearYouSection phone={phone} onNavigate={onNavigate} />
      </ViewportSection>
      <ServiceCategoryRow
        services={services}
        onNavigate={onNavigate}
        serviceLabelOverride={serviceLabelOverride}
        reviewDemoAccount={reviewDemoAccount}
      />
      <HeroBannerSection banners={homeCarouselBanners} onNavigate={onNavigate} />
      <TrustFeatureBar onNavigate={onNavigate} />
      <ActiveBookingsSection activeBookings={activeBookings} onViewBooking={onViewBooking} />
      {!reviewDemoAccount ? (
        <ShopProductsSection
          hotDeals={hotDeals}
          categories={ecommerceShopCategories}
          ecommerceEnabled={customerCommerceEnabled}
          onNavigate={onNavigate}
        />
      ) : null}
      <ViewportSection placeholderMinHeight={260}>
        <PopularServicesSection phone={phone} onNavigate={onNavigate} />
      </ViewportSection>
      <OffersForYouSection lowerBanners={featuredLowerBanners} onNavigate={onNavigate} />
      <ViewportSection placeholderMinHeight={480}>
        <HelpWaysSection
          services={services}
          customerCommerceEnabled={customerCommerceEnabled}
          onNavigate={onNavigate}
          reviewDemoAccount={reviewDemoAccount}
        />
      </ViewportSection>
      <ViewportSection placeholderMinHeight={400}>
        <DiscoverMoreSection phone={phone} onNavigate={onNavigate} />
      </ViewportSection>
      <WhatsNewSection
        announcements={whatsNewAnnouncements}
        onSeeAll={onWhatsNewSeeAll}
        onRowPress={onWhatsNewRowPress}
        onSosPress={onWhatsNewSosPress}
      />
      {!reviewDemoAccount ? (
        <ViewportSection placeholderMinHeight={300}>
          <AdoptionSection
            adoptablePets={adoptionStats?.adoptablePets}
            rehomingListings={adoptionStats?.rehomingListings}
          />
        </ViewportSection>
      ) : null}
      {!reviewDemoAccount ? (
        <ViewportSection placeholderMinHeight={250}>
          <PremiumPetFoodSection onNavigate={onNavigate} petFoodCategoryId={petFoodCategoryId || undefined} />
        </ViewportSection>
      ) : null}
      {petCareArticles.length > 0 ? (
        <ViewportSection placeholderMinHeight={120 + petCareArticles.length * 110}>
          <PetCareArticlesSection
            articles={petCareArticles}
            onArticleClick={onPetCareArticleClick}
            onSeeAll={onPetCareArticlesSeeAll}
          />
        </ViewportSection>
      ) : null}
      <ViewportSection placeholderMinHeight={720}>
        <MoreServicesSection onNavigate={onNavigate} reviewDemoAccount={reviewDemoAccount} />
      </ViewportSection>
      {lowerHomeBanners.length > 0 ? (
        <ViewportSection placeholderMinHeight={16 + lowerHomeBanners.length * 176}>
          <HomeLowerBannersSection lowerBanners={lowerHomeBanners} onNavigate={onNavigate} />
        </ViewportSection>
      ) : null}
      <ViewportSection placeholderMinHeight={200}>
        <NeedHelpSection onNavigate={onNavigate} />
      </ViewportSection>
    </>
  );
}

/** Orange header + pet strip for the new home layout. */
export const CustomerHomePageHeader = memo(CustomerHomePageHeaderComponent);

/** White scroll-area sections for the new home layout. */
export const CustomerHomePageContent = memo(CustomerHomePageContentComponent);

export { HomeHeaderSection } from './sections/HomeHeaderSection';
export { PetStripSection } from './sections/PetStripSection';
export { SearchFilterSection } from './sections/SearchFilterSection';
export { PremiumServiceCardsSection } from './sections/PremiumServiceCardsSection';
export { ServiceCategoryRow } from './sections/ServiceCategoryRow';
export { HeroBannerSection } from './sections/HeroBannerSection';
export { TrustFeatureBar } from './sections/TrustFeatureBar';
export { ActiveBookingsSection } from './sections/ActiveBookingsSection';
export { PopularServicesSection } from './sections/PopularServicesSection';
export { ShopProductsSection } from './sections/ShopProductsSection';
export { FeaturedOfferSection } from './sections/FeaturedOfferSection';
export { HelpGridSection } from './sections/HelpGridSection';
export { OffersForYouSection } from './sections/OffersForYouSection';
export { HelpWaysSection } from './sections/HelpWaysSection';
export { DiscoverMoreSection } from './sections/DiscoverMoreSection';
export { WhatsNewSection } from './sections/WhatsNewSection';
export { AdoptionSection } from './sections/AdoptionSection';
export { PremiumPetFoodSection } from './sections/PremiumPetFoodSection';
export { PetCareArticlesSection } from './sections/PetCareArticlesSection';
export { MoreServicesSection } from './sections/MoreServicesSection';
export { HomeLowerBannersSection } from './sections/HomeLowerBannersSection';
export { NeedHelpSection } from './sections/NeedHelpSection';
export { TrendingNowSection } from './sections/TrendingNowSection';
export { ForYouCardsSection } from './sections/ForYouCardsSection';

export { useHomeNavigation } from './hooks/useHomeNavigation';
export { useBannerCarousel } from './hooks/useBannerCarousel';
export { useHomePageData } from './hooks/useHomePageData';

export { SectionHeader, SectionHeaderWithChevron } from './shared/SectionHeader';
export { HorizontalScrollRow } from './shared/HorizontalScrollRow';
export { BannerCarousel } from './shared/BannerCarousel';
export { IconBadgeButton } from './shared/IconBadgeButton';

export type { QuickServiceTile, HomeCarouselBanner } from './types';
export { COMING_SOON_HOME_SERVICE_SCREENS } from './types';
export { buildHomeTopCarouselBanners } from './utils/banner-utils';
