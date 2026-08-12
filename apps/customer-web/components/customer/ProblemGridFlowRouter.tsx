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
import { apiClient } from '@/lib/api-client';
import { SpecializationDetailPage } from './specialization-detail/SpecializationDetailPage';
import { VetSpecializationDetailPage } from './specialization-detail/vet/VetSpecializationDetailPage';
import type { ServiceStyle } from './specialization-detail/ServiceModeSelection';
import { sanitizeCustomerAllowedServiceStyles } from '@/lib/sanitize-customer-allowed-service-styles';
import { toast } from 'sonner';
import { isEmergencyProblemTileLocked } from '@/lib/problem-grid-emergency-lock';
import { resolveCustomerDiscoveryCoords } from '@/lib/customer-discovery-coords';
import { ClinicListView } from './vet/ClinicListView';
import { VetServicesByStyle } from './vet/VetServicesByStyle';
import { GroomingServicesByStyle } from './grooming/GroomingServicesByStyle';
import { UniversalServicesByStyle } from './shared/UniversalServicesByStyle';
import type { RoleId, ServiceStyle as HubServiceStyle } from './shared/roleConfig';
import { BOARDING_NEEDS, NUTRITIONIST_NEEDS, WALKING_NEEDS } from './ProblemGridSection';

// ============================================================================
// TYPES (used by discovery helpers below)
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
// FLOW STEPS
// ============================================================================

type FlowStep = 'service-style' | 'discovery';

export function ProblemGridFlowRouter({
  initialProblem,
  customerId,
  onClose,
  onDiscoveryNavigate,
}: ProblemGridFlowRouterProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('service-style');
  const [selectedProblem, setSelectedProblem] = useState<ProblemGridItem | null>(initialProblem || null);
  const [selectedServiceStyle, setSelectedServiceStyle] = useState<ServiceStyle | null>(null);
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
  const availableStyles = groomingOnlyHomeAndCenter
    ? (['at_home', 'at_center'] as ServiceStyle[])
    : normalizedAvailableStyles;
  const hasTeleOption = availableStyles.includes('tele');

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

        if (matchingProblem?.description && typeof matchingProblem.description === 'string') {
          const desc = matchingProblem.description.trim();
          if (desc) {
            setSelectedProblem((prev) =>
              prev ? { ...prev, description: prev.description || desc } : prev
            );
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
      } else {
        const rid = selectedProblem.roleId || selectedProblem.linkedServiceRoles?.[0] || 'veterinarian';
        const sanitized = sanitizeCustomerAllowedServiceStyles(selectedProblem.allowedServiceStyles, {
          roleId: rid,
          specializationId: selectedProblem.id,
          categoryHint: selectedProblem.category,
        }) as ServiceStyle[];
        setAllowedServiceStyles(sanitized);
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

  const renderServiceStyleSelection = () => {
    if (!selectedProblem) return null;

    const detailProps = {
      problem: {
        id: selectedProblem.id,
        name: selectedProblem.name,
        icon: selectedProblem.icon,
        description: selectedProblem.description,
        category: selectedProblem.category,
        roleId: selectedProblem.roleId,
        linkedServiceRoles: selectedProblem.linkedServiceRoles,
      },
      availableStyles,
      loadingProblemDetails,
      hasTeleOption,
      instantTeleEnabled: isInstantTeleUiEnabled(),
      onBack: () => onClose?.(),
      onServiceStyleSelect: handleServiceStyleSelect,
    };

    if (isVetProblem(selectedProblem)) {
      return <VetSpecializationDetailPage {...detailProps} />;
    }

    return <SpecializationDetailPage {...detailProps} />;
  };

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
