import { useState, useEffect } from 'react';
import { X, Plus, Calendar, Utensils, TrendingUp, Save, Edit2, Trash2, Search } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { Button } from '../ui/button';

interface DietChartsProps {
  vendorId: string;
  onClose: () => void;
}

interface DietChart {
  id: string;
  petId: string;
  petName: string;
  customerName: string;
  chartName: string;
  startDate: string;
  endDate?: string;
  goalWeight?: number;
  currentWeight?: number;
  dietType: 'weight_loss' | 'weight_gain' | 'maintenance' | 'medical' | 'custom';
  meals: Meal[];
  supplements?: string[];
  restrictions?: string[];
  notes?: string;
  createdAt: string;
  status: 'active' | 'completed' | 'paused';
}

interface Meal {
  time: string;
  name: string;
  portions: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  instructions?: string;
}

export function VendorDietCharts({ vendorId, onClose }: DietChartsProps) {
  const [charts, setCharts] = useState<DietChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedChart, setSelectedChart] = useState<DietChart | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');

  // Form state
  const [formData, setFormData] = useState({
    petId: '',
    petName: '',
    customerName: '',
    chartName: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    goalWeight: '',
    currentWeight: '',
    dietType: 'maintenance' as DietChart['dietType'],
    meals: [] as Meal[],
    supplements: [] as string[],
    restrictions: [] as string[],
    notes: ''
  });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchDietCharts();
  }, [vendorId, filter]);

  const fetchDietCharts = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/vendor/diet-charts/${vendorId}?status=${filter === 'all' ? '' : filter}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      const data = await response.json();
      if (data.success) {
        setCharts(data.charts || []);
      }
    } catch (error) {
      console.error('Error fetching diet charts:', error);
      toast.error('Failed to load diet charts');
    } finally {
      setLoading(false);
    }
  };

  const saveDietChart = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/vendor/diet-charts/${vendorId}${selectedChart ? `/${selectedChart.id}` : ''}`,
        {
          method: selectedChart ? 'PUT' : 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success(`Diet chart ${selectedChart ? 'updated' : 'created'} successfully`);
        setShowCreateModal(false);
        setSelectedChart(null);
        resetForm();
        fetchDietCharts();
      } else {
        toast.error(data.error || 'Failed to save diet chart');
      }
    } catch (error) {
      console.error('Error saving diet chart:', error);
      toast.error('Failed to save diet chart');
    }
  };

  const deleteDietChart = async (chartId: string) => {
    if (!confirm('Are you sure you want to delete this diet chart?')) return;

    try {
      const response = await fetch(
        `${API_BASE}/vendor/diet-charts/${vendorId}/${chartId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Diet chart deleted');
        fetchDietCharts();
      }
    } catch (error) {
      console.error('Error deleting chart:', error);
      toast.error('Failed to delete chart');
    }
  };

  const addMeal = () => {
    setFormData({
      ...formData,
      meals: [...formData.meals, {
        time: '',
        name: '',
        portions: '',
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        instructions: ''
      }]
    });
  };

  const removeMeal = (index: number) => {
    setFormData({
      ...formData,
      meals: formData.meals.filter((_, i) => i !== index)
    });
  };

  const updateMeal = (index: number, field: keyof Meal, value: any) => {
    const updatedMeals = [...formData.meals];
    updatedMeals[index] = { ...updatedMeals[index], [field]: value };
    setFormData({ ...formData, meals: updatedMeals });
  };

  const resetForm = () => {
    setFormData({
      petId: '',
      petName: '',
      customerName: '',
      chartName: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      goalWeight: '',
      currentWeight: '',
      dietType: 'maintenance',
      meals: [],
      supplements: [],
      restrictions: [],
      notes: ''
    });
  };

  const filteredCharts = charts.filter(chart => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        chart.petName.toLowerCase().includes(query) ||
        chart.customerName.toLowerCase().includes(query) ||
        chart.chartName.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const stats = {
    active: charts.filter(c => c.status === 'active').length,
    completed: charts.filter(c => c.status === 'completed').length,
    total: charts.length
  };

  return (
    <div className="fixed inset-0 bg-[#FF8C42] black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#FF8C42] white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-[#FF8C42] gradient-to-r from-green-50 to-emerald-50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Utensils className="w-7 h-7 text-green-600" />
                Diet Charts
              </h2>
              <p className="text-sm text-gray-600 mt-1">Create and manage pet nutrition plans</p>
            </div>
            <Button onClick={onClose} className="p-2 hover:bg-[#FF8C42] white rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-500" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#FF8C42] white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-600">Total Charts</div>
            </div>
            <div className="bg-[#FF8C42] green-50 rounded-lg p-3 text-center border border-green-200">
              <div className="text-2xl font-bold text-green-700">{stats.active}</div>
              <div className="text-xs text-green-700">Active</div>
            </div>
            <div className="bg-[#FF8C42] blue-50 rounded-lg p-3 text-center border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">{stats.completed}</div>
              <div className="text-xs text-blue-700">Completed</div>
            </div>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="p-4 border-b border-gray-200 bg-[#FF8C42] gray-50">
          <div className="flex gap-3 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by pet name, customer, or chart name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <Button onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-[#FF8C42] green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Chart
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'all' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              All
            </Button>
            <Button onClick={() => setFilter('active')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'active' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Active ({stats.active})
            </Button>
            <Button onClick={() => setFilter('completed')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'completed' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Completed
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-gray-600">Loading diet charts...</p>
            </div>
          ) : filteredCharts.length === 0 ? (
            <div className="text-center py-12">
              <Utensils className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No diet charts found</p>
              <Button onClick={() => setShowCreateModal(true)}
                className="mt-4 px-6 py-2 bg-green-600 hover:bg-[#FF8C42] green-700 text-white rounded-lg font-medium transition-colors"
              >
                Create First Chart
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCharts.map((chart) => (
                <div
                  key={chart.id}
                  className="bg-[#FF8C42] white border-2 border-gray-200 rounded-xl p-4 hover:border-green-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{chart.chartName}</h3>
                      <div className="text-sm text-gray-600 mt-1">{chart.petName} - {chart.customerName}</div>
                      <div className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                        chart.status === 'active' ? 'bg-green-100 text-green-700' :
                        chart.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {chart.status.toUpperCase()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button onClick={() => {
                          setSelectedChart(chart);
                          setFormData(chart as any);
                          setShowCreateModal(true);
                        }}
                        className="p-2 hover:bg-[#FF8C42] gray-100 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </Button>
                      <Button onClick={() => deleteDietChart(chart.id)}
                        className="p-2 hover:bg-[#FF8C42] red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-[#FF8C42] gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-600 mb-1">Diet Type</div>
                      <div className="text-sm font-medium text-gray-900 capitalize">
                        {chart.dietType.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="bg-[#FF8C42] gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-600 mb-1">Duration</div>
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(chart.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {chart.goalWeight && chart.currentWeight && (
                    <div className="bg-[#FF8C42] green-50 border border-green-200 rounded-lg p-2 mb-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">Progress:</span>
                        <span className="font-medium text-green-700">
                          {chart.currentWeight}kg → {chart.goalWeight}kg
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-gray-600">
                    <div className="flex items-center gap-2 mb-1">
                      <Utensils className="w-4 h-4" />
                      <span>{chart.meals?.length || 0} meals/day</span>
                    </div>
                    {chart.supplements && chart.supplements.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Supplements: {chart.supplements.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="absolute inset-0 bg-[#FF8C42] black/50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#FF8C42] white rounded-xl p-6 max-w-2xl w-full my-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {selectedChart ? 'Edit' : 'Create'} Diet Chart
              </h3>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pet Name</label>
                    <input
                      type="text"
                      value={formData.petName}
                      onChange={(e) => setFormData({ ...formData, petName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., Max"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                    <input
                      type="text"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chart Name</label>
                  <input
                    type="text"
                    value={formData.chartName}
                    onChange={(e) => setFormData({ ...formData, chartName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., Weight Loss Plan - Week 1"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diet Type</label>
                    <select
                      value={formData.dietType}
                      onChange={(e) => setFormData({ ...formData, dietType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="maintenance">Maintenance</option>
                      <option value="weight_loss">Weight Loss</option>
                      <option value="weight_gain">Weight Gain</option>
                      <option value="medical">Medical</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Weight (kg)</label>
                    <input
                      type="number"
                      value={formData.currentWeight}
                      onChange={(e) => setFormData({ ...formData, currentWeight: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="15"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Goal Weight (kg)</label>
                    <input
                      type="number"
                      value={formData.goalWeight}
                      onChange={(e) => setFormData({ ...formData, goalWeight: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="12"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Meals</label>
                    <Button onClick={addMeal}
                      className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add Meal
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.meals.map((meal, idx) => (
                      <div key={idx} className="border border-gray-300 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <input
                            type="text"
                            value={meal.name}
                            onChange={(e) => updateMeal(idx, 'name', e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Meal name"
                          />
                          <Button onClick={() => removeMeal(idx)}
                            className="ml-2 p-1 text-red-600 hover:bg-[#FF8C42] red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <input
                            type="text"
                            value={meal.time}
                            onChange={(e) => updateMeal(idx, 'time', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded"
                            placeholder="Time (8:00 AM)"
                          />
                          <input
                            type="text"
                            value={meal.portions}
                            onChange={(e) => updateMeal(idx, 'portions', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded"
                            placeholder="Portions (1 cup)"
                          />
                          <input
                            type="number"
                            value={meal.calories}
                            onChange={(e) => updateMeal(idx, 'calories', Number(e.target.value))}
                            className="px-2 py-1 border border-gray-300 rounded"
                            placeholder="Calories"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    rows={3}
                    placeholder="Additional instructions or notes..."
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button onClick={() => {
                    setShowCreateModal(false);
                    setSelectedChart(null);
                    resetForm();
                  }}
                  className="flex-1 py-2 px-4 bg-gray-100 hover:bg-[#FF8C42] gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </Button>
                <Button onClick={saveDietChart}
                  className="flex-1 py-2 px-4 bg-green-600 hover:bg-[#FF8C42] green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {selectedChart ? 'Update' : 'Create'} Chart
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
