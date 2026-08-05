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
 * Discovery delegates to the same Services hub components and GET /customer/services/by-style
 * (ClinicListView, VetServicesByStyle, GroomingServicesByStyle, UniversalServicesByStyle) with
 * specialization + customer coordinates aligned to localStorage.
 *
 * Date: 2026-05-13
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { isInstantTeleUiEnabled } from '@/lib/instant-tele-ui';
import { shouldHideMarketplaceStyleTiles } from '@/lib/warmpawz-appointments-customer';
import {
  Home,
  Building2,
  Video,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { sanitizeCustomerAllowedServiceStyles } from '@/lib/sanitize-customer-allowed-service-styles';
import { toast } from 'sonner';
import { isEmergencyProblemTileLocked } from '@/lib/problem-grid-emergency-lock';
import { resolveCustomerDiscoveryCoords } from '@/lib/customer-discovery-coords';
import { isWarmpawzAppointmentsHubEnabled } from '@/lib/warmpawz-appointments-customer';
import { getWapptAllowedDiscoveryStyles, getWapptDefaultDiscoveryStyle } from '@/lib/wappt-hub-registry';
import { resolveProblemGridWapptCategory } from '@/lib/problem-grid-wappt-navigation';
import { problemGridAliasesForApi } from '@/lib/problem-grid-role-aliases';
import { WarmpawzAppointmentsVendorList } from '@/components/customer/warmpawz-appointments/WarmpawzAppointmentsVendorList';
import { ClinicListView } from './vet/ClinicListView';
import { VetServicesByStyle } from './vet/VetServicesByStyle';
import { GroomingServicesByStyle } from './grooming/GroomingServicesByStyle';
import { UniversalServicesByStyle } from './shared/UniversalServicesByStyle';
import type { RoleId, ServiceStyle as HubServiceStyle } from './shared/roleConfig';
import { BOARDING_NEEDS, NUTRITIONIST_NEEDS, WALKING_NEEDS } from './ProblemGridSection';

// ============================================================================
// TYPES (used by discovery helpers below)
// ============================================================================

type ServiceStyle = 'at_home' | 'at_center' | 'tele';

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

function isGroomingProblem(problem: ProblemGridItem | null): boolean {
  if (!problem) return false;
  const roleHints = [
    problem.roleId,
    ...(Array.isArray(problem.linkedServiceRoles) ? problem.linkedServiceRoles : []),
    problem.category,
    problem.id,
    problem.name,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());
  return roleHints.some((v) => v.includes('groom'));
}

function isVetProblem(problem: ProblemGridItem | null): boolean {
  if (!problem) return false;
  const roleHints = [
    problem.roleId,
    ...(Array.isArray(problem.linkedServiceRoles) ? problem.linkedServiceRoles : []),
    problem.category,
    problem.id,
    problem.name,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());
  return roleHints.some((v) => v.includes('vet') || v.includes('veterinar'));
}

function tileIdsExceptViewAll(rows: { id: string }[]): Set<string> {
  return new Set(rows.filter((r) => r.id !== 'view_all').map((r) => r.id));
}

const NUTRITION_TILE_IDS = tileIdsExceptViewAll(NUTRITIONIST_NEEDS);
const WALKING_TILE_IDS = tileIdsExceptViewAll(WALKING_NEEDS);
const BOARDING_TILE_IDS = tileIdsExceptViewAll(BOARDING_NEEDS);

function isNutritionProblem(problem: ProblemGridItem | null): boolean {
  if (!problem) return false;
  const cat = String(problem.category || '').toLowerCase();
  if (cat === 'nutrition' || cat === 'wellness') return true;
  const hub = String(problem.roleId || '').toLowerCase();
  if (hub.includes('nutrition') || hub === 'pet_nutritionist') return true;
  if (NUTRITION_TILE_IDS.has(problem.id)) return true;
  const roles = (problem.linkedServiceRoles || []).map((r) => String(r).toLowerCase());
  return roles.some((r) => r.includes('nutrition'));
}

function isWalkerProblem(problem: ProblemGridItem | null): boolean {
  if (!problem) return false;
  const cat = String(problem.category || '').toLowerCase();
  if (cat === 'walker' || cat === 'walking') return true;
  const hub = String(problem.roleId || '').toLowerCase();
  if (['walker', 'pet_walker', 'dog_walker', 'walker_solo'].includes(hub)) return true;
  if (WALKING_TILE_IDS.has(problem.id)) return true;
  const roles = (problem.linkedServiceRoles || []).map((r) => String(r).toLowerCase());
  const walkSlugs = new Set(['walker', 'walking', 'pet_walker', 'dog_walker', 'walker_solo', 'dog_walking']);
  return roles.some((r) => walkSlugs.has(r));
}

function isBoardingProblem(problem: ProblemGridItem | null): boolean {
  if (!problem) return false;
  const cat = String(problem.category || '').toLowerCase();
  if (cat === 'boarding') return true;
  const hub = String(problem.roleId || '').toLowerCase();
  if (hub.includes('board')) return true;
  if (BOARDING_TILE_IDS.has(problem.id)) return true;
  const roles = (problem.linkedServiceRoles || []).map((r) => String(r).toLowerCase());
  return roles.some((r) => r.includes('board'));
}

type ProblemDiscoveryKind =
  | 'vet_at_center'
  | 'vet_other'
  | 'groomer'
  | 'trainer'
  | 'behavior'
  | 'nutrition'
  | 'walker'
  | 'boarding';

function pickProblemDiscoveryKind(
  problem: ProblemGridItem | null,
  serviceStyle: ServiceStyle | null
): ProblemDiscoveryKind | null {
  if (!problem || !serviceStyle) return null;
  const hubRole = String(problem.roleId || '').toLowerCase();
  const cat = String(problem.category || '').toLowerCase();
  const allSlugs = [...(problem.linkedServiceRoles || []), problem.roleId].filter(Boolean).map((s) =>
    String(s).toLowerCase()
  );
  const categoryIsBehavior = cat === 'behavioral' || cat === 'behavior' || cat === 'sub_behavior';
  const openedFromTrainerHub =
    hubRole === 'trainer' || hubRole === 'training' || (hubRole === 'pet_trainer' && !categoryIsBehavior);
  const openedFromBehaviorHub = hubRole === 'behaviorist' || hubRole === 'behaviourist';
  const anySlugMatchesBehavior = allSlugs.some((r) =>
    /behav|behaviorist|behaviourist|pet_behavior|behaviorist_solo|behaviorist_center/.test(r)
  );
  const behavioralTileIds = new Set([
    'barking',
    'destructive',
    'fear_phobia',
    'resource_guarding',
    'separation_anxiety',
    'separation',
  ]);
  const problemTileId = String(problem.id || '').toLowerCase();
  const looksBehavioral =
    openedFromBehaviorHub ||
    (!openedFromTrainerHub &&
      (behavioralTileIds.has(problemTileId) || categoryIsBehavior || anySlugMatchesBehavior));

  if (looksBehavioral) return 'behavior';
  if (isGroomingProblem(problem)) return 'groomer';
  if (isVetProblem(problem)) return serviceStyle === 'at_center' ? 'vet_at_center' : 'vet_other';
  if (isNutritionProblem(problem)) return 'nutrition';
  if (isWalkerProblem(problem)) return 'walker';
  if (isBoardingProblem(problem)) return 'boarding';
  return 'trainer';
}

function resolveWapptCategoryForProblem(problem: ProblemGridItem | null): string | null {
  if (!problem) return null;
  const kind = pickProblemDiscoveryKind(problem, 'at_home');
  if (!kind) return null;
  return resolveProblemGridWapptCategory(kind);
}

/** WAPPT vendor list already exposes at_home / at_center toggles — skip the extra style step. */
function shouldSkipServiceStyleStepForWappt(problem: ProblemGridItem | null): boolean {
  const category = resolveWapptCategoryForProblem(problem);
  return Boolean(category && isWarmpawzAppointmentsHubEnabled(category));
}

function defaultWapptServiceStyleForProblem(problem: ProblemGridItem | null): ServiceStyle | null {
  const category = resolveWapptCategoryForProblem(problem);
  if (!category || !isWarmpawzAppointmentsHubEnabled(category)) return null;
  return getWapptDefaultDiscoveryStyle(category) as ServiceStyle;
}

export type VendorProfileFromProblemContext = {
  vendorId: string;
  vendorName: string;
  serviceStyle: ServiceStyle;
  problemCategory?: string;
  roleIds?: string[];
  /** Specialization / problem tile id (e.g. barking) for routing when API role slugs vary. */
  problemId?: string;
  problemTitle?: string;
};

interface ProblemGridFlowRouterProps {
  initialProblem?: ProblemGridItem;
  /** Optional; discovery uses localStorage + profile/GPS via {@link resolveCustomerDiscoveryCoords}. */
  location?: { lat: number; lng: number };
  customerId?: string;
  onClose?: () => void;
  /** Routes booking/profile/package flows from embedded Services lists (vet, grooming, training, behavior). */
  onDiscoveryNavigate: (screen: string, data?: any) => void;
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

type FlowStep = 'service-style' | 'discovery';

export function ProblemGridFlowRouter({
  initialProblem,
  customerId,
  onClose,
  onDiscoveryNavigate,
}: ProblemGridFlowRouterProps) {
  const skipServiceStyleStep = shouldSkipServiceStyleStepForWappt(initialProblem || null);
  const initialWapptStyle = defaultWapptServiceStyleForProblem(initialProblem || null);
  const [currentStep, setCurrentStep] = useState<FlowStep>(() =>
    skipServiceStyleStep && initialWapptStyle ? 'discovery' : 'service-style',
  );
  const [selectedProblem, setSelectedProblem] = useState<ProblemGridItem | null>(initialProblem || null);
  const [selectedServiceStyle, setSelectedServiceStyle] = useState<ServiceStyle | null>(() =>
    skipServiceStyleStep ? initialWapptStyle : null,
  );
  const [loadingProblemDetails, setLoadingProblemDetails] = useState(false);
  const [discoveryListKey, setDiscoveryListKey] = useState(0);

  const emergencyBounceRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialProblem?.id) return;
    if (!isEmergencyProblemTileLocked({ id: initialProblem.id, name: initialProblem.name })) return;
    const key = String(initialProblem.id);
    if (emergencyBounceRef.current === key) return;
    emergencyBounceRef.current = key;
    toast.info('Emergency care is coming soon on the app.');
    onClose?.();
  }, [initialProblem?.id, initialProblem?.name, onClose]);

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

  const normalizedAvailableStyles = sanitizeCustomerAllowedServiceStyles(allowedServiceStyles, {
    roleId: roleForStyles,
    specializationId: selectedProblem?.id,
    categoryHint: selectedProblem?.category,
  }) as ServiceStyle[];
  const groomingOnlyHomeAndCenter = isGroomingProblem(selectedProblem);
  const baseServiceStyles = groomingOnlyHomeAndCenter
    ? (['at_home', 'at_center'] as ServiceStyle[])
    : normalizedAvailableStyles;
  const wapptKindForStyles = selectedProblem
    ? pickProblemDiscoveryKind(selectedProblem, 'at_home')
    : null;
  const wapptCategoryForStyles = wapptKindForStyles
    ? resolveProblemGridWapptCategory(wapptKindForStyles)
    : null;
  const wapptHubStylesActive =
    Boolean(wapptCategoryForStyles) && isWarmpawzAppointmentsHubEnabled(wapptCategoryForStyles!);
  const availableStyles = baseServiceStyles.filter((style) => {
    if (!shouldHideMarketplaceStyleTiles()) return true;
    if (wapptHubStylesActive && wapptCategoryForStyles) {
      return getWapptAllowedDiscoveryStyles(wapptCategoryForStyles).includes(
        style as 'at_home' | 'at_center',
      );
    }
    return style === 'tele';
  });
  const hasTeleOption = availableStyles.includes('tele');
  const wapptSkipStyleStep = shouldSkipServiceStyleStepForWappt(selectedProblem);

  useEffect(() => {
    if (!selectedProblem || !wapptSkipStyleStep) return;
    const style = defaultWapptServiceStyleForProblem(selectedProblem);
    if (!style) return;
    setSelectedServiceStyle(style);
    setCurrentStep('discovery');
  }, [selectedProblem?.id, wapptSkipStyleStep]);

  useEffect(() => {
    if (selectedProblem?.id) {
      fetchProblemDetails();
    }
  }, [selectedProblem?.id, selectedProblem?.roleId, selectedProblem?.linkedServiceRoles]);

  const fetchProblemDetails = async () => {
    if (!selectedProblem) return;

    if (selectedProblem.allowedServiceStyles && selectedProblem.allowedServiceStyles.length > 0) {
      const roleId =
        selectedProblem.roleId || selectedProblem.linkedServiceRoles?.[0] || 'veterinarian';
      const sanitized = sanitizeCustomerAllowedServiceStyles(selectedProblem.allowedServiceStyles, {
        roleId,
        specializationId: selectedProblem.id,
        categoryHint: selectedProblem.category,
      }) as ServiceStyle[];
      if (sanitized.length > 0) {
        setAllowedServiceStyles(sanitized);
        return;
      }
    }

    setLoadingProblemDetails(true);
    try {
      const roleId = selectedProblem.roleId || selectedProblem.linkedServiceRoles?.[0] || 'vet';
      const aliases = problemGridAliasesForApi(roleId);
      let matchingProblem: {
        id?: string;
        problemId?: string;
        allowedServiceStyles?: ServiceStyle[];
      } | null = null;

      for (const apiRole of aliases) {
        const res = await apiClient.get<{ success?: boolean; problems?: any[] }>(
          `/public/problem-grid/${encodeURIComponent(apiRole)}`,
        );
        if (res?.success === false || !Array.isArray(res.problems)) continue;
        matchingProblem =
          res.problems.find(
            (p: any) =>
              String(p.id ?? p.problemId ?? '') === selectedProblem.id ||
              String(p.problemId ?? p.id ?? '') === selectedProblem.id,
          ) ?? null;
        if (matchingProblem) break;
      }

      if (!matchingProblem) {
        const legacyRes = await apiClient.get<any>(`/public/problems?roleId=${encodeURIComponent(roleId)}`);
        if (legacyRes?.success && legacyRes.problems) {
          matchingProblem =
            legacyRes.problems.find((p: any) => p.id === selectedProblem.id) ?? null;
        }
      }

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
      if (sanitized.length > 0) {
        setAllowedServiceStyles(sanitized);
      } else {
        const rid = selectedProblem.roleId || selectedProblem.linkedServiceRoles?.[0] || 'veterinarian';
        const preserved = sanitizeCustomerAllowedServiceStyles(selectedProblem.allowedServiceStyles, {
          roleId: rid,
          specializationId: selectedProblem.id,
          categoryHint: selectedProblem.category,
        }) as ServiceStyle[];
        setAllowedServiceStyles(preserved);
      }
    } catch (error: any) {
      console.error('Error fetching problem details:', error);
      const roleIdFb = selectedProblem.roleId || selectedProblem.linkedServiceRoles?.[0] || 'veterinarian';
      const sanitized = sanitizeCustomerAllowedServiceStyles(selectedProblem.allowedServiceStyles, {
        roleId: roleIdFb,
        specializationId: selectedProblem.id,
        categoryHint: selectedProblem.category,
      }) as ServiceStyle[];
      setAllowedServiceStyles(sanitized);
    } finally {
      setLoadingProblemDetails(false);
    }
  };

  useEffect(() => {
    if (currentStep !== 'discovery' || !selectedServiceStyle) return;
    let cancelled = false;
    (async () => {
      try {
        if (typeof localStorage === 'undefined') return;
        const lat = localStorage.getItem('customer_latitude');
        const lng = localStorage.getItem('customer_longitude');
        if (lat && lng) return;
        const { latitude, longitude } = await resolveCustomerDiscoveryCoords(customerId);
        if (cancelled || !latitude || !longitude) return;
        localStorage.setItem('customer_latitude', latitude);
        localStorage.setItem('customer_longitude', longitude);
        setDiscoveryListKey((k) => k + 1);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentStep, selectedServiceStyle, customerId]);

  const handleServiceStyleSelect = (style: ServiceStyle) => {
    setSelectedServiceStyle(style);
    setCurrentStep('discovery');
  };

  const goBackFromDiscovery = () => {
    if (wapptSkipStyleStep) {
      onClose?.();
      return;
    }
    setCurrentStep('service-style');
    setSelectedServiceStyle(null);
  };

  const goBack = () => {
    switch (currentStep) {
      case 'discovery':
        goBackFromDiscovery();
        break;
      case 'service-style':
        setAllowedServiceStyles(
          sanitizeCustomerAllowedServiceStyles([], {
            roleId: selectedProblem?.roleId || selectedProblem?.linkedServiceRoles?.[0] || 'veterinarian',
            specializationId: selectedProblem?.id,
            categoryHint: selectedProblem?.category,
          }) as ServiceStyle[]
        );
        onClose?.();
        break;
      default:
        onClose?.();
    }
  };

  const renderDiscovery = () => {
    if (!selectedProblem || !selectedServiceStyle) return null;

    const kind = pickProblemDiscoveryKind(selectedProblem, selectedServiceStyle) ?? 'trainer';
    const specId = selectedProblem.id;
    console.log(`🔵 [ProblemGridFlowRouter] renderDiscovery: kind=${kind} style=${selectedServiceStyle} specId=${specId} problemId=${selectedProblem.id}`);
    const hubStyle = selectedServiceStyle as HubServiceStyle;
    const profileBack = 'problem_grid_flow';
    const key = `${kind}-${selectedServiceStyle}-${specId}-${discoveryListKey}`;
    const phone = customerId || '';

    const wapptCategory = resolveProblemGridWapptCategory(kind);
    if (isWarmpawzAppointmentsHubEnabled(wapptCategory)) {
      return (
        <div key={key} className="mx-auto w-full max-w-customer">
          <WarmpawzAppointmentsVendorList
            category={wapptCategory}
            initialServiceStyle={selectedServiceStyle}
            lockStyleFilter={false}
            profileBackScreen={profileBack}
            specialization={specId}
            listSubtitleOverride={selectedProblem.name}
            onBack={goBackFromDiscovery}
            onGoHome={() => onClose?.()}
            onNavigate={onDiscoveryNavigate}
          />
        </div>
      );
    }

    if (kind === 'vet_at_center') {
      return (
        <div key={key} className="mx-auto w-full max-w-customer">
          <ClinicListView
            phone={phone}
            specialization={specId}
            vetStyleProfileReturnScreen="problem_grid_flow"
            onBack={goBackFromDiscovery}
            onNavigate={onDiscoveryNavigate}
          />
        </div>
      );
    }

    if (kind === 'vet_other') {
      return (
        <div key={key} className="mx-auto w-full max-w-customer">
          <VetServicesByStyle
            phone={phone}
            serviceStyle={selectedServiceStyle}
            serviceTypeName={selectedProblem.name}
            category="vet"
            specialization={specId}
            discoveryProfileBackScreen={profileBack}
            onBack={goBackFromDiscovery}
            onNavigate={onDiscoveryNavigate}
          />
        </div>
      );
    }

    if (kind === 'groomer') {
      return (
        <div key={key} className="mx-auto w-full max-w-customer">
          <GroomingServicesByStyle
            phone={phone}
            serviceStyle={selectedServiceStyle}
            serviceTypeName={selectedServiceStyle === 'at_center' ? 'Grooming Center' : 'At Home Grooming'}
            category="grooming"
            specialization={specId}
            onBack={goBackFromDiscovery}
            onNavigate={onDiscoveryNavigate}
          />
        </div>
      );
    }

    if (kind === 'behavior') {
      return (
        <div key={key} className="mx-auto w-full max-w-customer">
          <UniversalServicesByStyle
            phone={phone}
            roleId={'behaviorist' as RoleId}
            serviceStyle={hubStyle}
            serviceTypeName={selectedProblem.name}
            category="behaviourist"
            specialization={specId}
            profileBackScreen={profileBack}
            bookingScreen="training-booking"
            onBack={goBackFromDiscovery}
            onNavigate={onDiscoveryNavigate}
          />
        </div>
      );
    }

    if (kind === 'nutrition') {
      return (
        <div key={key} className="mx-auto w-full max-w-customer">
          <UniversalServicesByStyle
            phone={phone}
            roleId={'nutritionist' as RoleId}
            serviceStyle={hubStyle}
            serviceTypeName={selectedProblem.name}
            category="nutrition"
            specialization={specId}
            profileBackScreen={profileBack}
            bookingScreen="nutritionist-booking"
            onBack={goBackFromDiscovery}
            onNavigate={onDiscoveryNavigate}
          />
        </div>
      );
    }

    if (kind === 'walker') {
      return (
        <div key={key} className="mx-auto w-full max-w-customer">
          <UniversalServicesByStyle
            phone={phone}
            roleId={'walker' as RoleId}
            serviceStyle={hubStyle}
            serviceTypeName={selectedProblem.name}
            category="walker"
            specialization={specId}
            profileBackScreen={profileBack}
            bookingScreen="walker-booking"
            onBack={goBackFromDiscovery}
            onNavigate={onDiscoveryNavigate}
          />
        </div>
      );
    }

    if (kind === 'boarding') {
      return (
        <div key={key} className="mx-auto w-full max-w-customer">
          <UniversalServicesByStyle
            phone={phone}
            roleId={'boarding' as RoleId}
            serviceStyle={hubStyle}
            serviceTypeName={selectedProblem.name}
            category="boarding"
            specialization={specId}
            profileBackScreen={profileBack}
            bookingScreen="boarding-booking"
            onBack={goBackFromDiscovery}
            onNavigate={onDiscoveryNavigate}
          />
        </div>
      );
    }

    return (
      <div key={key} className="mx-auto w-full max-w-customer">
        <UniversalServicesByStyle
          phone={phone}
          roleId={'trainer' as RoleId}
          serviceStyle={hubStyle}
          serviceTypeName={selectedProblem.name}
          category="training"
          specialization={specId}
          profileBackScreen={profileBack}
          bookingScreen="training-booking"
          onBack={goBackFromDiscovery}
          onNavigate={onDiscoveryNavigate}
        />
      </div>
    );
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

      {!loadingProblemDetails && hasTeleOption && isInstantTeleUiEnabled() && (
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

  // ✅ Discovery step renders hub screens (Grooming/Walker/Vet/etc.) whose own
  // ServiceDashboardHeader already pads for env(safe-area-inset-*). Re-applying
  // `cw-header-safe-top` / `cw-header-safe-x` on this outer shell would push the
  // orange header inside a viewport-padded box, leaving a visible gray frame on
  // top/left/right (see "Dog Walking" hub for the desired edge-to-edge look).
  // Only the service-style selection step needs that breathing room for its
  // white card column.
  const isDiscoveryStep = currentStep === 'discovery';
  const outerSafeAreaClass = isDiscoveryStep ? '' : 'cw-header-safe-top cw-header-safe-x';

  return (
    <div className={`min-h-screen min-h-[100dvh] bg-gray-50 pb-8 ${outerSafeAreaClass}`.trim()}>
      <div className="mx-auto w-full max-w-customer">
        {currentStep === 'service-style' && renderServiceStyleSelection()}
        {isDiscoveryStep && renderDiscovery()}
      </div>
    </div>
  );
}

export default ProblemGridFlowRouter;
