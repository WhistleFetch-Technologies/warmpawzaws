'use client';

import React, { useState, useEffect, useMemo, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, MapPin, Clock, Video, Home, Building2, ChevronRight, Filter, Loader2, Shield, User, Heart, Share2, Navigation, Phone, Award, Stethoscope, Check, Search, X, TrendingUp, GraduationCap, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { resolveCustomerDiscoveryCoords } from '@/lib/customer-discovery-coords';
import { ServicePricingDisplay } from '../ServicePricingDisplay'; // ✅ FIX GAP-7.1: Vendor discount display
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { INDICATIVE_PRICING_NOTE } from '@/lib/pricing-disclaimer';
import { getRoleConfig, RoleId, ServiceStyle } from './roleConfig';
import { VendorProfileDashboardHeader } from './VendorProfileDashboardHeader';
import { ServiceDashboardHeader } from './ServiceDashboardHeader';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import { ServiceDescriptionInline } from './ServiceDescriptionInline';
import { buildTeleInstantAutoPayBookingUrl } from '@/lib/tele-direct-booking';
import { resolveVendorProfileHeroGallery, resolveCustomerVendorAmenities, shouldShowVendorAmenities } from '@/lib/vendor-display-media';
import { AmenitiesSection } from './AmenitiesSection';
import { VendorHeroPhotoCarousel } from './VendorHeroPhotoCarousel';
import {
  getWebGroomingTrainingEmbedVendorId,
  getWebVetDiscoveryChevronNavTarget,
  getWebWalkerDiscoveryChevronNavTarget,
} from '@/lib/customer-vendor-profile-navigation';
import { toast } from 'sonner';
import { filterServicesByQuery } from '@/lib/filter-services-by-query';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
  serviceTypeCategoryFromRoleId,
} from '@/lib/vendor-package-purchase-nav';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import {
  getAverageRatingLabel,
  hasRatings,
  normalizeRatingCount,
} from '@/lib/rating-display';
import { resolveVendorRating } from '@/lib/resolve-vendor-rating';
import { roleIdToSharePersona, shareVendorProfile } from '@/lib/vendor-profile-share';
import { resolveNextAvailableLabel } from '@/lib/available-slots-response';

interface UniversalServicesByStyleProps {
  phone: string;
  roleId: RoleId; // ✅ NEW: Role ID for universal component
  serviceStyle: ServiceStyle; // 'tele', 'at_home', 'at_center'
  serviceTypeName?: string;
  category?: string;
  vendorId?: string; // Optional: filter to show only this vendor's services (vendor profile mode)
  specialization?: string; // ✅ RULE 2 FIX: Specialization filter from problem grid
  profileBackScreen?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  bookingScreen?: string; // ✅ NEW: Screen name for booking (e.g., 'vet-booking', 'grooming-booking')
}

// Provider can be vendor (for at_center) or staff/individual (for at_home/tele)
interface Provider {
  providerId: string;
  providerType: 'vendor' | 'staff' | 'individual';
  vendorId?: string;
  vendorName?: string;
  staffId?: string;
  name: string;
  phone?: string;
  photo?: string;
  address?: string;
  city?: string;
  role?: string;
  experienceYears?: number;
  qualifications?: string;
  rating: number;
  reviewCount: number;
  distance?: number | null;
  isVerified?: boolean;
  isIndividualProvider?: boolean;
  nextAvailableSlot?: string;
  specialization?: string;
  services: {
    id: string;
    serviceId: string;
    name: string;
    price: number;
    originalPrice?: number; // ✅ FIX GAP-7.1: Original price for discount calculation
    vendorDiscount?: number; // ✅ FIX GAP-7.1: Vendor discount percentage
    duration: number;
    description?: string;
    category?: string;
    inActivePackage?: boolean;
  }[];
}

function canonicalVendorKeysFromRow(p: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  const add = (x: unknown) => {
    if (x == null) return;
    const s = String(x).trim();
    if (s) out.add(s);
  };
  add(p.id);
  add(p.providerId);
  add(p.provider_id);
  add(p.vendorId);
  add(p.vendor_id);
  add(p.facilityId);
  add(p.facility_id);
  add(p.staffId);
  add(p.staff_id);
  try {
    add(pickCustomerVendorAccountId(p));
  } catch {
    /* ignore */
  }
  return out;
}

function rowMatchesEmbedVendorId(p: Record<string, unknown>, embedVendorId: string): boolean {
  const want = String(embedVendorId || '').trim();
  if (!want) return false;
  return canonicalVendorKeysFromRow(p).has(want);
}

/** When hub/chevron passes a vendor id that does not appear in by-style/discover rows, load vendor + services directly. */
async function fetchEmbeddedVendorAsProvider(args: {
  embedVendorId: string;
  phone: string;
  finalCategory: string;
  serviceStyle: ServiceStyle;
  roleName: string;
}): Promise<Provider | null> {
  const { embedVendorId, phone, finalCategory, serviceStyle, roleName } = args;
  const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
  const styleOrder: ServiceStyle[] =
    serviceStyle === 'at_center' ? ['at_center', 'at_home', 'tele'] : [serviceStyle, 'at_center', 'at_home', 'tele'];

  let services: Provider['services'] = [];
  for (const st of styleOrder) {
    try {
      const servicesResponse = (await apiClient.get(
        `/customer/vendor/${embedVendorId}/services?serviceStyle=${st}&category=${finalCategory}${phoneParam}`
      )) as any;
      const servicesArray = mergeCustomerVendorServicesPayload(servicesResponse);
      if (servicesArray.length === 0) continue;
      services = servicesArray.map((s: any) => ({
        id: String(s.id || s.service_id || ''),
        serviceId: String(s.id || s.service_id || ''),
        name: s.name || s.service_name || `${roleName} Service`,
        price: Number(s.price || s.custom_price || 499),
        originalPrice: Number(s.price || s.custom_price || 499),
        vendorDiscount: s.vendor_discount || s.discount || 0,
        duration: Number(s.duration || s.custom_duration || s.duration_minutes || 30),
        description: s.description || s.custom_description,
        category: s.category_name || s.category,
        isPackage: !!(s.isPackage ?? (s.metadata && (s.metadata as any).isPackage)),
        inActivePackage: !!s.inActivePackage,
      }));
      break;
    } catch {
      /* try next */
    }
  }
  if (services.length === 0) return null;

  const vendorRes = (await apiClient.get(`/customer/vendor/${embedVendorId}`).catch(() => null)) as any;
  const v = vendorRes?.vendor || vendorRes;
  const name =
    (v && typeof v === 'object' && (v.businessName || v.business_name || v.name || v.fullName)) || 'Provider';
  const reviewCount =
    v && typeof v === 'object' ? Number(v.reviewCount ?? v.review_count ?? 0) || 0 : 0;
  const rawVendorRating =
    v && typeof v === 'object' && (v.rating != null || v.avgRating != null)
      ? Number(v.rating ?? v.avgRating)
      : NaN;
  const ratingNum =
    reviewCount > 0 && Number.isFinite(rawVendorRating) && rawVendorRating > 0
      ? rawVendorRating
      : 0;

  return {
    providerId: embedVendorId,
    providerType: 'vendor',
    vendorId: embedVendorId,
    name: String(name),
    phone: v && typeof v === 'object' ? String(v.phone || '') : undefined,
    photo: v && typeof v === 'object' ? (v.photo || v.photoUrl || v.logo) as string | undefined : undefined,
    address:
      v && typeof v === 'object'
        ? String(v.address || [v.city, v.state].filter(Boolean).join(', ') || '')
        : undefined,
    experienceYears:
      v && typeof v === 'object' ? Number(v.experience ?? v.yearsOfExperience ?? v.years_of_experience ?? 0) || undefined : undefined,
    qualifications: v && typeof v === 'object' ? (v.qualifications as string | undefined) : undefined,
    rating: ratingNum,
    reviewCount,
    isVerified: v && typeof v === 'object' ? Boolean(v.isVerified ?? v.verified ?? v.is_verified) : false,
    isIndividualProvider: true,
    services,
  };
}

export function UniversalServicesByStyle({ 
  phone,
  roleId,
  serviceStyle, 
  serviceTypeName,
  category,
  vendorId,
  specialization,
  profileBackScreen,
  onBack, 
  onNavigate,
  bookingScreen = 'booking' // Default booking screen
}: UniversalServicesByStyleProps) {
  const router = useRouter();
  const config = getRoleConfig(roleId);
  const finalCategory = category || config.category;
  const RoleIcon = config.icon;
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  
  // Profile view state (when vendorId is provided)
  const [vendor, setVendor] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [rating, setRating] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'reviews'>('services');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'name' | 'popular'>('popular');
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  // Check if we're in profile view mode (vendorId provided and single provider)
  const isProfileView = vendorId && providers.length === 1;
  const profileProvider = isProfileView ? providers[0] : null;

  useEffect(() => {
    loadServicesByStyle();
    // If vendorId is provided, also load vendor and facility details for profile view
    if (vendorId) {
      loadVendorProfile();
    }
  }, [serviceStyle, vendorId, specialization, phone]); // Reload when specialization or coords context (phone) changes

  const loadServicesByStyle = async () => {
    const { latitude, longitude } = await resolveCustomerDiscoveryCoords(phone);
    let locationParams = '';
    if (latitude != null && longitude != null) {
      locationParams = `&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`;
    }

    try {
      setLoading(true);
      
      // ✅ CRITICAL FIX: Different endpoints for different service styles
      // Rule 1: at_center (clinic) uses /customer/services/by-style (returns clinic profiles with services)
      // Rule 2 & 3: at_home/tele use /customer/discover-services (returns solo vendors and staff only)
      
      if (serviceStyle === 'at_center') {
        // ✅ CLINIC FLOWS: Use original endpoint that returns clinic profiles with services
        const specializationParam = specialization 
          ? `&specialization=${encodeURIComponent(specialization)}` 
          : '';
        const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
        
        const response = await apiClient.get(
          `/customer/services/by-style?style=${serviceStyle}&category=${category}${locationParams}${specializationParam}${phoneParam}`
        ) as any;

        if (response.success) {
          // API returns 'providers' or 'vendors' array with services already included
          let providerData = response.providers || response.vendors || [];
          
          // Filter to specific vendor if vendorId is provided (vendor profile mode)
          if (vendorId) {
            const want = String(vendorId).trim();
            providerData = providerData.filter((p: any) =>
              rowMatchesEmbedVendorId(p as Record<string, unknown>, want)
            );
            if (providerData.length === 0) {
              const fb = await fetchEmbeddedVendorAsProvider({
                embedVendorId: want,
                phone,
                finalCategory,
                serviceStyle,
                roleName: config.roleName,
              });
              if (fb) {
                providerData = [fb as any];
              }
            }
          }

          // ✅ FIX: Normalize nextAvailableSlot to always be a string
          // Handle all possible field names: nextAvailable (API), nextAvailableSlot, nextAvailability
          providerData = providerData.map((p: any) => {
            if (!p.photo && p.photoUrl) {
              p.photo = p.photoUrl;
            }
            p.nextAvailableSlot = resolveNextAvailableLabel(p);
            return p;
          });
          
          setProviders(providerData);
          console.log(`✅ [${config.roleName}] Loaded ${providerData.length} clinic${vendorId ? ' (filtered)' : 's'} with ${serviceStyle} services`);
        } else {
          console.warn(`⚠️ [${config.roleName}] API returned success=false`);
          setProviders([]);
        }
      } else {
        // ✅ HOME/TELE FLOWS: Use discover-services endpoint (solo vendors and staff only)
        // ✅ FIX: Don't pass roleId - it causes filtering issues. Category is sufficient.
        const phoneParam = phone ? `&phone=${encodeURIComponent(phone)}` : '';
        const specParam = specialization
          ? `&specialization=${encodeURIComponent(specialization)}`
          : '';
        const discoverResponse = await apiClient.get(
          `/customer/discover-services?category=${finalCategory}&serviceStyle=${serviceStyle}${locationParams}${phoneParam}${specParam}`
        ) as any;
        
        // The endpoint returns providers array (solo vendors and staff)
        const providersData = discoverResponse.providers || discoverResponse.vendors || [];
        
        // For each provider, fetch their services
        const providersWithServices = await Promise.all(
          providersData.map(async (provider: any) => {
            const providerId = provider.id || provider.vendorId || provider.providerId;
            const isStaff = provider.isStaffMember || provider.providerType === 'staff';
            
            // Fetch services for this provider
            let services: any[] = [];
            try {
              const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
              if (isStaff) {
                // For staff, services are linked via vendor_services of their vendor
                const vendorId = provider.vendorId || providerId;
                const servicesResponse = await apiClient.get(
                  `/customer/vendor/${vendorId}/services?serviceStyle=${serviceStyle}&category=${finalCategory}${phoneParam}`
                ) as any;
                
                // ✅ FIX: Handle response format correctly - API returns { success: true, services: [...] }
                // API returns { services, packages }; merge + dedupe so vendor custom packages appear (business + solo).
                let servicesArray = mergeCustomerVendorServicesPayload(servicesResponse);
                if (servicesArray.length === 0 && Array.isArray(servicesResponse)) servicesArray = servicesResponse;

                services = servicesArray.map((s: any) => ({
                  id: s.id || s.service_id,
                  serviceId: s.id || s.service_id,
                  name: s.name || s.service_name || `${config.roleName} Service`,
                  price: Number(s.price || s.custom_price || 499),
                  originalPrice: Number(s.price || s.custom_price || 499),
                  vendorDiscount: s.vendor_discount || s.discount || 0,
                  duration: Number(s.duration || s.custom_duration || s.duration_minutes || 30),
                  description: s.description || s.custom_description,
                  category: s.category_name || s.category,
                  isPackage: !!(s.isPackage ?? (s.metadata && (s.metadata as any).isPackage)),
                  inActivePackage: !!s.inActivePackage,
                }));
              } else {
                // Prefer services already on discover-services payload (same filters as listing). Secondary fetch
                // uses GET /customer/vendor/:id/services — if category rules drift, listing could succeed but this
                // returned 0 rows and the provider disappeared from "main" at-home.
                if (Array.isArray(provider.services) && provider.services.length > 0) {
                  services = provider.services.map((s: any) => ({
                    id: s.id || s.service_id,
                    serviceId: s.serviceId || s.id || s.service_id,
                    name: s.name || s.serviceName || s.service_name || `${config.roleName} Service`,
                    price: Number(s.price || s.custom_price || 499),
                    originalPrice: Number(s.price || s.custom_price || 499),
                    vendorDiscount: s.vendor_discount || s.discount || 0,
                    duration: Number(s.duration || s.custom_duration || s.duration_minutes || 30),
                    description: s.description || s.custom_description,
                    category: s.category || s.categoryName || s.category_name,
                    isPackage: !!(s.isPackage ?? (s.metadata && (s.metadata as any).isPackage)),
                    inActivePackage: !!s.inActivePackage,
                  }));
                } else {
                const servicesResponse = await apiClient.get(
                  `/customer/vendor/${providerId}/services?serviceStyle=${serviceStyle}&category=${finalCategory}${phoneParam}`
                ) as any;

                let servicesArray = mergeCustomerVendorServicesPayload(servicesResponse);
                if (servicesArray.length === 0 && Array.isArray(servicesResponse)) servicesArray = servicesResponse;

                services = servicesArray.map((s: any) => ({
                  id: s.id || s.service_id,
                  serviceId: s.id || s.service_id,
                  name: s.name || s.service_name || `${config.roleName} Service`,
                  price: Number(s.price || s.custom_price || 499),
                  originalPrice: Number(s.price || s.custom_price || 499),
                  vendorDiscount: s.vendor_discount || s.discount || 0,
                  duration: Number(s.duration || s.custom_duration || s.duration_minutes || 30),
                  description: s.description || s.custom_description,
                  category: s.category_name || s.category,
                  isPackage: !!(s.isPackage ?? (s.metadata && (s.metadata as any).isPackage)),
                  inActivePackage: !!s.inActivePackage,
                }));
                }
              }
            } catch (serviceError) {
              console.warn(`⚠️ [${config.roleName}] Could not fetch services for provider ${providerId}:`, serviceError);
              console.warn(`⚠️ [${config.roleName}] Provider details:`, { providerId, isStaff, vendorId: provider.vendorId });
              // ✅ FIX: Return null to filter out providers with no services
              return null;
            }
            
            // ✅ FIX: If no services found, filter out this provider
            if (!services || services.length === 0) {
              console.warn(`⚠️ [${config.roleName}] No services found for provider ${providerId}`);
              return null;
            }
            
            console.log(`✅ [${config.roleName}] Fetched ${services.length} service(s) for provider ${providerId}`);
            
            return {
              providerId: providerId,
              providerType: isStaff ? 'staff' : 'vendor',
              vendorId: provider.vendorId || (isStaff ? null : providerId),
              staffId: isStaff ? providerId : undefined,
              name: provider.businessName || provider.name || config.roleName,
              phone: provider.phone,
              photo: provider.photo || provider.photoUrl, // ✅ Support both photo and photoUrl
              address: provider.address || provider.location,
              city: provider.city,
              role: provider.role,
              experienceYears: provider.experienceYears,
              qualifications: provider.qualifications,
              rating: (() => {
                const rc =
                  Number(provider.reviewCount ?? provider.review_count ?? 0) || 0;
                const raw =
                  provider.rating != null ? Number(provider.rating) : NaN;
                return rc > 0 && Number.isFinite(raw) && raw > 0 ? raw : 0;
              })(),
              reviewCount: Number(provider.reviewCount ?? provider.review_count ?? 0) || 0,
              distance: provider.distance || null,
              isVerified: provider.isVerified,
              isOnline: provider.isOnline ?? provider.is_online,
              isIndividualProvider: provider.isIndividualProvider || !provider.vendorId,
              nextAvailableSlot: resolveNextAvailableLabel(provider),
              specialization: provider.specialization || provider.specialisation,
              services: services
            };
          })
        );
        
        // ✅ FIX: Filter out null providers first (from catch blocks), then filter by services
        const filteredProviders = providersWithServices
          .filter(p => p !== null && p !== undefined) // Remove null/undefined providers
          .filter(p => p && p.services && Array.isArray(p.services) && p.services.length > 0); // Only keep providers with services
        
        console.log(`✅ [${config.roleName}] Filtered providers: ${filteredProviders.length} out of ${providersWithServices.length} (removed ${providersWithServices.length - filteredProviders.length} with no services)`);
        
        // Filter to specific vendor if vendorId is provided (vendor profile mode)
        let finalProviders = filteredProviders;
        if (vendorId) {
          const want = String(vendorId).trim();
          finalProviders = filteredProviders.filter((p) => {
            const keys = [p.providerId, p.vendorId, p.staffId].filter(Boolean).map((x) => String(x));
            return keys.includes(want);
          });
          if (finalProviders.length === 0) {
            const fb = await fetchEmbeddedVendorAsProvider({
              embedVendorId: want,
              phone,
              finalCategory,
              serviceStyle,
              roleName: config.roleName,
            });
            if (fb) {
              finalProviders = [fb];
            }
          }
        }

        setProviders(finalProviders);
        console.log(`✅ [${config.roleName}] Loaded ${finalProviders.length} solo/staff provider${vendorId ? ' (filtered)' : 's'} with ${serviceStyle} services`);
      }
    } catch (error) {
      console.error(`❌ [${config.roleName}] Error loading services by style:`, error);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  // Load vendor and facility details for profile view
  const loadVendorProfile = async () => {
    if (!vendorId) return;
    
    try {
      const [vendorRes, facilityRes] = await Promise.all([
        apiClient.get<any>(`/customer/vendor/${vendorId}`).catch(() => null),
        apiClient.get<any>(`/customer/facility/${vendorId}`).catch(() => null)
      ]);

      if (vendorRes?.success || vendorRes) {
        const vendorData = vendorRes?.vendor || vendorRes;
        setVendor(vendorData);
      }

      if (facilityRes?.success) {
        setFacility(facilityRes.facility);
        setRating(facilityRes.rating);
        setReviews(facilityRes.recentReviews || []);
      }
    } catch (error) {
      console.error('Error loading vendor profile:', error);
    }
  };

  const getStyleIcon = () => {
    switch (serviceStyle) {
      case 'tele': return <Video className="w-5 h-5" />;
      case 'at_home': return <Home className="w-5 h-5" />;
      case 'at_center': return <Building2 className="w-5 h-5" />;
      default: return <Video className="w-5 h-5" />;
    }
  };

  const getStyleColor = () => {
    switch (serviceStyle) {
      case 'tele': return 'from-blue-500 to-blue-600';
      case 'at_home': return 'from-orange-500 to-orange-600';
      case 'at_center': return 'from-green-500 to-green-600';
      default: return 'from-blue-500 to-blue-600';
    }
  };

  const getProviderTypeLabel = (provider: Provider) => {
    if (provider.providerType === 'individual') {
      return 'Independent Provider';
    }
    if (provider.providerType === 'staff') {
      return provider.vendorName ? `From ${provider.vendorName}` : 'Clinic Staff';
    }
    return provider.role || 'Provider';
  };

  const getProviderAddress = (provider: Provider) => {
    const rawAddress = [
      provider.address,
      (provider as any)?.location?.address,
      (provider as any)?.vendorLocation?.address,
      (provider as any)?.vendor?.address,
      (provider as any)?.facility?.address,
    ].find((value) => typeof value === 'string' && value.trim().length > 0) as string | undefined;

    return rawAddress?.trim() || '';
  };

  const openProviderProfileForChevron = (e: MouseEvent, provider: Provider) => {
    e.stopPropagation();
    const row = provider as unknown as Record<string, unknown>;
    if (roleId === 'trainer') {
      onNavigate('training_embed_vendor_profile', {
        vendorId: getWebGroomingTrainingEmbedVendorId(row),
        serviceStyle: String(serviceStyle),
      });
      return;
    }
    if (roleId === 'veterinarian') {
      const { screen, data } = getWebVetDiscoveryChevronNavTarget({
        serviceStyle: String(serviceStyle),
        serviceTypeName,
        category,
        provider: row,
        ...(profileBackScreen
          ? { profileBackScreen }
          : { doctorProfileBackScreen: 'vet' }),
      });
      onNavigate(screen, data);
      return;
    }
    if (roleId === 'groomer') {
      onNavigate('grooming_embed_vendor_profile', {
        vendorId: getWebGroomingTrainingEmbedVendorId(row),
      });
      return;
    }
    if (roleId === 'walker') {
      const target = getWebWalkerDiscoveryChevronNavTarget({
        provider: row,
        providerDisplayName: provider.name,
        serviceStyle: String(serviceStyle),
        profileBackScreen,
        specialization,
      });
      if (!target) {
        toast.error('Profile unavailable — missing vendor id.');
        return;
      }
      onNavigate(target.screen, target.data);
      return;
    }
  };

  const handleSelectService = (provider: Provider, service: any) => {
    if (serviceStyle === 'tele' && roleId === 'veterinarian') {
      const sid = String(service.id || service.serviceId || '');
      const vid =
        provider.providerType === 'vendor'
          ? provider.providerId || provider.vendorId
          : provider.vendorId || provider.providerId;
      if (sid) {
        const url = buildTeleInstantAutoPayBookingUrl({
          serviceId: sid,
          vendorId: vid ? String(vid) : undefined,
        });
        if (url) {
          console.log('[UniversalServicesByStyle] vet tele Book Now →', url);
          router.push(url);
          return;
        }
      }
    }

    // ✅ FIX: Pass complete service data to booking router
    const bookingData: any = {
      serviceId: service.id || service.serviceId,
      serviceName: service.name || service.serviceName,
      serviceStyle: serviceStyle, // ✅ CRITICAL: Pass service style
      price: service.price || 0,
      duration: service.duration || 30,
      providerName: provider.name,
      vendorName: provider.vendorName || provider.name,
      /** Full row so vet-booking / package redirect sees metadata, isPackage, packageDetails */
      service: {
        ...service,
        id: service.id ?? service.serviceId,
        serviceId: service.serviceId ?? service.service_id ?? service.id,
        name: service.name || service.serviceName,
        price: service.price ?? 0,
        duration: service.duration ?? 30,
      },
    };

    const vendorIdForPkg =
      provider.providerType === 'vendor'
        ? String(provider.providerId || provider.vendorId || '')
        : String(provider.vendorId || provider.providerId || '');
    if (isVendorServicePackageRow(service as any) && vendorIdForPkg) {
      const pkgNav = buildWalkerServiceDataForVendorPackagePurchase({
        vendorId: vendorIdForPkg,
        vendorName: provider.vendorName || provider.name,
        serviceRow: service as Record<string, unknown>,
        serviceTypeCategory: serviceTypeCategoryFromRoleId(roleId),
        serviceStyle: String(serviceStyle),
      });
      if (pkgNav) {
        onNavigate('purchase-package', pkgNav);
        return;
      }
    }

    if (provider.providerType === 'vendor') {
      bookingData.vendorId = provider.providerId || provider.vendorId;
      bookingData.vendorName = provider.name;
      bookingData.doctorId = provider.providerId; // For compatibility
    } else {
      // Staff or individual provider
      bookingData.staffId = provider.staffId || provider.providerId;
      bookingData.staffName = provider.name;
      bookingData.vendorId = provider.vendorId; // May be null for individual providers
      bookingData.vendorName = provider.vendorName;
      bookingData.isIndividualProvider = provider.isIndividualProvider;
      bookingData.doctorId = provider.staffId || provider.providerId; // For compatibility
    }

    console.log(`✅ [${config.roleName}] Navigating to booking with data:`, bookingData);
    onNavigate(bookingScreen, bookingData);
  };

  // Filter and sort services for profile view
  const filteredServices = useMemo(
    () => filterServicesByQuery(profileProvider?.services || [], searchQuery),
    [profileProvider?.services, searchQuery]
  );
  const sortedServices = [...filteredServices].sort((a, b) => {
    if (sortBy === 'popular') return 0;
    if (sortBy === 'price') return a.price - b.price;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  const isSingleServiceSelection = serviceStyle === 'tele' || roleId === 'trainer';

  const toggleServiceSelection = (serviceId: string) => {
    if (isSingleServiceSelection) {
      setSelectedServices((prev) => {
        if (prev.has(serviceId)) return new Set();
        return new Set([serviceId]);
      });
      return;
    }
    const newSelection = new Set(selectedServices);
    if (newSelection.has(serviceId)) {
      newSelection.delete(serviceId);
    } else {
      newSelection.add(serviceId);
    }
    setSelectedServices(newSelection);
  };

  // ✅ FIX: Pass all selected services to booking (matches vet/grooming flow)
  const handleBookServices = () => {
    if (selectedServices.size === 0) {
      if (profileProvider?.services && profileProvider.services.length > 0) {
        handleSelectService(profileProvider, profileProvider.services[0]);
      }
      return;
    }

    const selectedServicesData = Array.from(selectedServices).map(id => 
      profileProvider?.services.find(s => s.id === id || s.serviceId === id)
    ).filter(Boolean);

    if (selectedServicesData.length > 0) {
      if (
        serviceStyle === 'tele' &&
        roleId === 'veterinarian' &&
        profileProvider
      ) {
        handleSelectService(profileProvider, selectedServicesData[0]);
        return;
      }

      const pkgRow = selectedServicesData.find((s) => isVendorServicePackageRow(s as any));
      if (pkgRow && profileProvider) {
        const vid =
          profileProvider.providerType === 'vendor'
            ? String(profileProvider.providerId || profileProvider.vendorId || '')
            : String(profileProvider.vendorId || profileProvider.providerId || '');
        if (vid) {
          const pkgNav = buildWalkerServiceDataForVendorPackagePurchase({
            vendorId: vid,
            vendorName: profileProvider.vendorName || profileProvider.name,
            serviceRow: pkgRow as Record<string, unknown>,
            serviceTypeCategory: serviceTypeCategoryFromRoleId(roleId),
            serviceStyle: String(serviceStyle),
          });
          if (pkgNav) {
            onNavigate('purchase-package', pkgNav);
            return;
          }
        }
      }

      const bookingServices =
        roleId === 'trainer' ||
        (serviceStyle === 'tele' && roleId === 'veterinarian')
          ? [selectedServicesData[0]]
          : selectedServicesData;
      const firstService = bookingServices[0];
      const bookingData: any = {
        vendorId: profileProvider!.providerId || profileProvider!.vendorId,
        vendorName: profileProvider!.name,
        serviceStyle,
        selectedServices: bookingServices,
        serviceId: firstService?.id || firstService?.serviceId,
        serviceName: firstService?.name,
        price: bookingServices.reduce((sum, s) => sum + (s?.price || 0), 0),
        duration: bookingServices.reduce((sum, s) => sum + (s?.duration || 0), 0),
        providerName: profileProvider!.name,
        service: firstService, // Backward compatibility
      };
      if (profileProvider!.providerType === 'vendor') {
        bookingData.vendorId = profileProvider!.providerId;
        bookingData.vendorName = profileProvider!.name;
      } else {
        bookingData.staffId = profileProvider!.staffId || profileProvider!.providerId;
        bookingData.staffName = profileProvider!.name;
        bookingData.vendorId = profileProvider!.vendorId;
        bookingData.vendorName = profileProvider!.vendorName;
      }
      onNavigate(bookingScreen, bookingData);
    }
  };

  const totalPrice = Array.from(selectedServices).reduce((sum, id) => {
    const service = profileProvider?.services.find(s => s.id === id || s.serviceId === id);
    return sum + (service?.price || 0);
  }, 0);

  const handleShare = async () => {
    const shareVendorId =
      vendorId ||
      pickCustomerVendorAccountId(profileProvider ?? {}) ||
      profileProvider?.vendorId ||
      profileProvider?.providerId;
    if (!shareVendorId) return;
    await shareVendorProfile({
      title: profileProvider?.name || `${config.roleName} Provider`,
      text: `Check out ${profileProvider?.name || `this ${config.roleName.toLowerCase()} provider`} on Warmpawz`,
      vendorId: String(shareVendorId),
      persona: roleIdToSharePersona(roleId),
      vendorName: profileProvider?.name,
      serviceStyle,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#FF8C42] mx-auto mb-3" />
          <p className="text-gray-600">Loading {vendorId ? 'provider profile' : 'available services'}...</p>
        </div>
      </div>
    );
  }

  // Profile View Mode - Zomato-style for vet provider (tele/at_home/at_center)
  if (isProfileView && profileProvider) {
    const providerName = vendor?.business_name || vendor?.name || profileProvider.name;
    const photos = resolveVendorProfileHeroGallery({ facility, vendor, profileProvider });
    const hasPhotos = photos.length > 0;
    const { amenities, customAmenities } = resolveCustomerVendorAmenities({
      ...(facility && typeof facility === 'object' ? facility : {}),
      ...(vendor && typeof vendor === 'object' ? vendor : {}),
      ...(profileProvider.amenities ? { amenities: profileProvider.amenities } : {}),
    });
    const hasAmenities =
      shouldShowVendorAmenities(serviceStyle) &&
      (amenities.length > 0 || customAmenities.length > 0);
    const address = vendor?.address || facility?.address || profileProvider.address || '';
    const phoneNumber = vendor?.phone || facility?.phone || profileProvider.phone || '';
    const description = vendor?.description || facility?.description || `${providerName} provides professional ${config.category} services.`;
    const profileServiceSubtitle =
      serviceStyle === 'tele'
        ? config.styleDescriptions.tele || 'Video consultation'
        : serviceStyle === 'at_home'
          ? config.styleDescriptions.at_home
          : config.styleDescriptions.at_center;

    const profileVendorId = String(
      vendorId ?? profileProvider.id ?? pickCustomerVendorAccountId(vendor as Record<string, unknown>) ?? ''
    ).trim();
    const profileReviewTotal = normalizeRatingCount(
      rating?.totalReviews ?? profileProvider.reviewCount
    );
    const profileAvgRaw = rating?.averageRating ?? profileProvider.rating;
    const profileRatingLabel = getAverageRatingLabel(profileAvgRaw, profileReviewTotal);
    const profileRatingResolved = resolveVendorRating(
      {
        vendorId: profileVendorId,
        vendorRating: profileAvgRaw,
        vendorReviewCount: profileReviewTotal,
        averageRating: rating?.averageRating,
      },
      { expectedVendorId: profileVendorId }
    );
    const showProfileRatingPill = profileRatingResolved.shouldShowRating;

    return (
      <div className="min-h-screen bg-gray-50 relative overflow-hidden">
        {/* ✅ FIX: Restore Frame UI with ServiceDashboardHeader */}
        <VendorProfileDashboardHeader
          fullWidth
          className="!z-0 isolation-auto"
          serviceName={config.roleName}
          serviceSubtitle={profileServiceSubtitle}
          serviceIcon={RoleIcon}
          iconColor="text-white"
          onBack={onBack}
          showBackButton={true}
          bottomEdge="flat"
        />

        <div className="relative z-0 mx-auto w-full max-w-customer">
        {hasPhotos ? (
          <div className="relative w-full -mt-3 sm:-mt-3">
            <div className="overflow-hidden rounded-t-[24px] bg-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] sm:rounded-t-[28px]">
              <VendorHeroPhotoCarousel
                photos={photos}
                name={providerName}
                frameClassName="relative h-[280px] overflow-hidden sm:h-[320px]"
              />
            </div>
          </div>
        ) : (
          <div className="relative w-full -mt-3 sm:-mt-3">
            <div className="overflow-hidden rounded-t-[24px] sm:rounded-t-[28px]">
          <div className="relative flex h-[280px] w-full items-center justify-center bg-gradient-to-br from-[#FF8C42] to-[#FF7029]">
            <div className="text-center text-white">
              {serviceStyle === 'tele' ? (
                <Video className="w-20 h-20 mx-auto mb-3 opacity-50" />
              ) : serviceStyle === 'at_home' ? (
                <Home className="w-20 h-20 mx-auto mb-3 opacity-50" />
              ) : (
                <Building2 className="w-20 h-20 mx-auto mb-3 opacity-50" />
              )}
              <p className="text-sm opacity-75">No photos available</p>
            </div>
          </div>
            </div>
          </div>
        )}

        <div className="mx-auto w-full max-w-customer px-4 cw-scroll-pad-tabbar-sticky-cta">
          {/* Provider Header Info - Vet-Focused */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4 -mt-6 relative z-10">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{providerName}</h1>
              
              {showProfileRatingPill ? (
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-lg">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-lg text-gray-900">
                    {profileRatingLabel}
                  </span>
                  <span className="text-gray-600 text-sm">
                    ({profileReviewTotal} {profileReviewTotal === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
                
                {facility?.isPremium && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" />
                    Premium
                  </span>
                )}
                {profileProvider.isVerified && (
                  <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    Verified
                  </span>
                )}
              </div>
              ) : null}

              {/* Service Type Badge */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
                  {serviceStyle === 'tele' ? (
                    <Video className="w-4 h-4 text-[#FF8C42]" />
                  ) : serviceStyle === 'at_home' ? (
                    <Home className="w-4 h-4 text-[#FF8C42]" />
                  ) : (
                    <Building2 className="w-4 h-4 text-[#FF8C42]" />
                  )}
                  <span className="text-sm font-medium text-gray-700">
                    {config.styleLabels[serviceStyle] || serviceTypeName || 'Service'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-3 gap-2 mb-4 border-t border-gray-100 pt-4">
              <button 
                onClick={() => phoneNumber && window.open(`tel:${phoneNumber}`, '_self')}
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <Phone className="w-5 h-5 text-[#FF8C42] group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-gray-700">Call</span>
              </button>
              {address && serviceStyle !== 'tele' && (
                <button 
                  onClick={() => {
                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                >
                  <Navigation className="w-5 h-5 text-[#FF8C42] group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium text-gray-700">Directions</span>
                </button>
              )}
              <button 
                onClick={handleShare}
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <Share2 className="w-5 h-5 text-[#FF8C42] group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-gray-700">Share</span>
              </button>
            </div>

            {/* Quick Info */}
            <div className="space-y-2.5 border-t border-gray-100 pt-4">
              {address && serviceStyle !== 'tele' && (
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">{address}</span>
                </div>
              )}
              {serviceStyle === 'tele' && (
                <div className="flex items-center gap-3 text-sm">
                  <Video className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700">Video Consultation Available</span>
                </div>
              )}
            </div>

            {/* Amenities/Features */}
            {hasAmenities && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Features</h3>
                <AmenitiesSection amenities={amenities} customAmenities={customAmenities} compact />
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b-2 border-gray-200 bg-white rounded-t-2xl overflow-hidden sticky top-[56px] z-40 shadow-sm">
            {['overview', 'services', 'reviews'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-4 text-sm font-semibold capitalize transition-all relative ${
                  activeTab === tab
                    ? 'text-[#FF8C42]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'services' ? `Services (${profileProvider.services.length})` : tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF8C42]" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-b-2xl p-5 mb-4 min-h-[400px]">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <RoleIcon className="w-5 h-5 text-[#FF8C42]" />
                    About
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{profileProvider.services.length}</div>
                    <div className="text-xs text-gray-500 mt-1">Services</div>
                  </div>
                  <div className="text-center border-x border-gray-200">
                    <div className="text-2xl font-bold text-gray-900">
                      {profileProvider.experienceYears || '5+'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Years Experience</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {rating?.totalReviews || profileProvider.reviewCount || '10+'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Reviews</div>
                  </div>
                </div>

                {/* Qualifications */}
                {profileProvider.qualifications && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Qualifications</h3>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                      <div className="flex items-start gap-3">
                        <Award className="w-5 h-5 text-blue-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-700 font-medium mb-1">Professional Credentials</p>
                          <p className="text-sm text-gray-600">{profileProvider.qualifications}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Full Amenities List */}
                {hasAmenities && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">All Features</h3>
                    <AmenitiesSection amenities={amenities} customAmenities={customAmenities} />
                  </div>
                )}

                {/* Get Directions CTA (only for at_home/at_center) */}
                {address && serviceStyle !== 'tele' && (
                  <button 
                    onClick={() => {
                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
                    }}
                    className="w-full px-4 py-3.5 bg-[#FF8C42] text-white rounded-xl font-semibold hover:bg-[#E67A35] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                  >
                    <Navigation className="w-5 h-5" />
                    Get Directions on Maps
                  </button>
                )}
              </div>
            )}

            {activeTab === 'services' && (
              <div className="space-y-4">
                {/* Search and Filter */}
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder={`Search ${config.category} services...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                    >
                      <option value="popular">Popular First</option>
                      <option value="price">Price: Low to High</option>
                      <option value="name">Name: A to Z</option>
                    </select>
                  </div>
                </div>

                {/* Services List - Enhanced Cards */}
                {sortedServices.length > 0 ? (
                  <div className="space-y-3">
                    {sortedServices.map((service) => {
                      const isSelected = selectedServices.has(service.id) || selectedServices.has(service.serviceId);
                      return (
                        <div
                          key={service.id}
                          onClick={() => toggleServiceSelection(service.id)}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                            isSelected
                              ? 'border-[#FF8C42] bg-gradient-to-br from-orange-50 to-orange-100 shadow-md'
                              : 'border-gray-200 hover:border-[#FF8C42]/50 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h4 className="font-bold text-gray-900 text-base">{service.name}</h4>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {(isVendorServicePackageRow(service as any) || (service as any).isPackage) && (
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-200">Package</span>
                                  )}
                                  {(service as any).inActivePackage && (
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-[#FF8C42] border border-orange-200">In your package</span>
                                  )}
                                </div>
                                {isSelected && (
                                  <span className="px-2.5 py-0.5 bg-green-500 text-white rounded-full text-xs font-semibold flex items-center gap-1 flex-shrink-0">
                                    <Check className="w-3 h-3" />
                                    Selected
                                  </span>
                                )}
                              </div>
                              {service.description?.trim() && (
                                <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                                  <ServiceDescriptionInline
                                    description={service.description!}
                                    title={service.name}
                                    className="m-0 text-sm leading-5 text-gray-600"
                                  />
                                </div>
                              )}
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-lg">
                                  <Clock className="w-3.5 h-3.5 text-gray-600" />
                                  {(service.duration ?? 0)} mins
                                </span>
                                {service.category && (
                                  <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-gray-600">{service.category}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {/* ✅ FIX GAP-7.1: Use ServicePricingDisplay for vendor discount */}
                              <ServicePricingDisplay
                                basePrice={service.originalPrice || service.price}
                                vendorDiscount={service.vendorDiscount}
                                usePromoQuote
                                vendorId={vendorId || undefined}
                                serviceId={String(service.id || service.serviceId || '')}
                                customerId={phone}
                                serviceStyle={serviceStyle}
                                serviceCategory={finalCategory}
                                className="mb-1"
                              />
                              {isSelected && (
                                <div className="mt-1 flex justify-end">
                                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                    <Check className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <RoleIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium mb-1">No services available</p>
                    <p className="text-sm text-gray-500">Services will be added soon</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {/* Reviews Summary */}
                {reviews.length > 0 && rating && (() => {
                  const tabTotal = normalizeRatingCount(
                    rating.totalReviews ?? profileProvider.reviewCount ?? reviews.length
                  );
                  let tabAvg = Number(rating.averageRating ?? profileProvider.rating ?? 0);
                  if ((!Number.isFinite(tabAvg) || tabAvg <= 0) && reviews.length > 0) {
                    tabAvg =
                      reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) /
                      reviews.length;
                  }
                  if (tabTotal <= 0 || !Number.isFinite(tabAvg) || tabAvg <= 0) return null;
                  return (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                          <span className="text-3xl font-bold text-gray-900">
                            {tabAvg.toFixed(1)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Based on {tabTotal} {tabTotal === 1 ? 'review' : 'reviews'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="w-10 h-10 mx-auto mb-1 bg-yellow-100 rounded-full flex items-center justify-center">
                          <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                        </div>
                        <p className="text-xs text-gray-500">Overall</p>
                      </div>
                    </div>
                  </div>
                  );
                })()}

                {/* Reviews List */}
                {reviews.length > 0 ? (
                  reviews.map((review) => (
                    <div key={review.id} className="bg-gray-50 rounded-xl p-5 border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-4 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-md">
                          {review.customerName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-gray-900">{review.customerName || 'Anonymous'}</h4>
                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                              {new Date(review.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mb-3">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={`w-4 h-4 ${i < review.rating ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}`} 
                              />
                            ))}
                            <span className="ml-2 text-sm font-medium text-gray-700">{review.rating}/5</span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium mb-1">No reviews yet</p>
                    <p className="text-sm text-gray-500">Be the first to review this provider!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fixed bottom CTA — sits above app bottom nav (same offset as boarding / vet profiles). */}
        <div className="cw-fixed-above-customer-tabbar fixed left-0 right-0 z-40 mx-auto w-full max-w-customer border-t border-gray-200 bg-white shadow-lg">
          {selectedServices.size > 0 && (
            <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {isSingleServiceSelection
                      ? 'Selected service'
                      : `${selectedServices.size} service${selectedServices.size > 1 ? 's' : ''} selected`}
                  </p>
                  <p className="text-lg font-bold text-orange-600">{formatPriceWithSymbol(totalPrice)}</p>
                </div>
                <button
                  onClick={() => setSelectedServices(new Set())}
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <div className="p-4">
            <Button 
              onClick={handleBookServices}
              disabled={profileProvider.services.length === 0}
              className="w-full bg-[#FF8C42] hover:bg-[#E67A35] h-12 text-lg text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {selectedServices.size === 0 
                ? (profileProvider.services.length === 0 ? 'No Services Available' : 'Select Services to Book')
                : isSingleServiceSelection
                  ? `Continue • ${formatPriceWithSymbol(totalPrice)}`
                  : `Book ${selectedServices.size} Service${selectedServices.size > 1 ? 's' : ''} (${formatPriceWithSymbol(totalPrice)})`
              }
            </Button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Listing View Mode (when vendorId not provided or multiple providers)
  // ✅ FIX: Prepare stats for ServiceDashboardHeader
  const listingStats = EMPTY_SERVICE_HEADER_STATS;

  const getServiceSubtitle = () => {
    if (serviceStyle === 'at_center') return config.styleDescriptions.at_center;
    if (serviceStyle === 'at_home') return config.styleDescriptions.at_home;
    if (serviceStyle === 'tele') return config.styleDescriptions.tele || 'Video consultation';
    return serviceTypeName || 'Choose a provider';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative overflow-hidden">
      {/* ✅ FIX: Use ServiceDashboardHeader to match vet service UI frame */}
      <ServiceDashboardHeader
        fullWidth
        serviceName={config.displayName}
        serviceSubtitle={getServiceSubtitle()}
        serviceIcon={config.icon}
        iconColor="text-white"
        stats={listingStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
        bottomEdge="sheet"
        sheetToneClass="bg-white"
      />

      {/* Unified body panel — matches Pet Boarding pattern (one continuous white surface, no gray gaps) */}
      <div className="flex-1 -mt-4 rounded-t-[1.75rem] bg-white sm:rounded-t-[2rem]">
      {/* Info section */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-orange-100 rounded-2xl flex items-center justify-center">
            {getStyleIcon()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{serviceTypeName || 'Services'}</h1>
            <p className="text-gray-600 text-sm">
              {providers.length} provider{providers.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>
        
        {/* Info badge for home/tele */}
        {(serviceStyle === 'at_home' || serviceStyle === 'tele') && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm mb-4">
            <div className="flex items-center gap-2 text-blue-900">
              <Shield className="w-4 h-4" />
              <span>All providers are verified and background-checked</span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-24">
        {providers.length === 0 ? (
          <Card className="p-8 text-center bg-white">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {getStyleIcon()}
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No Providers Available</h3>
            <p className="text-gray-500 text-sm mb-4">
              No {config.styleLabels[serviceStyle]?.toLowerCase() || 'service'} providers are currently available in your area.
            </p>
            <Button 
              onClick={onBack}
              variant="outline"
            >
              Try Other Services
            </Button>
          </Card>
        ) : (
          <div className="space-y-4  ">
            {providers.map((provider) => {
              const expanded = selectedProvider === provider.providerId;
              const headerInteractive = expanded;
              const providerAddress = getProviderAddress(provider);
              return (
              <Card key={provider.providerId} className="bg-white overflow-hidden">
                <div
                  role={headerInteractive ? 'button' : undefined}
                  tabIndex={headerInteractive ? 0 : undefined}
                  className={`p-4 border-b text-left w-full ${headerInteractive ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                  onClick={
                    headerInteractive
                      ? () =>
                          setSelectedProvider(
                            selectedProvider === provider.providerId ? null : provider.providerId
                          )
                      : undefined
                  }
                  onKeyDown={
                    headerInteractive
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedProvider(
                              selectedProvider === provider.providerId ? null : provider.providerId
                            );
                          }
                        }
                      : undefined
                  }
                >
                  <div className="flex min-w-0 w-full items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {/* Provider Photo or Initial */}
                      {provider.photo ? (
                        <img 
                          src={provider.photo} 
                          alt={provider.name}
                          className="h-12 w-12 shrink-0 rounded-full border-2 border-[#FF8C42] object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FF8C42] text-lg font-bold text-white">
                          {provider.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                          {provider.isVerified && (
                            <Shield className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-gray-500 text-sm">{getProviderTypeLabel(provider)}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {provider.reviewCount > 0 && provider.rating > 0 ? (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-medium">{Number(provider.rating).toFixed(1)}</span>
                            <span className="text-gray-400 text-sm">({provider.reviewCount})</span>
                          </div>
                          ) : (
                          <span className="text-xs text-gray-400">No reviews yet</span>
                          )}
                          {provider.city && (
                            <div className="flex items-center gap-1 text-gray-500 text-sm">
                              <MapPin className="w-3 h-3" />
                              {provider.city}
                            </div>
                          )}
                          {provider.distance != null && (
                            <span className="text-xs text-blue-600 font-medium">
                              {Number(provider.distance) < 1
                                ? `${Math.round(Number(provider.distance) * 1000)} m away`
                                : `${Math.round(Number(provider.distance))} km away`}
                            </span>
                          )}
                        </div>
                        {providerAddress && (
                          <div className="mt-1 flex min-w-0 items-start gap-1 text-xs text-gray-500">
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" />
                            <span className="line-clamp-1">{providerAddress}</span>
                          </div>
                        )}
                        {/* Show experience for staff/individual */}
                        {provider.experienceYears && provider.providerType !== 'vendor' && (
                          <div className="text-xs text-gray-500 mt-1">
                            {provider.experienceYears} years experience
                          </div>
                        )}
                        {provider.nextAvailableSlot && (
                          <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>Next: {provider.nextAvailableSlot}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`View profile: ${provider.name}`}
                      className="-m-1.5 p-1.5 rounded-full text-gray-400 hover:text-[#FF8C42] hover:bg-orange-50 flex-shrink-0 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#FF8C42] focus-visible:ring-offset-2"
                      onClick={(e) => openProviderProfileForChevron(e, provider)}
                    >
                      <ChevronRight
                        className={`w-5 h-5 transition-transform ${expanded ? 'rotate-90' : ''}`}
                        aria-hidden
                      />
                    </button>
                  </div>
                </div>

                {/* Services List - Expanded */}
                {expanded && (
                  <div className="bg-gray-50 p-4 space-y-3">
                    {/* Provider details for staff/individual */}
                    {provider.qualifications && (
                      <div className="bg-white rounded-lg p-3 mb-3 border border-blue-100">
                        <div className="text-xs text-gray-500 mb-1">Qualifications</div>
                        <div className="text-sm text-gray-700">{provider.qualifications}</div>
                      </div>
                    )}
                    
                    <h4 className="text-sm font-medium text-gray-600 mb-2">
                      Available Services ({provider.services.length})
                    </h4>
                    {provider.services.map((service) => (
                      <div
                        key={service.id}
                        className="bg-white rounded-lg p-4 shadow-sm border border-gray-100"
                      >
                        {/* Price + CTA on the right only; left = name, desc, duration/category (same grid as ClinicListView) */}
                        <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_6.25rem] items-start gap-2">
                          <div className="min-w-0 pr-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h5 className="line-clamp-2 break-words font-medium leading-5 text-gray-900">
                                {service.name}
                              </h5>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {(isVendorServicePackageRow(service as any) || (service as any).isPackage) && (
                                  <span className="shrink-0 rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                                    Package
                                  </span>
                                )}
                                {(service as any).inActivePackage && (
                                  <span className="shrink-0 rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-[#FF8C42]">
                                    In your package
                                  </span>
                                )}
                              </div>
                            </div>
                            {service.description?.trim() ? (
                              <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                <ServiceDescriptionInline
                                  description={service.description!}
                                  title={service.name}
                                  className="m-0 text-sm leading-5 text-gray-500 line-clamp-3"
                                />
                              </div>
                            ) : null}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="shrink-0 text-xs">
                                <Clock className="mr-1 h-3 w-3" />
                                {(service.duration ?? 0)} mins
                              </Badge>
                              {service.category && (
                                <Badge variant="secondary" className="max-w-full shrink-0 text-xs">
                                  {service.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <ServicePricingDisplay
                              basePrice={service.originalPrice || service.price}
                              vendorDiscount={service.vendorDiscount}
                              usePromoQuote
                              vendorId={String(provider.vendorId || vendorId || '')}
                              serviceId={String(service.id || service.serviceId || '')}
                              customerId={phone}
                              serviceStyle={serviceStyle}
                              serviceCategory={finalCategory}
                              className="mb-1"
                            />
                            <p className="mb-2 text-[11px] leading-4 text-gray-500 break-words">
                              {INDICATIVE_PRICING_NOTE}
                            </p>
                            <Button
                              size="sm"
                              className="h-8 w-full bg-[#FF8C42] px-2 text-xs font-semibold text-white hover:bg-[#E67A35] sm:h-9 sm:text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectService(provider, service);
                              }}
                            >
                              Book Now
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!expanded && provider.services.length > 0 && (
                  <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {provider.services.length} service{provider.services.length !== 1 ? 's' : ''} available
                      {provider.services[0] && (
                        <span className="text-gray-900 font-medium"> from {formatPriceWithSymbol(
                          Math.min(...provider.services.map(s => {
                            // ✅ FIX GAP-7.1: Use discounted price if available
                            const basePrice = s.originalPrice || s.price;
                            const finalPrice = s.vendorDiscount 
                              ? basePrice * (1 - s.vendorDiscount / 100)
                              : basePrice;
                            return finalPrice;
                          }))
                        )}</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42]/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProvider(provider.providerId);
                      }}
                    >
                      View Services
                    </Button>
                  </div>
                )}
              </Card>
            );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
