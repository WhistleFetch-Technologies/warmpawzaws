'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Button,
  Label,
  Switch,
  Badge,
  Input,
} from '@warmpawz/ui';
import {
  Plus,
  Edit,
  Trash2,
  Save,
  AlertCircle,
  IndianRupee,
  Calendar,
  TrendingUp,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';

interface SettlementRule {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: {
    vendorTier?: string[];
    serviceCategory?: string[];
    minBookingAmount?: number;
    maxBookingAmount?: number;
    paymentMethod?: string[];
    region?: string[];
    dayOfWeek?: number[];
    timeOfDay?: {
      start: string;
      end: string;
    };
  };
  settlement: {
    periodDays: number;
    commissionRate?: number;
    minPayoutAmount: number;
    autoProcess: boolean;
    holdPeriodDays?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export function DynamicSettlementRulesManager() {
  const [rules, setRules] = useState<SettlementRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRule, setEditingRule] = useState<SettlementRule | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<any>('/admin/finance/settlement-rules');
      setRules((data as any).data?.rules || (data as any).rules || []);
    } catch (error) {
      console.error('Error loading settlement rules:', error);
      toast.error('Failed to load settlement rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async (rule: SettlementRule) => {
    setSaving(true);
    try {
      const payload = {
        name: rule.name,
        conditions: rule.conditions || {},
        settlement: rule.settlement,
        isActive: rule.enabled,
        priority: rule.priority,
        ...(rule.id && { id: rule.id }),
      };
      if (rule.id) {
        await apiClient.put(`/admin/finance/settlement-rules/${rule.id}`, payload);
        toast.success('Settlement rule saved successfully');
      } else {
        await apiClient.post('/admin/finance/settlement-rules', payload);
        toast.success('Settlement rule created successfully');
      }
      setEditingRule(null);
      setShowAddForm(false);
      loadRules();
    } catch (error) {
      toast.error('Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await apiClient.delete(`/admin/finance/settlement-rules/${ruleId}`);
      toast.success('Settlement rule deleted');
      loadRules();
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  const handleCreateRule = () => {
    setEditingRule({
      id: '',
      name: '',
      priority: rules.length + 1,
      enabled: true,
      conditions: {},
      settlement: {
        periodDays: 7,
        minPayoutAmount: 100,
        autoProcess: true,
      },
    });
    setShowAddForm(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-black text-xl font-semibold">Settlement Rules</h2>
            <p className="text-gray-500 text-sm mt-1">Configure dynamic settlement rules</p>
          </div>
          <PolicyHelpButton docKey="finance-settlement-rules" />
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
          <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 mb-4">No settlement rules configured</p>
          <Button onClick={handleCreateRule} variant="outline">
            Create First Rule
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {rules
            .sort((a, b) => a.priority - b.priority)
            .map((rule) => (
              <Card key={rule.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle>{rule.name}</CardTitle>
                        <Badge variant="outline">Priority: {rule.priority}</Badge>
                        <Badge variant={rule.enabled ? 'default' : 'outline'}>
                          {rule.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <CardDescription>
                        Settlement period: {rule.settlement.periodDays} days | Min payout: ₹
                        {rule.settlement.minPayoutAmount}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingRule(rule);
                          setShowAddForm(true);
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
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {rule.conditions.vendorTier && rule.conditions.vendorTier.length > 0 && (
                      <div>
                        <span className="text-gray-500">Vendor Tiers:</span>
                        <span className="ml-2 font-medium">
                          {rule.conditions.vendorTier.join(', ')}
                        </span>
                      </div>
                    )}
                    {rule.conditions.minBookingAmount !== undefined && (
                      <div>
                        <span className="text-gray-500">Min Booking:</span>
                        <span className="ml-2 font-medium">
                          ₹{rule.conditions.minBookingAmount}
                        </span>
                      </div>
                    )}
                    {rule.settlement.commissionRate !== undefined && (
                      <div>
                        <span className="text-gray-500">Commission Rate:</span>
                        <span className="ml-2 font-medium">
                          {rule.settlement.commissionRate}%
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Rule Editor Modal */}
      {showAddForm && editingRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-900">
                {editingRule.id ? 'Edit Settlement Rule' : 'Create Settlement Rule'}
              </h3>
              <button
                onClick={() => {
                  setShowAddForm(false);
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingRule({ ...editingRule, name: e.target.value })}
                  placeholder="e.g., Premium Tier Settlement"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={editingRule.priority}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEditingRule({
                        ...editingRule,
                        priority: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Settlement Period (days) – override</Label>
                  <Input
                    type="number"
                    value={editingRule.settlement.periodDays}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEditingRule({
                        ...editingRule,
                        settlement: {
                          ...editingRule.settlement,
                          periodDays: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">Defaults to vendor&apos;s tier (Tier Management). This rule overrides for matching conditions.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Payout Amount (₹)</Label>
                  <Input
                    type="number"
                    value={editingRule.settlement.minPayoutAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEditingRule({
                        ...editingRule,
                        settlement: {
                          ...editingRule.settlement,
                          minPayoutAmount: parseFloat(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                {editingRule.settlement.commissionRate !== undefined && (
                  <div className="space-y-2">
                    <Label>Commission Rate (%)</Label>
                    <Input
                      type="number"
                      value={editingRule.settlement.commissionRate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditingRule({
                          ...editingRule,
                          settlement: {
                            ...editingRule.settlement,
                            commissionRate: parseFloat(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editingRule.enabled}
                  onCheckedChange={(checked: boolean) =>
                    setEditingRule({ ...editingRule, enabled: checked })
                  }
                />
                <Label>Enabled</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editingRule.settlement.autoProcess}
                  onCheckedChange={(checked: boolean) =>
                    setEditingRule({
                      ...editingRule,
                      settlement: {
                        ...editingRule.settlement,
                        autoProcess: checked,
                      },
                    })
                  }
                />
                <Label>Auto Process</Label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingRule(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleSaveRule(editingRule)}
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
