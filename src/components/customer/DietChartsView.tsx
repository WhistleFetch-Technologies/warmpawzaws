import { useState, useEffect } from 'react';
import { ArrowLeft, Utensils, Calendar, TrendingUp, Target, CheckCircle, Search, Clock } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

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

interface DietChartsViewProps {
  customerId: string;
  petId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function DietChartsView({ customerId, petId, onBack, onNavigate }: DietChartsViewProps) {
  const [charts, setCharts] = useState<DietChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChart, setSelectedChart] = useState<DietChart | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadCharts();
  }, [customerId, petId]);

  const loadCharts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (petId) params.append('petId', petId);

      const response = await fetch(
        `${API_BASE}/customer/diet-charts/${customerId}?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        const chartsList = data.charts || data.data?.charts || [];
        setCharts(chartsList);
        console.log('✅ Loaded diet charts:', chartsList.length);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load charts:', errorData);
        setCharts([]);
      }
    } catch (error: any) {
      console.error('Error loading charts:', error);
      const errorMessage = error?.message || 'Failed to load diet charts';
      toast.error(errorMessage);
      setCharts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadChartDetails = async (chartId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/customer/diet-charts/${customerId}/${chartId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        const chart = data.chart || data.data?.chart;
        if (chart) {
          setSelectedChart(chart);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(errorData.error || 'Failed to load chart details');
      }
    } catch (error: any) {
      console.error('Error loading chart details:', error);
      const errorMessage = error?.message || 'Failed to load chart details';
      toast.error(errorMessage);
    }
  };

  const filteredCharts = charts.filter(chart =>
    !searchQuery ||
    chart.chartName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chart.petName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getDietTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      weight_loss: 'Weight Loss',
      weight_gain: 'Weight Gain',
      maintenance: 'Maintenance',
      medical: 'Medical',
      custom: 'Custom'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading diet charts...</p>
        </div>
      </div>
    );
  }

  if (selectedChart) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
        <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
          <div className="px-4 py-3 flex items-center gap-3">
            <button 
              onClick={() => setSelectedChart(null)} 
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-semibold text-lg">Diet Chart Details</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Chart Info */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <h2 className="font-semibold text-lg mb-2">{selectedChart.chartName}</h2>
            <p className="text-sm text-gray-600 mb-3">For {selectedChart.petName}</p>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Diet Type</span>
                <span className="font-semibold">{getDietTypeLabel(selectedChart.dietType)}</span>
              </div>
              {selectedChart.currentWeight && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Current Weight</span>
                  <span className="font-semibold">{selectedChart.currentWeight} kg</span>
                </div>
              )}
              {selectedChart.goalWeight && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Goal Weight</span>
                  <span className="font-semibold">{selectedChart.goalWeight} kg</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Start Date</span>
                <span>{formatDate(selectedChart.startDate)}</span>
              </div>
              {selectedChart.endDate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">End Date</span>
                  <span>{formatDate(selectedChart.endDate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Meals */}
          {selectedChart.meals && selectedChart.meals.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="font-semibold mb-3">Daily Meals</h3>
              <div className="space-y-3">
                {selectedChart.meals.map((meal, idx) => (
                  <div key={idx} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-green-500" />
                        <span className="font-medium">{meal.time}</span>
                      </div>
                      <span className="text-sm text-gray-600">{meal.portions}</span>
                    </div>
                    <div className="text-sm font-semibold mb-1">{meal.name}</div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>Cal: {meal.calories}</span>
                      <span>P: {meal.protein}g</span>
                      <span>F: {meal.fat}g</span>
                      <span>C: {meal.carbs}g</span>
                    </div>
                    {meal.instructions && (
                      <p className="text-xs text-gray-600 mt-1">{meal.instructions}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supplements */}
          {selectedChart.supplements && selectedChart.supplements.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="font-semibold mb-2">Supplements</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {selectedChart.supplements.map((supplement, idx) => (
                  <li key={idx}>{supplement}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Restrictions */}
          {selectedChart.restrictions && selectedChart.restrictions.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="font-semibold mb-2">Restrictions</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {selectedChart.restrictions.map((restriction, idx) => (
                  <li key={idx}>{restriction}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {selectedChart.notes && (
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-sm text-gray-600">{selectedChart.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-lg">Diet Charts</h1>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search charts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </div>

      {/* Charts List */}
      <div className="p-4 space-y-3">
        {filteredCharts.length === 0 ? (
          <div className="text-center py-12">
            <Utensils className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No diet charts found</p>
          </div>
        ) : (
          filteredCharts.map((chart) => (
            <div
              key={chart.id}
              onClick={() => loadChartDetails(chart.id)}
              className="bg-white rounded-xl p-4 border border-gray-200 hover:border-green-500 transition-colors cursor-pointer"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{chart.chartName}</h3>
                    <p className="text-sm text-gray-600 mt-1">For {chart.petName}</p>
                  </div>
                  <div className={`px-2 py-1 text-xs rounded-full ${
                    chart.status === 'active' ? 'bg-green-100 text-green-700' :
                    chart.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {chart.status}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <span>{getDietTypeLabel(chart.dietType)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Started {formatDate(chart.startDate)}</span>
                  </div>
                </div>

                {chart.goalWeight && chart.currentWeight && (
                  <div className="flex items-center gap-2 text-xs">
                    <Target className="w-3 h-3 text-green-500" />
                    <span className="text-gray-600">
                      {chart.currentWeight} kg → {chart.goalWeight} kg
                    </span>
                  </div>
                )}

                {chart.meals && chart.meals.length > 0 && (
                  <div className="text-xs text-gray-500">
                    {chart.meals.length} meal{chart.meals.length !== 1 ? 's' : ''} per day
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

