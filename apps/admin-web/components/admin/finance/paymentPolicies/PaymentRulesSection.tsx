'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Label, Checkbox } from '@warmpawz/ui';
import { Plus, Edit, Trash2, Check, X, RefreshCw, Save } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

const VENDOR_TYPES = [
  { id: 'dog-walking', name: 'Dog Walking', icon: '🐕' },
  { id: 'breeder', name: 'Breeder', icon: '🐾' },
  { id: 'adoption', name: 'Adoption', icon: '❤️' },
  { id: 'grooming', name: 'Grooming', icon: '✂️' },
  { id: 'veterinarian', name: 'Veterinarian', icon: '⚕️' },
  { id: 'pet-cafe', name: 'Pet Cafe', icon: '☕' },
  { id: 'trainer', name: 'Trainer', icon: '🎓' },
  { id: 'resorts', name: 'Resorts', icon: '🏖️' },
  { id: 'rehome', name: 'Rehome', icon: '🏡' },
  { id: 'nutritionist', name: 'Nutritionist', icon: '🥗' },
  { id: 'sunset-services', name: 'Sunset Services', icon: '🌅' },
  { id: 'healthcare-provider', name: 'Healthcare Service Provider', icon: '🏥' },
  { id: 'pet-products-seller', name: 'Food, Medicine & Pet Products Sellers', icon: '🛒' },
];

interface PaymentRule {
  id: string;
  name: string;
  vendorTypes: string[];
  serviceLocation: 'at_home' | 'at_center' | 'both';
  reservationType: 'flat' | 'percentage' | 'full';
  reservationPercentage: number;
  flatAmount: number;
  minimumAdvancePayment: number;
  partialPaymentAllowed: boolean;
  escrowHoldPeriodHours: number;
  cancellationGracePeriodHours: number;
  autoCapturePayment: boolean;
  premiumBookingValue: number;
  travelDistanceLimitKm: number;
  travelSurchargePerKm: number;
  equipmentFee: number;
  isActive: boolean;
  createdAt?: string;
}

export function PaymentRulesSection() {
  const [rules, setRules] = useState<PaymentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRule, setEditingRule] = useState<PaymentRule | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/vendor-settings-rules');
      setRules((data as any).data?.paymentRules || (data as any).paymentRules || []);
    } catch (error) {
      console.error('Error loading payment rules:', error);
      toast.error('Failed to load payment rules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = () => {
    const newRule: PaymentRule = {
      id: '',
      name: '',
      vendorTypes: [],
      serviceLocation: 'both',
      reservationType: 'flat',
      reservationPercentage: 20,
      flatAmount: 100,
      minimumAdvancePayment: 50,
      partialPaymentAllowed: true,
      escrowHoldPeriodHours: 24,
      cancellationGracePeriodHours: 2,
      autoCapturePayment: true,
      premiumBookingValue: 5000,
      travelDistanceLimitKm: 10,
      travelSurchargePerKm: 15,
      equipmentFee: 0,
      isActive: true,
    };
    setEditingRule(newRule);
    setIsCreatingNew(true);
    setShowModal(true);
  };

  const handleSaveRule = async () => {
    if (!editingRule) return;

    if (!editingRule.name.trim()) {
      toast.error('Please enter a rule name');
      return;
    }

    if (editingRule.vendorTypes.length === 0) {
      toast.error('Please select at least one vendor type');
      return;
    }

    setSaving(true);
    try {
      if (isCreatingNew) {
        await apiClient.post('/admin/vendor-settings/payment-rules', editingRule);
        toast.success('Payment rule created!');
      } else {
        await apiClient.put(`/admin/vendor-settings/payment-rules/${editingRule.id}`, editingRule);
        toast.success('Payment rule updated!');
      }
      await loadData();
      setEditingRule(null);
      setIsCreatingNew(false);
      setShowModal(false);
    } catch (error) {
      console.error('Error saving payment rule:', error);
      toast.error('Error saving payment rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await apiClient.delete(`/admin/vendor-settings/payment-rules/${id}`);
      toast.success('Payment rule deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete payment rule');
    }
  };

  const toggleVendorType = (vendorTypeId: string) => {
    if (!editingRule) return;
    const newTypes = editingRule.vendorTypes.includes(vendorTypeId)
      ? editingRule.vendorTypes.filter((t) => t !== vendorTypeId)
      : [...editingRule.vendorTypes, vendorTypeId];
    setEditingRule({ ...editingRule, vendorTypes: newTypes });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-black text-xl font-semibold">Payment Policies</h2>
          <p className="text-gray-500 text-sm mt-1">Configure payment rules and policies</p>
        </div>
        <Button onClick={handleCreateRule} className="bg-[#FF8C42] text-white hover:bg-[#E67A32]">
          <Plus className="w-4 h-4 mr-2" />
          Create Rule
        </Button>
      </div>

      {/* Rules List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-gray-500 mb-4">No payment rules configured</p>
          <Button onClick={handleCreateRule} variant="outline">
            Create First Rule
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        rule.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-gray-500">Reservation Type:</span>
                      <span className="ml-2 font-medium">{rule.reservationType}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Flat Amount:</span>
                      <span className="ml-2 font-medium">₹{rule.flatAmount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Min Advance:</span>
                      <span className="ml-2 font-medium">₹{rule.minimumAdvancePayment}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Vendor Types:</span>
                      <span className="ml-2 font-medium">{rule.vendorTypes.length}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingRule(rule);
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
                    onClick={() => handleDeleteRule(rule.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rule Editor Modal */}
      {showModal && editingRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-900">
                {isCreatingNew ? 'Create Payment Rule' : 'Edit Payment Rule'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingRule(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <Label>Rule Name *</Label>
                <Input
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  placeholder="e.g., Standard Payment Rule"
                />
              </div>

              <div className="space-y-2">
                <Label>Vendor Types *</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border p-4 rounded-lg max-h-60 overflow-y-auto">
                  {VENDOR_TYPES.map((type) => (
                    <div key={type.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={editingRule.vendorTypes.includes(type.id)}
                        onCheckedChange={() => toggleVendorType(type.id)}
                      />
                      <Label className="text-sm">{type.icon} {type.name}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Service Location</Label>
                  <select
                    value={editingRule.serviceLocation}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
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
                  <Label>Reservation Type</Label>
                  <select
                    value={editingRule.reservationType}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        reservationType: e.target.value as any,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  >
                    <option value="flat">Flat Amount</option>
                    <option value="percentage">Percentage</option>
                    <option value="full">Full Payment</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Flat Amount (₹)</Label>
                  <Input
                    type="number"
                    value={editingRule.flatAmount}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        flatAmount: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reservation Percentage (%)</Label>
                  <Input
                    type="number"
                    value={editingRule.reservationPercentage}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        reservationPercentage: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Minimum Advance Payment (₹)</Label>
                  <Input
                    type="number"
                    value={editingRule.minimumAdvancePayment}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        minimumAdvancePayment: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Escrow Hold Period (hours)</Label>
                  <Input
                    type="number"
                    value={editingRule.escrowHoldPeriodHours}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        escrowHoldPeriodHours: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editingRule.partialPaymentAllowed}
                  onCheckedChange={(checked) =>
                    setEditingRule({ ...editingRule, partialPaymentAllowed: checked as boolean })
                  }
                />
                <Label>Allow Partial Payment</Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editingRule.autoCapturePayment}
                  onCheckedChange={(checked) =>
                    setEditingRule({ ...editingRule, autoCapturePayment: checked as boolean })
                  }
                />
                <Label>Auto Capture Payment</Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editingRule.isActive}
                  onCheckedChange={(checked) =>
                    setEditingRule({ ...editingRule, isActive: checked as boolean })
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
                  setEditingRule(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveRule}
                disabled={saving}
                className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Rule'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
