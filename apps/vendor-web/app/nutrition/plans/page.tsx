'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { Plus, Edit2, Trash2, Utensils } from 'lucide-react';

interface MealPlan {
  id: string;
  name: string;
  description: string;
  pet_types: string[];
  duration_days: number;
  meals_per_day: number;
  price: number;
  is_active: boolean;
  created_at: string;
}

export default function MealPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MealPlan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    pet_types: [] as string[],
    duration_days: '7',
    meals_per_day: '2',
    price: '',
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
      const response = await apiClient.get<any>(`/vendor/${vendorId}/nutritionist/meal-plans`);
      if (response.success || response.mealPlans || response.plans) {
        setPlans(response.mealPlans || response.plans || []);
      }
    } catch (error: any) {
      console.error('Error loading meal plans:', error);
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
        duration_days: parseInt(formData.duration_days),
        meals_per_day: parseInt(formData.meals_per_day),
        price: parseFloat(formData.price),
      };

      if (editingPlan) {
        await apiClient.put(`/vendor/${vendorId}/nutrition/meal-plans/${editingPlan.id}`, payload);
      } else {
        await apiClient.post(`/vendor/${vendorId}/nutrition/meal-plans`, payload);
      }
      setShowAddModal(false);
      setEditingPlan(null);
      resetForm();
      loadPlans();
    } catch (error: any) {
      alert(error.message || 'Failed to save meal plan');
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this meal plan?')) return;
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;
      await apiClient.delete(`/vendor/${vendorId}/nutritionist/meal-plans/${planId}`);
      loadPlans();
    } catch (error: any) {
      alert(error.message || 'Failed to delete meal plan');
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
      pet_types: [],
      duration_days: '7',
      meals_per_day: '2',
      price: '',
    });
  };

  const openEditModal = (plan: MealPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description,
      pet_types: plan.pet_types,
      duration_days: plan.duration_days.toString(),
      meals_per_day: plan.meals_per_day.toString(),
      price: plan.price.toString(),
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

  const petTypes = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Other'];

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="🍲 Meal Plans"
          subtitle="Create and manage diet plans for pets"
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
            <div className="text-5xl mb-4">🍲</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No meal plans yet</h3>
            <p className="text-gray-500 mb-4">Create your first meal plan to start offering nutrition services</p>
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
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{plan.description}</p>
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
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium text-gray-900">{plan.duration_days} days</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Meals per day:</span>
                    <span className="font-medium text-gray-900">{plan.meals_per_day}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Price:</span>
                    <span className="font-bold text-orange-600">₹{plan.price}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">Pet Types:</p>
                  <div className="flex flex-wrap gap-1">
                    {plan.pet_types?.map((type) => (
                      <span
                        key={type}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                      >
                        {type}
                      </span>
                    ))}
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
              {editingPlan ? 'Edit Meal Plan' : 'Create New Meal Plan'}
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
                  placeholder="e.g., Premium Dog Nutrition Plan"
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
                  placeholder="Describe the meal plan..."
                />
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
                    Duration (days)
                  </label>
                  <select
                    value={formData.duration_days}
                    onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meals per Day
                  </label>
                  <select
                    value={formData.meals_per_day}
                    onChange={(e) => setFormData({ ...formData, meals_per_day: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="1">1 meal</option>
                    <option value="2">2 meals</option>
                    <option value="3">3 meals</option>
                    <option value="4">4 meals</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price (₹)
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
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

