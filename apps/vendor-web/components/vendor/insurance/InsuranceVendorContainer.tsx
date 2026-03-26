'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Shield, FileText, TrendingUp, CheckCircle2, X, Edit, Trash2, Eye, EyeOff, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface InsuranceVendorContainerProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

interface InsurancePlan {
  id?: string;
  name: string;
  description: string;
  price: number;
  period: 'month' | 'year';
  coverage: number;
  deductible: number;
  features: string[];
  isPublished: boolean;
  category?: string;
  waitingPeriod?: number;
  maxAge?: number;
  minAge?: number;
}

function toMaybeNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function pickPrice(row: Record<string, unknown>): number {
  const candidates = [
    toMaybeNum(row.price),
    toMaybeNum(row.premium_monthly),
    toMaybeNum(row.monthly_premium),
    toMaybeNum(row.premium),
  ];
  for (const n of candidates) {
    if (n != null && n > 0) return n;
  }
  for (const n of candidates) {
    if (n != null) return n;
  }
  return 0;
}

/** GET /vendor/.../insurance/plans returns DB rows — normalize for UI */
function normalizeVendorInsurancePlan(row: Record<string, unknown>): InsurancePlan {
  let details: { features?: string[] } = {};
  const rawCd = row.coverage_details;
  if (rawCd && typeof rawCd === 'object' && !Array.isArray(rawCd)) {
    details = rawCd as { features?: string[] };
  } else if (typeof rawCd === 'string') {
    try {
      const p = JSON.parse(rawCd);
      if (p && typeof p === 'object' && !Array.isArray(p)) details = p as { features?: string[] };
    } catch {
      /* ignore */
    }
  }

  const features = Array.isArray(row.features)
    ? (row.features as string[])
    : Array.isArray(details?.features)
      ? details.features!
      : [];

  const price = pickPrice(row);
  const coverage =
    toMaybeNum(row.coverage) ?? toMaybeNum(row.coverage_amount) ?? toMaybeNum(row.coverageAmount) ?? 0;

  return {
    id: row.id != null ? String(row.id) : undefined,
    name: String(row.name ?? row.plan_name ?? 'Plan'),
    description: String(row.description ?? ''),
    price,
    period: row.period === 'year' ? 'year' : 'month',
    coverage,
    deductible: toMaybeNum(row.deductible) ?? 0,
    features,
    isPublished: Boolean(row.isPublished ?? row.is_published ?? row.is_active),
    category: row.category != null ? String(row.category) : undefined,
    waitingPeriod:
      row.waitingPeriod != null
        ? Number(row.waitingPeriod)
        : row.waiting_period_days != null
          ? Number(row.waiting_period_days)
          : undefined,
    maxAge: row.maxAge != null ? Number(row.maxAge) : row.max_age != null ? Number(row.max_age) : undefined,
    minAge: row.minAge != null ? Number(row.minAge) : row.min_age != null ? Number(row.min_age) : undefined,
  };
}

export function InsuranceVendorContainer({ vendorId, vendorData, onBack }: InsuranceVendorContainerProps) {
  const router = useRouter();
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<InsurancePlan | null>(null);
  const [stats, setStats] = useState({
    totalPlans: 0,
    publishedPlans: 0,
    totalPolicies: 0,
    activePolicies: 0,
  });

  const [formData, setFormData] = useState<InsurancePlan>({
    name: '',
    description: '',
    price: 0,
    period: 'month',
    coverage: 0,
    deductible: 0,
    features: [],
    isPublished: false,
    category: 'basic',
    waitingPeriod: 0,
    maxAge: 15,
    minAge: 0,
  });

  const [newFeature, setNewFeature] = useState('');

  useEffect(() => {
    loadPlans();
    loadStats();
  }, [vendorId]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/insurance/plans`);
      const raw = response.plans || response.services || [];
      const plansList = Array.isArray(raw) ? raw.map((r) => normalizeVendorInsurancePlan(r as Record<string, unknown>)) : [];
      setPlans(plansList);
    } catch (error: any) {
      console.error('Error loading plans:', error);
      // Fallback to empty list
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/insurance/stats`);
      setStats(response.stats || {
        totalPlans: plans.length,
        publishedPlans: plans.filter(p => p.isPublished).length,
        totalPolicies: 0,
        activePolicies: 0,
      });
    } catch (error) {
      // Use default stats
      setStats({
        totalPlans: plans.length,
        publishedPlans: plans.filter(p => p.isPublished).length,
        totalPolicies: 0,
        activePolicies: 0,
      });
    }
  };

  const handleCreatePlan = async () => {
    if (!formData.name || !formData.description || formData.price <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        vendorId,
        ...formData,
        serviceType: 'insurance',
        category: 'insurance',
        serviceStyle: 'product',
      };

      if (editingPlan?.id) {
        // Update existing plan
        const response = await apiClient.put<any>(`/vendor/${vendorId}/insurance/plans/${editingPlan.id}`, payload);
        toast.success('Plan updated successfully!');
      } else {
        // Create new plan
        const response = await apiClient.post<any>(`/vendor/${vendorId}/insurance/plans`, payload);
        toast.success('Plan created successfully!');
      }

      setShowCreateModal(false);
      setEditingPlan(null);
      resetForm();
      loadPlans();
      loadStats();
    } catch (error: any) {
      console.error('Error creating plan:', error);
      toast.error(error.message || 'Failed to create plan');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishToggle = async (plan: InsurancePlan) => {
    try {
      const updatedPlan = { ...plan, isPublished: !plan.isPublished };
      await apiClient.put<any>(`/vendor/${vendorId}/insurance/plans/${plan.id}`, updatedPlan);
      toast.success(updatedPlan.isPublished ? 'Plan published!' : 'Plan unpublished');
      loadPlans();
    } catch (error: any) {
      toast.error('Failed to update plan status');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      await apiClient.delete<any>(`/vendor/${vendorId}/insurance/plans/${planId}`);
      toast.success('Plan deleted successfully!');
      loadPlans();
      loadStats();
    } catch (error: any) {
      toast.error('Failed to delete plan');
    }
  };

  const handleEditPlan = (plan: InsurancePlan) => {
    setEditingPlan(plan);
    setFormData(plan);
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      period: 'month',
      coverage: 0,
      deductible: 0,
      features: [],
      isPublished: false,
      category: 'basic',
      waitingPeriod: 0,
      maxAge: 15,
      minAge: 0,
    });
    setNewFeature('');
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setFormData({
        ...formData,
        features: [...formData.features, newFeature.trim()],
      });
      setNewFeature('');
    }
  };

  const removeFeature = (index: number) => {
    setFormData({
      ...formData,
      features: formData.features.filter((_, i) => i !== index),
    });
  };

  if (loading && plans.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Insurance Policy Management</h1>
            <p className="text-gray-600 mt-1">Create and manage insurance plans for pets</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {onBack && (
              <Button variant="outline" onClick={onBack}>
                ← Back
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push('/insurance/policies')}>
              <Shield className="w-4 h-4 mr-2" />
              Issued policies
            </Button>
            <Button variant="outline" onClick={() => router.push('/insurance/claims')}>
              <ClipboardList className="w-4 h-4 mr-2" />
              Claims
            </Button>
            <Button onClick={() => { resetForm(); setEditingPlan(null); setShowCreateModal(true); }} className="bg-orange-500 hover:bg-orange-600">
              <Plus className="w-4 h-4 mr-2" />
              Create Plan
            </Button>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Use <strong>Issued policies</strong> to track customer coverage, consent checkpoints, and lifecycle status. Plans you create here are what customers can buy.
        </p>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Plans</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPlans}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Published</p>
                <p className="text-2xl font-bold text-green-600">{stats.publishedPlans}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Policies</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPolicies}</p>
              </div>
              <Shield className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Policies</p>
                <p className="text-2xl font-bold text-orange-600">{stats.activePolicies}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </Card>
        </div>

        {/* Plans List */}
        <div className="space-y-4">
          {plans.length === 0 ? (
            <Card className="p-12 text-center">
              <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Plans Created</h3>
              <p className="text-gray-600 mb-4">Create your first insurance plan to get started</p>
              <Button onClick={() => { resetForm(); setShowCreateModal(true); }} className="bg-orange-500 hover:bg-orange-600">
                <Plus className="w-4 h-4 mr-2" />
                Create First Plan
              </Button>
            </Card>
          ) : (
            plans.map((plan) => (
              <Card key={plan.id || plan.name} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                      {plan.isPublished ? (
                        <Badge className="bg-green-500">Published</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </div>
                    <p className="text-gray-600 mb-4">{plan.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Price</p>
                        <p className="font-semibold text-gray-900">₹{plan.price}/{plan.period}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Coverage</p>
                        <p className="font-semibold text-gray-900">₹{plan.coverage.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Deductible</p>
                        <p className="font-semibold text-gray-900">₹{plan.deductible}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Features</p>
                        <p className="font-semibold text-gray-900">{plan.features?.length || 0}</p>
                      </div>
                    </div>

                    {plan.features && plan.features.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Features:</p>
                        <div className="flex flex-wrap gap-2">
                          {plan.features.slice(0, 5).map((feature, idx) => (
                            <Badge key={idx} variant="outline">{feature}</Badge>
                          ))}
                          {plan.features.length > 5 && (
                            <Badge variant="outline">+{plan.features.length - 5} more</Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePublishToggle(plan)}
                    >
                      {plan.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditPlan(plan)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => plan.id && handleDeletePlan(plan.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingPlan ? 'Edit Plan' : 'Create New Insurance Plan'}
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => { setShowCreateModal(false); resetForm(); }}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Plan Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Basic Coverage, Comprehensive Plan"
                    />
                  </div>

                  <div>
                    <Label>Description *</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe what this plan covers..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Price (₹) *</Label>
                      <Input
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                        placeholder="299"
                      />
                    </div>
                    <div>
                      <Label>Period *</Label>
                      <select
                        value={formData.period}
                        onChange={(e) => setFormData({ ...formData, period: e.target.value as 'month' | 'year' })}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="month">Monthly</option>
                        <option value="year">Yearly</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Coverage Amount (₹) *</Label>
                      <Input
                        type="number"
                        value={formData.coverage}
                        onChange={(e) => setFormData({ ...formData, coverage: Number(e.target.value) })}
                        placeholder="50000"
                      />
                    </div>
                    <div>
                      <Label>Deductible (₹) *</Label>
                      <Input
                        type="number"
                        value={formData.deductible}
                        onChange={(e) => setFormData({ ...formData, deductible: Number(e.target.value) })}
                        placeholder="2000"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Min Age (years)</Label>
                      <Input
                        type="number"
                        value={formData.minAge}
                        onChange={(e) => setFormData({ ...formData, minAge: Number(e.target.value) })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label>Max Age (years)</Label>
                      <Input
                        type="number"
                        value={formData.maxAge}
                        onChange={(e) => setFormData({ ...formData, maxAge: Number(e.target.value) })}
                        placeholder="15"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Waiting Period (days)</Label>
                    <Input
                      type="number"
                      value={formData.waitingPeriod}
                      onChange={(e) => setFormData({ ...formData, waitingPeriod: Number(e.target.value) })}
                      placeholder="30"
                    />
                  </div>

                  <div>
                    <Label>Category</Label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="basic">Basic</option>
                      <option value="comprehensive">Comprehensive</option>
                      <option value="premium">Premium</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  <div>
                    <Label>Features</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={newFeature}
                        onChange={(e) => setNewFeature(e.target.value)}
                        placeholder="Add a feature (e.g., Accident coverage)"
                        onKeyPress={(e) => e.key === 'Enter' && addFeature()}
                      />
                      <Button type="button" onClick={addFeature}>Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.features.map((feature, idx) => (
                        <Badge key={idx} className="flex items-center gap-1">
                          {feature}
                          <button onClick={() => removeFeature(idx)} className="ml-1">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isPublished"
                      checked={formData.isPublished}
                      onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="isPublished">Publish immediately</Label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setShowCreateModal(false); resetForm(); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-orange-500 hover:bg-orange-600"
                      onClick={handleCreatePlan}
                      disabled={loading}
                    >
                      {editingPlan ? 'Update Plan' : 'Create Plan'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
