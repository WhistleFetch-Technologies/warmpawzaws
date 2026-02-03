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

const VENDOR_TYPES = [
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
];

const SERVICE_TYPES = [
  { id: 'at_home', name: 'At Home', icon: '🏠' },
  { id: 'at_center', name: 'At Center', icon: '🏢' },
  { id: 'video_consultation', name: 'Video Consultation', icon: '📹' },
  { id: 'delivery', name: 'Delivery', icon: '🚚' },
  { id: 'pickup', name: 'Pickup', icon: '📦' },
];

interface CancellationPolicy {
  id: string;
  name: string;
  description: string;
  policyType: 'standard' | 'vendor_specific' | 'service_specific';
  vendorTypes: string[];
  serviceTypes: string[];
  gracePeriodHours: number;
  cancellationWindows: {
    hoursBefore: number;
    refundPercentage: number;
    cancellationFee: number;
    penaltyPercentage: number;
  }[];
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

  useEffect(() => {
    loadPolicies();
  }, []);

  /** Normalize API row (snake_case, flat) to UI shape (camelCase, with arrays) */
  const normalizePolicy = (row: any): CancellationPolicy => {
    const arr = (v: unknown) => (Array.isArray(v) ? v : []);
    return {
      id: row.id ?? '',
      name: row.name ?? row.policy_name ?? '',
      description: row.description ?? '',
      policyType: (row.policyType ?? row.policy_type ?? 'standard') as CancellationPolicy['policyType'],
      vendorTypes: arr(row.vendorTypes ?? row.vendor_types),
      serviceTypes: arr(row.serviceTypes ?? row.service_types),
      gracePeriodHours: row.gracePeriodHours ?? row.hours_before_booking ?? 2,
      cancellationWindows: arr(row.cancellationWindows ?? row.cancellation_windows).length
        ? arr(row.cancellationWindows ?? row.cancellation_windows)
        : [
            { hoursBefore: 48, refundPercentage: 100, cancellationFee: 0, penaltyPercentage: 0 },
            { hoursBefore: 24, refundPercentage: 75, cancellationFee: 0, penaltyPercentage: 0 },
            { hoursBefore: 12, refundPercentage: 50, cancellationFee: 0, penaltyPercentage: 0 },
            { hoursBefore: 0, refundPercentage: 0, cancellationFee: 0, penaltyPercentage: 0 },
          ],
      vendorCancellationPenalty: row.vendorCancellationPenalty ?? row.vendor_cancellation_penalty ?? {
        enabled: true,
        penaltyPercentage: 10,
        compensationPercentage: 50,
      },
      noShowPolicy: row.noShowPolicy ?? row.no_show_policy ?? {
        enabled: true,
        refundPercentage: 0,
        penaltyAmount: 0,
      },
      isActive: row.isActive ?? row.is_active ?? true,
      priority: row.priority ?? 0,
      createdAt: row.createdAt ?? row.created_at,
      updatedAt: row.updatedAt ?? row.updated_at,
    };
  };

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<any>('/admin/finance/cancellation-policies');
      const raw = (data as any)?.data?.policies ?? (data as any)?.policies;
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
        <div>
          <h2 className="text-black text-xl font-semibold">Cancellation Policy</h2>
          <p className="text-gray-500 text-sm mt-1">Manage cancellation rules and policies</p>
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
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
                gracePeriodHours: 2,
                cancellationWindows: [],
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Policy Editor Modal */}
      {showModal && editingPolicy && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
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
                  onChange={(e) => setEditingPolicy({ ...editingPolicy, name: e.target.value })}
                  placeholder="e.g., Standard Cancellation Policy"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editingPolicy.description}
                  onChange={(e) =>
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
                    onChange={(e) =>
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
                </div>
                <div className="space-y-2">
                  <Label>Grace Period (hours)</Label>
                  <Input
                    type="number"
                    value={editingPolicy.gracePeriodHours}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        gracePeriodHours: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Vendor Types</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border p-4 rounded-lg max-h-60 overflow-y-auto">
                  {VENDOR_TYPES.map((type) => (
                    <div key={type.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={(editingPolicy.vendorTypes ?? []).includes(type.id)}
                        onCheckedChange={(checked) => {
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
                <Label>Service Types</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border p-4 rounded-lg">
                  {SERVICE_TYPES.map((type) => (
                    <div key={type.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={(editingPolicy.serviceTypes ?? []).includes(type.id)}
                        onCheckedChange={(checked) => {
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

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editingPolicy.isActive}
                  onCheckedChange={(checked) =>
                    setEditingPolicy({ ...editingPolicy, isActive: checked as boolean })
                  }
                />
                <Label>Active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModal(false)}>
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
