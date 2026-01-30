import React, { useState, useEffect } from 'react';
import { Calendar, Clock, UtensilsCrossed, Apple, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

/**
 * 🍽️ MEAL PLAN VIEWER COMPONENT
 * 
 * Phase 7B: Critical Services - Rule 8 Implementation
 * 
 * Features:
 * - View assigned meal plans
 * - Daily meal schedule
 * - Nutritional information
 * - Shopping list generator
 */

interface MealItem {
  itemName: string;
  quantity: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  instructions?: string;
}

interface MealPlan {
  planId: string;
  customerId: string;
  petId: string;
  nutritionistId: string;
  planName: string;
  description: string;
  startDate: string;
  endDate: string;
  meals: Array<{
    day: string;
    breakfast?: MealItem;
    lunch?: MealItem;
    dinner?: MealItem;
    snacks?: MealItem[];
  }>;
  nutritionalGoals: {
    calories?: number;
    protein?: number;
    fat?: number;
    carbs?: number;
  };
  specialInstructions?: string;
  status: 'active' | 'completed' | 'discontinued';
  createdAt: string;
  updatedAt: string;
}

interface MealPlanViewerProps {
  customerId: string;
}

export default function MealPlanViewer({ customerId }: MealPlanViewerProps) {
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<MealPlan | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMealPlans();
  }, [customerId]);

  const fetchMealPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/customer/${customerId}/meal-plans`,
        {
          headers: {
            Authorization: (getAuthHeaders().Authorization || ""),
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setMealPlans(data.data.mealPlans || []);
        if (data.data.mealPlans.length > 0) {
          setSelectedPlan(data.data.mealPlans[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching meal plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDailyNutrition = (meals: any) => {
    let totals = { calories: 0, protein: 0, fat: 0, carbs: 0 };

    const addMeal = (meal?: MealItem) => {
      if (meal) {
        totals.calories += meal.calories || 0;
        totals.protein += meal.protein || 0;
        totals.fat += meal.fat || 0;
        totals.carbs += meal.carbs || 0;
      }
    };

    addMeal(meals.breakfast);
    addMeal(meals.lunch);
    addMeal(meals.dinner);
    meals.snacks?.forEach((snack: MealItem) => addMeal(snack));

    return totals;
  };

  const generateShoppingList = () => {
    if (!selectedPlan) return [];

    const ingredients = new Set<string>();
    selectedPlan.meals.forEach((dayMeal) => {
      const addIngredients = (meal?: MealItem) => {
        if (meal) {
          ingredients.add(`${meal.itemName} - ${meal.quantity}`);
        }
      };

      addIngredients(dayMeal.breakfast);
      addIngredients(dayMeal.lunch);
      addIngredients(dayMeal.dinner);
      dayMeal.snacks?.forEach(addIngredients);
    });

    return Array.from(ingredients);
  };

  const MealCard = ({ meal, mealType }: { meal?: MealItem; mealType: string }) => {
    if (!meal) return null;

    return (
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <UtensilsCrossed className="w-4 h-4 text-orange-500" />
          <span className="text-gray-900">{mealType}</span>
        </div>
        <h4 className="text-gray-900 mb-2">{meal.itemName}</h4>
        <p className="text-gray-600 text-sm mb-3">Quantity: {meal.quantity}</p>
        
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-orange-50 rounded px-2 py-1">
            <p className="text-xs text-gray-600">Calories</p>
            <p className="text-orange-600">{meal.calories} kcal</p>
          </div>
          <div className="bg-blue-50 rounded px-2 py-1">
            <p className="text-xs text-gray-600">Protein</p>
            <p className="text-blue-600">{meal.protein}g</p>
          </div>
          <div className="bg-red-50 rounded px-2 py-1">
            <p className="text-xs text-gray-600">Fat</p>
            <p className="text-red-600">{meal.fat}g</p>
          </div>
          <div className="bg-green-50 rounded px-2 py-1">
            <p className="text-xs text-gray-600">Carbs</p>
            <p className="text-green-600">{meal.carbs}g</p>
          </div>
        </div>

        {meal.instructions && (
          <div className="bg-gray-50 rounded p-2">
            <p className="text-xs text-gray-600">{meal.instructions}</p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (mealPlans.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg p-12 text-center">
            <Apple className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-900 mb-2">No Meal Plans Yet</h3>
            <p className="text-gray-600">Your nutritionist will create a personalized meal plan for your pet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-gray-900 mb-2">Meal Plans</h1>
          <p className="text-gray-600">View and manage your pet's nutrition plans</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Meal Plans List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-gray-900 mb-4">Your Plans</h3>
              <div className="space-y-2">
                {mealPlans.map((plan) => (
                  <button
                    key={plan.planId}
                    onClick={() => setSelectedPlan(plan)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedPlan?.planId === plan.planId
                        ? 'bg-orange-50 border-2 border-orange-500'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <h4 className="text-gray-900 mb-1">{plan.planName}</h4>
                    <p className="text-gray-600 text-sm">{plan.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        plan.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {plan.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Shopping List */}
            <div className="bg-white rounded-lg p-4 shadow-sm mt-4">
              <h3 className="text-gray-900 mb-4">Shopping List</h3>
              <div className="space-y-2">
                {generateShoppingList().map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" className="rounded" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Meal Plan Details */}
          {selectedPlan && (
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
                <h2 className="text-gray-900 mb-4">{selectedPlan.planName}</h2>
                <p className="text-gray-600 mb-4">{selectedPlan.description}</p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-600">Start Date</p>
                      <p className="text-gray-900">{new Date(selectedPlan.startDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-600">End Date</p>
                      <p className="text-gray-900">{new Date(selectedPlan.endDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Nutritional Goals */}
                {selectedPlan.nutritionalGoals && Object.keys(selectedPlan.nutritionalGoals).length > 0 && (
                  <div className="bg-orange-50 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="w-5 h-5 text-orange-500" />
                      <h3 className="text-gray-900">Daily Nutritional Goals</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {selectedPlan.nutritionalGoals.calories && (
                        <div>
                          <p className="text-xs text-gray-600">Calories</p>
                          <p className="text-orange-600">{selectedPlan.nutritionalGoals.calories} kcal</p>
                        </div>
                      )}
                      {selectedPlan.nutritionalGoals.protein && (
                        <div>
                          <p className="text-xs text-gray-600">Protein</p>
                          <p className="text-blue-600">{selectedPlan.nutritionalGoals.protein}g</p>
                        </div>
                      )}
                      {selectedPlan.nutritionalGoals.fat && (
                        <div>
                          <p className="text-xs text-gray-600">Fat</p>
                          <p className="text-red-600">{selectedPlan.nutritionalGoals.fat}g</p>
                        </div>
                      )}
                      {selectedPlan.nutritionalGoals.carbs && (
                        <div>
                          <p className="text-xs text-gray-600">Carbs</p>
                          <p className="text-green-600">{selectedPlan.nutritionalGoals.carbs}g</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedPlan.specialInstructions && (
                  <div className="bg-blue-50 rounded-lg p-4 mb-6">
                    <h3 className="text-gray-900 mb-2">Special Instructions</h3>
                    <p className="text-gray-600">{selectedPlan.specialInstructions}</p>
                  </div>
                )}
              </div>

              {/* Daily Meals */}
              <div className="space-y-4">
                {selectedPlan.meals.map((dayMeal, index) => {
                  const isExpanded = expandedDay === dayMeal.day;
                  const dailyNutrition = calculateDailyNutrition(dayMeal);

                  return (
                    <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden">
                      <button
                        onClick={() => setExpandedDay(isExpanded ? null : dayMeal.day)}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-orange-500" />
                          <div className="text-left">
                            <h3 className="text-gray-900">{dayMeal.day}</h3>
                            <p className="text-gray-600 text-sm">
                              {dailyNutrition.calories} kcal • {dailyNutrition.protein}g protein
                            </p>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="p-4 border-t border-gray-200 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <MealCard meal={dayMeal.breakfast} mealType="Breakfast" />
                            <MealCard meal={dayMeal.lunch} mealType="Lunch" />
                            <MealCard meal={dayMeal.dinner} mealType="Dinner" />
                            {dayMeal.snacks?.map((snack, idx) => (
                              <MealCard key={idx} meal={snack} mealType={`Snack ${idx + 1}`} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
