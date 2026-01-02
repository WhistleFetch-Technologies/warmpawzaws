import { useState, useEffect } from 'react';
import { X, Plus, MapPin, DollarSign, Save, Edit2, Trash2, Navigation, Calculator } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';

interface DistancePricingProps {
  vendorId: string;
  onClose: () => void;
}

interface PricingRule {
  id: string;
  serviceName: string;
  basePrice: number;
  baseDist: number; // km
  pricePerKm: number;
  maxDistance?: number;
  minCharge?: number;
  surgeMultiplier?: number;
  peakHourMultiplier?: number;
  zoneSpecific?: {
    zoneName: string;
    multiplier: number;
  }[];
  isActive: boolean;
  createdAt: string;
}

export function VendorDistancePricing({ vendorId, onClose }: DistancePricingProps) {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState<PricingRule | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    serviceName: '',
    basePrice: '',
    baseDist: '5',
    pricePerKm: '',
    maxDistance: '',
    minCharge: '',
    surgeMultiplier: '1',
    peakHourMultiplier: '1'
  });

  // Calculator state
  const [calcDistance, setCalcDistance] = useState('');
  const [calcResult, setCalcResult] = useState<any>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchRules();
  }, [vendorId]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/vendor/distance-pricing/${vendorId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      const data = await response.json();
      // ✅ FIX: Handle standardized response format
      // Response format: { success: true, rules: [...], total: ... }
      if (data.success) {
        setRules(data.rules || data.data?.rules || []);
      } else {
        const errorData = data.error || data.message || 'Unknown error';
        console.error('Failed to fetch pricing rules:', errorData);
        toast.error(errorData);
      }
    } catch (error: any) {
      console.error('Error fetching pricing rules:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const saveRule = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/vendor/distance-pricing/${vendorId}${selectedRule ? `/${selectedRule.id}` : ''}`,
        {
          method: selectedRule ? 'PUT' : 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...formData,
            basePrice: parseFloat(formData.basePrice),
            baseDist: parseFloat(formData.baseDist),
            pricePerKm: parseFloat(formData.pricePerKm),
            maxDistance: formData.maxDistance ? parseFloat(formData.maxDistance) : undefined,
            minCharge: formData.minCharge ? parseFloat(formData.minCharge) : undefined,
            surgeMultiplier: parseFloat(formData.surgeMultiplier),
            peakHourMultiplier: parseFloat(formData.peakHourMultiplier),
            isActive: true
          })
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success(`Pricing rule ${selectedRule ? 'updated' : 'created'} successfully`);
        setShowCreateModal(false);
        setSelectedRule(null);
        resetForm();
        await fetchRules(); // ✅ Ensure rules reload
      } else {
        const errorData = data.error || data.message || 'Failed to save pricing rule';
        toast.error(errorData);
      }
    } catch (error: any) {
      console.error('Error saving pricing rule:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  const deleteRule = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    const ruleName = rule?.serviceName || 'this pricing rule';
    
    if (!confirm(`Are you sure you want to delete "${ruleName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/vendor/distance-pricing/${vendorId}/${ruleId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success(`Pricing rule "${ruleName}" deleted successfully`);
        await fetchRules(); // ✅ Ensure rules reload
      } else {
        const errorData = data.error || data.message || 'Failed to delete pricing rule';
        toast.error(errorData);
      }
    } catch (error: any) {
      console.error('Error deleting rule:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  const toggleRuleStatus = async (ruleId: string, isActive: boolean) => {
    try {
      const response = await fetch(
        `${API_BASE}/vendor/distance-pricing/${vendorId}/${ruleId}/toggle`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ isActive })
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success(`Pricing rule ${isActive ? 'activated' : 'deactivated'}`);
        fetchRules();
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast.error('Failed to update rule status');
    }
  };

  const calculatePrice = (rule: PricingRule, distance: number) => {
    let price = rule.basePrice;
    
    if (distance > rule.baseDist) {
      const extraKm = distance - rule.baseDist;
      price += extraKm * rule.pricePerKm;
    }

    // Apply multipliers
    if (rule.surgeMultiplier && rule.surgeMultiplier > 1) {
      price *= rule.surgeMultiplier;
    }

    // Ensure minimum charge
    if (rule.minCharge && price < rule.minCharge) {
      price = rule.minCharge;
    }

    return Math.round(price);
  };

  const runCalculator = () => {
    if (!selectedRule || !calcDistance) return;

    const distance = parseFloat(calcDistance);
    const finalPrice = calculatePrice(selectedRule, distance);

    setCalcResult({
      distance,
      basePrice: selectedRule.basePrice,
      baseDist: selectedRule.baseDist,
      extraKm: Math.max(0, distance - selectedRule.baseDist),
      extraCharge: Math.max(0, (distance - selectedRule.baseDist) * selectedRule.pricePerKm),
      finalPrice
    });
  };

  const resetForm = () => {
    setFormData({
      serviceName: '',
      basePrice: '',
      baseDist: '5',
      pricePerKm: '',
      maxDistance: '',
      minCharge: '',
      surgeMultiplier: '1',
      peakHourMultiplier: '1'
    });
  };

  const stats = {
    total: rules.length,
    active: rules.filter(r => r.isActive).length,
    avgPricePerKm: rules.length > 0 
      ? Math.round(rules.reduce((sum, r) => sum + r.pricePerKm, 0) / rules.length)
      : 0
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-yellow-50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Navigation className="w-7 h-7 text-orange-600" />
                Distance-Based Pricing
              </h2>
              <p className="text-sm text-gray-600 mt-1">Configure pricing based on distance traveled</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-600">Pricing Rules</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
              <div className="text-2xl font-bold text-green-700">{stats.active}</div>
              <div className="text-xs text-green-700">Active</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-200">
              <div className="text-2xl font-bold text-orange-700">₹{stats.avgPricePerKm}</div>
              <div className="text-xs text-orange-700">Avg per KM</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Pricing Rule
            </button>
            <button
              onClick={() => setShowCalculator(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Calculator className="w-4 h-4" />
              Price Calculator
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-gray-600">Loading pricing rules...</p>
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12">
              <Navigation className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No pricing rules configured</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
              >
                Create First Rule
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`bg-white border-2 rounded-xl p-4 transition-colors ${
                    rule.isActive ? 'border-green-200 hover:border-green-300' : 'border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{rule.serviceName}</h3>
                      <div className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                        rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {rule.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setSelectedRule(rule);
                          setFormData(rule as any);
                          setShowCreateModal(true);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="p-2 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>

                  {/* Pricing Details */}
                  <div className="space-y-2">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-orange-700">Base Price</span>
                        <span className="font-semibold text-orange-900">₹{rule.basePrice}</span>
                      </div>
                      <div className="text-xs text-orange-600">
                        For first {rule.baseDist} km
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-xs text-gray-600 mb-1">Per KM</div>
                        <div className="text-sm font-medium text-gray-900">₹{rule.pricePerKm}/km</div>
                      </div>
                      {rule.minCharge && (
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-xs text-gray-600 mb-1">Min Charge</div>
                          <div className="text-sm font-medium text-gray-900">₹{rule.minCharge}</div>
                        </div>
                      )}
                    </div>

                    {rule.maxDistance && (
                      <div className="text-xs text-gray-500">
                        <MapPin className="w-3 h-3 inline mr-1" />
                        Max distance: {rule.maxDistance} km
                      </div>
                    )}

                    {(rule.surgeMultiplier && rule.surgeMultiplier > 1) && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                        <div className="text-xs text-red-700">
                          Surge: {rule.surgeMultiplier}x multiplier
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => toggleRuleStatus(rule.id, !rule.isActive)}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                        rule.isActive
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {rule.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRule(rule);
                        setShowCalculator(true);
                      }}
                      className="flex-1 py-2 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors"
                    >
                      Calculate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {selectedRule ? 'Edit' : 'Create'} Pricing Rule
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
                  <input
                    type="text"
                    value={formData.serviceName}
                    onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., Pet Pickup & Drop"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (₹)</label>
                    <input
                      type="number"
                      value={formData.basePrice}
                      onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Base Dist (km)</label>
                    <input
                      type="number"
                      value={formData.baseDist}
                      onChange={(e) => setFormData({ ...formData, baseDist: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price per KM (₹)</label>
                    <input
                      type="number"
                      value={formData.pricePerKm}
                      onChange={(e) => setFormData({ ...formData, pricePerKm: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Charge (₹)</label>
                    <input
                      type="number"
                      value={formData.minCharge}
                      onChange={(e) => setFormData({ ...formData, minCharge: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="150"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Distance (km) - Optional</label>
                  <input
                    type="number"
                    value={formData.maxDistance}
                    onChange={(e) => setFormData({ ...formData, maxDistance: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Surge Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.surgeMultiplier}
                    onChange={(e) => setFormData({ ...formData, surgeMultiplier: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="1.5"
                  />
                  <p className="text-xs text-gray-500 mt-1">1.0 = no surge, 1.5 = 50% increase</p>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedRule(null);
                    resetForm();
                  }}
                  className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveRule}
                  className="flex-1 py-2 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {selectedRule ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Calculator Modal */}
        {showCalculator && selectedRule && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Price Calculator
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Rule: {selectedRule.serviceName}
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Enter Distance (km)</label>
                <input
                  type="number"
                  value={calcDistance}
                  onChange={(e) => setCalcDistance(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="15"
                />
              </div>

              <button
                onClick={runCalculator}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors mb-4"
              >
                Calculate Price
              </button>

              {calcResult && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Distance:</span>
                    <span className="font-medium">{calcResult.distance} km</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Base Price ({calcResult.baseDist} km):</span>
                    <span className="font-medium">₹{calcResult.basePrice}</span>
                  </div>
                  {calcResult.extraKm > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Extra {calcResult.extraKm} km:</span>
                      <span className="font-medium">₹{Math.round(calcResult.extraCharge)}</span>
                    </div>
                  )}
                  <div className="border-t border-blue-300 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="font-semibold text-blue-900">Final Price:</span>
                      <span className="text-xl font-bold text-blue-600">₹{calcResult.finalPrice}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  setShowCalculator(false);
                  setSelectedRule(null);
                  setCalcDistance('');
                  setCalcResult(null);
                }}
                className="w-full mt-4 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
