'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Label, Checkbox } from '@warmpawz/ui';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';

/** Fallback vendor types when API roles are not available. Tele/Video is in Service Location, not here. */
const FALLBACK_VENDOR_TYPES = [
  { id: 'veterinarian', name: 'Veterinarian', icon: '⚕️' },
  { id: 'grooming', name: 'Grooming', icon: '✂️' },
  { id: 'dog-walking', name: 'Dog Walking', icon: '🐕' },
  { id: 'trainer', name: 'Trainer', icon: '🎓' },
  { id: 'nutritionist', name: 'Nutritionist', icon: '🥗' },
  { id: 'resorts', name: 'Resorts', icon: '🏖️' },
  { id: 'pet-products-seller', name: 'Food, Medicine & Pet Products Sellers', icon: '🛒' },
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
}

/** Map DB service_location to frontend: home->at_home, clinic->at_center, tele->tele, both|all->all */
const serviceLocationFromDb = (v: string): ServiceLocationValue => {
  if (v === 'home') return 'at_home';
  if (v === 'clinic') return 'at_center';
  if (v === 'tele') return 'tele';
  return 'all'; // both (legacy) or all
};

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
  return {
    id: row.id ?? '',
    name: row.name ?? row.policy_name ?? '',
    vendorTypes: arr(row.vendor_types ?? row.vendorTypes),
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
    const mapRolesToOptions = (roles: any[]): { id: string; name: string; icon: string }[] => {
      const options = roles
        .filter((r: any) => r.is_active !== false)
        .map((r: any) => ({
          id: (r.code ?? r.id ?? r.name ?? '').toString().toLowerCase().replace(/\s+/g, '-'),
          name: r.display_name ?? r.name ?? r.code ?? '',
          icon: roleToIcon[(r.code ?? r.name ?? '').toString().toLowerCase()] ?? '📌',
        }))
        .filter((o: { id: string }) => o.id)
        .filter((o: { id: string }) => o.id !== 'tele' && o.id !== 'video_consultation'); // Tele is in Service Location, not vendor types
      return options;
    };
    try {
      let data = await apiClient.get<any>('/config/roles').catch(() => null);
      let roles = (data as any)?.roles ?? (data as any)?.data?.roles ?? [];
      if (!Array.isArray(roles) || roles.length === 0) {
        data = await apiClient.get<any>('/admin/roles').catch(() => null);
        roles = (data as any)?.roles ?? (data as any)?.data?.roles ?? [];
      }
      if (Array.isArray(roles) && roles.length > 0) {
        const options = mapRolesToOptions(roles);
        setVendorTypeOptions(options.length > 0 ? options : FALLBACK_VENDOR_TYPES);
      } else {
        setVendorTypeOptions(FALLBACK_VENDOR_TYPES);
      }
    } catch {
      setVendorTypeOptions(FALLBACK_VENDOR_TYPES);
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
    const payload = {
      ...editingTier,
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-black text-xl font-semibold">Refund Policies</h2>
            <p className="text-gray-500 text-sm mt-1">Configure refund rules and policies</p>
          </div>
          <PolicyHelpButton docKey="finance-refund-policies" />
        </div>
        <Button onClick={handleCreateTier} className="bg-[#FF8C42] text-white hover:bg-[#E67A32]">
          <Plus className="w-4 h-4 mr-2" />
          Create Refund Tier
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
                      setEditingTier(normalizeTier(tier));
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
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 id="refund-tier-modal-title" className="text-xl font-bold text-gray-900">
                {isCreatingNew ? 'Create Refund Tier' : 'Edit Refund Tier'}
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
                  onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
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
                  onChange={(e) =>
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
                  onChange={(e) => {
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
                        onChange={(e) =>
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
                          onChange={(e) =>
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
                          onChange={(e) => {
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
                </div>
              )}

              {editingTier.cancelledBy === 'provider' && (
                <div className="space-y-2">
                  <Label>Vendor cancellation reason</Label>
                  <select
                    value={editingTier.vendorCancellationReason ?? 'operational'}
                    onChange={(e) =>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Refund Percentage (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={Number.isFinite(editingTier.refundPercentage) ? editingTier.refundPercentage : ''}
                    onChange={(e) => {
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
                    onChange={(e) => {
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
                  onCheckedChange={(checked) =>
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
