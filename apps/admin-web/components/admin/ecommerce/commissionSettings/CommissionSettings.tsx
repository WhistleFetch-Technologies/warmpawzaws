'use client';

import { useState, useEffect } from 'react';
import {
  Percent,
  Save,
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  IndianRupee,
  Layers,
  Users,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  BarChart3,
} from 'lucide-react';
import { Button, Badge } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { toast, Toaster } from 'sonner';

interface CommissionRule {
  id: string;
  name: string;
  type: 'category' | 'value_tier' | 'vendor_tier' | 'product_specific' | 'hybrid';
  priority: number;
  enabled: boolean;
  conditions: {
    categories?: string[];
    minOrderValue?: number;
    maxOrderValue?: number;
    vendorTier?: string;
    productIds?: string[];
    minQuantity?: number;
    dateRange?: { start: string; end: string };
  };
  commission: {
    type: 'percentage' | 'fixed' | 'tiered';
    value?: number;
    tiers?: Array<{
      min: number;
      max: number | null;
      rate: number;
      fixedAmount?: number;
    }>;
    minAmount?: number;
    maxAmount?: number;
  };
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface VendorTier {
  id: string;
  name: string;
  commissionRate: number;
  requirements: {
    minMonthlyOrders?: number;
    minRating?: number;
    minRevenue?: number;
    verificationRequired?: boolean;
  };
  benefits: string[];
  color: string;
}

export function CommissionSettings() {
  const [defaultRate, setDefaultRate] = useState(15);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [vendorTiers, setVendorTiers] = useState<VendorTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);
  const [editingTier, setEditingTier] = useState<VendorTier | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSettings();
  }, []);

  const getDefaultVendorTiers = (): VendorTier[] => [
    {
      id: 'bronze',
      name: 'Bronze',
      commissionRate: 20,
      requirements: {},
      benefits: ['Basic support', 'Standard listing'],
      color: 'bg-orange-100 text-orange-700',
    },
    {
      id: 'silver',
      name: 'Silver',
      commissionRate: 15,
      requirements: { minMonthlyOrders: 50, minRating: 4.0 },
      benefits: ['Priority support', 'Featured listing', 'Analytics access'],
      color: 'bg-gray-100 text-gray-700',
    },
    {
      id: 'gold',
      name: 'Gold',
      commissionRate: 12,
      requirements: {
        minMonthlyOrders: 200,
        minRating: 4.5,
        minRevenue: 100000,
      },
      benefits: [
        '24/7 support',
        'Premium listing',
        'Advanced analytics',
        'Marketing support',
      ],
      color: 'bg-yellow-100 text-yellow-700',
    },
    {
      id: 'platinum',
      name: 'Platinum',
      commissionRate: 8,
      requirements: {
        minMonthlyOrders: 500,
        minRating: 4.8,
        minRevenue: 500000,
        verificationRequired: true,
      },
      benefits: [
        'Dedicated manager',
        'Top placement',
        'Full analytics suite',
        'Co-marketing',
        'Custom support',
      ],
      color: 'bg-purple-100 text-purple-700',
    },
  ];

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/ecommerce/commission/settings');
      const settings = (data as any).data?.settings || (data as any).settings || {};
      setDefaultRate(settings.defaultRate || 15);
      setRules(settings.rules || []);
      setVendorTiers(settings.vendorTiers || getDefaultVendorTiers());
    } catch (error) {
      console.error('Error loading settings:', error);
      setVendorTiers(getDefaultVendorTiers());
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.put('/admin/ecommerce/commission/settings', {
        defaultRate,
        rules,
        vendorTiers,
      });
      toast.success('Commission settings updated successfully');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Error updating settings');
    } finally {
      setSaving(false);
    }
  };

  const addRule = () => {
    const newRule: CommissionRule = {
      id: `rule_${Date.now()}`,
      name: 'New Commission Rule',
      type: 'category',
      priority: rules.length + 1,
      enabled: true,
      conditions: {},
      commission: {
        type: 'percentage',
        value: 15,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditingRule(newRule);
    setShowRuleModal(true);
  };

  const saveRule = (rule: CommissionRule) => {
    if (rule.id.startsWith('rule_')) {
      const existing = rules.find((r) => r.id === rule.id);
      if (existing) {
        setRules(
          rules.map((r) =>
            r.id === rule.id ? { ...rule, updatedAt: new Date().toISOString() } : r
          )
        );
      } else {
        setRules([...rules, rule]);
      }
    }
    setShowRuleModal(false);
    setEditingRule(null);
  };

  const deleteRule = (ruleId: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      setRules(rules.filter((r) => r.id !== ruleId));
      toast.success('Rule deleted');
    }
  };

  const toggleRuleExpanded = (ruleId: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  };

  const calculateCommission = (
    orderValue: number,
    category?: string,
    vendorTier?: string
  ): number => {
    // Find applicable rules in priority order
    const applicableRules = rules
      .filter((r) => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of applicableRules) {
      const { conditions, commission } = rule;

      // Check conditions
      let matches = true;
      if (conditions.categories && category) {
        matches = matches && conditions.categories.includes(category);
      }
      if (conditions.minOrderValue) {
        matches = matches && orderValue >= conditions.minOrderValue;
      }
      if (conditions.maxOrderValue) {
        matches = matches && orderValue <= conditions.maxOrderValue;
      }
      if (conditions.vendorTier && vendorTier) {
        matches = matches && conditions.vendorTier === vendorTier;
      }

      if (matches) {
        if (commission.type === 'percentage') {
          let amount = (orderValue * (commission.value || 0)) / 100;
          if (commission.minAmount) amount = Math.max(amount, commission.minAmount);
          if (commission.maxAmount) amount = Math.min(amount, commission.maxAmount);
          return amount;
        } else if (commission.type === 'fixed') {
          return commission.value || 0;
        } else if (commission.type === 'tiered' && commission.tiers) {
          const tier = commission.tiers.find(
            (t) => orderValue >= t.min && (t.max === null || orderValue < t.max)
          );
          if (tier) {
            const amount = (orderValue * tier.rate) / 100;
            return tier.fixedAmount ? amount + tier.fixedAmount : amount;
          }
        }
      }
    }

    // Default commission
    return (orderValue * defaultRate) / 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Toaster position="top-right" richColors />
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-black text-xl font-semibold">
            Enterprise Commission Management
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Multi-tier commission rules for marketplace optimization
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#FF8C42] text-white hover:bg-[#E67A32] disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Percent className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Default Rate</p>
              <p className="text-2xl font-bold text-gray-900">{defaultRate}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Layers className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Rules</p>
              <p className="text-2xl font-bold text-gray-900">
                {rules.filter((r) => r.enabled).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Vendor Tiers</p>
              <p className="text-2xl font-bold text-gray-900">{vendorTiers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Rules</p>
              <p className="text-2xl font-bold text-gray-900">{rules.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Default Commission Rate */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <IndianRupee className="w-5 h-5 text-[#FF8C42]" />
          <h3 className="font-semibold text-gray-900">Default Commission Rate</h3>
        </div>
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Rate (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={defaultRate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaultRate(parseFloat(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
          />
          <p className="text-xs text-gray-500 mt-2">
            Applied when no specific rule matches. This is the fallback commission rate.
          </p>
        </div>
      </div>

      {/* Vendor Tiers */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#FF8C42]" />
            <h3 className="font-semibold text-gray-900">Vendor Tier System</h3>
          </div>
          <Button onClick={() => setShowTierModal(true)} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Tier
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {vendorTiers.map((tier) => (
            <div key={tier.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <Badge className={tier.color}>{tier.name}</Badge>
                <span className="text-2xl font-bold text-gray-900">
                  {tier.commissionRate}%
                </span>
              </div>

              {Object.keys(tier.requirements).length > 0 && (
                <div className="mb-3 pb-3 border-b border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">Requirements:</p>
                  <div className="space-y-1 text-xs text-gray-600">
                    {tier.requirements.minMonthlyOrders && (
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>{tier.requirements.minMonthlyOrders}+ orders/month</span>
                      </div>
                    )}
                    {tier.requirements.minRating && (
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>{tier.requirements.minRating}+ rating</span>
                      </div>
                    )}
                    {tier.requirements.minRevenue && (
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>₹{tier.requirements.minRevenue.toLocaleString()}+ revenue</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Benefits:</p>
                <div className="space-y-1">
                  {tier.benefits.slice(0, 3).map((benefit, idx) => (
                    <div key={idx} className="flex items-start gap-1 text-xs text-gray-600">
                      <Check className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Commission Rules */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#FF8C42]" />
            <h3 className="font-semibold text-gray-900">Commission Rules</h3>
            <Badge variant="outline">{rules.length} rules</Badge>
          </div>
          <Button
            onClick={addRule}
            className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Rule
          </Button>
        </div>

        {rules.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No commission rules configured</p>
            <Button onClick={addRule} variant="outline">
              Create First Rule
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules
              .sort((a, b) => a.priority - b.priority)
              .map((rule) => (
                <div key={rule.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-4 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-sm font-bold text-gray-700">
                          {rule.priority}
                        </span>
                        <button
                          onClick={() => toggleRuleExpanded(rule.id)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {expandedRules.has(rule.id) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900">{rule.name}</h4>
                          <Badge variant={rule.enabled ? 'default' : 'outline'}>
                            {rule.enabled ? 'Active' : 'Disabled'}
                          </Badge>
                          <Badge variant="outline" className="bg-blue-50">
                            {rule.type.replace('_', ' ')}
                          </Badge>
                        </div>
                        {rule.description && (
                          <p className="text-sm text-gray-500 mt-1">{rule.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Commission</p>
                          <p className="font-bold text-gray-900">
                            {rule.commission.type === 'percentage' &&
                              `${rule.commission.value}%`}
                            {rule.commission.type === 'fixed' && `₹${rule.commission.value}`}
                            {rule.commission.type === 'tiered' && 'Tiered'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        onClick={() => {
                          setEditingRule(rule);
                          setShowRuleModal(true);
                        }}
                        variant="ghost"
                        size="sm"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          const updatedRules = rules.map((r) =>
                            r.id === rule.id ? { ...r, enabled: !r.enabled } : r
                          );
                          setRules(updatedRules);
                        }}
                        variant="ghost"
                        size="sm"
                      >
                        {rule.enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        onClick={() => deleteRule(rule.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {expandedRules.has(rule.id) && (
                    <div className="p-4 border-t border-gray-200 bg-white">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h5 className="text-sm font-semibold text-gray-700 mb-2">Conditions</h5>
                          <div className="space-y-2 text-sm">
                            {rule.conditions.categories && (
                              <div>
                                <span className="text-gray-500">Categories:</span>{' '}
                                <span className="font-medium">
                                  {rule.conditions.categories.join(', ')}
                                </span>
                              </div>
                            )}
                            {rule.conditions.minOrderValue !== undefined && (
                              <div>
                                <span className="text-gray-500">Min Order:</span>{' '}
                                <span className="font-medium">
                                  ₹{rule.conditions.minOrderValue}
                                </span>
                              </div>
                            )}
                            {rule.conditions.maxOrderValue !== undefined && (
                              <div>
                                <span className="text-gray-500">Max Order:</span>{' '}
                                <span className="font-medium">
                                  ₹{rule.conditions.maxOrderValue}
                                </span>
                              </div>
                            )}
                            {rule.conditions.vendorTier && (
                              <div>
                                <span className="text-gray-500">Vendor Tier:</span>{' '}
                                <span className="font-medium">{rule.conditions.vendorTier}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <h5 className="text-sm font-semibold text-gray-700 mb-2">
                            Commission Details
                          </h5>
                          <div className="space-y-2 text-sm">
                            {rule.commission.type === 'tiered' && rule.commission.tiers && (
                              <div>
                                {rule.commission.tiers.map((tier, idx) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between py-1 border-b border-gray-100"
                                  >
                                    <span className="text-gray-500">
                                      ₹{tier.min} - {tier.max ? `₹${tier.max}` : '∞'}
                                    </span>
                                    <span className="font-medium">{tier.rate}%</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {rule.commission.minAmount !== undefined && (
                              <div>
                                <span className="text-gray-500">Min Amount:</span>{' '}
                                <span className="font-medium">₹{rule.commission.minAmount}</span>
                              </div>
                            )}
                            {rule.commission.maxAmount !== undefined && (
                              <div>
                                <span className="text-gray-500">Max Amount:</span>{' '}
                                <span className="font-medium">₹{rule.commission.maxAmount}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Commission Calculator */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Commission Calculator</h3>
        </div>
        <CommissionCalculator
          defaultRate={defaultRate}
          rules={rules}
          vendorTiers={vendorTiers}
          calculateCommission={calculateCommission}
        />
      </div>

      {/* Rule Modal */}
      {showRuleModal && editingRule && (
        <RuleEditorModal
          rule={editingRule}
          onSave={saveRule}
          onClose={() => {
            setShowRuleModal(false);
            setEditingRule(null);
          }}
        />
      )}
    </div>
  );
}

// Commission Calculator Component
function CommissionCalculator({
  defaultRate,
  rules,
  vendorTiers,
  calculateCommission,
}: {
  defaultRate: number;
  rules: CommissionRule[];
  vendorTiers: VendorTier[];
  calculateCommission: (orderValue: number, category?: string, vendorTier?: string) => number;
}) {
  const [orderValue, setOrderValue] = useState(1000);
  const [category, setCategory] = useState('');
  const [vendorTier, setVendorTier] = useState('');

  const commission = calculateCommission(orderValue, category, vendorTier);
  const commissionRate = (commission / orderValue) * 100;
  const vendorEarnings = orderValue - commission;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Order Value (₹)
          </label>
          <input
            type="number"
            value={orderValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrderValue(parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category (optional)
          </label>
          <select
            value={category}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select category</option>
            <option value="food">Food</option>
            <option value="toys">Toys</option>
            <option value="accessories">Accessories</option>
            <option value="medicine">Medicine</option>
            <option value="grooming">Grooming</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vendor Tier (optional)
          </label>
          <select
            value={vendorTier}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVendorTier(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select tier</option>
            {vendorTiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 space-y-4">
        <h4 className="font-semibold text-gray-900 mb-4">Calculation Result</h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center pb-3 border-b border-gray-200">
            <span className="text-gray-600">Order Value</span>
            <span className="font-bold text-gray-900">₹{orderValue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-gray-200">
            <span className="text-gray-600">Commission Rate</span>
            <span className="font-bold text-orange-600">{commissionRate.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-gray-200">
            <span className="text-gray-600">Platform Commission</span>
            <span className="font-bold text-red-600">-₹{commission.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-gray-900 font-semibold">Vendor Earnings</span>
            <span className="font-bold text-green-600 text-xl">
              ₹{vendorEarnings.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Rule Editor Modal Component
function RuleEditorModal({
  rule,
  onSave,
  onClose,
}: {
  rule: CommissionRule;
  onSave: (rule: CommissionRule) => void;
  onClose: () => void;
}) {
  const [editedRule, setEditedRule] = useState<CommissionRule>(rule);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-xl font-bold text-gray-900">
            {rule.id.startsWith('rule_') ? 'Edit' : 'New'} Commission Rule
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rule Name</label>
            <input
              type="text"
              value={editedRule.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedRule({ ...editedRule, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              placeholder="e.g., Premium Category High Value"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={editedRule.description || ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditedRule({ ...editedRule, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              rows={2}
              placeholder="Brief description of this rule"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rule Type</label>
              <select
                value={editedRule.type}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditedRule({ ...editedRule, type: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              >
                <option value="category">Category-based</option>
                <option value="value_tier">Value Tier-based</option>
                <option value="vendor_tier">Vendor Tier-based</option>
                <option value="product_specific">Product-specific</option>
                <option value="hybrid">Hybrid (Multiple conditions)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <input
                type="number"
                value={editedRule.priority}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditedRule({
                    ...editedRule,
                    priority: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                min="1"
              />
            </div>
          </div>

          {/* Commission Settings */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-semibold text-gray-900 mb-4">Commission Settings</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commission Type
              </label>
              <select
                value={editedRule.commission.type}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setEditedRule({
                    ...editedRule,
                    commission: {
                      ...editedRule.commission,
                      type: e.target.value as any,
                    },
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
                <option value="tiered">Tiered (Based on value range)</option>
              </select>
            </div>

            {(editedRule.commission.type === 'percentage' ||
              editedRule.commission.type === 'fixed') && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {editedRule.commission.type === 'percentage'
                    ? 'Percentage (%)'
                    : 'Fixed Amount (₹)'}
                </label>
                <input
                  type="number"
                  value={editedRule.commission.value || 0}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditedRule({
                      ...editedRule,
                      commission: {
                        ...editedRule.commission,
                        value: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  step="0.1"
                />
              </div>
            )}
          </div>

          {/* Conditions */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-semibold text-gray-900 mb-4">Rule Conditions</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Order Value (₹)
                  </label>
                  <input
                    type="number"
                    value={editedRule.conditions.minOrderValue || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEditedRule({
                        ...editedRule,
                        conditions: {
                          ...editedRule.conditions,
                          minOrderValue: e.target.value
                            ? parseFloat(e.target.value)
                            : undefined,
                        },
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Order Value (₹)
                  </label>
                  <input
                    type="number"
                    value={editedRule.conditions.maxOrderValue || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEditedRule({
                        ...editedRule,
                        conditions: {
                          ...editedRule.conditions,
                          maxOrderValue: e.target.value
                            ? parseFloat(e.target.value)
                            : undefined,
                        },
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50">
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button
            onClick={() => onSave(editedRule)}
            className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Rule
          </Button>
        </div>
      </div>
    </div>
  );
}
