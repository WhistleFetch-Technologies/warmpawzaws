'use client';

/**
 * ============================================================================
 * PROBLEM GRID FLOW ROUTER
 * ============================================================================
 *
 * Orchestrates the complete flow from Problem Grid selection to booking
 * - User selects a problem/need from grid
 * - Shows available service styles (Home, Center, Tele)
 * - Routes to appropriate service discovery with pre-applied filters
 * - Maintains context through the entire booking flow
 *
 * Discovery lists vendors (grouped from /customer/services/by-problem); each
 * vendor expands inline to show services, then BookingFlow (vet-clinic style).
 *
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect, useMemo, type MouseEvent } from 'react';
import {
  Home,
  Building2,
  Video,
  ArrowLeft,
  ArrowRight,
  Loader2,
  MapPin,
  Calendar,
  Filter,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { sanitizeCustomerAllowedServiceStyles } from '@/lib/sanitize-customer-allowed-service-styles';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { sanitizeDisplayImageUrl, pickVendorPhotoFromRow } from '@/lib/resolve-display-image-url';
import { BookingFlow } from './BookingFlow';
import { ServiceDescriptionInline } from './shared/ServiceDescriptionInline';
import {
  groupByProblemRowsByVendor,
  type ByProblemServiceRow,
  type VendorGroupFromProblem,
} from '@/lib/group-by-problem-vendors';

function serviceCardThumbUrl(row: ByProblemServiceRow): string | undefined {
  const fromService = sanitizeDisplayImageUrl((row as { serviceImageUrl?: string | null }).serviceImageUrl);
  if (fromService) return fromService;
  return pickVendorPhotoFromRow(row as Record<string, unknown>);
}

function serviceTitleInitial(title: string): string {
  const t = title.trim();
  if (!t) return '?';
  const ch = t.charAt(0);
  return /[a-zA-Z0-9]/.test(ch) ? ch.toUpperCase() : t.slice(0, 1);
}

/** Category / service-type label for bottom row (matches vet clinic cards) */
function pickServiceCategoryLabel(row: ByProblemServiceRow, problemName?: string | null): string {
  const x = row as Record<string, unknown>;
  const cat = x.category ?? x.category_name ?? x.categoryName;
  if (typeof cat === 'string' && cat.trim()) return cat.trim();
  const rn = x.roleName ?? x.role_name;
  if (typeof rn === 'string' && rn.trim()) {
    return rn
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (problemName?.trim()) return problemName.trim();
  return 'Service';
}

// ============================================================================
// TYPES
// ============================================================================

interface ProblemGridItem {
  id: string;
  name: string;
  icon: string;
  description?: string;
  allowedServiceStyles?: ServiceStyle[];
  linkedServiceRoles: string[];
  specializations?: string[];
  category: string;
  popular?: boolean;
  roleId?: string;
}

type ServiceStyle = 'at_home' | 'at_center' | 'tele';

/** Minimal shape kept for BookingFlow handoff */
interface ServiceProvider {
  id: string;
  type: 'vendor' | 'staff';
  vendorId: string;
  name: string;
  photo?: string;
  rating: number;
  reviewCount: number;
  experience?: string;
  specializations: string[];
  distance: number;
  distanceFormatted: string;
  nextAvailable?: string;
  price: number;
  priceFormatted: string;
  serviceId: string;
  serviceName: string;
  isInstantAvailable?: boolean;
}

export type VendorProfileFromProblemContext = {
  vendorId: string;
  vendorName: string;
  serviceStyle: ServiceStyle;
  problemCategory?: string;
  roleIds?: string[];
};

interface ProblemGridFlowRouterProps {
  initialProblem?: ProblemGridItem;
  location?: { lat: number; lng: number };
  customerId?: string;
  onClose?: () => void;
  onBookingComplete?: (bookingId: string) => void;
  /** Chevron opens vendor/center profile in the parent app (e.g. vet clinic profile). If omitted, chevron toggles expand. */
  onVendorProfile?: (ctx: VendorProfileFromProblemContext) => void;
}

// ============================================================================
// SERVICE STYLE CONFIGURATION
// ============================================================================

const SERVICE_STYLE_CONFIG: Record<
  ServiceStyle,
  {
    label: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    description: string;
  }
> = {
  at_home: {
    label: 'At Home',
    icon: <Home className="w-6 h-6" />,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: 'Service at your doorstep',
  },
  at_center: {
    label: 'At Clinic/Center',
    icon: <Building2 className="w-6 h-6" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'Visit the service center',
  },
  tele: {
    label: 'Video Call',
    icon: <Video className="w-6 h-6" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    description: 'Online consultation',
  },
};

// ============================================================================
// FLOW STEPS
// ============================================================================

type FlowStep = 'service-style' | 'discovery' | 'booking' | 'confirmation';

function rowToServiceProvider(row: ByProblemServiceRow): ServiceProvider {
  const serviceId = String(row.serviceId || row.service_id || '');
  const vid = String(row.vendorId || row.vendor_id || '');
  const price = typeof row.price === 'number' ? row.price : parseFloat(String(row.price || 0)) || 0;
  const dist = row.distance != null && row.distance !== '' ? Number(row.distance) : NaN;
  return {
    id: String(row.id || `${vid}_${serviceId}`),
    type: 'vendor',
    vendorId: vid,
    name: String(row.vendorName || row.vendor_name || 'Provider'),
    photo: row.photo || row.photoUrl,
    rating: Number(row.rating ?? row.vendorRating ?? 0),
    reviewCount: Number(row.reviewCount ?? row.vendorReviews ?? 0),
    specializations: Array.isArray(row.specializations) ? row.specializations : [],
    distance: Number.isFinite(dist) ? dist : 0,
    distanceFormatted: row.distanceFormatted || 'N/A',
    nextAvailable: row.nextAvailable,
    price,
    priceFormatted: row.priceFormatted || `₹${price.toLocaleString('en-IN')}`,
    serviceId,
    serviceName: String(row.serviceName || row.name || 'Service'),
    isInstantAvailable: row.isInstantAvailable,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ProblemGridFlowRouter({
  initialProblem,
  location,
  customerId,
  onClose,
  onBookingComplete,
  onVendorProfile,
}: ProblemGridFlowRouterProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('service-style');
  const [selectedProblem, setSelectedProblem] = useState<ProblemGridItem | null>(initialProblem || null);
  const [selectedServiceStyle, setSelectedServiceStyle] = useState<ServiceStyle | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  /** Which vendor row is expanded to show inline services (discovery step only) */
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProblemDetails, setLoadingProblemDetails] = useState(false);
  /** Flat rows from by-problem (one per vendor_service) */
  const [flatRows, setFlatRows] = useState<ByProblemServiceRow[]>([]);
  const [isInstantMode, setIsInstantMode] = useState(false);
  const [allowedServiceStyles, setAllowedServiceStyles] = useState<ServiceStyle[]>(() => {
    if (!initialProblem) {
      return sanitizeCustomerAllowedServiceStyles([], { roleId: 'veterinarian' }) as ServiceStyle[];
    }
    const rid = initialProblem.roleId || initialProblem.linkedServiceRoles?.[0] || 'veterinarian';
    return sanitizeCustomerAllowedServiceStyles(initialProblem.allowedServiceStyles, {
      roleId: rid,
      specializationId: initialProblem.id,
      categoryHint: initialProblem.category,
    }) as ServiceStyle[];
  });

  const roleForStyles = selectedProblem?.roleId || selectedProblem?.linkedServiceRoles?.[0] || 'veterinarian';

  const availableStyles = sanitizeCustomerAllowedServiceStyles(allowedServiceStyles, {
    roleId: roleForStyles,
    specializationId: selectedProblem?.id,
    categoryHint: selectedProblem?.category,
  }) as ServiceStyle[];
  const hasTeleOption = availableStyles.includes('tele');

  const vendorsGrouped = useMemo(() => groupByProblemRowsByVendor(flatRows), [flatRows]);

  const visibleVendors = useMemo(() => {
    if (!isInstantMode) return vendorsGrouped;
    return vendorsGrouped.filter((v) => v.isInstantAvailable);
  }, [vendorsGrouped, isInstantMode]);

  useEffect(() => {
    if (selectedProblem?.id) {
      fetchProblemDetails();
    }
  }, [selectedProblem?.id, selectedProblem?.roleId, selectedProblem?.linkedServiceRoles]);

  const fetchProblemDetails = async () => {
    if (!selectedProblem) return;

    setLoadingProblemDetails(true);
    try {
      const roleId = selectedProblem.roleId || selectedProblem.linkedServiceRoles?.[0] || 'vet';
      const res = await apiClient.get<any>(`/public/problems?roleId=${roleId}`);

      if (res.success && res.problems) {
        const matchingProblem = res.problems.find((p: any) => p.id === selectedProblem.id);

        let styles: ServiceStyle[] = [];
        if (matchingProblem?.allowedServiceStyles) {
          styles = matchingProblem.allowedServiceStyles as ServiceStyle[];
        } else if (selectedProblem.allowedServiceStyles) {
          styles = selectedProblem.allowedServiceStyles;
        }

        const sanitized = sanitizeCustomerAllowedServiceStyles(styles, {
          roleId,
          specializationId: selectedProblem.id,
          categoryHint: selectedProblem.category,
        }) as ServiceStyle[];
        setAllowedServiceStyles(sanitized.length > 0 ? sanitized : (['at_home', 'at_center'] as ServiceStyle[]));
      } else {
        const rid = selectedProblem.roleId || selectedProblem.linkedServiceRoles?.[0] || 'veterinarian';
        const sanitized = sanitizeCustomerAllowedServiceStyles(selectedProblem.allowedServiceStyles, {
          roleId: rid,
          specializationId: selectedProblem.id,
          categoryHint: selectedProblem.category,
        }) as ServiceStyle[];
        setAllowedServiceStyles(sanitized.length > 0 ? sanitized : (['at_home', 'at_center'] as ServiceStyle[]));
      }
    } catch (error: any) {
      console.error('Error fetching problem details:', error);
      const roleIdFb = selectedProblem.roleId || selectedProblem.linkedServiceRoles?.[0] || 'veterinarian';
      const sanitized = sanitizeCustomerAllowedServiceStyles(selectedProblem.allowedServiceStyles, {
        roleId: roleIdFb,
        specializationId: selectedProblem.id,
        categoryHint: selectedProblem.category,
      }) as ServiceStyle[];
      setAllowedServiceStyles(sanitized.length > 0 ? sanitized : (['at_home', 'at_center'] as ServiceStyle[]));
    } finally {
      setLoadingProblemDetails(false);
    }
  };

  useEffect(() => {
    if (selectedServiceStyle && selectedProblem) {
      fetchProviders();
    }
  }, [selectedServiceStyle, selectedProblem]);

  const fetchProviders = async () => {
    if (!selectedProblem || !selectedServiceStyle) return;

    if (!availableStyles.includes(selectedServiceStyle)) {
      console.warn(`Service style ${selectedServiceStyle} is not allowed for problem ${selectedProblem.id}`);
      setFlatRows([]);
      return;
    }

    setLoading(true);
    setExpandedVendorId(null);
    try {
      const byProblemParams = new URLSearchParams({
        problemId: selectedProblem.id,
        serviceStyle: selectedServiceStyle,
        ...(location && {
          lat: location.lat.toString(),
          lng: location.lng.toString(),
        }),
      });
      const res = await apiClient.get<any>(`/customer/services/by-problem?${byProblemParams}`);

      if (res.success) {
        let rows: ByProblemServiceRow[] = res.providers || res.services || [];

        if (selectedServiceStyle === 'at_center') {
          rows = rows.filter((p: any) => {
            const style = p.serviceStyle || p.service_style;
            return style === 'at_center' || style === 'at_vendor' || style === 'at_clinic';
          });
        } else if (selectedServiceStyle === 'tele') {
          rows = rows.filter((p: any) => {
            const style = p.serviceStyle || p.service_style;
            return style === 'tele' || style === 'online' || style === 'video_consultation';
          });
        }

        setFlatRows(rows);
      } else {
        setFlatRows([]);
      }
    } catch (error: any) {
      console.error('Error fetching providers:', error);
      setFlatRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceStyleSelect = (style: ServiceStyle) => {
    setSelectedServiceStyle(style);
    setCurrentStep('discovery');
  };

  const toggleVendorExpanded = (vendor: VendorGroupFromProblem) => {
    setExpandedVendorId((prev) => (prev === vendor.vendorId ? null : vendor.vendorId));
  };

  const handleServiceRowSelect = (row: ByProblemServiceRow) => {
    setSelectedProvider(rowToServiceProvider(row));
    setCurrentStep('booking');
  };

  const handleBookingComplete = (bookingId: string) => {
    setCurrentStep('confirmation');
    onBookingComplete?.(bookingId);
  };

  const goBack = () => {
    switch (currentStep) {
      case 'discovery':
        setCurrentStep('service-style');
        setSelectedServiceStyle(null);
        setFlatRows([]);
        setExpandedVendorId(null);
        setIsInstantMode(false);
        break;
      case 'booking': {
        const reopenVendorId = selectedProvider?.vendorId ?? null;
        setCurrentStep('discovery');
        setSelectedProvider(null);
        if (reopenVendorId) setExpandedVendorId(reopenVendorId);
        break;
      }
      case 'service-style':
        setAllowedServiceStyles(['at_home', 'at_center', 'tele']);
        onClose?.();
        break;
      default:
        onClose?.();
    }
  };

  const renderServiceStyleSelection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="relative z-10 h-11 min-h-[44px] min-w-[44px] shrink-0 p-0 touch-manipulation"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-gray-900">{selectedProblem?.name || 'Select Service Type'}</h2>
          <p className="text-sm text-gray-500">Choose how you'd like to receive this service</p>
        </div>
        {selectedProblem && <span className="text-4xl">{selectedProblem.icon}</span>}
      </div>

      {loadingProblemDetails && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#FF8C42]" />
          <span className="ml-2 text-gray-500">Loading options...</span>
        </div>
      )}

      {!loadingProblemDetails && (
        <div className="grid gap-4">
          {availableStyles.map((style) => {
            const config = SERVICE_STYLE_CONFIG[style];
            if (!config) return null;

            return (
              <Card
                key={style}
                onClick={() => handleServiceStyleSelect(style)}
                className="p-4 cursor-pointer hover:shadow-md transition border-gray-200 hover:border-[#FF8C42]"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 ${config.bgColor} rounded-2xl flex items-center justify-center ${config.color}`}
                  >
                    {config.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{config.label}</h3>
                    <p className="text-sm text-gray-500">{config.description}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!loadingProblemDetails && availableStyles.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No service styles available for this problem.</p>
          <Button variant="outline" onClick={onClose} className="mt-4">
            Go Back
          </Button>
        </div>
      )}

      {!loadingProblemDetails && hasTeleOption && (
        <Card className="bg-gradient-to-r from-purple-500 to-indigo-600 p-4 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <Clock className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Need Instant Consultation?</h3>
              <p className="text-sm text-purple-100">Connect with an available doctor in minutes</p>
            </div>
            <Button
              variant="secondary"
              className="bg-white text-purple-600 hover:bg-purple-50"
              onClick={() => {
                setSelectedServiceStyle('tele');
                setIsInstantMode(true);
                setCurrentStep('discovery');
              }}
            >
              Instant
            </Button>
          </div>
        </Card>
      )}

      {!loadingProblemDetails && availableStyles.length > 0 && (
        <div className="text-center">
          <p className="text-sm text-gray-500">Service providers are filtered based on "{selectedProblem?.name}"</p>
          {availableStyles.length < 3 && (
            <p className="text-xs text-gray-400 mt-1">
              Only{' '}
              {availableStyles
                .map((s) => SERVICE_STYLE_CONFIG[s]?.label)
                .filter(Boolean)
                .join(' and ')}{' '}
              available for this service
            </p>
          )}
        </div>
      )}
    </div>
  );

  const renderVendorServiceRows = (v: VendorGroupFromProblem) => (
    <div className="space-y-3">
      {v.rows.map((row, idx) => {
        const serviceId = String(row.serviceId || row.service_id || idx);
        const title = String(row.serviceName || row.name || 'Service');
        const price = typeof row.price === 'number' ? row.price : parseFloat(String(row.price || 0)) || 0;
        const duration = Number(row.duration) || 0;
        const desc = (row.description && String(row.description).trim()) || '';
        const descTrim = desc.trim();
        const nameTrim = title.trim();
        const showDesc = descTrim.length > 0 && descTrim !== nameTrim;
        const thumb = serviceCardThumbUrl(row);
        const categoryLabel = pickServiceCategoryLabel(row, selectedProblem?.name);
        const distFmt = row.distanceFormatted?.trim();
        const showDistance =
          selectedServiceStyle !== 'tele' && distFmt && distFmt !== 'N/A';

        return (
          <div
            key={`${v.vendorId}-${serviceId}-${idx}`}
            role="button"
            tabIndex={0}
            onClick={() => handleServiceRowSelect(row)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleServiceRowSelect(row);
              }
            }}
            className="cursor-pointer rounded-xl border border-gray-100 bg-white shadow-sm transition hover:border-[#FF8C42] hover:shadow-md"
          >
            <div className="flex items-stretch gap-3 p-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                {thumb ? (
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white">
                    <span className="text-xl font-bold">{serviceTitleInitial(title)}</span>
                  </div>
                )}
              </div>

              {/* Match ClinicListView vet cards: title + desc, bottom row (orange price, time, distance, category), right column (gray price + Book Now) */}
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-900 leading-snug">{title}</h3>
                  <div className="mt-1">
                    {showDesc ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <ServiceDescriptionInline
                          description={descTrim}
                          title={title}
                          className="m-0 mt-1 text-sm leading-5 text-gray-500"
                          dialogHint="Full service description (from your provider)"
                        />
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm mt-1 line-clamp-2 italic">
                        Professional care — tap Book Now to continue.
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="text-lg font-bold text-[#FF8C42] tabular-nums">
                      {formatPriceWithSymbol(price)}
                    </span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      <Clock className="w-3 h-3 mr-1" />
                      {duration > 0 ? `${duration} mins` : 'Duration on request'}
                    </Badge>
                    {showDistance && (
                      <span className="flex items-center gap-1 text-xs text-gray-600 shrink-0">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                        {distFmt}
                      </span>
                    )}
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {categoryLabel}
                    </Badge>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2 min-w-[6.5rem] flex flex-col items-end">
                  <div className="text-lg font-bold text-gray-900 mb-2 tabular-nums">
                    {formatPriceWithSymbol(price)}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#FF8C42] hover:bg-[#E67A35] text-white w-full sm:w-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleServiceRowSelect(row);
                    }}
                  >
                    Book Now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderDiscovery = () => (
    <div className="space-y-4">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="relative z-10 h-11 min-h-[44px] min-w-[44px] shrink-0 p-0 touch-manipulation"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-lg font-bold text-gray-900">{selectedProblem?.name}</h2>
            {selectedServiceStyle && (
              <Badge
                className={`${SERVICE_STYLE_CONFIG[selectedServiceStyle].bgColor} ${SERVICE_STYLE_CONFIG[selectedServiceStyle].color}`}
              >
                {SERVICE_STYLE_CONFIG[selectedServiceStyle].label}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {isInstantMode ? 'Instantly available providers' : 'Select a service provider'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="bg-orange-50 border-orange-200 text-orange-700">
          <Filter className="w-3 h-3 mr-1" />
          {selectedProblem?.name}
        </Badge>
        {selectedProblem?.specializations?.map((spec) => (
          <Badge key={spec} variant="outline" className="bg-gray-50">
            {spec}
          </Badge>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" />
        </div>
      )}

      {!loading && visibleVendors.length > 0 && (
        <div className="space-y-3">
          {visibleVendors.map((vendor) => {
            const expanded = expandedVendorId === vendor.vendorId;
            const headerInteractive = Boolean(onVendorProfile) ? expanded : true;
            return (
              <Card
                key={vendor.vendorId}
                className={`overflow-hidden transition border-gray-200 ${expanded ? 'border-[#FF8C42] ring-1 ring-[#FF8C42]/30' : ''}`}
              >
                <div
                  role={headerInteractive ? 'button' : undefined}
                  tabIndex={headerInteractive ? 0 : undefined}
                  onClick={
                    headerInteractive
                      ? () => toggleVendorExpanded(vendor)
                      : undefined
                  }
                  onKeyDown={
                    headerInteractive
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleVendorExpanded(vendor);
                          }
                        }
                      : undefined
                  }
                  className={`p-4 text-left w-full ${
                    headerInteractive ? 'cursor-pointer hover:bg-gray-50' : ''
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {vendor.photo ? (
                        <img src={vendor.photo} alt={vendor.vendorName} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="w-8 h-8 text-gray-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{vendor.vendorName}</h3>
                          <p className="text-sm text-gray-500 truncate">
                            {vendor.serviceCount} service{vendor.serviceCount !== 1 ? 's' : ''}
                            {vendor.specializations.length > 0
                              ? ` · ${vendor.specializations.slice(0, 2).join(', ')}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex items-start gap-2 flex-shrink-0">
                          {vendor.isInstantAvailable && (
                            <Badge className="bg-green-100 text-green-700 flex-shrink-0">Available Now</Badge>
                          )}
                          {onVendorProfile && selectedServiceStyle ? (
                            <button
                              type="button"
                              aria-label={`View ${vendor.vendorName} profile`}
                              className="p-1 -m-1 rounded-md text-gray-400 hover:text-[#FF8C42] hover:bg-orange-50 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#FF8C42]/40"
                              onClick={(e: MouseEvent) => {
                                e.stopPropagation();
                                onVendorProfile({
                                  vendorId: vendor.vendorId,
                                  vendorName: vendor.vendorName,
                                  serviceStyle: selectedServiceStyle,
                                  problemCategory: selectedProblem?.category,
                                  roleIds: selectedProblem?.linkedServiceRoles,
                                });
                              }}
                            >
                              <ChevronRight
                                className={`w-5 h-5 transition-transform mt-0.5 ${expanded ? 'rotate-90' : ''}`}
                                aria-hidden
                              />
                            </button>
                          ) : (
                            <ChevronRight
                              className={`w-5 h-5 text-gray-400 transition-transform mt-0.5 pointer-events-none ${expanded ? 'rotate-90' : ''}`}
                              aria-hidden
                            />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="flex items-center gap-1 text-yellow-600">
                          ⭐ {vendor.rating.toFixed(1)}
                          <span className="text-gray-400">({vendor.reviewCount})</span>
                        </span>
                        {selectedServiceStyle !== 'tele' && (
                          <span className="flex items-center gap-1 text-gray-500">
                            <MapPin className="w-3 h-3" />
                            {vendor.distanceFormatted}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-[#FF8C42]">
                        ₹{vendor.minPrice.toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-gray-500">onwards</p>
                    </div>
                  </div>
                </div>

                {expanded && selectedServiceStyle && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-gray-700">
                        Available Services ({vendor.rows.length})
                      </h4>
                    </div>
                    {vendor.rows.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-2">No services listed for this provider.</p>
                    ) : (
                      <div className="max-h-[min(60vh,28rem)] overflow-y-auto pr-1">
                        {renderVendorServiceRows(vendor)}
                      </div>
                    )}
                  </div>
                )}

                {!expanded && vendor.rows.length > 0 && (
                  <div className="px-4 py-3 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-100">
                    <div className="text-sm text-gray-600">
                      {vendor.serviceCount} service{vendor.serviceCount !== 1 ? 's' : ''} available
                      <span className="text-gray-900 font-medium">
                        {' '}
                        from ₹{vendor.minPrice.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42]/10 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedVendorId(vendor.vendorId);
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

      {!loading && visibleVendors.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">No providers found</h3>
          <p className="text-sm text-gray-500 mb-4">Try changing the service type or check back later</p>
          <Button variant="outline" onClick={goBack}>
            Change Service Type
          </Button>
        </div>
      )}
    </div>
  );

  const renderBooking = () => {
    if (!selectedProvider || !selectedServiceStyle) return null;

    return (
      <BookingFlow
        serviceId={selectedProvider.serviceId}
        customerPhone={customerId || ''}
        onBack={goBack}
        onComplete={handleBookingComplete}
      />
    );
  };

  const renderConfirmation = () => (
    <div className="min-h-[400px] flex flex-col items-center justify-center text-center p-6">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
        <span className="text-5xl">✓</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
      <p className="text-gray-600 mb-6">
        Your {selectedProblem?.name}{' '}
        {selectedServiceStyle && SERVICE_STYLE_CONFIG[selectedServiceStyle].label.toLowerCase()} appointment is confirmed.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose}>
          Back to Home
        </Button>
        <Button className="bg-[#FF8C42] hover:bg-[#E67A35]" onClick={() => (window.location.href = '/bookings')}>
          View Booking
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-50 cw-header-safe-top cw-header-safe-x pb-8">
      <div className="mx-auto max-w-lg">
        {currentStep === 'service-style' && renderServiceStyleSelection()}
        {currentStep === 'discovery' && renderDiscovery()}
        {currentStep === 'booking' && renderBooking()}
        {currentStep === 'confirmation' && renderConfirmation()}
      </div>
    </div>
  );
}

export default ProblemGridFlowRouter;
