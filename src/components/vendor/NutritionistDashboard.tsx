import React, { useState, useEffect } from 'react';
import { Calendar, Users, FileText, Plus } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Button } from '../ui/button';

/**
 * 🥗 NUTRITIONIST VENDOR DASHBOARD
 * Phase 7B: Rule 8 - Vendor management for consultations & meal plans
 */

export default function NutritionistDashboard({ vendorId }: { vendorId: string }) {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [mealPlans, setMealPlans] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'consultations' | 'meal-plans'>('consultations');
  const [showCreateMealPlan, setShowCreateMealPlan] = useState(false);
  const [mealPlanForm, setMealPlanForm] = useState({
    customerId: '',
    petId: '',
    planName: '',
    description: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchConsultations();
    fetchMealPlans();
  }, [vendorId]);

  const fetchConsultations = async () => {
    // Fetch vendor's consultations - simplified for now
    setConsultations([]);
  };

  const fetchMealPlans = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/nutritionist/${vendorId}/meal-plans`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await response.json();
      if (data.success) setMealPlans(data.data.mealPlans || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const createMealPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/nutritionist/meal-plan/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            ...mealPlanForm,
            nutritionistId: vendorId,
            meals: [],
            nutritionalGoals: {},
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        alert('Meal plan created!');
        setShowCreateMealPlan(false);
        fetchMealPlans();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-gray-900">Nutritionist Dashboard</h1>
          <Button onClick={() => setShowCreateMealPlan(true)}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Meal Plan
          </Button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              <Button onClick={() => setActiveTab('consultations')} className={`px-6 py-4 ${
                  activeTab === 'consultations'
                    ? 'border-b-2 border-orange-500 text-orange-500'
                    : 'text-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  <span>Consultations</span>
                </div>
              </Button>
              <Button onClick={() => setActiveTab('meal-plans')} className={`px-6 py-4 ${
                  activeTab === 'meal-plans'
                    ? 'border-b-2 border-orange-500 text-orange-500'
                    : 'text-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  <span>Meal Plans</span>
                </div>
              </Button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'consultations' && (
              <div>
                {consultations.length === 0 ? (
                  <p className="text-gray-600 text-center py-12">No consultations yet</p>
                ) : (
                  <div className="space-y-4">
                    {consultations.map((c) => (
                      <div key={c.consultationId} className="bg-gray-50 rounded-lg p-4">
                        <h3 className="text-gray-900">{c.consultationType}</h3>
                        <p className="text-gray-600 text-sm">{new Date(c.scheduledAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'meal-plans' && (
              <div>
                {mealPlans.length === 0 ? (
                  <p className="text-gray-600 text-center py-12">No meal plans created yet</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {mealPlans.map((plan) => (
                      <div key={plan.planId} className="bg-gray-50 rounded-lg p-4">
                        <h3 className="text-gray-900 mb-2">{plan.planName}</h3>
                        <p className="text-gray-600 text-sm mb-3">{plan.description}</p>
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>{new Date(plan.startDate).toLocaleDateString()}</span>
                          <span className={`px-2 py-1 rounded ${
                            plan.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {plan.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Create Meal Plan Modal */}
        {showCreateMealPlan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
              <h2 className="text-gray-900 mb-4">Create Meal Plan</h2>
              <form onSubmit={createMealPlan} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Customer ID</label>
                    <input
                      type="text"
                      value={mealPlanForm.customerId}
                      onChange={(e) => setMealPlanForm({ ...mealPlanForm, customerId: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Pet ID</label>
                    <input
                      type="text"
                      value={mealPlanForm.petId}
                      onChange={(e) => setMealPlanForm({ ...mealPlanForm, petId: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Plan Name</label>
                  <input
                    type="text"
                    value={mealPlanForm.planName}
                    onChange={(e) => setMealPlanForm({ ...mealPlanForm, planName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Description</label>
                  <textarea
                    value={mealPlanForm.description}
                    onChange={(e) => setMealPlanForm({ ...mealPlanForm, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={mealPlanForm.startDate}
                      onChange={(e) => setMealPlanForm({ ...mealPlanForm, startDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={mealPlanForm.endDate}
                      onChange={(e) => setMealPlanForm({ ...mealPlanForm, endDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    className="flex-1 bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600"
                  >
                    Create Plan
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowCreateMealPlan(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
