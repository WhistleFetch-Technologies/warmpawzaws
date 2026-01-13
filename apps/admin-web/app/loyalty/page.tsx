'use client';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Button, Card, CardHeader, CardTitle, CardContent, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Tabs, TabsList, TabsTrigger, TabsContent } from '@warmpawz/ui';
import { Gift, Plus, Edit, Trash2, TrendingUp, Users, Award, Coins, Filter } from 'lucide-react';
import { useApiData, useCrud, useFormModal, useNotifications } from '@/hooks';
import { validateRequired } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { LoyaltySegmentsManagement } from '@/components/admin/loyalty/LoyaltySegmentsManagement';
import { LoyaltyActionRulesManagement } from '@/components/admin/loyalty/LoyaltyActionRulesManagement';

// ============================================================================
// TYPES
// ============================================================================

interface LoyaltyRule {
  id: string;
  name: string;
  description: string;
  points_per_rupee: number;
  redemption_rate: number; // Points per rupee for redemption
  min_points_to_redeem: number;
  max_redemption_per_transaction?: number;
  expiry_days?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  customer_name?: string;
  transaction_type: 'earned' | 'redeemed';
  points: number;
  reference_type?: string;
  reference_id?: string;
  description: string;
  created_at: string;
}

interface LoyaltyStats {
  totalCustomers: number;
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  activePoints: number;
  averagePointsPerCustomer: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface LoyaltyRuleFormData {
  name: string;
  description: string;
  points_per_rupee: number;
  redemption_rate: number;
  min_points_to_redeem: number;
  max_redemption_per_transaction?: number;
  expiry_days?: number;
  is_active: boolean;
}

export default function LoyaltyPage() {
  // Additional modal state for transactions
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('rules');

  // Reusable hooks for rules
  const { data: rules, loading: rulesLoading, error: rulesError, refetch: refetchRules } = useApiData<LoyaltyRule>({
    endpoint: '/admin/loyalty/rules',
    dataKey: 'rules',
  });

  // Stats (read-only) - handle as single object response
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  
  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await apiClient.get<any>('/admin/loyalty/stats');
        setStats(response.stats || response);
      } catch (err) {
        console.error('Error loading stats:', err);
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, []);

  // Transactions (read-only)
  const { data: transactions, loading: transactionsLoading } = useApiData<LoyaltyTransaction>({
    endpoint: '/admin/loyalty/transactions',
    params: { limit: 50 },
    dataKey: 'transactions',
  });

  const notifications = useNotifications({ autoClearSuccess: true });
  
  const { saving, deleting, error: crudError, success: crudSuccess, create, update, remove } = useCrud<LoyaltyRule, LoyaltyRuleFormData>({
    endpoint: '/admin/loyalty/rules',
    onSuccess: (message) => {
      notifications.setSuccess(message);
      refetchRules();
    },
    onError: (err) => {
      notifications.setError(err.message || 'Operation failed');
    },
  });

  const modal = useFormModal<LoyaltyRuleFormData, LoyaltyRule>({
    initialFormData: {
      name: '',
      description: '',
      points_per_rupee: 1,
      redemption_rate: 100,
      min_points_to_redeem: 100,
      max_redemption_per_transaction: undefined,
      expiry_days: undefined,
      is_active: true,
    },
    getDefaultFormData: () => ({
      name: '',
      description: '',
      points_per_rupee: 1,
      redemption_rate: 100,
      min_points_to_redeem: 100,
      max_redemption_per_transaction: undefined,
      expiry_days: undefined,
      is_active: true,
    }),
    mapItemToFormData: (rule) => ({
      name: rule.name,
      description: rule.description,
      points_per_rupee: rule.points_per_rupee,
      redemption_rate: rule.redemption_rate,
      min_points_to_redeem: rule.min_points_to_redeem,
      max_redemption_per_transaction: rule.max_redemption_per_transaction,
      expiry_days: rule.expiry_days,
      is_active: rule.is_active,
    }),
  });

  // Combine loading states - but don't wait forever if there's an error
  const loading = (rulesLoading || statsLoading || transactionsLoading) && !rulesError;
  
  // Combine errors and success messages
  const error = rulesError || crudError || notifications.error;
  const success = crudSuccess || notifications.success;

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleSaveRule = async () => {
    const validation = validateRequired(modal.formData, ['name', 'points_per_rupee', 'redemption_rate']);
    if (!validation.isValid) {
      notifications.setError(Object.values(validation.errors)[0]);
      return;
    }

    if (modal.editingItem) {
      await update(modal.editingItem.id, modal.formData);
    } else {
      await create(modal.formData);
    }

    if (!crudError) {
      modal.closeModal();
    }
  };

  const handleDeleteRule = async (rule: LoyaltyRule) => {
    await remove(rule);
  };

  const handleToggleRuleStatus = async (rule: LoyaltyRule) => {
    await update(rule.id, { ...rule, is_active: !rule.is_active } as any);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // Show loading only if we're actually loading and haven't encountered an error
  if (loading && !error) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading loyalty data...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
        {/* Header - Match wireframe: border-b, max-w-7xl mx-auto px-6 py-4 */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                {/* ✅ FIX: Match wireframe - text-2xl font-bold text-gray-900 */}
                <h1 className="text-2xl font-bold text-gray-900">Loyalty & Rewards</h1>
                <p className="text-sm text-gray-500 mt-1">Manage loyalty points program and rewards</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={modal.openCreate}
                  variant="default"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Rule
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content - Match wireframe: max-w-7xl mx-auto p-6 or p-8 */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8">
          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={notifications.clearError} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
              <span>{success}</span>
              <button onClick={notifications.clearSuccess} className="text-green-400 hover:text-green-600">✕</button>
            </div>
          )}

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Customers</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalCustomers}</p>
                    </div>
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Points Issued</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalPointsIssued.toLocaleString()}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Points Redeemed</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalPointsRedeemed.toLocaleString()}</p>
                    </div>
                    <Award className="w-8 h-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Points</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.activePoints.toLocaleString()}</p>
                    </div>
                    <Coins className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabs for Rules, Action Rules, and Segments */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="rules">
                <Gift className="w-4 h-4 mr-2" />
                Basic Rules
              </TabsTrigger>
              <TabsTrigger value="action-rules">
                <Award className="w-4 h-4 mr-2" />
                Action Rules
              </TabsTrigger>
              <TabsTrigger value="segments">
                <Filter className="w-4 h-4 mr-2" />
                Segments
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rules" className="space-y-6">
              {/* Loyalty Rules */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Loyalty Rules</CardTitle>
                </CardHeader>
                <CardContent>
                  {rules.length === 0 ? (
                    <div className="text-center py-12">
                      <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">No loyalty rules configured</p>
                      <Button onClick={modal.openCreate} variant="default">
                        Create Your First Rule
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Points/Rupee</TableHead>
                          <TableHead>Redemption Rate</TableHead>
                          <TableHead>Min Points</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rules.map(rule => (
                          <TableRow key={rule.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{rule.name}</p>
                                {rule.description && (
                                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{rule.points_per_rupee}</TableCell>
                            <TableCell>{rule.redemption_rate} pts/₹</TableCell>
                            <TableCell>{rule.min_points_to_redeem}</TableCell>
                            <TableCell>
                              <Badge variant={rule.is_active ? "default" : "secondary"}>
                                {rule.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => modal.openEdit(rule)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  onClick={() => handleToggleRuleStatus(rule)}
                                  variant={rule.is_active ? "secondary" : "default"}
                                  size="sm"
                                  disabled={saving}
                                >
                                  {rule.is_active ? 'Deactivate' : 'Activate'}
                                </Button>
                                <Button
                                  onClick={() => handleDeleteRule(rule)}
                                  variant="destructive"
                                  size="sm"
                                  disabled={deleting}
                                >
                                  <Trash2 className="w-4 h-4" />
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

              {/* Recent Transactions */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Recent Transactions</CardTitle>
                    <Button
                      onClick={() => setShowTransactionsModal(true)}
                      variant="outline"
                      size="sm"
                    >
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No transactions yet
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Points</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.slice(0, 10).map(transaction => (
                          <TableRow key={transaction.id}>
                            <TableCell>{transaction.customer_name || transaction.customer_id}</TableCell>
                            <TableCell>
                              <Badge variant={transaction.transaction_type === 'earned' ? "default" : "secondary"}>
                                {transaction.transaction_type === 'earned' ? 'Earned' : 'Redeemed'}
                              </Badge>
                            </TableCell>
                            <TableCell className={transaction.transaction_type === 'earned' ? 'text-green-600' : 'text-orange-600'}>
                              {transaction.transaction_type === 'earned' ? '+' : '-'}{transaction.points}
                            </TableCell>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell>{new Date(transaction.created_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="action-rules" className="space-y-6">
              <LoyaltyActionRulesManagement />
            </TabsContent>

            <TabsContent value="segments" className="space-y-6">
              <LoyaltySegmentsManagement />
            </TabsContent>
          </Tabs>
          </div>
        </main>

        {/* Create/Edit Rule Modal */}
        <Dialog open={modal.isOpen} onOpenChange={(open) => !open && modal.closeModal()}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{modal.editingItem ? 'Edit Loyalty Rule' : 'Create Loyalty Rule'}</DialogTitle>
              <DialogDescription>Configure how customers earn and redeem loyalty points</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Rule Name *</Label>
                <Input
                  id="name"
                  value={modal.formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, name: e.target.value })}
                  placeholder="Standard Loyalty Program"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={modal.formData.description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, description: e.target.value })}
                  placeholder="Earn points on every purchase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="points_per_rupee">Points per Rupee *</Label>
                  <Input
                    id="points_per_rupee"
                    type="number"
                    value={modal.formData.points_per_rupee}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, points_per_rupee: Number(e.target.value) })}
                    min="0"
                    step="0.1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Points earned per ₹1 spent</p>
                </div>
                <div>
                  <Label htmlFor="redemption_rate">Redemption Rate *</Label>
                  <Input
                    id="redemption_rate"
                    type="number"
                    value={modal.formData.redemption_rate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, redemption_rate: Number(e.target.value) })}
                    min="1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Points needed per ₹1 redeemed</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min_points_to_redeem">Min Points to Redeem *</Label>
                  <Input
                    id="min_points_to_redeem"
                    type="number"
                    value={modal.formData.min_points_to_redeem}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, min_points_to_redeem: Number(e.target.value) })}
                    min="1"
                  />
                </div>
                <div>
                  <Label htmlFor="max_redemption">Max Redemption per Transaction</Label>
                  <Input
                    id="max_redemption"
                    type="number"
                    value={modal.formData.max_redemption_per_transaction || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, max_redemption_per_transaction: e.target.value ? Number(e.target.value) : undefined })}
                    min="1"
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="expiry_days">Points Expiry (days)</Label>
                <Input
                  id="expiry_days"
                  type="number"
                  value={modal.formData.expiry_days || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, expiry_days: e.target.value ? Number(e.target.value) : undefined })}
                  min="1"
                  placeholder="Never expire"
                />
                <p className="text-xs text-muted-foreground mt-1">Leave empty for no expiry</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={modal.formData.is_active}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, is_active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="is_active">Rule is active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={modal.closeModal} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleSaveRule} disabled={saving} variant="default">
                {saving ? 'Saving...' : modal.editingItem ? 'Update Rule' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

