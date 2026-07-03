'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Pill, FlaskConical, Wheat, Heart } from 'lucide-react';
import { mapCatalogSlugToLaunchServiceId } from '@warmpawz/service-launch-mappings';
import { useCustomerCategories } from '@/hooks/useCustomerCategories';
import { apiClient } from '@/lib/api-client';
import { buildCustomerLaunchTiles } from '@/lib/customer-launch-tiles';
import { filterHomeServiceTilesForReviewAccount } from '@/lib/app-review-demo-account';
import { serviceBaseOnpincode } from '../../homepage/constants/helpers';
import { quickServices, serviceScreenMap } from '../../homepage/constants';
import type { QuickServiceTile } from '../types';

export type PetTypeFilter = 'all' | 'dogs' | 'cats';

/** Large-card services — "Services for You" (2-col). */
export const PRIMARY_SERVICE_SCREENS = new Set([
  'grooming',
  'vet',
  'boarding',
  'walker',
  'training',
  'shop',
  'nutritionist',
  'pet-sitter',
]);

const DOG_ONLY_SCREENS = new Set(['walker']);

export const SERVICE_LABEL_OVERRIDE: Record<string, string> = {
  emergency: 'Emergency Care',
  ambulance: 'Emergency Care',
  emergency_care: 'Emergency Care',
  'lab-diagnostics': 'Diagnostics / Lab Tests',
  diagnostic: 'Diagnostics / Lab Tests',
  diagnostics: 'Diagnostics / Lab Tests',
  lab: 'Diagnostics / Lab Tests',
  nutrition: 'Nutritionist',
  nutritionist: 'Nutritionist',
  wellness: 'Nutritionist',
  specialty: 'Pet Insurance',
  speciality: 'Pet Insurance',
  veterinary: 'Vet Care',
  vet: 'Vet Care',
  walking: 'Dog Walker',
  walker: 'Dog Walker',
  shop: 'Pet Products',
  marketplace: 'Pet Products',
  'pet-sitter': 'Pet Sitter',
  pet_sitter: 'Pet Sitter',
  sitting: 'Pet Sitter',
};

export const SERVICE_DESCRIPTIONS: Record<string, string> = {
  vet: 'Consultations, checkups & treatments',
  grooming: 'Salon, spa & at-home grooming',
  shop: 'Food, accessories & medicines',
  training: 'Obedience, behavior & skills',
  walker: 'Daily walks & exercise',
  boarding: 'Safe stay while you\'re away',
  'pet-sitter': 'In-home pet sitting',
  adoption: 'Find your new best friend',
  'mating-dating-hub': 'Find the perfect match',
  cafes: 'Pet-friendly dining spots',
  photography: 'Professional pet photography',
  insurance: 'Health & accident coverage',
  breeder: 'Certified breeders & puppies',
  ambulance: 'Emergency pet transport',
  nutritionist: 'Diet plans & nutrition advice',
  behaviorist: 'Behavior correction',
  relocation: 'Pet transport & moving services',
  resort: 'Luxury boarding & spa',
  holiday: 'Travel packages with your pet',
  sunset: 'End-of-life support & memorial',
  pharmacy: 'Medicines & supplements',
  'lab-diagnostics': 'Lab tests & reports',
};

function displayLabelForService(service: QuickServiceTile): string {
  return service.label?.trim() || String(service.categoryId || service.screen || 'Service');
}

function descriptionForService(service: QuickServiceTile): string {
  const screen = String(service.screen || '').toLowerCase();
  const categoryId = String(service.categoryId || '').toLowerCase();
  return (
    SERVICE_DESCRIPTIONS[screen] ||
    SERVICE_DESCRIPTIONS[categoryId] ||
    'Explore this service'
  );
}

function serviceMatchesPetFilter(service: QuickServiceTile, filter: PetTypeFilter): boolean {
  if (filter === 'all' || filter === 'dogs') return true;
  const screen = String(service.screen || service.categoryId || '').toLowerCase();
  return !DOG_ONLY_SCREENS.has(screen);
}

function buildSourceQuickServices(quickServiceTiles: QuickServiceTile[]): QuickServiceTile[] {
  const usingApiCategories = quickServiceTiles.length > 0;
  const baseQuickServices = usingApiCategories ? quickServiceTiles : quickServices;
  if (usingApiCategories) return baseQuickServices;

  const hasPharmacy = baseQuickServices.some(
    (s) => ((s.categoryId || s.screen || '') as string).toLowerCase() === 'pharmacy'
  );
  const hasLabDiagnostics = baseQuickServices.some((s) => {
    const raw = ((s.categoryId || s.screen || '') as string).toLowerCase();
    return raw === 'lab-diagnostics' || (s.screen as string) === 'lab-diagnostics';
  });
  const nutritionCatalogIds = new Set(['nutritionist', 'nutrition', 'wellness']);
  const hasNutritionist = baseQuickServices.some((s) => {
    const raw = ((s.categoryId || s.screen || '') as string).toLowerCase();
    if (nutritionCatalogIds.has(raw)) return true;
    return mapCatalogSlugToLaunchServiceId(s.categoryId || s.screen) === 'nutritionist';
  });
  const hasTrainingAggregate = baseQuickServices.some((s) => {
    if (((s.screen || '') as string).toLowerCase() === 'training') return true;
    return mapCatalogSlugToLaunchServiceId(s.categoryId || '') === 'training';
  });
  const hasBehaviorist = baseQuickServices.some((s) => {
    const raw = ((s.categoryId || s.screen || '') as string).toLowerCase();
    return raw === 'behaviorist' || raw === 'behavioral';
  });

  let sourceQuickServices = baseQuickServices;
  if (!hasPharmacy) {
    sourceQuickServices = [
      ...sourceQuickServices,
      {
        icon: Pill,
        label: 'Pharmacy',
        color: 'bg-red-100 text-red-600',
        screen: 'pharmacy',
        categoryId: 'pharmacy',
      },
    ];
  }
  if (!hasLabDiagnostics) {
    sourceQuickServices = [
      ...sourceQuickServices,
      {
        icon: FlaskConical,
        label: 'Diagnostics / Lab Tests',
        color: 'bg-teal-100 text-teal-600',
        screen: 'lab-diagnostics',
        categoryId: 'lab-diagnostics',
      },
    ];
  }
  if (!hasNutritionist) {
    sourceQuickServices = [
      ...sourceQuickServices,
      {
        icon: Wheat,
        label: 'Nutritionist',
        color: 'bg-green-100 text-green-600',
        screen: 'nutritionist',
        categoryId: 'nutritionist',
      },
    ];
  }
  if (!hasBehaviorist && !hasTrainingAggregate) {
    sourceQuickServices = [
      ...sourceQuickServices,
      {
        icon: Heart,
        label: 'Behaviorist',
        color: 'bg-indigo-100 text-indigo-600',
        screen: 'behaviorist',
        categoryId: 'behaviorist',
      },
    ];
  }

  const seenScreens = new Set<string>();
  return sourceQuickServices
    .map((service) => {
      const screen = service.screen || service.categoryId || '';
      const categoryId = (service.categoryId || service.screen || '').toLowerCase();
      const launchId = mapCatalogSlugToLaunchServiceId(
        service.categoryId || service.screen || ''
      ).toLowerCase();
      const overrideKey = Object.keys(SERVICE_LABEL_OVERRIDE).find(
        (key) => categoryId === key.toLowerCase() || screen.toLowerCase() === key.toLowerCase()
      );
      const label =
        launchId === 'training'
          ? service.label
          : overrideKey
            ? SERVICE_LABEL_OVERRIDE[overrideKey]
            : service.label;
      return { ...service, label, screen };
    })
    .filter((service) => {
      const screen = service.screen || '';
      if (seenScreens.has(screen)) return false;
      seenScreens.add(screen);
      return true;
    });
}

export interface AllServicesTile extends QuickServiceTile {
  displayLabel: string;
  description: string;
  /** Optional CMS or static category image */
  imageUrl?: string;
}

export interface UseAllServicesDataOptions {
  phone?: string | null;
}

export function useAllServicesData({ phone }: UseAllServicesDataOptions) {
  const { quickServiceTiles, loading: categoriesLoading } = useCustomerCategories(phone);
  const [filteredServices, setFilteredServices] = useState<QuickServiceTile[]>([]);
  const [resolved, setResolved] = useState(false);
  const [petFilter, setPetFilter] = useState<PetTypeFilter>('all');

  const sourceQuickServices = useMemo(
    () => buildSourceQuickServices(quickServiceTiles),
    [quickServiceTiles]
  );

  const loadLaunchConfig = useCallback(async () => {
    try {
      setResolved(false);

      let customerCity = '';
      let customerState = '';
      if (phone) {
        try {
          const addressesResponse = (await apiClient
            .get(`/customer/addresses?phone=${encodeURIComponent(phone)}`)
            .catch(() => null)) as {
            addresses?: Array<{ city?: string; state?: string; isDefault?: boolean }>;
          } | null;
          const addresses = addressesResponse?.addresses || [];
          const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0];
          if (defaultAddress) {
            customerCity = (defaultAddress.city || '').trim();
            customerState = (defaultAddress.state || '').trim();
          }
        } catch {
          /* profile fallback below */
        }
        if (!customerCity || !customerState) {
          try {
            const profileResponse = await apiClient
              .get(`/customer/profile?phone=${encodeURIComponent(phone)}`)
              .catch(() => null);
            const profile = profileResponse as Record<string, unknown> | null;
            const profileLocation = serviceBaseOnpincode(profile, (profile?.pincode as string) || '');
            if (!customerCity && profileLocation.city) customerCity = String(profileLocation.city).trim();
            if (!customerState && profileLocation.state) customerState = String(profileLocation.state).trim();
          } catch {
            /* keep empty */
          }
        }
      }

      const params = new URLSearchParams();
      if (customerState) params.append('state', customerState);
      if (customerCity) params.append('city', customerCity);

      const configResponse = await apiClient
        .get(`/config/service-launch/customer?${params.toString()}`)
        .catch(() => null);

      if (configResponse && (configResponse as { success?: boolean }).success) {
        const { services, buttons } = configResponse as {
          services?: {
            catalog?: Array<{
              serviceId?: string;
              displayName?: string;
              effectiveStatus?: string;
            }>;
            visible?: Array<{ serviceId?: string; status?: string }>;
            comingSoon?: Array<{ serviceId?: string }>;
            hidden?: Array<{ serviceId?: string }>;
          };
          buttons?: Array<{ id?: string; enabled?: boolean; launchPhase?: string }>;
        };

        const catalog = services?.catalog;
        const visibleLaunch = services?.visible || [];
        const comingSoonLaunch = services?.comingSoon || [];
        const hiddenLaunch = services?.hidden || [];

        if (
          services &&
          (catalog?.length ||
            visibleLaunch.length > 0 ||
            comingSoonLaunch.length > 0 ||
            hiddenLaunch.length > 0)
        ) {
          const usingApiCategories = quickServiceTiles.length > 0;
          const resultTiles = buildCustomerLaunchTiles({
            tilePool: usingApiCategories ? sourceQuickServices : [...sourceQuickServices, ...quickServices],
            catalog: catalog?.map((c) => ({
              serviceId: c.serviceId || '',
              categoryId: (c as { categoryId?: string; category_id?: string }).categoryId
                || (c as { category_id?: string }).category_id
                || '',
              displayName: c.displayName,
              effectiveStatus: c.effectiveStatus,
            })),
            visible: visibleLaunch,
            comingSoon: comingSoonLaunch,
            hidden: hiddenLaunch,
            includeHiddenAsComingSoon: true,
            dedupeByLaunchServiceId: true,
          });
          if (resultTiles.length > 0) {
            setFilteredServices(resultTiles);
            setResolved(true);
            return;
          }
        }

        const blockedCategoryIds = new Set<string>();
        const comingSoonCategoryIds = new Set<string>();
        const blockedServiceIds = new Set<string>();
        const comingSoonServiceIds = new Set<string>();

        if (services) {
          (services.hidden || []).forEach((svc) => {
            const svcId = (svc.serviceId || '').toLowerCase();
            blockedCategoryIds.add(svcId);
            for (const [key, screens] of Object.entries(serviceScreenMap)) {
              if (svcId.includes(key) || key.includes(svcId)) {
                screens.forEach((screen) => blockedServiceIds.add(screen));
              }
            }
          });
          (services.comingSoon || []).forEach((svc) => {
            const svcId = (svc.serviceId || '').toLowerCase();
            comingSoonCategoryIds.add(svcId);
            for (const [key, screens] of Object.entries(serviceScreenMap)) {
              if (svcId.includes(key) || key.includes(svcId)) {
                screens.forEach((screen) => comingSoonServiceIds.add(screen));
              }
            }
          });
        }

        if (buttons && Array.isArray(buttons)) {
          buttons.forEach((btn) => {
            const btnId = (btn.id || '').toLowerCase();
            if (btn.enabled === false) {
              blockedCategoryIds.add(btnId);
              for (const [key, screens] of Object.entries(serviceScreenMap)) {
                if (btnId.includes(key) || key.includes(btnId)) {
                  screens.forEach((screen) => blockedServiceIds.add(screen));
                }
              }
            } else if (btn.launchPhase === 'coming_soon') {
              comingSoonCategoryIds.add(btnId);
              for (const [key, screens] of Object.entries(serviceScreenMap)) {
                if (btnId.includes(key) || key.includes(btnId)) {
                  screens.forEach((screen) => comingSoonServiceIds.add(screen));
                }
              }
            }
          });
        }

        if (
          blockedCategoryIds.size > 0 ||
          comingSoonCategoryIds.size > 0 ||
          blockedServiceIds.size > 0 ||
          comingSoonServiceIds.size > 0
        ) {
          const filtered = sourceQuickServices.filter((service) => {
            const catId = (service.categoryId || '').toLowerCase();
            const screen = (service.screen || '').toLowerCase();
            return (
              !blockedCategoryIds.has(catId) &&
              !blockedCategoryIds.has(screen) &&
              !blockedServiceIds.has(screen)
            );
          });
          const withComingSoon = filtered.map((service) => ({
            ...service,
            isComingSoon:
              comingSoonCategoryIds.has((service.categoryId || '').toLowerCase()) ||
              comingSoonServiceIds.has(service.screen),
          }));
          setFilteredServices(withComingSoon);
        } else {
          setFilteredServices(sourceQuickServices);
        }
        setResolved(true);
        return;
      }

      setFilteredServices(sourceQuickServices);
      setResolved(true);
    } catch {
      setFilteredServices(sourceQuickServices);
      setResolved(true);
    }
  }, [phone, sourceQuickServices]);

  useEffect(() => {
    if (phone) {
      void loadLaunchConfig();
    } else {
      setFilteredServices(sourceQuickServices);
      setResolved(true);
    }
  }, [phone, loadLaunchConfig, sourceQuickServices]);

  const allServices = useMemo((): AllServicesTile[] => {
    const list = resolved ? filteredServices : sourceQuickServices;
    const mapped = list.map((service) => ({
      ...service,
      displayLabel: displayLabelForService(service),
      description: descriptionForService(service),
    }));
    return filterHomeServiceTilesForReviewAccount(mapped, phone) as AllServicesTile[];
  }, [resolved, filteredServices, sourceQuickServices, phone]);

  const petFilteredServices = useMemo(
    () => allServices.filter((s) => serviceMatchesPetFilter(s, petFilter)),
    [allServices, petFilter]
  );

  const primaryServices = useMemo(
    () =>
      petFilteredServices.filter((s) => {
        const screen = String(s.screen || '').toLowerCase();
        return PRIMARY_SERVICE_SCREENS.has(screen);
      }),
    [petFilteredServices]
  );

  const secondaryServices = useMemo(
    () =>
      petFilteredServices.filter((s) => {
        const screen = String(s.screen || '').toLowerCase();
        return !PRIMARY_SERVICE_SCREENS.has(screen);
      }),
    [petFilteredServices]
  );

  return {
    primaryServices,
    secondaryServices,
    petFilteredServices,
    petFilter,
    setPetFilter,
    loading: categoriesLoading || !resolved,
    serviceLabelOverride: SERVICE_LABEL_OVERRIDE,
  };
}
