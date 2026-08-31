'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { Plus, Edit2, Trash2, Shield } from 'lucide-react';

interface InsurancePlan {
  id: string;
  name: string;
  description: string;
  plan_type: 'comprehensive' | 'accident_only' | 'illness_only' | 'wellness' | 'custom';
  coverage_amount: number;
  premium: number;
  deductible: number;
  pet_types: string[];
  age_min?: number;
  age_max?: number;
  is_active: boolean;
  created_at: string;
}

function toMaybeNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Legacy rows often have monthly_premium set but premium_monthly still 0 */
function pickPremium(row: Record<string, unknown>): number {
  const candidates = [
    toMaybeNum(row.premium_monthly),
    toMaybeNum(row.monthly_premium),
    toMaybeNum(row.premium),
    toMaybeNum(row.premiumMonthly),
    toMaybeNum(row.monthlyPremium),
  ];
  for (const n of candidates) {
    if (n != null && n > 0) return n;
  }
  for (const n of candidates) {
    if (n != null) return n;
  }
  return 0;
}

function parseCoverageDetails(row: Record<string, unknown>): {
  pet_types?: string[];
  age_min?: number;
  age_max?: number;
} {
  const raw = row.coverage_details;
  let o: Record<string, unknown> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    o = raw as Record<string, unknown>;
  } else if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object' && !Array.isArray(p)) o = p as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  const petRaw = o.pet_types ?? o.petTypes;
  const pet_types = Array.isArray(petRaw) ? (petRaw as string[]) : undefined;
  const age_min = toMaybeNum(o.age_min ?? o.ageMin) ?? undefined;
  const age_max = toMaybeNum(o.age_max ?? o.ageMax) ?? undefined;
  return { pet_types, age_min, age_max };
}

/** API returns RDS rows (plan_name, premium_monthly, …) — map to UI shape */
function normalizeInsurancePlanRow(row: Record<string, unknown>): InsurancePlan {
  const cd = parseCoverageDetails(row);
  const petTypesRaw = row.pet_types ?? row.petTypes ?? cd.pet_types;
  const pet_types = Array.isArray(petTypesRaw) ? (petTypesRaw as string[]) : [];

  const rawType = String(row.plan_type ?? row.planType ?? 'comprehensive').toLowerCase();
  let plan_type: InsurancePlan['plan_type'] = 'comprehensive';
  if (['comprehensive', 'accident_only', 'illness_only', 'wellness', 'custom'].includes(rawType)) {
    plan_type = rawType as InsurancePlan['plan_type'];
  } else if (rawType === 'lifetime' || rawType === 'maximum_benefit' || rawType === 'time_limited') {
    plan_type = String(rawType) === 'accident_only' ? 'accident_only' : 'comprehensive';
  }

  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? row.plan_name ?? 'Plan'),
    description: String(row.description ?? ''),
    plan_type,
    coverage_amount:
      toMaybeNum(row.coverage_amount) ??
      toMaybeNum(row.coverageAmount) ??
      toMaybeNum(row.coverage) ??
      0,
    premium: pickPremium(row),
    deductible: toMaybeNum(row.deductible) ?? 0,
    pet_types,
    age_min:
      row.age_min != null
        ? Number(row.age_min)
        : row.min_age != null
          ? Number(row.min_age)
          : cd.age_min,
    age_max:
      row.age_max != null
        ? Number(row.age_max)
        : row.max_age != null
          ? Number(row.max_age)
          : cd.age_max,
    is_active: row.is_active !== false && row.isActive !== false,
    created_at: String(row.created_at ?? row.createdAt ?? ''),
  };
}

/** When API Gateway runs an older Lambda, DB rows miss premium/pets/ages — cache last save per plan */
type PlanFieldPatch = {
  premium: number;
  deductible: number;
  pet_types: string[];
  age_min?: number;
  age_max?: number;
};

function patchesKey(vendorId: string) {
  return `warmpawz_ins_plan_fields_v1_${vendorId}`;
}

function readPlanPatches(vendorId: string): Record<string, PlanFieldPatch> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(sessionStorage.getItem(patchesKey(vendorId)) || '{}');
  } catch {
    return {};
  }
}

function writePlanPatches(vendorId: string, patches: Record<string, PlanFieldPatch>) {
  sessionStorage.setItem(patchesKey(vendorId), JSON.stringify(patches));
}

function recordPlanPatch(vendorId: string, planId: string, patch: PlanFieldPatch) {
  const all = readPlanPatches(vendorId);
  all[planId] = patch;
  writePlanPatches(vendorId, all);
}

function removePlanPatch(vendorId: string, planId: string) {
  const all = readPlanPatches(vendorId);
  delete all[planId];
  writePlanPatches(vendorId, all);
}

function applyPlanFieldPatches(vendorId: string, plans: InsurancePlan[]): InsurancePlan[] {
  const patches = readPlanPatches(vendorId);
  const next: Record<string, PlanFieldPatch> = { ...patches };

  const merged = plans.map((plan) => {
    const patch = next[plan.id];
    if (!patch) return plan;

    const petsEqual =
      JSON.stringify([...(plan.pet_types ?? [])].sort()) ===
      JSON.stringify([...(patch.pet_types ?? [])].sort());
    const premiumOk = plan.premium > 0 && Math.abs(plan.premium - patch.premium) < 0.01;
    const dedOk = Math.abs(plan.deductible - patch.deductible) < 0.01;
    const ageOk =
      plan.age_min === patch.age_min &&
      plan.age_max === patch.age_max;

    if (premiumOk && dedOk && petsEqual && ageOk) {
      delete next[plan.id];
      return plan;
    }

    return {
      ...plan,
      premium: !premiumOk && patch.premium > 0 ? patch.premium : plan.premium,
      deductible:
        plan.deductible === 0 && patch.deductible > 0 ? patch.deductible : plan.deductible,
      pet_types:
        (!plan.pet_types || plan.pet_types.length === 0) && (patch.pet_types?.length ?? 0) > 0
          ? patch.pet_types
          : plan.pet_types,
      age_min: plan.age_min == null && patch.age_min != null ? patch.age_min : plan.age_min,
      age_max: plan.age_max == null && patch.age_max != null ? patch.age_max : plan.age_max,
    };
  });

  writePlanPatches(vendorId, next);
  return merged;
}

export default function InsurancePlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<InsurancePlan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    plan_type: 'comprehensive' as InsurancePlan['plan_type'],
    coverage_amount: '',
    premium: '',
    deductible: '',
    pet_types: [] as string[],
    age_min: '',
    age_max: '',
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        router.push('/');
        return;
      }
      const response = await apiClient.get<any>(`/vendor/${vendorId}/insurance/plans`);
      const raw = response.plans ?? response.services ?? [];
      const list = Array.isArray(raw) ? raw : [];
      if (response.success || response.plans || list.length) {
        const normalized = list.map((r: Record<string, unknown>) => normalizeInsurancePlanRow(r));
        setPlans(applyPlanFieldPatches(vendorId, normalized));
      } else {
        setPlans([]);
      }
    } catch (error: any) {
      console.error('Error loading insurance plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;

      const payload = {
        ...formData,
        coverage_amount: parseFloat(formData.coverage_amount) || 0,
        premium: parseFloat(formData.premium) || 0,
        deductible: parseFloat(formData.deductible) || 0,
        age_min: formData.age_min ? parseInt(formData.age_min, 10) : undefined,
        age_max: formData.age_max ? parseInt(formData.age_max, 10) : undefined,
      };

      const patch: PlanFieldPatch = {
        premium: payload.premium,
        deductible: payload.deductible,
        pet_types: Array.isArray(payload.pet_types) ? payload.pet_types : [],
        age_min: payload.age_min,
        age_max: payload.age_max,
      };

      if (editingPlan) {
        await apiClient.put(`/vendor/${vendorId}/insurance/plans/${editingPlan.id}`, payload);
        recordPlanPatch(vendorId, editingPlan.id, patch);
      } else {
        const res = (await apiClient.post(`/vendor/${vendorId}/insurance/plans`, payload)) as {
          plan?: { id?: string };
        };
        const newId = res?.plan?.id != null ? String(res.plan.id) : '';
        if (newId) recordPlanPatch(vendorId, newId, patch);
      }
      setShowAddModal(false);
      setEditingPlan(null);
      resetForm();
      loadPlans();
    } catch (error: any) {
      alert(error.message || 'Failed to save insurance plan');
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this insurance plan?')) return;
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;
      await apiClient.delete(`/vendor/${vendorId}/insurance/plans/${planId}`);
      removePlanPatch(vendorId, planId);
      loadPlans();
    } catch (error: any) {
      alert(error.message || 'Failed to delete insurance plan');
    }
  };

  const togglePetType = (petType: string) => {
    setFormData({
      ...formData,
      pet_types: formData.pet_types.includes(petType)
        ? formData.pet_types.filter(t => t !== petType)
        : [...formData.pet_types, petType],
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      plan_type: 'comprehensive',
      coverage_amount: '',
      premium: '',
      deductible: '',
      pet_types: [],
      age_min: '',
      age_max: '',
    });
  };

  const openEditModal = (plan: InsurancePlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description,
      plan_type: plan.plan_type,
      coverage_amount: plan.coverage_amount.toString(),
      premium: plan.premium.toString(),
      deductible: plan.deductible.toString(),
      pet_types: plan.pet_types,
      age_min: plan.age_min?.toString() || '',
      age_max: plan.age_max?.toString() || '',
    });
    setShowAddModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const petTypes = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'];
  const planTypes = [
    { value: 'comprehensive', label: 'Comprehensive' },
    { value: 'accident_only', label: 'Accident Only' },
    { value: 'illness_only', label: 'Illness Only' },
    { value: 'wellness', label: 'Wellness' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="📋 Insurance Plans"
          subtitle="Create and manage pet insurance plans"
          onBack={() => router.back()}
          actions={[
            <button
              key="create-plan"
              type="button"
              onClick={() => {
                resetForm();
                setEditingPlan(null);
                setShowAddModal(true);
              }}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 transition"
            >
              <Plus className="h-5 w-5 shrink-0" />
              Create Plan
            </button>,
          ]}
        />

        <main className="w-full px-4 py-6 sm:px-6">
        {plans.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No insurance plans yet</h3>
            <p className="text-gray-500 mb-4">Create your first insurance plan to start offering coverage</p>
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              Create First Plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white rounded-xl p-6 shadow-sm border-2 transition ${
                  plan.is_active ? 'border-green-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                    <p className="text-sm text-gray-500 mt-1 capitalize">{(plan.plan_type || 'plan').replace(/_/g, ' ')}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      plan.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Coverage:</span>
                    <span className="font-medium text-gray-900">₹{plan.coverage_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Premium:</span>
                    <span className="font-bold text-orange-600">₹{plan.premium}/month</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Deductible:</span>
                    <span className="font-medium text-gray-900">₹{plan.deductible}</span>
                  </div>
                </div>

                {(plan.age_min != null || plan.age_max != null) && (
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">Age range:</span>
                    <span className="font-medium text-gray-900">
                      {plan.age_min ?? '—'} – {plan.age_max ?? '—'} mo
                    </span>
                  </div>
                )}

                <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Pet Types:</p>
                  <div className="flex flex-wrap gap-1">
                    {(plan.pet_types ?? []).length === 0 ? (
                      <span className="text-xs text-gray-400">None selected</span>
                    ) : (
                      (plan.pet_types ?? []).map((type) => (
                      <span
                        key={type}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                      >
                        {type}
                      </span>
                    ))
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(plan)}
                    className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                  >
                    <Edit2 className="w-4 h-4 inline mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingPlan ? 'Edit Insurance Plan' : 'Create New Insurance Plan'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., Comprehensive Pet Insurance"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe the insurance plan..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan Type
                </label>
                <select
                  value={formData.plan_type}
                  onChange={(e) => setFormData({ ...formData, plan_type: e.target.value as InsurancePlan['plan_type'] })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {planTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Coverage (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.coverage_amount}
                    onChange={(e) => setFormData({ ...formData, coverage_amount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Premium (₹/month)
                  </label>
                  <input
                    type="number"
                    value={formData.premium}
                    onChange={(e) => setFormData({ ...formData, premium: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deductible (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.deductible}
                    onChange={(e) => setFormData({ ...formData, deductible: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pet Types
                </label>
                <div className="flex flex-wrap gap-2">
                  {petTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => togglePetType(type)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                        formData.pet_types.includes(type)
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Age (months)
                  </label>
                  <input
                    type="number"
                    value={formData.age_min}
                    onChange={(e) => setFormData({ ...formData, age_min: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Optional"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Age (months)
                  </label>
                  <input
                    type="number"
                    value={formData.age_max}
                    onChange={(e) => setFormData({ ...formData, age_max: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Optional"
                    min="0"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingPlan(null);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium"
              >
                {editingPlan ? 'Update' : 'Create'} Plan
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

