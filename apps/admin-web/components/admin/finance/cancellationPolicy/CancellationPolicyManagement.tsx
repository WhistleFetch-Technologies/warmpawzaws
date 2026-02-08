'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Checkbox,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Switch,
  Label,
  Input,
  Button,
} from '@warmpawz/ui';
import {
  Plus,
  Edit2,
  Trash2,
  FileCheck,
  Search,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';

/** Fallback vendor types when API roles are not available; includes Tele. */
const FALLBACK_VENDOR_TYPES = [
  { id: 'veterinarian', name: 'Veterinarian', icon: '⚕️' },
  { id: 'veterinary_clinic', name: 'Veterinary Clinic', icon: '🏥' },
  { id: 'pet_groomer', name: 'Pet Groomer', icon: '✂️' },
  { id: 'pet_trainer', name: 'Pet Trainer', icon: '🎓' },
  { id: 'pet_walker', name: 'Pet Walker', icon: '🐕' },
  { id: 'pet_boarding', name: 'Pet Boarding', icon: '🏖️' },
  { id: 'pet_resort', name: 'Pet Resort', icon: '🏨' },
  { id: 'pet_sitter', name: 'Pet Sitter', icon: '🏡' },
  { id: 'pet_pharmacy', name: 'Pet Pharmacy', icon: '💊' },
  { id: 'pet_products_store', name: 'Pet Products Store', icon: '🛒' },
  { id: 'pet_cafe', name: 'Pet Cafe', icon: '☕' },
  { id: 'nutritionist', name: 'Nutritionist', icon: '🥗' },
  { id: 'pet_behaviorist', name: 'Pet Behaviorist', icon: '🧠' },
  { id: 'tele', name: 'Tele / Video Consultation', icon: '📹' },
  { id: 'adoption', name: 'Adoption', icon: '❤️' },
  { id: 'breeder', name: 'Breeder', icon: '🐾' },
];

const SERVICE_TYPES = [
  { id: 'at_home', name: 'At Home', icon: '🏠' },
  { id: 'at_center', name: 'At Center', icon: '🏢' },
  { id: 'video_consultation', name: 'Video Consultation', icon: '📹' },
  { id: 'delivery', name: 'Delivery', icon: '🚚' },
  { id: 'pickup', name: 'Pickup', icon: '📦' },
];

/** Default service categories and formats (can be overridden by /config/policy-options). */
const DEFAULT_SERVICE_CATEGORIES = [
  { id: 'veterinary', name: 'Veterinary Services' },
  { id: 'grooming', name: 'Grooming Services' },
  { id: 'walkers_training_boarding', name: 'Walkers, Training & Boarding' },
  { id: 'ecommerce', name: 'E-commerce Products' },
];
const DEFAULT_SERVICE_FORMATS = [
  { id: 'in_clinic', name: 'In-Clinic' },
  { id: 'teleconsultation', name: 'Teleconsultation' },
  { id: 'doorstep', name: 'Doorstep / Home Visit' },
  { id: 'centre', name: 'Centre-Based' },
];

interface CancellationWindow {
  hoursBefore: number;
  refundPercentage: number;
  cancellationFee: number;
  penaltyPercentage: number;
  allowReschedule?: boolean;
  maxReschedules?: number;
}

interface CancellationPolicy {
  id: string;
  name: string;
  description: string;
  policyType: 'standard' | 'vendor_specific' | 'service_specific';
  vendorTypes: string[];
  serviceTypes: string[];
  serviceCategory?: string;
  serviceFormat?: string;
  gracePeriodHours: number;
  cancellationWindows: CancellationWindow[];
  vendorCancellationPenalty: {
    enabled: boolean;
    penaltyPercentage: number;
    compensationPercentage: number;
  };
  noShowPolicy: {
    enabled: boolean;
    refundPercentage: number;
    penaltyAmount: number;
  };
  isActive: boolean;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

const POLICY_TYPE_HELP = {
  standard: 'Applies to all vendors and services. Use for platform-wide default rules (e.g. 24h full refund).',
  vendor_specific: 'Applies only to selected Vendor Types (e.g. Veterinarian, Groomer). When a customer cancels, the policy that matches the vendor’s role is used.',
  service_specific: 'Applies only to selected Service Types (e.g. At Home, Video Consultation). When a customer cancels, the policy that matches how the service is delivered is used.',
} as const;

export function CancellationPolicyManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policies, setPolicies] = useState<CancellationPolicy[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<CancellationPolicy | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<
    'all' | 'standard' | 'vendor_specific' | 'service_specific'
  >('all');
  const [vendorTypeOptions, setVendorTypeOptions] = useState<{ id: string; name: string; icon: string }[]>(FALLBACK_VENDOR_TYPES);
  const [serviceCategories, setServiceCategories] = useState<{ id: string; name: string }[]>(DEFAULT_SERVICE_CATEGORIES);
  const [serviceFormats, setServiceFormats] = useState<{ id: string; name: string }[]>(DEFAULT_SERVICE_FORMATS);

  useEffect(() => {
    loadPolicies();
  }, []);

  useEffect(() => {
    loadRolesForVendorTypes();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient.get<any>('/config/policy-options').catch(() => ({}));
        const cats = (data as any)?.serviceCategories;
        const fmts = (data as any)?.serviceFormats;
        if (Array.isArray(cats) && cats.length > 0) setServiceCategories(cats.map((c: any) => ({ id: c.id ?? c.value ?? '', name: c.name ?? c.label ?? '' })));
        if (Array.isArray(fmts) && fmts.length > 0) setServiceFormats(fmts.map((f: any) => ({ id: f.id ?? f.value ?? '', name: f.name ?? f.label ?? '' })));
      } catch {
        // keep defaults
      }
    })();
  }, []);

  const loadRolesForVendorTypes = async () => {
    const roleToIcon: Record<string, string> = {
      veterinarian: '⚕️', veterinary_clinic: '🏥', grooming: '✂️', groomer: '✂️', trainer: '🎓', walker: '🐕',
      boarding: '🏖️', resort: '🏨', sitter: '🏡', pharmacy: '💊', nutritionist: '🥗', pet_cafe: '☕',
      tele: '📹', adoption: '❤️', breeder: '🐾', behaviorist: '🧠',
    };
    const mapRolesToOptions = (roles: any[]): { id: string; name: string; icon: string }[] => {
      const options = roles
        .filter((r: any) => r.is_active !== false)
        .map((r: any) => ({
          id: (r.code ?? r.id ?? r.name ?? '').toString().toLowerCase().replace(/\s+/g, '_'),
          name: r.display_name ?? r.name ?? r.code ?? '',
          icon: roleToIcon[(r.code ?? r.name ?? '').toString().toLowerCase()] ?? '📌',
        }))
        .filter((o: { id: string }) => o.id);
      const hasTele = options.some((o: { id: string }) => o.id === 'tele' || o.id === 'video_consultation');
      if (!hasTele) {
        options.push({ id: 'tele', name: 'Tele / Video Consultation', icon: '📹' });
      }
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

  /** Normalize API row (snake_case, flat) to UI shape (camelCase, with arrays) */
  const normalizePolicy = (row: any): CancellationPolicy => {
    const arr = (v: unknown) => (Array.isArray(v) ? v : []);
    let rawWindows = row.cancellationWindows ?? row.cancellation_windows;
    if (typeof rawWindows === 'string') try { rawWindows = JSON.parse(rawWindows); } catch { rawWindows = []; }
    const windowsArr = arr(rawWindows);
    const defaultWindows: CancellationWindow[] = [
      { hoursBefore: 48, refundPercentage: 100, cancellationFee: 0, penaltyPercentage: 0 },
      { hoursBefore: 24, refundPercentage: 75, cancellationFee: 0, penaltyPercentage: 0 },
      { hoursBefore: 12, refundPercentage: 50, cancellationFee: 0, penaltyPercentage: 0 },
      { hoursBefore: 0, refundPercentage: 0, cancellationFee: 0, penaltyPercentage: 0 },
    ];
    const cancellationWindows: CancellationWindow[] = windowsArr.length
      ? windowsArr.map((w: any) => ({
          hoursBefore: Number(w.hoursBefore ?? w.hours_before ?? 0),
          refundPercentage: Number(w.refundPercentage ?? w.refund_percentage ?? 0),
          cancellationFee: Number(w.cancellationFee ?? w.cancellation_fee ?? 0),
          penaltyPercentage: Number(w.penaltyPercentage ?? w.penalty_percentage ?? 0),
          allowReschedule: w.allowReschedule ?? w.allow_reschedule,
          maxReschedules: w.maxReschedules ?? w.max_reschedules,
        }))
      : defaultWindows;
    let penalty = row.vendorCancellationPenalty ?? row.vendor_cancellation_penalty;
    if (typeof penalty === 'string') try { penalty = JSON.parse(penalty); } catch { penalty = null; }
    let noShow = row.noShowPolicy ?? row.no_show_policy;
    if (typeof noShow === 'string') try { noShow = JSON.parse(noShow); } catch { noShow = null; }
    return {
      id: row.id ?? '',
      name: row.name ?? row.policy_name ?? '',
      description: row.description ?? '',
      policyType: (row.policyType ?? row.policy_type ?? 'standard') as CancellationPolicy['policyType'],
      vendorTypes: arr(row.vendorTypes ?? row.vendor_types),
      serviceTypes: arr(row.serviceTypes ?? row.service_types),
      serviceCategory: row.serviceCategory ?? row.service_category ?? undefined,
      serviceFormat: row.serviceFormat ?? row.service_format ?? undefined,
      gracePeriodHours: Number(row.gracePeriodHours ?? row.hours_before_booking ?? 2) || 2,
      cancellationWindows,
      vendorCancellationPenalty: penalty && typeof penalty === 'object'
        ? { enabled: !!penalty.enabled, penaltyPercentage: Number(penalty.penaltyPercentage ?? penalty.penalty_percentage ?? 10), compensationPercentage: Number(penalty.compensationPercentage ?? penalty.compensation_percentage ?? 50) }
        : { enabled: true, penaltyPercentage: 10, compensationPercentage: 50 },
      noShowPolicy: noShow && typeof noShow === 'object'
        ? { enabled: !!noShow.enabled, refundPercentage: Number(noShow.refundPercentage ?? noShow.refund_percentage ?? 0), penaltyAmount: Number(noShow.penaltyAmount ?? noShow.penalty_amount ?? 0) }
        : { enabled: true, refundPercentage: 0, penaltyAmount: 0 },
      isActive: row.isActive ?? row.is_active ?? true,
      priority: row.priority ?? 0,
      createdAt: row.createdAt ?? row.created_at,
      updatedAt: row.updatedAt ?? row.updated_at,
    };
  };

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>('/admin/finance/cancellation-policies');
      const raw = (res as any)?.policies ?? (res as any)?.data?.policies;
      const list = Array.isArray(raw) ? raw : [];
      setPolicies(list.map((row: any) => normalizePolicy(row ?? {})));
    } catch (error) {
      console.error('Error loading cancellation policies:', error);
      toast.error('Failed to load cancellation policies');
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePolicy = async () => {
    if (!editingPolicy || !editingPolicy.name) {
      toast.error('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      if (editingPolicy.id) {
        await apiClient.put(
          `/admin/finance/cancellation-policies/${editingPolicy.id}`,
          editingPolicy
        );
        toast.success('Cancellation policy updated successfully');
      } else {
        await apiClient.post('/admin/finance/cancellation-policies', editingPolicy);
        toast.success('Cancellation policy created successfully');
      }
      setShowModal(false);
      setEditingPolicy(null);
      loadPolicies();
    } catch (error) {
      toast.error('Failed to save cancellation policy');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePolicy = async (id: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;
    try {
      await apiClient.delete(`/admin/finance/cancellation-policies/${id}`);
      toast.success('Cancellation policy deleted');
      loadPolicies();
    } catch (error) {
      toast.error('Failed to delete cancellation policy');
    }
  };

  const policiesList = Array.isArray(policies) ? policies : [];
  const filteredPolicies = policiesList.filter((policy) => {
    if (!policy) return false;
    const name = policy.name ?? (policy as any).policy_name ?? '';
    const description = policy.description ?? '';
    if (searchQuery) {
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        description.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
    }
    if (filterType !== 'all' && (policy.policyType || 'standard') !== filterType) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-black text-xl font-semibold">Cancellation Policy</h2>
            <p className="text-gray-500 text-sm mt-1">Manage cancellation rules and policies</p>
          </div>
          <PolicyHelpButton docKey="finance-cancellation-policy" />
        </div>
        <Button
          onClick={() => {
            setEditingPolicy({
              id: '',
              name: '',
              description: '',
              policyType: 'standard',
              vendorTypes: [],
              serviceTypes: [],
              serviceCategory: undefined,
              serviceFormat: undefined,
              gracePeriodHours: 2,
              cancellationWindows: [
                { hoursBefore: 48, refundPercentage: 100, cancellationFee: 0, penaltyPercentage: 0 },
                { hoursBefore: 24, refundPercentage: 75, cancellationFee: 0, penaltyPercentage: 0 },
                { hoursBefore: 12, refundPercentage: 50, cancellationFee: 0, penaltyPercentage: 0 },
                { hoursBefore: 0, refundPercentage: 0, cancellationFee: 0, penaltyPercentage: 0 },
              ],
              vendorCancellationPenalty: {
                enabled: true,
                penaltyPercentage: 10,
                compensationPercentage: 50,
              },
              noShowPolicy: {
                enabled: true,
                refundPercentage: 0,
                penaltyAmount: 0,
              },
              isActive: true,
              priority: 1,
            });
            setShowModal(true);
          }}
          className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Policy
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search policies..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={filterType}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterType(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
          >
            <option value="all">All Types</option>
            <option value="standard">Standard</option>
            <option value="vendor_specific">Vendor Specific</option>
            <option value="service_specific">Service Specific</option>
          </select>
        </div>
      </div>

      {/* Policies List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
        </div>
      ) : filteredPolicies.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <FileCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 mb-4">No cancellation policies found</p>
          <Button
            onClick={() => {
              setEditingPolicy({
                id: '',
                name: '',
                description: '',
                policyType: 'standard',
                vendorTypes: [],
                serviceTypes: [],
                serviceCategory: undefined,
                serviceFormat: undefined,
                gracePeriodHours: 2,
                cancellationWindows: [
                  { hoursBefore: 48, refundPercentage: 100, cancellationFee: 0, penaltyPercentage: 0 },
                  { hoursBefore: 24, refundPercentage: 75, cancellationFee: 0, penaltyPercentage: 0 },
                  { hoursBefore: 12, refundPercentage: 50, cancellationFee: 0, penaltyPercentage: 0 },
                  { hoursBefore: 0, refundPercentage: 0, cancellationFee: 0, penaltyPercentage: 0 },
                ],
                vendorCancellationPenalty: {
                  enabled: true,
                  penaltyPercentage: 10,
                  compensationPercentage: 50,
                },
                noShowPolicy: {
                  enabled: true,
                  refundPercentage: 0,
                  penaltyAmount: 0,
                },
                isActive: true,
                priority: 1,
              });
              setShowModal(true);
            }}
            variant="outline"
          >
            Create First Policy
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPolicies.map((policy) => (
            <Card key={policy.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle>{policy.name || (policy as any).policy_name || 'Unnamed'}</CardTitle>
                      <Badge variant={(policy.isActive ?? (policy as any).is_active) ? 'default' : 'outline'}>
                        {(policy.isActive ?? (policy as any).is_active) ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline">{(policy.policyType || 'standard').replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-sm text-gray-600">{policy.description ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingPolicy(normalizePolicy(policy));
                        setShowModal(true);
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDeletePolicy(policy.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Grace Period:</span>
                    <span className="ml-2 font-medium">{policy.gracePeriodHours ?? (policy as any).hours_before_booking ?? 0}h</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Cancellation Windows:</span>
                    <span className="ml-2 font-medium">{(policy.cancellationWindows || []).length}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Vendor Types:</span>
                    <span className="ml-2 font-medium">{(policy.vendorTypes || []).length}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Priority:</span>
                    <span className="ml-2 font-medium">{policy.priority ?? 0}</span>
                  </div>
                  {(policy.serviceCategory || policy.serviceFormat) && (
                    <div className="md:col-span-2">
                      <span className="text-gray-500">Category / Format:</span>
                      <span className="ml-2 font-medium">
                        {[policy.serviceCategory, policy.serviceFormat].filter(Boolean).join(' / ') || '—'}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Policy Editor Modal */}
      {showModal && editingPolicy && (
        <Dialog
          open={showModal}
          onOpenChange={(open: boolean) => {
            setShowModal(open);
            if (!open) setEditingPolicy(null);
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPolicy.id ? 'Edit Cancellation Policy' : 'Create Cancellation Policy'}
              </DialogTitle>
              <DialogDescription>
                Configure cancellation rules, grace periods, and penalties
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Policy Name *</Label>
                <Input
                  value={editingPolicy.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingPolicy({ ...editingPolicy, name: e.target.value })}
                  placeholder="e.g., Standard Cancellation Policy"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editingPolicy.description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingPolicy({ ...editingPolicy, description: e.target.value })
                  }
                  placeholder="Policy description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Policy Type</Label>
                  <select
                    value={editingPolicy.policyType}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        policyType: e.target.value as any,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  >
                    <option value="standard">Standard</option>
                    <option value="vendor_specific">Vendor Specific</option>
                    <option value="service_specific">Service Specific</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {POLICY_TYPE_HELP[editingPolicy.policyType]}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Grace Period (hours)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={Number.isFinite(editingPolicy.gracePeriodHours) ? editingPolicy.gracePeriodHours : ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const v = parseInt(e.target.value, 10);
                      setEditingPolicy({
                        ...editingPolicy,
                        gracePeriodHours: Number.isFinite(v) ? Math.max(0, v) : 2,
                      });
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Vendor Types {editingPolicy.policyType === 'vendor_specific' ? '(select which roles this policy applies to)' : '(optional; used when Policy Type is Vendor Specific)'}</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border p-4 rounded-lg max-h-60 overflow-y-auto">
                  {vendorTypeOptions.map((type) => (
                    <div key={type.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={(editingPolicy.vendorTypes ?? []).includes(type.id)}
                        onCheckedChange={(checked: boolean) => {
                          if (checked) {
                            setEditingPolicy({
                              ...editingPolicy,
                              vendorTypes: [...(editingPolicy.vendorTypes ?? []), type.id],
                            });
                          } else {
                            setEditingPolicy({
                              ...editingPolicy,
                              vendorTypes: (editingPolicy.vendorTypes ?? []).filter((t) => t !== type.id),
                            });
                          }
                        }}
                      />
                      <Label className="text-sm">
                        {type.icon} {type.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Service Types {editingPolicy.policyType === 'service_specific' ? '(select which delivery types this policy applies to)' : '(optional; used when Policy Type is Service Specific)'}</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border p-4 rounded-lg">
                  {SERVICE_TYPES.map((type) => (
                    <div key={type.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={(editingPolicy.serviceTypes ?? []).includes(type.id)}
                        onCheckedChange={(checked: boolean) => {
                          if (checked) {
                            setEditingPolicy({
                              ...editingPolicy,
                              serviceTypes: [...(editingPolicy.serviceTypes ?? []), type.id],
                            });
                          } else {
                            setEditingPolicy({
                              ...editingPolicy,
                              serviceTypes: (editingPolicy.serviceTypes ?? []).filter(
                                (t) => t !== type.id
                              ),
                            });
                          }
                        }}
                      />
                      <Label className="text-sm">
                        {type.icon} {type.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Service Category (optional)</Label>
                  <select
                    value={editingPolicy.serviceCategory ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEditingPolicy({ ...editingPolicy, serviceCategory: e.target.value || undefined })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  >
                    <option value="">All / Not specified</option>
                    {serviceCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">e.g. Veterinary, Grooming, E-commerce</p>
                </div>
                <div className="space-y-2">
                  <Label>Service Format (optional)</Label>
                  <select
                    value={editingPolicy.serviceFormat ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEditingPolicy({ ...editingPolicy, serviceFormat: e.target.value || undefined })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  >
                    <option value="">All / Not specified</option>
                    {serviceFormats.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">e.g. In-Clinic, Teleconsultation, Doorstep</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cancellation Windows (hours before → refund %, fee, reschedule)</Label>
                <p className="text-xs text-gray-500">Order by hours descending (e.g. 48h → 100%, then 24h → 75%, then 12h → 50%, then 0h → 0%).</p>
                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                  {(editingPolicy.cancellationWindows ?? []).map((win, idx) => (
                    <div key={idx} className="p-3 grid grid-cols-2 md:grid-cols-6 gap-2 items-center bg-gray-50/50">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Hours"
                        value={win.hoursBefore}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const v = parseInt(e.target.value, 10);
                          const next = [...(editingPolicy.cancellationWindows ?? [])];
                          next[idx] = { ...win, hoursBefore: Number.isFinite(v) ? v : 0 };
                          setEditingPolicy({ ...editingPolicy, cancellationWindows: next });
                        }}
                      />
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="Refund %"
                        value={win.refundPercentage}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const v = parseFloat(e.target.value);
                          const next = [...(editingPolicy.cancellationWindows ?? [])];
                          next[idx] = { ...win, refundPercentage: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0 };
                          setEditingPolicy({ ...editingPolicy, cancellationWindows: next });
                        }}
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="Fee ₹"
                        value={win.cancellationFee}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const v = parseFloat(e.target.value);
                          const next = [...(editingPolicy.cancellationWindows ?? [])];
                          next[idx] = { ...win, cancellationFee: Number.isFinite(v) ? Math.max(0, v) : 0 };
                          setEditingPolicy({ ...editingPolicy, cancellationWindows: next });
                        }}
                      />
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="Penalty %"
                        value={win.penaltyPercentage}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const v = parseFloat(e.target.value);
                          const next = [...(editingPolicy.cancellationWindows ?? [])];
                          next[idx] = { ...win, penaltyPercentage: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0 };
                          setEditingPolicy({ ...editingPolicy, cancellationWindows: next });
                        }}
                      />
                      <div className="flex items-center gap-1">
                        <Checkbox
                          checked={win.allowReschedule ?? false}
                          onCheckedChange={(checked: boolean) => {
                            const next = [...(editingPolicy.cancellationWindows ?? [])];
                            next[idx] = { ...win, allowReschedule: !!checked };
                            setEditingPolicy({ ...editingPolicy, cancellationWindows: next });
                          }}
                        />
                        <Label className="text-xs">Reschedule</Label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => {
                          const next = (editingPolicy.cancellationWindows ?? []).filter((_, i) => i !== idx);
                          setEditingPolicy({ ...editingPolicy, cancellationWindows: next });
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const next = [...(editingPolicy.cancellationWindows ?? []), { hoursBefore: 24, refundPercentage: 50, cancellationFee: 0, penaltyPercentage: 0 }];
                    setEditingPolicy({ ...editingPolicy, cancellationWindows: next });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add window
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-lg bg-amber-50/50">
                <div>
                  <Label className="font-medium">Vendor / Provider cancellation</Label>
                  <p className="text-xs text-gray-500 mb-2">When clinic/vet/groomer cancels: penalty and customer compensation</p>
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      checked={editingPolicy.vendorCancellationPenalty?.enabled ?? true}
                      onCheckedChange={(checked: boolean) =>
                        setEditingPolicy({
                          ...editingPolicy,
                          vendorCancellationPenalty: { ...(editingPolicy.vendorCancellationPenalty ?? {}), enabled: !!checked },
                        })
                      }
                    />
                    <Label>Enabled</Label>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Penalty %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={editingPolicy.vendorCancellationPenalty?.penaltyPercentage ?? 10}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const v = parseFloat(e.target.value);
                          setEditingPolicy({
                            ...editingPolicy,
                            vendorCancellationPenalty: { ...(editingPolicy.vendorCancellationPenalty ?? {}), penaltyPercentage: Number.isFinite(v) ? v : 10, compensationPercentage: editingPolicy.vendorCancellationPenalty?.compensationPercentage ?? 50 },
                          });
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Compensation %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={editingPolicy.vendorCancellationPenalty?.compensationPercentage ?? 50}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const v = parseFloat(e.target.value);
                          setEditingPolicy({
                            ...editingPolicy,
                            vendorCancellationPenalty: { ...(editingPolicy.vendorCancellationPenalty ?? {}), compensationPercentage: Number.isFinite(v) ? v : 50 },
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="font-medium">No-show policy</Label>
                  <p className="text-xs text-gray-500 mb-2">When customer does not show up</p>
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      checked={editingPolicy.noShowPolicy?.enabled ?? true}
                      onCheckedChange={(checked: boolean) =>
                        setEditingPolicy({
                          ...editingPolicy,
                          noShowPolicy: { ...(editingPolicy.noShowPolicy ?? {}), enabled: !!checked },
                        })
                      }
                    />
                    <Label>Enabled</Label>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Refund %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={editingPolicy.noShowPolicy?.refundPercentage ?? 0}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const v = parseFloat(e.target.value);
                          setEditingPolicy({
                            ...editingPolicy,
                            noShowPolicy: { ...(editingPolicy.noShowPolicy ?? {}), refundPercentage: Number.isFinite(v) ? v : 0, penaltyAmount: editingPolicy.noShowPolicy?.penaltyAmount ?? 0 },
                          });
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Penalty amount ₹</Label>
                      <Input
                        type="number"
                        min={0}
                        value={editingPolicy.noShowPolicy?.penaltyAmount ?? 0}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const v = parseFloat(e.target.value);
                          setEditingPolicy({
                            ...editingPolicy,
                            noShowPolicy: { ...(editingPolicy.noShowPolicy ?? {}), penaltyAmount: Number.isFinite(v) ? Math.max(0, v) : 0 },
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editingPolicy.isActive}
                  onCheckedChange={(checked: boolean) =>
                    setEditingPolicy({ ...editingPolicy, isActive: checked as boolean })
                  }
                />
                <Label>Active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setEditingPolicy(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePolicy}
                disabled={saving}
                className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
              >
                {saving ? 'Saving...' : 'Save Policy'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
