/**
 * Dynamic Settlement Rules Manager
 * 
 * Admin UI for configuring dynamic settlement rules based on:
 * - Vendor tier
 * - Service category
 * - Booking amount
 * - Payment method
 * - Geographic location
 */

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { Plus, Edit, Trash2, Save, AlertCircle, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface SettlementRule {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  
  // Conditions
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
  
  // Settlement Configuration
  settlement: {
    periodDays: number; // Settlement period in days
    commissionRate?: number; // Override commission rate
    minPayoutAmount: number;
    autoProcess: boolean;
    holdPeriodDays?: number; // Hold period before settlement
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

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/finance/settlement-rules`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        setRules(data.rules || []);
      }
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
      const method = rule.id ? 'PUT' : 'POST';
      const url = rule.id 
        ? `${API_BASE}/admin/finance/settlement-rules/${rule.id}`
        : `${API_BASE}/admin/finance/settlement-rules`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(rule)
      });

      if (response.ok) {
        toast.success('Settlement rule saved successfully');
        setEditingRule(null);
        setShowAddForm(false);
        loadRules();
      } else {
        toast.error('Failed to save rule');
      }
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Error saving settlement rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const response = await fetch(`${API_BASE}/admin/finance/settlement-rules/${ruleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        toast.success('Rule deleted successfully');
        loadRules();
      } else {
        toast.error('Failed to delete rule');
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Error deleting rule');
    }
  };

  const createNewRule = (): SettlementRule => ({
    id: '',
    name: '',
    priority: rules.length + 1,
    enabled: true,
    conditions: {},
    settlement: {
      periodDays: 7,
      minPayoutAmount: 100,
      autoProcess: true
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Dynamic Settlement Rules</h3>
          <p className="text-sm text-gray-500">
            Configure settlement rules that automatically adjust based on conditions
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingRule(createNewRule());
            setShowAddForm(true);
          }}
          className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading rules...</div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No settlement rules configured</p>
            <p className="text-xs mt-1">Create a rule to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rules
            .sort((a, b) => a.priority - b.priority)
            .map((rule) => (
              <Card key={rule.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">{rule.name}</CardTitle>
                      <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                        {rule.enabled ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline">Priority: {rule.priority}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingRule(rule);
                          setShowAddForm(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRule(rule.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Conditions</Label>
                    <div className="text-sm space-y-1">
                      {rule.conditions.vendorTier && (
                        <div>Tiers: {rule.conditions.vendorTier.join(', ')}</div>
                      )}
                      {rule.conditions.serviceCategory && (
                        <div>Categories: {rule.conditions.serviceCategory.join(', ')}</div>
                      )}
                      {rule.conditions.minBookingAmount && (
                        <div>Min Amount: ₹{rule.conditions.minBookingAmount}</div>
                      )}
                      {rule.conditions.maxBookingAmount && (
                        <div>Max Amount: ₹{rule.conditions.maxBookingAmount}</div>
                      )}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Settlement</Label>
                    <div className="text-sm space-y-1">
                      <div>Settlement Period: {rule.settlement.periodDays} days</div>
                      <div>Min Payout: ₹{rule.settlement.minPayoutAmount}</div>
                      {rule.settlement.commissionRate && (
                        <div>Commission Rate: {rule.settlement.commissionRate * 100}%</div>
                      )}
                      <div>Auto Process: {rule.settlement.autoProcess ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Add/Edit Rule Form */}
      {showAddForm && editingRule && (
        <Card>
          <CardHeader>
            <CardTitle>{editingRule.id ? 'Edit Rule' : 'Create New Rule'}</CardTitle>
            <CardDescription>Configure settlement rule conditions and settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                value={editingRule.name}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                placeholder="e.g., Premium Tier Fast Settlement"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={editingRule.priority}
                  onChange={(e) => setEditingRule({ ...editingRule, priority: parseInt(e.target.value) || 1 })}
                  min="1"
                />
              </div>
              <div className="space-y-2 flex items-end">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={editingRule.enabled}
                    onCheckedChange={(c) => setEditingRule({ ...editingRule, enabled: c })}
                  />
                  <Label>Enabled</Label>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label className="text-base font-semibold">Conditions</Label>
              
              <div className="space-y-2">
                <Label className="text-sm">Vendor Tiers (comma-separated)</Label>
                <Input
                  value={editingRule.conditions.vendorTier?.join(', ') || ''}
                  onChange={(e) => setEditingRule({
                    ...editingRule,
                    conditions: {
                      ...editingRule.conditions,
                      vendorTier: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    }
                  })}
                  placeholder="e.g., premium, enterprise"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Min Booking Amount (₹)</Label>
                  <Input
                    type="number"
                    value={editingRule.conditions.minBookingAmount || ''}
                    onChange={(e) => setEditingRule({
                      ...editingRule,
                      conditions: {
                        ...editingRule.conditions,
                        minBookingAmount: e.target.value ? parseFloat(e.target.value) : undefined
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Max Booking Amount (₹)</Label>
                  <Input
                    type="number"
                    value={editingRule.conditions.maxBookingAmount || ''}
                    onChange={(e) => setEditingRule({
                      ...editingRule,
                      conditions: {
                        ...editingRule.conditions,
                        maxBookingAmount: e.target.value ? parseFloat(e.target.value) : undefined
                      }
                    })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label className="text-base font-semibold">Settlement Configuration</Label>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Settlement Period (days)</Label>
                  <Input
                    type="number"
                    value={editingRule.settlement.periodDays}
                    onChange={(e) => setEditingRule({
                      ...editingRule,
                      settlement: {
                        ...editingRule.settlement,
                        periodDays: parseInt(e.target.value) || 7
                      }
                    })}
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Min Payout Amount (₹)</Label>
                  <Input
                    type="number"
                    value={editingRule.settlement.minPayoutAmount}
                    onChange={(e) => setEditingRule({
                      ...editingRule,
                      settlement: {
                        ...editingRule.settlement,
                        minPayoutAmount: parseFloat(e.target.value) || 100
                      }
                    })}
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Commission Rate Override (%)</Label>
                <Input
                  type="number"
                  value={editingRule.settlement.commissionRate ? editingRule.settlement.commissionRate * 100 : ''}
                  onChange={(e) => setEditingRule({
                    ...editingRule,
                    settlement: {
                      ...editingRule.settlement,
                      commissionRate: e.target.value ? parseFloat(e.target.value) / 100 : undefined
                    }
                  })}
                  placeholder="Leave empty to use tier default"
                  min="0"
                  max="100"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={editingRule.settlement.autoProcess}
                  onCheckedChange={(c) => setEditingRule({
                    ...editingRule,
                    settlement: {
                      ...editingRule.settlement,
                      autoProcess: c
                    }
                  })}
                />
                <Label>Auto Process Settlements</Label>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingRule(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleSaveRule(editingRule)}
                disabled={saving || !editingRule.name}
                className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
              >
                {saving ? 'Saving...' : 'Save Rule'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

