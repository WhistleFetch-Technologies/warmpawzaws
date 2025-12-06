import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { ArrowLeft, Plus, Edit, Trash2, Check, X, RefreshCw } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

// Hardcoded vendor types with icons - same as payment settings
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

interface VendorType {
  id: string;
  name: string;
  icon: string;
}

interface RefundTier {
  id: string;
  name: string;
  vendorTypes: string[]; // Array of vendor type IDs
  serviceLocation: 'at_home' | 'at_center' | 'both';
  hoursBeforeService: number;
  refundPercentage: number;
  cancellationFee: number;
  isActive: boolean;
  createdAt?: string;
}

interface RefundPoliciesManagementNewProps {
  onBack: () => void;
}

export function RefundPoliciesManagementNew({ onBack }: RefundPoliciesManagementNewProps) {
  const [tiers, setTiers] = useState<RefundTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTier, setEditingTier] = useState<RefundTier | null>(null);
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
        setTiers(data.refundTiers || []);
      }
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
      isActive: true
    };
    setEditingTier(newTier);
    setIsCreatingNew(true);
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
      const url = isCreatingNew
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor-settings/refund-tiers`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor-settings/refund-tiers/${editingTier.id}`;

      const method = isCreatingNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(editingTier)
      });

      if (response.ok) {
        toast.success(isCreatingNew ? 'Refund tier created!' : 'Refund tier updated!');
        await loadData();
        setEditingTier(null);
        setIsCreatingNew(false);
      } else {
        toast.error('Failed to save refund tier');
      }
    } catch (error) {
      console.error('Error saving refund tier:', error);
      toast.error('Error saving refund tier');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTier = async (tierId: string) => {
    if (!confirm('Are you sure you want to delete this refund tier?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor-settings/refund-tiers/${tierId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        toast.success('Refund tier deleted!');
        await loadData();
      } else {
        toast.error('Failed to delete refund tier');
      }
    } catch (error) {
      console.error('Error deleting refund tier:', error);
      toast.error('Error deleting refund tier');
    }
  };

  const toggleVendorType = (vendorTypeId: string) => {
    if (!editingTier) return;

    const updated = { ...editingTier };
    if (updated.vendorTypes.includes(vendorTypeId)) {
      updated.vendorTypes = updated.vendorTypes.filter(id => id !== vendorTypeId);
    } else {
      updated.vendorTypes = [...updated.vendorTypes, vendorTypeId];
    }
    setEditingTier(updated);
  };

  const selectAllVendorTypes = () => {
    if (!editingTier) return;
    setEditingTier({
      ...editingTier,
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
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Refund Policies Management</h2>
            <p className="text-sm text-gray-500">Configure cancellation and refund tiers per vendor type & location</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {!editingTier && (
            <Button 
              size="default" 
              onClick={handleCreateTier}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Refund Tier
            </Button>
          )}
        </div>
      </div>

      {/* Editing Tier Form */}
      {editingTier && (
        <div className="bg-gradient-to-r from-orange-50 to-white border-2 border-[#FF8C42] rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-gray-900">
              {isCreatingNew ? 'Create New Refund Tier' : 'Edit Refund Tier'}
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingTier(null);
                  setIsCreatingNew(false);
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveTier}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Tier'}
              </Button>
            </div>
          </div>

          {/* Tier Name */}
          <div className="mb-6">
            <Label className="text-sm mb-2 font-medium">Tier Name</Label>
            <Input
              value={editingTier.name}
              onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
              placeholder="e.g., Standard 24-Hour Policy, Grooming Cancellation Tier"
              className="h-10"
            />
          </div>

          {/* Service Location Selector */}
          <div className="mb-6">
            <Label className="text-sm mb-3 font-medium">Service Location</Label>
            <div className="grid grid-cols-3 gap-4">
              <div 
                className={`text-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  editingTier.serviceLocation === 'at_home' 
                    ? 'border-[#FF8C42] bg-orange-50 shadow-md' 
                    : 'border-gray-200 hover:border-[#FF8C42]'
                }`}
                onClick={() => setEditingTier({ ...editingTier, serviceLocation: 'at_home' })}
              >
                <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-lg ${
                  editingTier.serviceLocation === 'at_home' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  🏠
                </div>
                <div className="text-sm font-medium text-gray-900">At Home</div>
                <div className="text-xs text-gray-500 mt-1">Service at customer's location</div>
              </div>
              <div 
                className={`text-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  editingTier.serviceLocation === 'at_center' 
                    ? 'border-[#FF8C42] bg-orange-50 shadow-md' 
                    : 'border-gray-200 hover:border-[#FF8C42]'
                }`}
                onClick={() => setEditingTier({ ...editingTier, serviceLocation: 'at_center' })}
              >
                <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-lg ${
                  editingTier.serviceLocation === 'at_center' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  🏢
                </div>
                <div className="text-sm font-medium text-gray-900">At Center</div>
                <div className="text-xs text-gray-500 mt-1">Service at vendor's location</div>
              </div>
              <div 
                className={`text-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  editingTier.serviceLocation === 'both' 
                    ? 'border-[#FF8C42] bg-orange-50 shadow-md' 
                    : 'border-gray-200 hover:border-[#FF8C42]'
                }`}
                onClick={() => setEditingTier({ ...editingTier, serviceLocation: 'both' })}
              >
                <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-lg ${
                  editingTier.serviceLocation === 'both' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
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
              <Label className="text-sm font-medium">Applicable Vendor Types ({editingTier.vendorTypes.length} selected)</Label>
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
                const isSelected = editingTier.vendorTypes.includes(vendorType.id);
                
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
                      id={`vendor-${vendorType.id}`}
                    />
                    <label
                      htmlFor={`vendor-${vendorType.id}`}
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

          {/* Refund Configuration */}
          <div className="grid grid-cols-3 gap-6">
            <div>
              <Label className="text-sm mb-2 font-medium">Hours Before Service</Label>
              <Input
                type="number"
                value={editingTier.hoursBeforeService}
                onChange={(e) => setEditingTier({ ...editingTier, hoursBeforeService: parseFloat(e.target.value) || 0 })}
                className="h-10"
                min="0"
                placeholder="e.g., 24"
              />
              <p className="text-xs text-gray-500 mt-1">Cancellation window before service starts</p>
            </div>
            <div>
              <Label className="text-sm mb-2 font-medium">Refund Percentage (%)</Label>
              <Input
                type="number"
                value={editingTier.refundPercentage}
                onChange={(e) => setEditingTier({ ...editingTier, refundPercentage: parseFloat(e.target.value) || 0 })}
                className="h-10"
                min="0"
                max="100"
                placeholder="e.g., 75"
              />
              <p className="text-xs text-gray-500 mt-1">Percentage of amount to refund</p>
            </div>
            <div>
              <Label className="text-sm mb-2 font-medium">Cancellation Fee (₹)</Label>
              <Input
                type="number"
                value={editingTier.cancellationFee}
                onChange={(e) => setEditingTier({ ...editingTier, cancellationFee: parseFloat(e.target.value) || 0 })}
                className="h-10"
                min="0"
                placeholder="e.g., 50"
              />
              <p className="text-xs text-gray-500 mt-1">Fixed cancellation fee (0 for none)</p>
            </div>
          </div>

          {/* Refund Calculation Summary */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Refund Calculation Example</h4>
            <p className="text-sm text-blue-800">
              If a customer cancels <span className="font-bold">{editingTier.hoursBeforeService} hours</span> before service, 
              they will receive <span className="font-bold">{editingTier.refundPercentage}% refund</span>
              {editingTier.cancellationFee > 0 && (
                <> minus a <span className="font-bold">₹{editingTier.cancellationFee} cancellation fee</span></>
              )}.
              <br />
              <span className="text-xs">Example: ₹1000 booking → ₹{(1000 * editingTier.refundPercentage / 100) - editingTier.cancellationFee} refunded</span>
            </p>
          </div>
        </div>
      )}

      {/* Tiers List */}
      {!editingTier && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Active Refund Tiers ({tiers.length})</h3>
          
          {tiers.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No refund tiers configured yet</p>
              <Button onClick={handleCreateTier} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
                <Plus className="w-4 h-4 mr-2" />
                Create First Tier
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {tiers.map(tier => (
                <div
                  key={tier.id}
                  className="border border-gray-200 rounded-lg p-5 hover:border-[#FF8C42] transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-900">{tier.name}</h4>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                          {tier.serviceLocation === 'at_home' && '🏠 At Home'}
                          {tier.serviceLocation === 'at_center' && '🏢 At Center'}
                          {tier.serviceLocation === 'both' && '🌐 Both Locations'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(tier.vendorTypes || []).map(vtId => {
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
                          setEditingTier({
                            ...tier,
                            vendorTypes: tier.vendorTypes || []
                          });
                          setIsCreatingNew(false);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteTier(tier.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Cancel Window:</span>
                      <span className="ml-2 font-medium">{tier.hoursBeforeService}h before</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Refund:</span>
                      <span className="ml-2 font-medium">{tier.refundPercentage}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Fee:</span>
                      <span className="ml-2 font-medium">₹{tier.cancellationFee}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span className={`ml-2 font-medium ${tier.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                        {tier.isActive ? 'Active' : 'Inactive'}
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