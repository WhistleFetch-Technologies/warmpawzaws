import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Checkbox } from '../../ui/checkbox';
import { Save, RotateCcw, CreditCard, Plus, Edit, Trash2, Check, X } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

// Hardcoded vendor types - these are the categories for rules
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
  { id: 'pet-products-seller', name: 'Food, Medicine & Pet Products Sellers', icon: '🛒' }
];

interface PaymentRule {
  id: string;
  name: string;
  vendorTypes: string[]; // Array of vendor type IDs
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor-settings-rules`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRules(data.paymentRules || []);
      }
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
      isActive: true
    };
    setEditingRule(newRule);
    setIsCreatingNew(true);
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
      const url = isCreatingNew
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor-settings/payment-rules`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor-settings/payment-rules/${editingRule.id}`;

      const method = isCreatingNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(editingRule)
      });

      if (response.ok) {
        toast.success(isCreatingNew ? 'Payment rule created!' : 'Payment rule updated!');
        await loadData();
        setEditingRule(null);
        setIsCreatingNew(false);
      } else {
        toast.error('Failed to save payment rule');
      }
    } catch (error) {
      console.error('Error saving payment rule:', error);
      toast.error('Error saving payment rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this payment rule?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor-settings/payment-rules/${ruleId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        toast.success('Payment rule deleted!');
        await loadData();
      } else {
        toast.error('Failed to delete payment rule');
      }
    } catch (error) {
      console.error('Error deleting payment rule:', error);
      toast.error('Error deleting payment rule');
    }
  };

  const toggleVendorType = (vendorTypeId: string) => {
    if (!editingRule) return;

    const updated = { ...editingRule };
    if (updated.vendorTypes.includes(vendorTypeId)) {
      updated.vendorTypes = updated.vendorTypes.filter(id => id !== vendorTypeId);
    } else {
      updated.vendorTypes = [...updated.vendorTypes, vendorTypeId];
    }
    setEditingRule(updated);
  };

  const selectAllVendorTypes = () => {
    if (!editingRule) return;
    setEditingRule({
      ...editingRule,
      vendorTypes: VENDOR_TYPES.map(vt => vt.id)
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Payment Rules</h3>
          <p className="text-sm text-gray-500">Configure payment rules per vendor type & service location</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {!editingRule && (
            <Button 
              size="sm" 
              onClick={handleCreateRule}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Rule
            </Button>
          )}
        </div>
      </div>

      {/* Editing Rule Form */}
      {editingRule && (
        <div className="bg-gradient-to-r from-blue-50 to-white border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-gray-900">
              {isCreatingNew ? 'Create New Payment Rule' : 'Edit Payment Rule'}
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingRule(null);
                  setIsCreatingNew(false);
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveRule}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Rule'}
              </Button>
            </div>
          </div>

          {/* Rule Name */}
          <div className="mb-6">
            <Label className="text-sm mb-2 font-medium">Rule Name</Label>
            <Input
              value={editingRule.name}
              onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
              placeholder="e.g., Grooming Full Payment, Dog Walking 20% Advance"
              className="h-10"
            />
          </div>

          {/* Service Location Selector */}
          <div className="mb-6">
            <Label className="text-sm mb-3 font-medium">Service Location</Label>
            <div className="grid grid-cols-3 gap-4">
              <div 
                className={`text-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  editingRule.serviceLocation === 'at_home' 
                    ? 'border-[#FF8C42] bg-orange-50 shadow-md' 
                    : 'border-gray-200 hover:border-[#FF8C42]'
                }`}
                onClick={() => setEditingRule({ ...editingRule, serviceLocation: 'at_home' })}
              >
                <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-lg ${
                  editingRule.serviceLocation === 'at_home' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  🏠
                </div>
                <div className="text-sm font-medium text-gray-900">At Home</div>
                <div className="text-xs text-gray-500 mt-1">Service at customer's location</div>
              </div>
              <div 
                className={`text-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  editingRule.serviceLocation === 'at_center' 
                    ? 'border-[#FF8C42] bg-orange-50 shadow-md' 
                    : 'border-gray-200 hover:border-[#FF8C42]'
                }`}
                onClick={() => setEditingRule({ ...editingRule, serviceLocation: 'at_center' })}
              >
                <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-lg ${
                  editingRule.serviceLocation === 'at_center' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  🏢
                </div>
                <div className="text-sm font-medium text-gray-900">At Center</div>
                <div className="text-xs text-gray-500 mt-1">Service at vendor's location</div>
              </div>
              <div 
                className={`text-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  editingRule.serviceLocation === 'both' 
                    ? 'border-[#FF8C42] bg-orange-50 shadow-md' 
                    : 'border-gray-200 hover:border-[#FF8C42]'
                }`}
                onClick={() => setEditingRule({ ...editingRule, serviceLocation: 'both' })}
              >
                <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-lg ${
                  editingRule.serviceLocation === 'both' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  🌐
                </div>
                <div className="text-sm font-medium text-gray-900">Both</div>
                <div className="text-xs text-gray-500 mt-1">Applicable to both locations</div>
              </div>
            </div>
          </div>

          {/* Vendor Type Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Applicable Vendor Types ({editingRule.vendorTypes.length} selected)</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={selectAllVendorTypes}
              >
                Select All ({VENDOR_TYPES.length})
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3 border border-gray-200 rounded-lg p-4 bg-white max-h-80 overflow-y-auto">
              {VENDOR_TYPES.map(vendorType => {
                const isSelected = editingRule.vendorTypes.includes(vendorType.id);
                
                return (
                  <div
                    key={vendorType.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleVendorType(vendorType.id)}
                      id={`payment-vendor-${vendorType.id}`}
                    />
                    <label
                      htmlFor={`payment-vendor-${vendorType.id}`}
                      className="flex-1 cursor-pointer flex items-center gap-2"
                    >
                      <span className="text-lg">{vendorType.icon}</span>
                      <span className="text-sm font-medium text-gray-900">{vendorType.name}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reservation Type */}
          <div className="mb-6">
            <Label className="text-sm mb-3 font-medium">Reservation Type</Label>
            <div className="grid grid-cols-3 gap-4">
              <div 
                className={`text-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  editingRule.reservationType === 'flat' 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setEditingRule({ ...editingRule, reservationType: 'flat' })}
              >
                <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-lg ${
                  editingRule.reservationType === 'flat' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  ₹
                </div>
                <div className="text-sm font-medium text-gray-900">Flat Amount</div>
                <div className="text-xs text-gray-500 mt-1">Fixed reservation fee</div>
              </div>
              <div 
                className={`text-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  editingRule.reservationType === 'percentage' 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setEditingRule({ ...editingRule, reservationType: 'percentage' })}
              >
                <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-lg ${
                  editingRule.reservationType === 'percentage' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  %
                </div>
                <div className="text-sm font-medium text-gray-900">Percentage</div>
                <div className="text-xs text-gray-500 mt-1">% of total amount</div>
              </div>
              <div 
                className={`text-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  editingRule.reservationType === 'full' 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setEditingRule({ ...editingRule, reservationType: 'full' })}
              >
                <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-lg ${
                  editingRule.reservationType === 'full' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  💯
                </div>
                <div className="text-sm font-medium text-gray-900">Full Payment</div>
                <div className="text-xs text-gray-500 mt-1">100% upfront</div>
              </div>
            </div>
          </div>

          {/* Dynamic Configuration based on Reservation Type */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {editingRule.reservationType === 'percentage' && (
              <>
                <div>
                  <Label className="text-sm mb-2 font-medium">Reservation Percentage (%)</Label>
                  <Input
                    type="number"
                    value={editingRule.reservationPercentage}
                    onChange={(e) => setEditingRule({ ...editingRule, reservationPercentage: parseFloat(e.target.value) || 0 })}
                    className="h-10"
                    min="0"
                    max="100"
                    placeholder="e.g., 20"
                  />
                </div>
                <div>
                  <Label className="text-sm mb-2 font-medium">Minimum Advance Payment (₹)</Label>
                  <Input
                    type="number"
                    value={editingRule.minimumAdvancePayment}
                    onChange={(e) => setEditingRule({ ...editingRule, minimumAdvancePayment: parseFloat(e.target.value) || 0 })}
                    className="h-10"
                    min="0"
                    placeholder="e.g., 50"
                  />
                </div>
              </>
            )}
            {editingRule.reservationType === 'flat' && (
              <div>
                <Label className="text-sm mb-2 font-medium">Flat Amount (₹)</Label>
                <Input
                  type="number"
                  value={editingRule.flatAmount}
                  onChange={(e) => setEditingRule({ ...editingRule, flatAmount: parseFloat(e.target.value) || 0 })}
                  className="h-10"
                  min="0"
                  placeholder="e.g., 100"
                />
              </div>
            )}
          </div>

          {/* Additional Settings */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <Label className="text-sm mb-2 font-medium">Escrow Hold (hours)</Label>
              <Input
                type="number"
                value={editingRule.escrowHoldPeriodHours}
                onChange={(e) => setEditingRule({ ...editingRule, escrowHoldPeriodHours: parseFloat(e.target.value) || 0 })}
                className="h-10"
                min="0"
                placeholder="e.g., 24"
              />
            </div>
            <div>
              <Label className="text-sm mb-2 font-medium">Travel Surcharge (₹/km)</Label>
              <Input
                type="number"
                value={editingRule.travelSurchargePerKm}
                onChange={(e) => setEditingRule({ ...editingRule, travelSurchargePerKm: parseFloat(e.target.value) || 0 })}
                className="h-10"
                min="0"
                placeholder="e.g., 15"
              />
            </div>
            <div>
              <Label className="text-sm mb-2 font-medium">Equipment Fee (₹)</Label>
              <Input
                type="number"
                value={editingRule.equipmentFee}
                onChange={(e) => setEditingRule({ ...editingRule, equipmentFee: parseFloat(e.target.value) || 0 })}
                className="h-10"
                min="0"
                placeholder="e.g., 0"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-3 gap-6">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <Label className="text-sm font-medium">Auto-Capture Payment</Label>
              <Switch
                checked={editingRule.autoCapturePayment}
                onCheckedChange={(checked) => setEditingRule({ ...editingRule, autoCapturePayment: checked })}
              />
            </div>
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <Label className="text-sm font-medium">Partial Payment Allowed</Label>
              <Switch
                checked={editingRule.partialPaymentAllowed}
                onCheckedChange={(checked) => setEditingRule({ ...editingRule, partialPaymentAllowed: checked })}
              />
            </div>
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <Label className="text-sm font-medium">Rule Active</Label>
              <Switch
                checked={editingRule.isActive}
                onCheckedChange={(checked) => setEditingRule({ ...editingRule, isActive: checked })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Rules List */}
      {!editingRule && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Active Payment Rules ({rules.length})</h3>
          </div>
          
          {rules.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No payment rules configured yet</p>
              <Button onClick={handleCreateRule} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
                <Plus className="w-4 h-4 mr-2" />
                Create First Rule
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => (
                <div
                  key={rule.id}
                  className="border border-gray-200 rounded-lg p-5 hover:border-[#FF8C42] transition-all bg-white"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-900">{rule.name}</h4>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                          {rule.serviceLocation === 'at_home' && '🏠 At Home'}
                          {rule.serviceLocation === 'at_center' && '🏢 At Center'}
                          {rule.serviceLocation === 'both' && '🌐 Both Locations'}
                        </span>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                          {rule.reservationType === 'flat' && '₹ Flat'}
                          {rule.reservationType === 'percentage' && '% Percentage'}
                          {rule.reservationType === 'full' && '💯 Full'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(rule.vendorTypes || []).map(vtId => {
                          const vendorType = VENDOR_TYPES.find(vt => vt.id === vtId);
                          return vendorType ? (
                            <span key={vtId} className="px-2 py-1 bg-orange-100 text-[#FF8C42] text-xs rounded-full font-medium flex items-center gap-1">
                              <span>{vendorType.icon}</span>
                              <span>{vendorType.name}</span>
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingRule({
                            ...rule,
                            vendorTypes: rule.vendorTypes || []
                          });
                          setIsCreatingNew(false);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Payment:</span>
                      <span className="ml-2 font-medium">
                        {rule.reservationType === 'flat' && `₹${rule.flatAmount}`}
                        {rule.reservationType === 'percentage' && `${rule.reservationPercentage}%`}
                        {rule.reservationType === 'full' && '100%'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Escrow:</span>
                      <span className="ml-2 font-medium">{rule.escrowHoldPeriodHours}h</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Auto-Capture:</span>
                      <span className={`ml-2 font-medium ${rule.autoCapturePayment ? 'text-green-600' : 'text-gray-400'}`}>
                        {rule.autoCapturePayment ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span className={`ml-2 font-medium ${rule.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}