'use client';

import { useState, useEffect, type MouseEvent } from 'react';
import { Button, Input, Label, Checkbox } from '@warmpawz/ui';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';

/** E-commerce / product-seller roles are configured under Ecommerce Policies, not booking cancellation. */
const ECOMMERCE_VENDOR_TYPE_IDS = new Set(
  [
    'pet-products-seller',
    'pet_products_seller',
    'pet-products-store',
    'pet_products_store',
    'ecommerce',
    'marketplace',
    'product_seller',
  ].map((s) => s.toLowerCase())
);

function isEcommerceVendorTypeId(id: string): boolean {
  const t = id.toLowerCase();
  if (ECOMMERCE_VENDOR_TYPE_IDS.has(t)) return true;
  if (t.includes('product') && (t.includes('seller') || t.includes('store'))) return true;
  return false;
}

/** Fallback vendor types when API roles are not available. Tele/Video is in Service Location, not here. */
const FALLBACK_VENDOR_TYPES = [
  { id: 'veterinarian', name: 'Veterinarian', icon: '⚕️' },
  { id: 'grooming', name: 'Grooming', icon: '✂️' },
  { id: 'dog-walking', name: 'Dog Walking', icon: '🐕' },
  { id: 'trainer', name: 'Trainer', icon: '🎓' },
  { id: 'nutritionist', name: 'Nutritionist', icon: '🥗' },
  { id: 'resorts', name: 'Resorts', icon: '🏖️' },
  { id: 'breeder', name: 'Breeder', icon: '🐾' },
  { id: 'adoption', name: 'Adoption', icon: '❤️' },
  { id: 'pet-cafe', name: 'Pet Cafe', icon: '☕' },
  { id: 'sunset-services', name: 'Sunset Services', icon: '🌅' },
  { id: 'rehome', name: 'Rehome', icon: '🏡' },
  { id: 'healthcare-provider', name: 'Healthcare Service Provider', icon: '🏥' },
];

/** Service location options: Tele/Video Consultation is a location, not a vendor type. "All" = all locations. */
const SERVICE_LOCATION_OPTIONS = [
  { value: 'at_home' as const, label: 'At Home' },
  { value: 'at_center' as const, label: 'At Center' },
  { value: 'tele' as const, label: 'Tele / Video Consultation' },
  { value: 'all' as const, label: 'All' },
];

type ServiceLocationValue = 'at_home' | 'at_center' | 'tele' | 'all';

/** Stored in vendor_refund_tiers.policy_extensions (single source for cancellation + refund UX). */
export interface PolicyExtensions {
  rescheduleAllowed?: boolean;
  /** Hours before booking when reschedule is still allowed (customer display + ops). */
  rescheduleCutoffHours?: number;
  /** Max reschedule count per booking (customer display + ops). */
  maxReschedulesPerBooking?: number;
  noShowPolicy?: {
    enabled?: boolean;
    refundPercentage?: number;
    penaltyAmount?: number;
    gracePeriodMinutes?: number;
  };
  providerPolicy?: { penaltyPercentage?: number; compensationPercentage?: number };
}

/** Who cancels the booking: used to apply different refund rules by canceller. No "any" – policy must be for pet_parent or provider. */
export type CancelledByValue = 'pet_parent' | 'provider';

const CANCELLED_BY_OPTIONS: { value: CancelledByValue; label: string }[] = [
  { value: 'pet_parent', label: 'Pet Parent / Customer' },
  { value: 'provider', label: 'Service Provider / Platform' },
];

/** Customer cancellation windows: time slots – only when Pet Parent cancels. Includes 6+ hours. */
export type CustomerCancellationWindow =
  | '24_plus'
  | '12_24'
  | 'under_12_no_show'
  | '12_plus'
  | '6_plus'
  | '6_12'
  | 'under_6_no_show'
  | '48_plus'
  | '24_48'
  | 'under_24_no_show'
  | 'after_checkin'
  | 'did_not_join_video';

const CUSTOMER_CANCELLATION_WINDOWS: { value: CustomerCancellationWindow; label: string }[] = [
  { value: '24_plus', label: '24+ hours' },
  { value: '12_24', label: '12–24 hours' },
  { value: 'under_12_no_show', label: '<12 hours / no show / after arrival' },
  { value: '12_plus', label: '12+ hours' },
  { value: '6_plus', label: '6+ hours' },
  { value: '6_12', label: '6–12 hours' },
  { value: 'under_6_no_show', label: '<6 hours / no show' },
  { value: '48_plus', label: '48+ hours' },
  { value: '24_48', label: '24–48 hours' },
  { value: 'under_24_no_show', label: '<24 hours / no show' },
  { value: 'after_checkin', label: 'After check-in / early checkout' },
  { value: 'did_not_join_video', label: 'Did not join the video' },
];

/** Optional custom rule: operator + hours (Option A flexible rule). */
export type HoursOperator = 'gte' | 'lte' | 'gt' | 'lt';

const HOURS_OPERATOR_OPTIONS: { value: HoursOperator; label: string }[] = [
  { value: 'gte', label: '≥ (at least / plus)' },
  { value: 'gt', label: '> (more than)' },
  { value: 'lte', label: '≤ (at most)' },
  { value: 'lt', label: '< (less than / below)' },
];

/** Vendor cancellation reasons (12–14): only when Service Provider/Platform cancels. */
export type VendorCancellationReason = 'emergency' | 'operational' | 'technical';

const VENDOR_CANCELLATION_REASONS: { value: VendorCancellationReason; label: string }[] = [
  { value: 'emergency', label: 'Emergency cancellation' },
  { value: 'operational', label: 'Operational issue' },
  { value: 'technical', label: 'Technical failure' },
];

/** Derive hours_before_service from customer window for backend compatibility. */
function hoursFromCustomerWindow(window: CustomerCancellationWindow | undefined): number {
  if (!window) return 24;
  const map: Record<CustomerCancellationWindow, number> = {
    '48_plus': 48,
    '24_plus': 24,
    '24_48': 24,
    '12_plus': 12,
    '12_24': 12,
    '6_plus': 6,
    '6_12': 6,
    'under_24_no_show': 0,
    'under_12_no_show': 0,
    'under_6_no_show': 0,
    after_checkin: 0,
    did_not_join_video: 0,
  };
  return map[window] ?? 24;
}

interface RefundTier {
  id: string;
  name: string;
  vendorTypes: string[];
  serviceLocation: ServiceLocationValue;
  cancelledBy: CancelledByValue;
  cancellationWindow?: CustomerCancellationWindow;
  vendorCancellationReason?: VendorCancellationReason;
  /** Option A: use custom rule (operator + threshold) instead of preset window. */
  useCustomRule?: boolean;
  hoursOperator?: HoursOperator;
  hoursThreshold?: number;
  hoursBeforeService: number;
  refundPercentage: number;
  maxPartialRefundPercentage?: number;
  cancellationFee: number;
  isActive: boolean;
  createdAt?: string;
  policyExtensions?: PolicyExtensions;
}

/**
 * Map stored/API service_location to UI select values.
 * Accepts DB tokens (home, clinic, …) and UI tokens (at_home, …) so normalizeTier stays correct when
 * re-run on an already-normalized tier (e.g. Edit passes camelCase serviceLocation from state).
 */
const serviceLocationFromDb = (v: string): ServiceLocationValue => {
  const s = String(v).trim().toLowerCase();
  if (s === 'home' || s === 'at_home') return 'at_home';
  if (s === 'clinic' || s === 'at_center') return 'at_center';
  if (s === 'tele') return 'tele';
  if (s === 'all' || s === 'both' || s === '') return 'all';
  return 'all';
};

/** Normalize tier.vendor_types[] tokens for checkbox ids (underscore codes); preserve UUIDs. */
function normalizeVendorTypeToken(t: string): string {
  const s = String(t).trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return s.toLowerCase();
  return s.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
}

const CUSTOMER_WINDOW_VALUES: CustomerCancellationWindow[] = [
  '24_plus', '12_24', 'under_12_no_show', '12_plus', '6_plus', '6_12', 'under_6_no_show',
  '48_plus', '24_48', 'under_24_no_show', 'after_checkin', 'did_not_join_video',
];
const VENDOR_REASON_VALUES: VendorCancellationReason[] = ['emergency', 'operational', 'technical'];

/** Normalize API tier row (snake_case) to UI RefundTier (camelCase). */
function normalizeTier(row: any): RefundTier {
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const rawLoc = row.service_location ?? row.serviceLocation ?? 'both';
  const maxPartial = row.max_partial_refund_percentage ?? row.maxPartialRefundPercentage;
  const rawCancelledBy = row.cancelled_by ?? row.cancelledBy ?? '';
  const cancelledBy: CancelledByValue = ['pet_parent', 'provider'].includes(String(rawCancelledBy)) ? (rawCancelledBy as CancelledByValue) : 'pet_parent';
  const rawWindow = row.cancellation_window ?? row.cancellationWindow ?? '';
  const cancellationWindow: CustomerCancellationWindow | undefined = CUSTOMER_WINDOW_VALUES.includes(rawWindow as CustomerCancellationWindow) ? (rawWindow as CustomerCancellationWindow) : undefined;
  const rawReason = row.vendor_cancellation_reason ?? row.vendorCancellationReason ?? '';
  const vendorCancellationReason: VendorCancellationReason | undefined = VENDOR_REASON_VALUES.includes(rawReason as VendorCancellationReason) ? (rawReason as VendorCancellationReason) : undefined;
  const rawOp = row.hours_operator ?? row.hoursOperator ?? '';
  const hoursOperator: HoursOperator | undefined = ['gte', 'lte', 'gt', 'lt'].includes(String(rawOp)) ? (rawOp as HoursOperator) : undefined;
  const hoursThreshold = row.hours_threshold ?? row.hoursThreshold;
  const useCustomRule = hoursOperator != null && hoursThreshold != null && Number.isFinite(Number(hoursThreshold));
  const hoursBeforeService = useCustomRule
    ? Number(hoursThreshold)
    : cancellationWindow != null
      ? hoursFromCustomerWindow(cancellationWindow)
      : (Number(row.hours_before_service ?? row.hoursBeforeService ?? 24) || 24);
  let policyExtensions: PolicyExtensions | undefined;
  const rawExt = row.policy_extensions ?? row.policyExtensions;
  if (rawExt != null) {
    if (typeof rawExt === 'string') {
      try {
        policyExtensions = JSON.parse(rawExt) as PolicyExtensions;
      } catch {
        policyExtensions = undefined;
      }
    } else if (typeof rawExt === 'object') {
      policyExtensions = rawExt as PolicyExtensions;
    }
  }
  return {
    id: row.id ?? '',
    name: row.name ?? row.policy_name ?? '',
    vendorTypes: arr(row.vendor_types ?? row.vendorTypes).map((t: unknown) => normalizeVendorTypeToken(String(t))),
    serviceLocation: serviceLocationFromDb(String(rawLoc)),
    cancelledBy,
    cancellationWindow,
    vendorCancellationReason,
    useCustomRule: useCustomRule || undefined,
    hoursOperator,
    hoursThreshold: hoursThreshold != null && Number.isFinite(Number(hoursThreshold)) ? Number(hoursThreshold) : undefined,
    hoursBeforeService,
    refundPercentage: (() => {
      const rp = row.refund_percentage ?? row.refundPercentage;
      if (rp != null && rp !== '' && Number.isFinite(Number(rp))) {
        return Math.min(100, Math.max(0, Number(rp)));
      }
      return 75;
    })(),
    maxPartialRefundPercentage: maxPartial !== undefined && maxPartial !== null && Number.isFinite(Number(maxPartial)) ? Number(maxPartial) : undefined,
    cancellationFee: Number(row.cancellation_fee ?? row.cancellationFee ?? 0) || 0,
    isActive: row.is_active ?? row.isActive !== false,
    createdAt: row.created_at ?? row.createdAt,
    policyExtensions,
  };
}

export function RefundPoliciesSection() {
  const [tiers, setTiers] = useState<RefundTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTier, setEditingTier] = useState<RefundTier | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [vendorTypeOptions, setVendorTypeOptions] = useState<{ id: string; name: string; icon: string }[]>(FALLBACK_VENDOR_TYPES);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadRolesForVendorTypes();
  }, []);

  const loadRolesForVendorTypes = async () => {
    const roleToIcon: Record<string, string> = {
      veterinarian: '⚕️', grooming: '✂️', trainer: '🎓', walker: '🐕', nutritionist: '🥗',
      resorts: '🏖️', adoption: '❤️', breeder: '🐾', pet_cafe: '☕', tele: '📹',
    };
    /** Stored in vendor_types[] and matched to vendors.role_id → roles.name (or id). Underscores align with DB role codes. */
    const vendorTypeIdFromRole = (r: any): string => {
      const code = (r.name ?? r.roleCode ?? r.code ?? '').toString().trim();
      if (code) return code.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
      return String(r.id ?? r.roleId ?? '')
        .trim()
        .toLowerCase();
    };
    const mapRolesToOptions = (roles: any[]): { id: string; name: string; icon: string }[] => {
      const options = roles
        .filter((r: any) => r.is_active !== false)
        .map((r: any) => {
          const id = vendorTypeIdFromRole(r);
          const primary = (r.display_name ?? r.roleName ?? r.name ?? id).toString();
          const cat = r.category ? String(r.category).trim() : '';
          const name = cat ? `${primary} (${cat})` : primary;
          return {
            id,
            name,
            icon: roleToIcon[(r.name ?? r.code ?? '').toString().toLowerCase()] ?? '📌',
          };
        })
        .filter((o: { id: string }) => o.id)
        .filter((o: { id: string }) => o.id !== 'tele' && o.id !== 'video_consultation') // Tele is in Service Location, not vendor types
        .filter((o: { id: string }) => !isEcommerceVendorTypeId(o.id));
      return options;
    };
    try {
      let data = await apiClient.get<any>('/config/roles?role_type=vendor').catch(() => null);
      let roles = (data as any)?.roles ?? (data as any)?.data?.roles ?? [];
      if (!Array.isArray(roles) || roles.length === 0) {
        data = await apiClient.get<any>('/config/roles').catch(() => null);
        roles = (data as any)?.roles ?? (data as any)?.data?.roles ?? [];
      }
      if (!Array.isArray(roles) || roles.length === 0) {
        data = await apiClient.get<any>('/admin/roles').catch(() => null);
        roles = (data as any)?.roles ?? (data as any)?.data?.roles ?? [];
      }
      if (Array.isArray(roles) && roles.length > 0) {
        const options = mapRolesToOptions(roles);
        setVendorTypeOptions(
          (options.length > 0 ? options : FALLBACK_VENDOR_TYPES).filter((o) => !isEcommerceVendorTypeId(o.id))
        );
      } else {
        setVendorTypeOptions(FALLBACK_VENDOR_TYPES.filter((o) => !isEcommerceVendorTypeId(o.id)));
      }
    } catch {
      setVendorTypeOptions(FALLBACK_VENDOR_TYPES.filter((o) => !isEcommerceVendorTypeId(o.id)));
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      // Prefer dedicated refund-tiers endpoint (single source of truth from vendor_refund_tiers)
      let data: any;
      try {
        data = await apiClient.get<any>('/admin/vendor-settings/refund-tiers');
      } catch {
        data = await apiClient.get<any>('/admin/vendor-settings-rules');
      }
      const raw =
        (data as any)?.refundTiers ??
        (data as any)?.tiers ??
        (data as any)?.data?.refundTiers ??
        [];
      setTiers(Array.isArray(raw) ? raw.map(normalizeTier) : []);
    } catch (error) {
      console.error('Error loading refund tiers:', error);
      toast.error('Failed to load refund tiers');
      setTiers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTier = () => {
    const newTier: RefundTier = {
      id: '',
      name: '',
      vendorTypes: [],
      serviceLocation: 'all',
      cancelledBy: 'pet_parent',
      cancellationWindow: '24_plus',
      vendorCancellationReason: undefined,
      useCustomRule: false,
      hoursOperator: undefined,
      hoursThreshold: undefined,
      hoursBeforeService: 24,
      refundPercentage: 100,
      cancellationFee: 0,
      isActive: true,
      policyExtensions: {
        rescheduleAllowed: false,
        noShowPolicy: { enabled: false, refundPercentage: 0, penaltyAmount: 0 },
        providerPolicy: { penaltyPercentage: 0, compensationPercentage: 100 },
      },
    };
    setEditingTier(newTier);
    setIsCreatingNew(true);
    setShowModal(true);
  };

  const handleSaveTier = async () => {
    if (!editingTier) return;

    if (!editingTier.name.trim()) {
      toast.error('Please enter a tier name');
      return;
    }

    if (editingTier.vendorTypes.length === 0) {
      toast.error('Please select at least one vendor type');
      return;
    }

    if (editingTier.cancelledBy === 'pet_parent') {
      const useCustom = editingTier.useCustomRule && editingTier.hoursOperator != null && Number.isFinite(editingTier.hoursThreshold);
      if (!useCustom && !editingTier.cancellationWindow) {
        toast.error('Please select a cancellation window or use a custom rule');
        return;
      }
      if (useCustom && (editingTier.hoursThreshold == null || editingTier.hoursThreshold < 0)) {
        toast.error('Please enter a valid hours threshold for the custom rule');
        return;
      }
    }
    if (editingTier.cancelledBy === 'provider' && !editingTier.vendorCancellationReason) {
      toast.error('Please select a vendor cancellation reason');
      return;
    }

    if (editingTier.refundPercentage < 0 || editingTier.refundPercentage > 100) {
      toast.error('Refund percentage must be between 0 and 100');
      return;
    }

    const useCustom = editingTier.cancelledBy === 'pet_parent' && editingTier.useCustomRule && editingTier.hoursOperator != null && Number.isFinite(editingTier.hoursThreshold);
    const pe = editingTier.policyExtensions || {};
    const policyExtensions: PolicyExtensions =
      editingTier.cancelledBy === 'pet_parent'
        ? {
            rescheduleAllowed: pe.rescheduleAllowed === true,
            ...(pe.rescheduleAllowed === true && Number.isFinite(Number(pe.rescheduleCutoffHours)) && Number(pe.rescheduleCutoffHours) > 0
              ? { rescheduleCutoffHours: Math.min(168, Math.max(1, Math.floor(Number(pe.rescheduleCutoffHours)))) }
              : {}),
            ...(pe.rescheduleAllowed === true &&
            Number.isFinite(Number(pe.maxReschedulesPerBooking)) &&
            Number(pe.maxReschedulesPerBooking) >= 0
              ? { maxReschedulesPerBooking: Math.min(20, Math.max(0, Math.floor(Number(pe.maxReschedulesPerBooking)))) }
              : {}),
            noShowPolicy: {
              enabled: pe.noShowPolicy?.enabled === true,
              refundPercentage: Math.min(100, Math.max(0, Number(pe.noShowPolicy?.refundPercentage ?? 0))),
              penaltyAmount: Math.max(0, Number(pe.noShowPolicy?.penaltyAmount ?? 0)),
              ...(pe.noShowPolicy?.enabled === true &&
              Number.isFinite(Number(pe.noShowPolicy?.gracePeriodMinutes)) &&
              Number(pe.noShowPolicy?.gracePeriodMinutes) >= 0
                ? {
                    gracePeriodMinutes: Math.min(1440, Math.max(0, Math.floor(Number(pe.noShowPolicy?.gracePeriodMinutes)))),
                  }
                : {}),
            },
          }
        : {
            providerPolicy: {
              penaltyPercentage: Math.min(100, Math.max(0, Number(pe.providerPolicy?.penaltyPercentage ?? 0))),
              compensationPercentage: Math.min(100, Math.max(0, Number(pe.providerPolicy?.compensationPercentage ?? 100))),
            },
          };

    const vendorTypesNormalized = [
      ...new Set(editingTier.vendorTypes.map((t) => normalizeVendorTypeToken(t))),
    ].filter(Boolean);

    const payload = {
      ...editingTier,
      vendorTypes: vendorTypesNormalized,
      policyExtensions,
      maxPartialRefundPercentage: null, // Removed: use Refund % for partial (e.g. 50%) instead
      hoursBeforeService: editingTier.cancelledBy === 'pet_parent' && !useCustom && editingTier.cancellationWindow
        ? hoursFromCustomerWindow(editingTier.cancellationWindow)
        : (useCustom ? editingTier.hoursThreshold : editingTier.hoursBeforeService) ?? editingTier.hoursBeforeService,
      ...(useCustom
        ? { hoursOperator: editingTier.hoursOperator, hoursThreshold: editingTier.hoursThreshold, cancellationWindow: undefined }
        : { hoursOperator: undefined, hoursThreshold: undefined }),
    };
    setSaving(true);
    try {
      if (isCreatingNew) {
        await apiClient.post('/admin/vendor-settings/refund-tiers', payload);
        toast.success('Refund tier created!');
      } else {
        await apiClient.put(`/admin/vendor-settings/refund-tiers/${editingTier.id}`, payload);
        toast.success('Refund tier updated!');
      }
      await loadData();
      setEditingTier(null);
      setIsCreatingNew(false);
      setShowModal(false);
    } catch (error) {
      console.error('Error saving refund tier:', error);
      toast.error('Error saving refund tier');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTier = async (id: string) => {
    if (!confirm('Are you sure you want to delete this refund tier?')) return;
    try {
      await apiClient.delete(`/admin/vendor-settings/refund-tiers/${id}`);
      toast.success('Refund tier deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete refund tier');
    }
  };

  const toggleVendorType = (vendorTypeId: string) => {
    if (!editingTier) return;
    const newTypes = editingTier.vendorTypes.includes(vendorTypeId)
      ? editingTier.vendorTypes.filter((t) => t !== vendorTypeId)
      : [...editingTier.vendorTypes, vendorTypeId];
    setEditingTier({ ...editingTier, vendorTypes: newTypes });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-xl border border-orange-200 bg-orange-50/80 px-4 py-3 text-sm text-gray-800">
        <p className="font-semibold text-gray-900 mb-1">One engine for service bookings (everything below lives in vendor_refund_tiers)</p>
        <ul className="list-disc list-inside space-y-0.5 text-gray-700">
          <li><strong>Refund policy</strong> — refund % and cancellation fee for this tier</li>
          <li><strong>Cancellation policy</strong> — who cancels (customer vs provider), time window or custom hours rule</li>
          <li><strong>Rescheduling</strong> — per customer tier: allow reschedule when this tier applies</li>
          <li><strong>No-show</strong> — per customer tier: optional refund % and penalty amount</li>
        </ul>
        <p className="mt-2 text-xs text-gray-600">
          E-commerce product orders are <strong>not</strong> configured here — use Finance → Ecommerce Policies.
        </p>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-black text-xl font-semibold">Cancellation & Refund Policies</h2>
            <p className="text-gray-500 text-sm mt-1">Edit tiers below; customer payment and cancel flows read the same data (plus legacy fallbacks only if tiers are missing).</p>
          </div>
          <PolicyHelpButton docKey="finance-refund-policies" />
        </div>
        <Button onClick={handleCreateTier} className="bg-[#FF8C42] text-white hover:bg-[#E67A32]">
          <Plus className="w-4 h-4 mr-2" />
          Create Cancellation & Refund Policy
        </Button>
      </div>

      {/* Tiers List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
        </div>
      ) : tiers.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-gray-500 mb-4">No refund tiers configured</p>
          <Button onClick={handleCreateTier} variant="outline">
            Create First Tier
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{tier.name}</h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        tier.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {tier.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                    {tier.cancelledBy === 'pet_parent' && tier.useCustomRule && tier.hoursOperator != null && tier.hoursThreshold != null && (
                      <div>
                        <span className="text-gray-500">Custom rule:</span>
                        <span className="ml-2 font-medium">
                          {HOURS_OPERATOR_OPTIONS.find((o) => o.value === tier.hoursOperator)?.label ?? tier.hoursOperator} {tier.hoursThreshold} hours
                        </span>
                      </div>
                    )}
                    {tier.cancelledBy === 'pet_parent' && !tier.useCustomRule && tier.cancellationWindow && (
                      <div>
                        <span className="text-gray-500">Window:</span>
                        <span className="ml-2 font-medium">
                          {CUSTOMER_CANCELLATION_WINDOWS.find((o) => o.value === tier.cancellationWindow)?.label ?? tier.cancellationWindow}
                        </span>
                      </div>
                    )}
                    {tier.cancelledBy === 'provider' && tier.vendorCancellationReason && (
                      <div>
                        <span className="text-gray-500">Reason:</span>
                        <span className="ml-2 font-medium">
                          {VENDOR_CANCELLATION_REASONS.find((o) => o.value === tier.vendorCancellationReason)?.label ?? tier.vendorCancellationReason}
                        </span>
                      </div>
                    )}
                    {tier.cancelledBy === 'pet_parent' && (
                      <div>
                        <span className="text-gray-500">Hours (derived):</span>
                        <span className="ml-2 font-medium">{tier.hoursBeforeService}h</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Refund Percentage:</span>
                      <span className="ml-2 font-medium">{tier.refundPercentage}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Cancellation Fee:</span>
                      <span className="ml-2 font-medium">₹{tier.cancellationFee}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Vendor Types:</span>
                      <span className="ml-2 font-medium">{tier.vendorTypes.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Service Location:</span>
                      <span className="ml-2 font-medium">
                        {SERVICE_LOCATION_OPTIONS.find((o) => o.value === tier.serviceLocation)?.label ?? tier.serviceLocation}
                      </span>
                    </div>
                    {tier.cancelledBy && (
                      <div>
                        <span className="text-gray-500">Who cancels:</span>
                        <span className="ml-2 font-medium">
                          {CANCELLED_BY_OPTIONS.find((o) => o.value === tier.cancelledBy)?.label ?? tier.cancelledBy}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Tier is already normalizeTier-shaped; shallow copy avoids re-mapping UI values to DB and back (which broke serviceLocation).
                      setEditingTier({
                        ...tier,
                        vendorTypes: [...tier.vendorTypes],
                        policyExtensions: tier.policyExtensions ? { ...tier.policyExtensions } : undefined,
                      });
                      setIsCreatingNew(false);
                      setShowModal(true);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteTier(tier.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tier Editor Modal */}
      {showModal && editingTier && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-tier-modal-title"
          onClick={() => {
            setShowModal(false);
            setEditingTier(null);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 id="refund-tier-modal-title" className="text-xl font-bold text-gray-900">
                {isCreatingNew ? 'Create Cancellation & Refund Policy' : 'Edit Cancellation & Refund Policy'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingTier(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <Label>Tier Name *</Label>
                <Input
                  value={editingTier.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingTier({ ...editingTier, name: e.target.value })}
                  placeholder="e.g., Standard Refund Policy"
                />
              </div>

              <div className="space-y-2">
                <Label>Vendor Types *</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border p-4 rounded-lg max-h-60 overflow-y-auto">
                  {vendorTypeOptions.map((type) => (
                    <div key={type.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={editingTier.vendorTypes.includes(type.id)}
                        onCheckedChange={() => toggleVendorType(type.id)}
                      />
                      <Label className="text-sm">
                        {type.icon} {type.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Service Location</Label>
                <select
                  value={editingTier.serviceLocation}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setEditingTier({
                      ...editingTier,
                      serviceLocation: e.target.value as ServiceLocationValue,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                >
                  {SERVICE_LOCATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">Policy applies to selected vendor types and this service style.</p>
              </div>

              <div className="space-y-2">
                <Label>Who cancels</Label>
                <select
                  value={editingTier.cancelledBy ?? 'pet_parent'}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const v = (e.target.value as CancelledByValue) || 'pet_parent';
                    setEditingTier({
                      ...editingTier,
                      cancelledBy: v,
                      cancellationWindow: v === 'pet_parent' ? (editingTier.cancellationWindow ?? '24_plus') : undefined,
                      vendorCancellationReason: v === 'provider' ? (editingTier.vendorCancellationReason ?? 'operational') : undefined,
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                >
                  {CANCELLED_BY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Policy applies when this party cancels: Pet Parent/Customer (time windows) or Service Provider/Platform (reasons).
                </p>
              </div>

              {editingTier.cancelledBy === 'pet_parent' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Rule type</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="ruleType"
                          checked={!editingTier.useCustomRule}
                          onChange={() =>
                            setEditingTier({
                              ...editingTier,
                              useCustomRule: false,
                              cancellationWindow: editingTier.cancellationWindow ?? '24_plus',
                              hoursBeforeService: hoursFromCustomerWindow(editingTier.cancellationWindow ?? '24_plus'),
                              hoursOperator: undefined,
                              hoursThreshold: undefined,
                            })
                          }
                          className="text-[#FF8C42] focus:ring-[#FF8C42]"
                        />
                        <span>Preset window</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="ruleType"
                          checked={!!editingTier.useCustomRule}
                          onChange={() =>
                            setEditingTier({
                              ...editingTier,
                              useCustomRule: true,
                              cancellationWindow: undefined,
                              hoursOperator: editingTier.hoursOperator ?? 'gte',
                              hoursThreshold: editingTier.hoursThreshold ?? 24,
                              hoursBeforeService: editingTier.hoursThreshold ?? 24,
                            })
                          }
                          className="text-[#FF8C42] focus:ring-[#FF8C42]"
                        />
                        <span>Custom rule (≥ / &lt; hours)</span>
                      </label>
                    </div>
                  </div>
                  {!editingTier.useCustomRule && (
                    <div className="space-y-2">
                      <Label>Cancellation window (customer)</Label>
                      <select
                        value={editingTier.cancellationWindow ?? '24_plus'}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          setEditingTier({
                            ...editingTier,
                            cancellationWindow: e.target.value as CustomerCancellationWindow,
                            hoursBeforeService: hoursFromCustomerWindow(e.target.value as CustomerCancellationWindow),
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                      >
                        {CUSTOMER_CANCELLATION_WINDOWS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500">Time slot when pet parent cancels. Refund % applies to this window.</p>
                    </div>
                  )}
                  {editingTier.useCustomRule && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Operator</Label>
                        <select
                          value={editingTier.hoursOperator ?? 'gte'}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                            setEditingTier({
                              ...editingTier,
                              hoursOperator: e.target.value as HoursOperator,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                        >
                          {HOURS_OPERATOR_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Hours before service</Label>
                        <Input
                          type="number"
                          min={0}
                          value={editingTier.hoursThreshold ?? ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const v = parseFloat(e.target.value);
                            setEditingTier({
                              ...editingTier,
                              hoursThreshold: Number.isFinite(v) ? v : undefined,
                              hoursBeforeService: Number.isFinite(v) ? v : editingTier.hoursBeforeService,
                            });
                          }}
                          placeholder="e.g. 24"
                        />
                        <p className="text-xs text-gray-500">Tier applies when hours until booking satisfies this rule.</p>
                      </div>
                    </div>
                  )}

                  <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                    <Label className="text-sm font-semibold">Reschedule (this tier)</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={editingTier.policyExtensions?.rescheduleAllowed === true}
                        onCheckedChange={(checked: boolean) =>
                          setEditingTier({
                            ...editingTier,
                            policyExtensions: {
                              ...editingTier.policyExtensions,
                              rescheduleAllowed: checked === true,
                              ...(checked !== true
                                ? { rescheduleCutoffHours: undefined, maxReschedulesPerBooking: undefined }
                                : {}),
                            },
                          })
                        }
                      />
                      <span className="text-sm text-gray-700">Allow reschedule when this tier applies</span>
                    </div>
                    {editingTier.policyExtensions?.rescheduleAllowed === true && (
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                          <Label className="text-xs">Latest reschedule (hours before booking)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={168}
                            placeholder="e.g. 12"
                            value={editingTier.policyExtensions?.rescheduleCutoffHours ?? ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const v = parseFloat(e.target.value);
                              setEditingTier({
                                ...editingTier,
                                policyExtensions: {
                                  ...editingTier.policyExtensions,
                                  rescheduleCutoffHours: Number.isFinite(v) ? v : undefined,
                                },
                              });
                            }}
                          />
                          <p className="text-xs text-gray-500">Shown to customers; leave empty to omit from booking policy text.</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Max reschedules per booking</Label>
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            placeholder="e.g. 2"
                            value={
                              editingTier.policyExtensions?.maxReschedulesPerBooking === undefined
                                ? ''
                                : String(editingTier.policyExtensions.maxReschedulesPerBooking)
                            }
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const v = parseFloat(e.target.value);
                              setEditingTier({
                                ...editingTier,
                                policyExtensions: {
                                  ...editingTier.policyExtensions,
                                  maxReschedulesPerBooking: Number.isFinite(v) ? Math.floor(v) : undefined,
                                },
                              });
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border rounded-lg p-4 space-y-3">
                    <Label className="text-sm font-semibold">No-show (customer cancellations)</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={editingTier.policyExtensions?.noShowPolicy?.enabled === true}
                        onCheckedChange={(checked: boolean) =>
                          setEditingTier({
                            ...editingTier,
                            policyExtensions: {
                              ...editingTier.policyExtensions,
                              noShowPolicy: {
                                enabled: checked === true,
                                refundPercentage: editingTier.policyExtensions?.noShowPolicy?.refundPercentage ?? 0,
                                penaltyAmount: editingTier.policyExtensions?.noShowPolicy?.penaltyAmount ?? 0,
                                gracePeriodMinutes: editingTier.policyExtensions?.noShowPolicy?.gracePeriodMinutes,
                              },
                            },
                          })
                        }
                      />
                      <span className="text-sm text-gray-700">Enable no-show policy for this tier</span>
                    </div>
                    {editingTier.policyExtensions?.noShowPolicy?.enabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                          <Label>Grace period after scheduled time (minutes)</Label>
                          <Input
                            type="number"
                            min={0}
                            max={1440}
                            placeholder="Optional — shown to customers when set"
                            value={
                              editingTier.policyExtensions?.noShowPolicy?.gracePeriodMinutes === undefined
                                ? ''
                                : String(editingTier.policyExtensions.noShowPolicy.gracePeriodMinutes)
                            }
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const v = parseFloat(e.target.value);
                              setEditingTier({
                                ...editingTier,
                                policyExtensions: {
                                  ...editingTier.policyExtensions,
                                  noShowPolicy: {
                                    enabled: true,
                                    refundPercentage: editingTier.policyExtensions?.noShowPolicy?.refundPercentage ?? 0,
                                    penaltyAmount: editingTier.policyExtensions?.noShowPolicy?.penaltyAmount ?? 0,
                                    gracePeriodMinutes: Number.isFinite(v) ? Math.floor(v) : undefined,
                                  },
                                },
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>No-show refund %</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={editingTier.policyExtensions?.noShowPolicy?.refundPercentage ?? 0}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const v = parseFloat(e.target.value);
                              setEditingTier({
                                ...editingTier,
                                policyExtensions: {
                                  ...editingTier.policyExtensions,
                                  noShowPolicy: {
                                    enabled: true,
                                    refundPercentage: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0,
                                    penaltyAmount: editingTier.policyExtensions?.noShowPolicy?.penaltyAmount ?? 0,
                                    gracePeriodMinutes: editingTier.policyExtensions?.noShowPolicy?.gracePeriodMinutes,
                                  },
                                },
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Penalty amount (₹)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={editingTier.policyExtensions?.noShowPolicy?.penaltyAmount ?? 0}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const v = parseFloat(e.target.value);
                              setEditingTier({
                                ...editingTier,
                                policyExtensions: {
                                  ...editingTier.policyExtensions,
                                  noShowPolicy: {
                                    enabled: true,
                                    refundPercentage: editingTier.policyExtensions?.noShowPolicy?.refundPercentage ?? 0,
                                    penaltyAmount: Number.isFinite(v) ? Math.max(0, v) : 0,
                                    gracePeriodMinutes: editingTier.policyExtensions?.noShowPolicy?.gracePeriodMinutes,
                                  },
                                },
                              });
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {editingTier.cancelledBy === 'provider' && (
                <div className="space-y-2">
                  <Label>Vendor cancellation reason</Label>
                  <select
                    value={editingTier.vendorCancellationReason ?? 'operational'}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setEditingTier({
                        ...editingTier,
                        vendorCancellationReason: e.target.value as VendorCancellationReason,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  >
                    {VENDOR_CANCELLATION_REASONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">Reason when service provider/platform cancels. Typically full refund or reschedule.</p>
                </div>
              )}

              {editingTier.cancelledBy === 'provider' && (
                <div className="grid grid-cols-2 gap-4 border rounded-lg p-4 bg-slate-50">
                  <div className="space-y-2">
                    <Label>Penalty to provider (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={editingTier.policyExtensions?.providerPolicy?.penaltyPercentage ?? 0}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const v = parseFloat(e.target.value);
                        setEditingTier({
                          ...editingTier,
                          policyExtensions: {
                            ...editingTier.policyExtensions,
                            providerPolicy: {
                              penaltyPercentage: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0,
                              compensationPercentage:
                                editingTier.policyExtensions?.providerPolicy?.compensationPercentage ?? 100,
                            },
                          },
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer compensation (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={editingTier.policyExtensions?.providerPolicy?.compensationPercentage ?? 100}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const v = parseFloat(e.target.value);
                        setEditingTier({
                          ...editingTier,
                          policyExtensions: {
                            ...editingTier.policyExtensions,
                            providerPolicy: {
                              penaltyPercentage: editingTier.policyExtensions?.providerPolicy?.penaltyPercentage ?? 0,
                              compensationPercentage: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 100,
                            },
                          },
                        });
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 col-span-2">
                    Refund % and cancellation fee above still apply to the customer payout for this provider-cancel scenario.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Refund Percentage (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={Number.isFinite(editingTier.refundPercentage) ? editingTier.refundPercentage : ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const raw = e.target.value;
                      const v = parseFloat(raw);
                      // Allow 0 explicitly; use previous value when clearing (empty string)
                      setEditingTier({
                        ...editingTier,
                        refundPercentage: raw === '' ? editingTier.refundPercentage : (Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : editingTier.refundPercentage),
                      });
                    }}
                  />
                  <p className="text-xs text-gray-500">0–100%. Use 0% for no refund (cancellation fee only); 50% for partial refund.</p>
                </div>
                <div className="space-y-2">
                  <Label>Cancellation Fee (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={Number.isFinite(editingTier.cancellationFee) ? editingTier.cancellationFee : ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const v = parseFloat(e.target.value);
                      setEditingTier({
                        ...editingTier,
                        cancellationFee: Number.isFinite(v) ? Math.max(0, v) : 0,
                      });
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editingTier.isActive}
                  onCheckedChange={(checked: boolean) =>
                    setEditingTier({ ...editingTier, isActive: checked as boolean })
                  }
                />
                <Label>Active</Label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setEditingTier(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTier}
                disabled={saving}
                className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Tier'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
