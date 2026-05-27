'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { fetchCustomerMessageUnreadBreakdown } from '@/lib/customer-message-unread';
import { customerPathToScreen } from '@/lib/promotion-navigation';
import { iconForCustomerHomeApiBanner } from '@/lib/customer-banner-icons';
import { serviceBaseOnpincode } from '../../homepage/constants/helpers';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { buildHomeTopCarouselBanners } from '../utils/banner-utils';
import { extractProductImageUrl } from '../utils/product-image';
import type { HomeCarouselBanner } from '../types';
import type { Pet, UserData } from '../../homepage/constants/interface';

export type { HomeCarouselBanner };

export interface UseHomePageDataOptions {
  phone: string;
  refreshKey?: number;
  /** Bump when notification inbox changes so unread badge refetches. */
  notificationInboxVersion?: number;
  /** Bump when booking messages inbox changes. */
  messagesInboxVersion?: number;
}

async function resolveCustomerLocation(phone: string): Promise<{ city: string; state: string }> {
  let city = '';
  let state = '';
  try {
    const addressesResponse = (await apiClient
      .get(`/customer/addresses?phone=${encodeURIComponent(phone)}`)
      .catch(() => null)) as { addresses?: Array<{ city?: string; state?: string; isDefault?: boolean }> } | null;
    const addresses = addressesResponse?.addresses || [];
    const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0];
    if (defaultAddress) {
      city = (defaultAddress.city || '').trim();
      state = (defaultAddress.state || '').trim();
    }
  } catch {
    /* keep fallback */
  }

  if (!city || !state) {
    try {
      const profileResponse = await apiClient
        .get(`/customer/profile?phone=${encodeURIComponent(phone)}`)
        .catch(() => null);
      const profile = profileResponse as Record<string, unknown> | null;
      const profileLocation = serviceBaseOnpincode(profile, (profile?.pincode as string) || '');
      if (!city && profileLocation.city) city = String(profileLocation.city).trim();
      if (!state && profileLocation.state) state = String(profileLocation.state).trim();
    } catch {
      /* keep fallback */
    }
  }

  return { city, state };
}

function dedupeBannerList(rawList: unknown[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  return (rawList as unknown[]).filter((item) => {
    const id =
      item && typeof item === 'object' && 'id' in item && (item as { id: unknown }).id != null
        ? String((item as { id: unknown }).id)
        : '';
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }) as Record<string, unknown>[];
}

function mapApiBanner(b: Record<string, unknown>, defaults?: { gradientFrom?: string; gradientTo?: string }) {
  const rawCta = String(b.ctaLink ?? b.cta_link ?? '').trim();
  const screenFromSlash = rawCta.startsWith('/') ? customerPathToScreen(rawCta) : null;
  const ctaLink = screenFromSlash ?? rawCta;
  const explicitComingSoonFalse = b.comingSoon === false || b.coming_soon === false;
  const comingSoon = explicitComingSoonFalse ? false : Boolean(b.comingSoon || b.coming_soon);
  return {
    id: b.id as string | number,
    title: String(b.title ?? ''),
    subtitle: String(b.subtitle ?? ''),
    imageUrl: String(b.imageUrl || b.image_url || ''),
    gradientFrom: String(b.gradientFrom || b.gradient_from || defaults?.gradientFrom || '#FF8C42'),
    gradientTo: String(b.gradientTo || b.gradient_to || defaults?.gradientTo || '#FF6B35'),
    Icon: iconForCustomerHomeApiBanner(b),
    ctaText: String(b.ctaText || b.cta_text || 'Learn More'),
    ctaLink,
    comingSoon,
  };
}

// mapApiBanner retained for middle/lower banner mappers below; hero uses buildHomeTopCarouselBanners.

/**
 * Core home page data fetching: profile, pets, banners, services, unread counts.
 * Extracted from CustomerHomeComplete — behavior preserved for new modular sections.
 */
export function useHomePageData({
  phone,
  refreshKey = 0,
  notificationInboxVersion = 0,
  messagesInboxVersion = 0,
}: UseHomePageDataOptions) {
  const [userData, setUserData] = useState<UserData>({ name: 'User', phone: '', pets: [] });
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [userProfilePhoto, setUserProfilePhoto] = useState('');
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState('');

  const [dynamicBanners, setDynamicBanners] = useState<Record<string, unknown>[]>([]);
  const [dynamicMiddleBanners, setDynamicMiddleBanners] = useState<Record<string, unknown>[]>([]);
  const [dynamicLowerBanners, setDynamicLowerBanners] = useState<Record<string, unknown>[]>([]);
  const [dynamicArticles, setDynamicArticles] = useState<Record<string, unknown>[]>([]);
  const [dynamicAnnouncements, setDynamicAnnouncements] = useState<Record<string, unknown>[]>([]);

  const [groomingServices, setGroomingServices] = useState<Record<string, unknown>[]>([]);
  const [vetServicesData, setVetServicesData] = useState<Record<string, unknown>[]>([]);
  const [hotDeals, setHotDeals] = useState<Record<string, unknown>[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [combinedMessageUnreadCount, setCombinedMessageUnreadCount] = useState(0);

  const [ecommerceShopCategories, setEcommerceShopCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [customerCommerceEnabled] = useState<boolean>(() => isCustomerEcommerceEnabled());

  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      const [profileResult, petsResult] = await Promise.allSettled([
        apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`),
        apiClient.get(`/customer/pets/${encodeURIComponent(phone)}`),
      ]);

      if (profileResult.status === 'fulfilled') {
        const profileResp = profileResult.value as Record<string, unknown>;
        if (profileResp && (profileResp.success || profileResp.profile)) {
          const profile = (profileResp.profile || profileResp) as Record<string, unknown>;
          setUserData((prev) => ({
            ...prev,
            name: String(profile.firstName || profile.name || 'User'),
            phone,
            journeyType: String(profile.journeyType || ''),
          }));
          setUserProfilePhoto(String(profile.photo || profile.profile_photo_url || ''));
          const profilePets = profile.pets;
          if (Array.isArray(profilePets) && profilePets.length > 0) {
            setUserData((prev) => ({ ...prev, pets: profilePets as Pet[] }));
            setSelectedPet((prev) => prev ?? (profilePets[0] as Pet));
          }
        }
      } else if (profileResult.status === 'rejected') {
        const cachedProfile = localStorage.getItem('customerData');
        if (cachedProfile) {
          try {
            const profile = JSON.parse(cachedProfile);
            setUserData((prev) => ({
              ...prev,
              name: profile.firstName || profile.name || 'User',
              phone,
            }));
          } catch {
            /* ignore */
          }
        }
      }

      if (petsResult.status === 'fulfilled') {
        const petsResp = petsResult.value as Record<string, unknown>;
        if (petsResp && (petsResp.success || petsResp.pets)) {
          let pets: Pet[] = [];
          if (Array.isArray(petsResp)) {
            pets = petsResp as Pet[];
          } else if (Array.isArray(petsResp.pets)) {
            pets = petsResp.pets as Pet[];
          } else if (
            petsResp.pets &&
            typeof petsResp.pets === 'object' &&
            Array.isArray((petsResp.pets as { pets?: Pet[] }).pets)
          ) {
            pets = (petsResp.pets as { pets: Pet[] }).pets;
          } else if (petsResp.success && Array.isArray(petsResp.data)) {
            pets = petsResp.data as Pet[];
          }
          if (pets.length > 0) {
            setUserData((prev) => ({ ...prev, pets }));
            setSelectedPet((prev) => prev ?? pets[0]);
          }
        }
      }
    } catch {
      /* silent — fallbacks in state */
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const loadDynamicContent = useCallback(async () => {
    try {
      const { city: customerCity, state: customerState } = await resolveCustomerLocation(phone);
      const bannerQuery = new URLSearchParams({ limit: '20' });
      if (customerState) bannerQuery.append('state', customerState);
      if (customerCity) bannerQuery.append('city', customerCity);
      const homeTopQuery = new URLSearchParams(bannerQuery);
      homeTopQuery.append('position', 'home_top');
      const homeMiddleQuery = new URLSearchParams(bannerQuery);
      homeMiddleQuery.append('position', 'home_middle');
      const homeLowerQuery = new URLSearchParams(bannerQuery);
      homeLowerQuery.append('position', 'home_lower');

      const [bannersResp, middleBannersResp, lowerBannersResp, articlesResp, announcementsResp] =
        await Promise.allSettled([
          apiClient.get(`/customer/banners?${homeTopQuery.toString()}`),
          apiClient.get(`/customer/banners?${homeMiddleQuery.toString()}`),
          apiClient.get(`/customer/banners?${homeLowerQuery.toString()}`),
          apiClient.getCustomerArticlesList('/customer/articles?limit=3&featured=true'),
          apiClient.get('/customer/announcements?limit=3'),
        ]);

      const extractBanners = (resp: PromiseSettledResult<unknown>): Record<string, unknown>[] => {
        if (resp.status !== 'fulfilled') return [];
        const v = resp.value as Record<string, unknown> | null | undefined;
        const rawList =
          (Array.isArray(v?.banners) && v.banners) ||
          (Array.isArray((v?.data as Record<string, unknown>)?.banners) &&
            (v!.data as { banners: unknown[] }).banners) ||
          [];
        return rawList.length > 0 ? dedupeBannerList(rawList) : [];
      };

      const top = extractBanners(bannersResp);
      if (top.length > 0) setDynamicBanners(top);
      setDynamicMiddleBanners(extractBanners(middleBannersResp));
      setDynamicLowerBanners(extractBanners(lowerBannersResp));

      if (articlesResp.status === 'fulfilled') {
        const articles = (articlesResp.value as { articles?: Record<string, unknown>[] })?.articles;
        if (articles?.length) setDynamicArticles(articles);
      }
      if (announcementsResp.status === 'fulfilled') {
        const announcements = (announcementsResp.value as { announcements?: Record<string, unknown>[] })
          ?.announcements;
        if (announcements?.length) setDynamicAnnouncements(announcements);
      }
    } catch {
      /* fallbacks already in state */
    }
  }, [phone]);

  const loadServicesFromAPI = useCallback(async () => {
    try {
      setServicesLoading(true);
      let locationParams = '';
      if (typeof window !== 'undefined') {
        try {
          const customerLat = localStorage.getItem('customer_latitude');
          const customerLng = localStorage.getItem('customer_longitude');
          if (customerLat && customerLng) {
            locationParams = `&latitude=${encodeURIComponent(customerLat)}&longitude=${encodeURIComponent(customerLng)}`;
          }
        } catch {
          /* ignore */
        }
      }
      const phoneParam = phone ? `&phone=${encodeURIComponent(phone)}` : '';
      const productRequest = isCustomerEcommerceEnabled()
        ? apiClient.get('/products?featured=true&limit=3')
        : Promise.resolve({ products: [] });

      const [groomingResult, vetResult, productsResult] = await Promise.allSettled([
        apiClient.get(
          `/customer/discover-services?category=grooming&serviceStyle=at_center${locationParams}${phoneParam}`
        ),
        apiClient.get(
          `/customer/discover-services?category=vet&serviceStyle=at_center${locationParams}${phoneParam}`
        ),
        productRequest,
      ]);

      if (groomingResult.status === 'fulfilled') {
        const groomingResp = groomingResult.value as Record<string, unknown>;
        const services = (groomingResp?.services || groomingResp?.vendors || []) as Record<string, unknown>[];
        if (services.length > 0) {
          setGroomingServices(
            services.slice(0, 3).map((s) => ({
              id: s.id || s.vendorServiceId,
              title: s.serviceName || s.name || 'Grooming Service',
              price: `₹${s.price || s.basePrice || 999}`,
              rating: s.rating != null ? Number(s.rating) : undefined,
              reviewCount: Number(s.reviewCount ?? s.review_count ?? 0) || 0,
              serviceStyle: s.serviceStyle || 'at_center',
              description: s.description || 'Professional grooming service',
              vendorId: s.vendorId,
            }))
          );
        }
      }

      if (vetResult.status === 'fulfilled') {
        const vetResp = vetResult.value as Record<string, unknown>;
        const services = (vetResp?.services || vetResp?.vendors || []) as Record<string, unknown>[];
        if (services.length > 0) {
          setVetServicesData(
            services.slice(0, 3).map((s) => ({
              id: s.id || s.vendorServiceId,
              title: s.serviceName || s.name || 'Vet Service',
              price: `₹${s.price || s.basePrice || 499}`,
              serviceStyle: s.serviceStyle || 'clinic',
              description: s.description || 'Veterinary service',
              type: s.serviceStyle === 'at_home' ? 'visit' : s.serviceStyle === 'tele' ? 'video' : 'clinic',
              vendorId: s.vendorId,
            }))
          );
        }
      }

      if (productsResult.status === 'fulfilled') {
        const productsResp = productsResult.value as { products?: Record<string, unknown>[] };
        const raw = productsResp?.products;
        if (raw && Array.isArray(raw) && raw.length > 0) {
          const featured = raw.filter((p) => p.is_featured === true || p.isFeatured === true);
          setHotDeals(
            featured.length > 0
              ? featured.slice(0, 3).map((p) => ({
                  id: p.id,
                  title: p.name || 'Pet Products',
                  price: `₹${p.salePrice || p.price || 999}`,
                  originalPrice: p.originalPrice ? `₹${p.originalPrice}` : null,
                  discount: p.discountPercent ? `${p.discountPercent}% OFF` : null,
                  image: extractProductImageUrl(p),
                  priceValue: Number(p.salePrice ?? p.price) || undefined,
                  iconType: 'product',
                  rating:
                    Number(p.reviewCount ?? p.review_count ?? 0) > 0 &&
                    p.rating != null &&
                    Number(p.rating) > 0
                      ? Number(p.rating)
                      : undefined,
                  reviewCount: Number(p.reviewCount ?? p.review_count ?? 0) || 0,
                }))
              : []
          );
        } else {
          setHotDeals([]);
        }
      } else {
        setHotDeals([]);
      }
    } catch {
      /* keep defaults */
    } finally {
      setServicesLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    if (!phone) return;
    void loadUserData();
    void loadServicesFromAPI();
    void loadDynamicContent();
  }, [phone, refreshKey, loadUserData, loadServicesFromAPI, loadDynamicContent]);

  useEffect(() => {
    if (!phone) return;
    apiClient
      .get(`/customer/by-phone?phone=${encodeURIComponent(phone)}`)
      .then((r) => {
        const resp = r as { customer?: { id?: string } };
        if (resp?.customer?.id) setCustomerId(resp.customer.id);
      })
      .catch(() => {});
  }, [phone, refreshKey]);

  useEffect(() => {
    const clean = (phone || '').replace(/[^0-9]/g, '');
    if (clean.length < 10) {
      setNotificationUnreadCount(0);
      return;
    }
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const data = await apiClient.get<{ notifications?: { is_read?: boolean; read?: boolean }[] }>(
          `/customer/notifications?phone=${encodeURIComponent(clean)}&limit=50`
        );
        if (cancelled) return;
        const list = data.notifications ?? [];
        setNotificationUnreadCount(list.filter((n) => !(n.is_read ?? n.read)).length);
      } catch {
        if (!cancelled) setNotificationUnreadCount(0);
      }
    };
    void fetchUnread();
    const interval = setInterval(fetchUnread, 90_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [phone, refreshKey, notificationInboxVersion]);

  useEffect(() => {
    const clean = (phone || '').replace(/[^0-9]/g, '');
    if (clean.length < 10) {
      setCombinedMessageUnreadCount(0);
      return;
    }
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const b = await fetchCustomerMessageUnreadBreakdown({
          customerId: customerId || undefined,
          phoneForApi: phone,
        });
        if (!cancelled) setCombinedMessageUnreadCount(b.total);
      } catch {
        if (!cancelled) setCombinedMessageUnreadCount(0);
      }
    };
    void fetchUnread();
    const interval = setInterval(fetchUnread, 90_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [phone, refreshKey, customerId, messagesInboxVersion]);

  useEffect(() => {
    if (!customerCommerceEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<{ categories?: Array<Record<string, unknown>> }>('/ecommerce/categories');
        const raw = res?.categories;
        if (cancelled || !Array.isArray(raw)) return;
        const mapped = raw
          .map((c) => ({
            id: String(c.id ?? c.category_id ?? c.uuid ?? '').trim(),
            name: String(c.name ?? c.title ?? c.display_name ?? 'Category').trim(),
          }))
          .filter((c) => c.id);
        if (!cancelled) setEcommerceShopCategories(mapped);
      } catch {
        if (!cancelled) setEcommerceShopCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerCommerceEnabled]);

  const homeCarouselBanners: HomeCarouselBanner[] = buildHomeTopCarouselBanners(dynamicBanners);

  const refresh = useCallback(() => {
    void loadUserData();
    void loadServicesFromAPI();
    void loadDynamicContent();
  }, [loadUserData, loadServicesFromAPI, loadDynamicContent]);

  return {
    userData,
    setUserData,
    selectedPet,
    setSelectedPet,
    userProfilePhoto,
    loading,
    customerId,
    dynamicBanners,
    dynamicMiddleBanners,
    dynamicLowerBanners,
    dynamicArticles,
    dynamicAnnouncements,
    homeCarouselBanners,
    groomingServices,
    vetServicesData,
    hotDeals,
    servicesLoading,
    notificationUnreadCount,
    combinedMessageUnreadCount,
    ecommerceShopCategories,
    customerCommerceEnabled,
    refresh,
    loadUserData,
    loadDynamicContent,
    loadServicesFromAPI,
  };
}
