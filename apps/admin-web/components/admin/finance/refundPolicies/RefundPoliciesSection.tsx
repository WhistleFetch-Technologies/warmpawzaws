'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Label, Checkbox } from '@warmpawz/ui';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

/** Fallback vendor types when API roles are not available; includes Tele. */
const FALLBACK_VENDOR_TYPES = [
  { id: 'veterinarian', name: 'Veterinarian', icon: '⚕️' },
  { id: 'tele', name: 'Tele / Video Consultation', icon: '📹' },
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

interface RefundTier {
  id: string;
  name: string;
  vendorTypes: string[];
  serviceLocation: 'at_home' | 'at_center' | 'both';
  hoursBeforeService: number;
  refundPercentage: number;
  cancellationFee: number;
  isActive: boolean;
  createdAt?: string;
}

/** Map DB service_location to frontend: home->at_home, clinic->at_center, both->both */
const serviceLocationFromDb = (v: string): RefundTier['serviceLocation'] => {
  if (v === 'home') return 'at_home';
  if (v === 'clinic') return 'at_center';
  return 'both';
};

/** Normalize API tier row (snake_case) to UI RefundTier (camelCase). */
function normalizeTier(row: any): RefundTier {
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const rawLoc = row.service_location ?? row.serviceLocation ?? 'both';
  return {
    id: row.id ?? '',
    name: row.name ?? row.policy_name ?? '',
    vendorTypes: arr(row.vendor_types ?? row.vendorTypes),
    serviceLocation: serviceLocationFromDb(String(rawLoc)),
    hoursBeforeService: Number(row.hours_before_service ?? row.hoursBeforeService ?? 24) || 24,
    refundPercentage: Number(row.refund_percentage ?? row.refundPercentage ?? 75) || 75,
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

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/vendor-settings-rules');
      const raw = (data as any).data?.refundTiers ?? (data as any).refundTiers ?? [];
      setTiers(Array.isArray(raw) ? raw.map(normalizeTier) : []);
    } catch (error) {
      console.error('Error loading refund tiers:', error);
      toast.error('Failed to load refund tiers');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTier = () => {
    const newTier: RefundTier = {
      id: '',
      name: '',
      vendorTypes: [],
      serviceLocation: 'both',
      hoursBeforeService: 24,
      refundPercentage: 75,
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

    if (editingTier.hoursBeforeService < 0) {
      toast.error('Hours before service must be positive');
      return;
    }

    if (editingTier.refundPercentage < 0 || editingTier.refundPercentage > 100) {
      toast.error('Refund percentage must be between 0 and 100');
      return;
    }

    setSaving(true);
    try {
      if (isCreatingNew) {
        await apiClient.post('/admin/vendor-settings/refund-tiers', editingTier);
        toast.success('Refund tier created!');
      } else {
        await apiClient.put(`/admin/vendor-settings/refund-tiers/${editingTier.id}`, editingTier);
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
        <div>
          <h2 className="text-black text-xl font-semibold">Refund Policies</h2>
          <p className="text-gray-500 text-sm mt-1">Configure refund rules and policies</p>
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
                    <div>
                      <span className="text-gray-500">Hours Before Service:</span>
                      <span className="ml-2 font-medium">{tier.hoursBeforeService}h</span>
                    </div>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-900">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Service Location</Label>
                  <select
                    value={editingTier.serviceLocation}
                    onChange={(e) =>
                      setEditingTier({
                        ...editingTier,
                        serviceLocation: e.target.value as any,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  >
                    <option value="at_home">At Home</option>
                    <option value="at_center">At Center</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Hours Before Service</Label>
                  <Input
                    type="number"
                    min={0}
                    value={Number.isFinite(editingTier.hoursBeforeService) ? editingTier.hoursBeforeService : ''}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setEditingTier({
                        ...editingTier,
                        hoursBeforeService: Number.isFinite(v) ? v : 24,
                      });
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Refund Percentage (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={Number.isFinite(editingTier.refundPercentage) ? editingTier.refundPercentage : ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setEditingTier({
                        ...editingTier,
                        refundPercentage: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 75,
                      });
                    }}
                  />
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
