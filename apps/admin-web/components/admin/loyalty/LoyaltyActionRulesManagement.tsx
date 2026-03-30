'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Switch,
  Textarea,
} from '@warmpawz/ui';
import { Plus, Edit2, Trash2, Award, Save, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface LoyaltyActionRule {
  id: string;
  action_name: string;
  action_category: 'loyalty' | 'referral_rewards';
  user_type: 'customer' | 'vendor' | 'both';
  points_type: 'fixed' | 'percentage' | 'per_amount';
  points_value: number;
  base_amount?: number;
  min_amount?: number;
  max_points_per_transaction?: number;
  frequency_type?: 'one_time' | 'recurring' | 'unlimited' | 'monthly_limit' | 'yearly_limit';
  frequency_limit?: number;
  frequency_period?: 'day' | 'week' | 'month' | 'year';
  conditions?: {
    segment_ids?: string[];
    service_categories?: string[];
    customer_tiers?: string[];
    first_purchase?: boolean;
    birthday_month?: boolean;
    [key: string]: any;
  };
  multiplier_conditions?: Record<string, number>;
  is_active: boolean;
  priority: number;
  description?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface LoyaltySegment {
  id: string;
  segment_name: string;
  segment_type: 'customer' | 'vendor' | 'both';
}

interface ActionRuleFormData {
  action_name: string;
  action_category: 'loyalty' | 'referral_rewards';
  user_type: 'customer' | 'vendor' | 'both';
  points_type: 'fixed' | 'percentage' | 'per_amount';
  points_value: number;
  base_amount?: number;
  min_amount?: number;
  max_points_per_transaction?: number;
  frequency_type?: 'one_time' | 'recurring' | 'unlimited' | 'monthly_limit' | 'yearly_limit';
  frequency_limit?: number;
  frequency_period?: 'day' | 'week' | 'month' | 'year';
  conditions?: {
    segment_ids?: string[];
    service_categories?: string[];
    customer_tiers?: string[];
    [key: string]: any;
  };
  description?: string;
  is_active: boolean;
  priority: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LoyaltyActionRulesManagement() {
  const [rules, setRules] = useState<LoyaltyActionRule[]>([]);
  const [segments, setSegments] = useState<LoyaltySegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<LoyaltyActionRule | null>(null);
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [loadingActions, setLoadingActions] = useState<boolean>(false);
  const actionsAbortRef = React.useRef<AbortController | null>(null);
  const debounceRef = React.useRef<number | undefined>(undefined);
  const [formData, setFormData] = useState<ActionRuleFormData>({
    action_name: '',
    action_category: 'loyalty',
    user_type: 'customer',
    points_type: 'fixed',
    points_value: 100,
    frequency_type: 'unlimited',
    is_active: true,
    priority: 100,
    conditions: {},
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rulesRes, segmentsRes] = await Promise.all([
        apiClient.get<{ success: boolean; rules: LoyaltyActionRule[] }>('/admin/loyalty-action-rules'),
        apiClient.get<{ success: boolean; segments: LoyaltySegment[] }>('/admin/loyalty-segments'),
      ]);
      
      if (rulesRes.success) {
        setRules(rulesRes.rules || []);
      }
      if (segmentsRes.success) {
        setSegments(segmentsRes.segments || []);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Failed to load action rules');
    } finally {
      setLoading(false);
    }
  };

  // Load distinct action names (searchable)
  const loadActions = async (q: string) => {
    try {
      actionsAbortRef.current?.abort();
      const ac = new AbortController();
      actionsAbortRef.current = ac;
      setLoadingActions(true);

      const params = new URLSearchParams();
      if (q?.trim()) params.set('search', q.trim());
      params.set('limit', '100');

      const res = await apiClient.get<any>(`/admin/loyalty/actions?${params.toString()}`, {
        signal: ac.signal,
      } as any);
      const items = Array.isArray(res?.actions) ? res.actions : [];
      setActionOptions(items.filter((v: any) => typeof v === 'string' && v.length > 0));
    } catch (e) {
      if (!(actionsAbortRef.current && actionsAbortRef.current.signal.aborted)) {
        setActionOptions([]);
      }
    } finally {
      setLoadingActions(false);
    }
  };

  // Prime action list on dialog open
  useEffect(() => {
    if (showDialog) {
      loadActions('');
    } else {
      actionsAbortRef.current?.abort();
      window.clearTimeout(debounceRef.current);
    }
  }, [showDialog]);

  const handleCreate = () => {
    setEditingRule(null);
    setFormData({
      action_name: '',
      action_category: 'loyalty',
      user_type: 'customer',
      points_type: 'fixed',
      points_value: 100,
      frequency_type: 'unlimited',
      is_active: true,
      priority: 100,
      conditions: {},
    });
    setShowDialog(true);
  };

  const handleEdit = (rule: LoyaltyActionRule) => {
    setEditingRule(rule);
    setFormData({
      action_name: rule.action_name,
      action_category: rule.action_category,
      user_type: rule.user_type,
      points_type: rule.points_type,
      points_value: rule.points_value,
      base_amount: rule.base_amount,
      min_amount: rule.min_amount,
      max_points_per_transaction: rule.max_points_per_transaction,
      frequency_type: rule.frequency_type || 'unlimited',
      frequency_limit: rule.frequency_limit,
      frequency_period: rule.frequency_period,
      conditions: rule.conditions || {},
      description: rule.description,
      is_active: rule.is_active,
      priority: rule.priority,
    });
    setShowDialog(true);
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this action rule?')) {
      return;
    }

    try {
      await apiClient.delete(`/admin/loyalty-action-rules/${ruleId}`);
      toast.success('Action rule deleted successfully');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete action rule');
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.action_name.trim()) {
        toast.error('Action name is required');
        return;
      }

      const payload = {
        ...formData,
        conditions: formData.conditions || {},
      };

      if (editingRule) {
        await apiClient.put(`/admin/loyalty-action-rules/${editingRule.id}`, payload);
        toast.success('Action rule updated successfully');
      } else {
        await apiClient.post('/admin/loyalty-action-rules', payload);
        toast.success('Action rule created successfully');
      }

      setShowDialog(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save action rule');
    }
  };

  const getSegmentNames = (segmentIds?: string[]): string => {
    if (!segmentIds || segmentIds.length === 0) return 'None';
    const names = segmentIds
      .map(id => segments.find(s => s.id === id)?.segment_name)
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : `${segmentIds.length} segment(s)`;
  };

  const formatPoints = (rule: LoyaltyActionRule): string => {
    if (rule.points_type === 'fixed') {
      return `${rule.points_value} points`;
    } else if (rule.points_type === 'percentage') {
      return `${rule.points_value}% of amount`;
    } else {
      return `${rule.points_value} points per ₹${rule.base_amount || 100}`;
    }
  };

  const selectedSegmentIds = formData.conditions?.segment_ids || [];
  const allowedSegmentTypes: Array<LoyaltySegment['segment_type']> =
    formData.user_type === 'customer'
      ? ['customer', 'both']
      : formData.user_type === 'vendor'
        ? ['vendor', 'both']
        : ['customer', 'vendor', 'both'];
  const availableSegments = segments.filter((s) => allowedSegmentTypes.includes(s.segment_type));
  const missingSelectedSegments = selectedSegmentIds.filter(
    (id) => !availableSegments.some((s) => s.id === id)
  );
  const targetEntityLabel =
    formData.user_type === 'both'
      ? 'customers/vendors'
      : formData.user_type === 'vendor'
        ? 'vendors'
        : 'customers';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Action-Based Rules</h2>
          <p className="text-muted-foreground">
            Define points earned for specific actions. Can target segments for personalized rewards.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" /> Create Action Rule
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Action Rules</CardTitle>
          <CardDescription>
            Rules that award points for specific actions. Use segments to target specific customer groups.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading action rules...</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No action rules defined. Create your first action rule to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Segments</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">
                      <div>
                        <p>{rule.action_name}</p>
                        {rule.description && (
                          <p className="text-xs text-muted-foreground">{rule.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.action_category}</Badge>
                    </TableCell>
                    <TableCell>{formatPoints(rule)}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex items-center gap-1">
                        <Link2 className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm truncate">
                          {getSegmentNames(rule.conditions?.segment_ids)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {rule.frequency_type || 'unlimited'}
                      </Badge>
                    </TableCell>
                    <TableCell>{rule.priority}</TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(rule)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Action Rule' : 'Create Action Rule'}
            </DialogTitle>
            <DialogDescription>
              Define points awarded for specific actions. Link segments to target specific customer groups.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="action_name">Action Name *</Label>
                <>
                  <Input
                    id="action_name"
                    list="action-name-options"
                    value={formData.action_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const val = e.target.value;
                      setFormData((prev) => ({ ...prev, action_name: val }));
                      window.clearTimeout(debounceRef.current);
                      debounceRef.current = window.setTimeout(() => {
                        loadActions(val);
                      }, 250);
                    }}
                    placeholder={loadingActions ? 'Loading actions…' : 'Search or select (e.g., buy_medicine)'}
                    autoComplete="off"
                  />
                  <datalist id="action-name-options">
                    {actionOptions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </>
                <p className="text-xs text-muted-foreground">
                  {loadingActions
                    ? 'Loading actions…'
                    : actionOptions.length
                      ? `${actionOptions.length} actions · You can also type a custom name`
                      : 'Type to search or enter a custom action (e.g., buy_medicine)'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="action_category">Category</Label>
                <Select
                  value={formData.action_category}
                  onValueChange={(value: 'loyalty' | 'referral_rewards') =>
                    setFormData((prev) => ({ ...prev, action_category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loyalty">Loyalty</SelectItem>
                    <SelectItem value="referral_rewards">Referral Rewards</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user_type">User Type</Label>
                <Select
                  value={formData.user_type}
                  onValueChange={(value: 'customer' | 'vendor' | 'both') =>
                    setFormData((prev) => ({ ...prev, user_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="points_type">Points Type</Label>
                <Select
                  value={formData.points_type}
                  onValueChange={(value: 'fixed' | 'percentage' | 'per_amount') =>
                    setFormData((prev) => ({ ...prev, points_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Points</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="per_amount">Per Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="points_value">Points Value *</Label>
                <Input
                  id="points_value"
                  type="number"
                  value={formData.points_value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev) => ({
                      ...prev,
                      points_value: parseFloat(e.target.value) || 0,
                    }))
                  }
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground">
                  {formData.points_type === 'fixed' && 'Fixed points awarded'}
                  {formData.points_type === 'percentage' && 'Percentage of amount (0-100)'}
                  {formData.points_type === 'per_amount' && 'Points per base amount'}
                </p>
              </div>

              {(formData.points_type === 'percentage' || formData.points_type === 'per_amount') && (
                <div className="space-y-2">
                  <Label htmlFor="base_amount">Base Amount (₹)</Label>
                  <Input
                    id="base_amount"
                    type="number"
                    value={formData.base_amount || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({
                        ...prev,
                        base_amount: e.target.value ? parseFloat(e.target.value) : undefined,
                      }))
                    }
                    placeholder="100"
                  />
                  <p className="text-xs text-muted-foreground">
                    Base amount for calculation (e.g., 100 for "10 points per ₹100")
                  </p>
                </div>
              )}
            </div>

            {/* SEGMENT SELECTION - KEY FEATURE */}
            <div className="border-t pt-4 space-y-2">
              <Label className="font-semibold flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Target Segments (Optional)
              </Label>
              <p className="text-xs text-muted-foreground">
                Select segments to target. Rule will ONLY apply to {targetEntityLabel} in selected segments.
              </p>
              <div className="max-h-40 overflow-y-auto border rounded-md p-3 space-y-2">
                {availableSegments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No compatible segments available for selected user type.
                  </p>
                ) : (
                  availableSegments.map((segment) => (
                      <div key={segment.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`segment-${segment.id}`}
                          checked={selectedSegmentIds.includes(segment.id)}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const currentIds = formData.conditions?.segment_ids || [];
                            const newIds = e.target.checked
                              ? [...currentIds, segment.id]
                              : currentIds.filter(id => id !== segment.id);
                            setFormData((prev) => ({
                              ...prev,
                              conditions: {
                                ...prev.conditions,
                                segment_ids: newIds,
                              },
                            }));
                          }}
                          className="rounded"
                        />
                        <Label htmlFor={`segment-${segment.id}`} className="text-sm cursor-pointer">
                          {segment.segment_name}
                        </Label>
                      </div>
                    ))
                )}
              </div>
              {missingSelectedSegments.length > 0 && (
                <p className="text-xs text-amber-600">
                  ⚠ {missingSelectedSegments.length} linked segment(s) are not compatible with current user type or inactive.
                </p>
              )}
              {selectedSegmentIds.length > 0 && (
                <p className="text-xs text-green-600">
                  ✓ {selectedSegmentIds.length} segment(s) selected
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="frequency_type">Frequency Type</Label>
                <Select
                  value={formData.frequency_type || 'unlimited'}
                  onValueChange={(value: any) =>
                    setFormData((prev) => ({ ...prev, frequency_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One Time</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                    <SelectItem value="monthly_limit">Monthly Limit</SelectItem>
                    <SelectItem value="yearly_limit">Yearly Limit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev) => ({
                      ...prev,
                      priority: parseInt(e.target.value) || 100,
                    }))
                  }
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground">
                  Higher priority rules are evaluated first
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Describe this action rule..."
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked: boolean) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              {editingRule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
