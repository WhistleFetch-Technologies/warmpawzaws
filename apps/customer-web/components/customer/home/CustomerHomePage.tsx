'use client';

/**
 * New modular customer home page orchestrator.
 *
 * Phased rollout: sections are composed here as each phase lands.
 * Gated in CustomerHomeComplete when NEXT_PUBLIC_NEW_HOME_UI is enabled.
 */
import React, { memo } from 'react';
import { HomeHeaderSection } from './sections/HomeHeaderSection';
import { PetStripSection } from './sections/PetStripSection';
import { HomeHeaderShell } from './shared/HomeHeaderShell';
import { SearchFilterSection } from './sections/SearchFilterSection';
import type { SearchFilterSectionProps } from './sections/SearchFilterSection';
import { ServiceCategoryRow } from './sections/ServiceCategoryRow';
import { HeroBannerSection } from './sections/HeroBannerSection';
import { TrustFeatureBar } from './sections/TrustFeatureBar';
import { ActiveBookingsSection } from './sections/ActiveBookingsSection';
import type { ActiveBookingItem } from './sections/ActiveBookingsSection';
import { PopularServicesSection } from './sections/PopularServicesSection';
import { ShopProductsSection } from './sections/ShopProductsSection';
import type { ShopHotDeal } from './sections/ShopProductsSection';
import type { FeaturedLowerBanner } from './sections/FeaturedOfferSection';
import { OffersForYouSection } from './sections/OffersForYouSection';
import { HelpWaysSection } from './sections/HelpWaysSection';
import { DiscoverMoreSection } from './sections/DiscoverMoreSection';
import { WhatsNewSection } from './sections/WhatsNewSection';
import { AdoptionSection } from './sections/AdoptionSection';
import { PremiumPetFoodSection } from './sections/PremiumPetFoodSection';
import { PetCareArticlesSection } from './sections/PetCareArticlesSection';
import type { PetCareArticleItem } from './sections/PetCareArticlesSection';
import { MoreServicesSection } from './sections/MoreServicesSection';
import { HomeLowerBannersSection } from './sections/HomeLowerBannersSection';
import { NeedHelpSection } from './sections/NeedHelpSection';
import type { HomeNavigateFn } from './hooks/useHomeNavigation';
import type { HomeCarouselBanner, QuickServiceTile } from './types';
import type { Pet } from '../homepage/constants/interface';
import type { WhatsNewAnnouncement } from '@/lib/whats-new-announcements';

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
  ecommerceShopCategories: Array<{ id: string; name: string }>;
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
}: CustomerHomePageContentProps) {
  return (
    <>
      <SearchFilterSection
        customerId={customerId}
        onSearch={onSearch}
        onResultSelect={onSearchResultSelect}
      />
      <ServiceCategoryRow
        services={services}
        onNavigate={onNavigate}
        serviceLabelOverride={serviceLabelOverride}
      />
      <HeroBannerSection banners={homeCarouselBanners} onNavigate={onNavigate} />
      <TrustFeatureBar onNavigate={onNavigate} />
      <ActiveBookingsSection activeBookings={activeBookings} onViewBooking={onViewBooking} />
      <ShopProductsSection
        hotDeals={hotDeals}
        categories={ecommerceShopCategories}
        ecommerceEnabled={customerCommerceEnabled}
        onNavigate={onNavigate}
      />
      <PopularServicesSection phone={phone} onNavigate={onNavigate} />
      <OffersForYouSection lowerBanners={featuredLowerBanners} onNavigate={onNavigate} />
      <HelpWaysSection
        services={services}
        customerCommerceEnabled={customerCommerceEnabled}
        onNavigate={onNavigate}
      />
      <DiscoverMoreSection phone={phone} onNavigate={onNavigate} />
      <WhatsNewSection
        announcements={whatsNewAnnouncements}
        onSeeAll={onWhatsNewSeeAll}
        onRowPress={onWhatsNewRowPress}
        onSosPress={onWhatsNewSosPress}
      />
      <AdoptionSection
        adoptablePets={adoptionStats?.adoptablePets}
        rehomingListings={adoptionStats?.rehomingListings}
      />
      <PremiumPetFoodSection />
      <PetCareArticlesSection
        articles={petCareArticles}
        onArticleClick={onPetCareArticleClick}
        onSeeAll={onPetCareArticlesSeeAll}
      />
      <MoreServicesSection onNavigate={onNavigate} />
      <HomeLowerBannersSection lowerBanners={featuredLowerBanners.slice(1)} onNavigate={onNavigate} />
      <NeedHelpSection onNavigate={onNavigate} />
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
