import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Save,
  ChefHat,
  Apple,
  Clock,
  Scale,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface NutrientInfo {
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  calories: number;
}

interface MealItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  nutrients: NutrientInfo;
}

interface Meal {
  id: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  time: string;
  items: MealItem[];
  totalCalories: number;
  totalNutrients: NutrientInfo;
  specialInstructions?: string;
}

interface MealPlan {
  name: string;
  description: string;
  duration: number; // days
  petType: 'dog' | 'cat' | 'both';
  ageGroup: 'puppy' | 'adult' | 'senior' | 'all';
  healthGoal: string;
  meals: Meal[];
  dailyCalorieTarget: number;
  guidelines: string[];
  restrictions: string[];
}

interface MealPlanCreatorProps {
  vendorId: string;
  onSave?: (planId: string) => void;
  onCancel?: () => void;
}

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { value: 'lunch', label: 'Lunch', icon: '☀️' },
  { value: 'dinner', label: 'Dinner', icon: '🌙' },
  { value: 'snack', label: 'Snack', icon: '🍪' }
];

const PET_TYPES = ['dog', 'cat', 'both'];
const AGE_GROUPS = ['puppy', 'adult', 'senior', 'all'];
const HEALTH_GOALS = [
  'Weight Management',
  'Muscle Building',
  'Digestive Health',
  'Skin & Coat Health',
  'Joint Support',
  'General Wellness'
];

const FOOD_ITEMS = [
  { name: 'Chicken Breast', unit: 'g', cal: 165, protein: 31, fat: 3.6, carbs: 0, fiber: 0 },
  { name: 'Brown Rice', unit: 'g', cal: 112, protein: 2.6, fat: 0.9, carbs: 24, fiber: 1.8 },
  { name: 'Sweet Potato', unit: 'g', cal: 86, protein: 1.6, fat: 0.1, carbs: 20, fiber: 3 },
  { name: 'Carrots', unit: 'g', cal: 41, protein: 0.9, fat: 0.2, carbs: 10, fiber: 2.8 },
  { name: 'Green Beans', unit: 'g', cal: 31, protein: 1.8, fat: 0.1, carbs: 7, fiber: 3.4 },
  { name: 'Salmon', unit: 'g', cal: 208, protein: 20, fat: 13, carbs: 0, fiber: 0 },
  { name: 'Eggs', unit: 'piece', cal: 78, protein: 6.3, fat: 5.3, carbs: 0.6, fiber: 0 },
  { name: 'Pumpkin', unit: 'g', cal: 26, protein: 1, fat: 0.1, carbs: 7, fiber: 0.5 }
];

export function MealPlanCreator({
  vendorId,
  onSave,
  onCancel
}: MealPlanCreatorProps) {
  const [mealPlan, setMealPlan] = useState<MealPlan>({
    name: '',
    description: '',
    duration: 7,
    petType: 'dog',
    ageGroup: 'adult',
    healthGoal: HEALTH_GOALS[0],
    meals: [],
    dailyCalorieTarget: 1200,
    guidelines: [],
    restrictions: []
  });

  const [newGuideline, setNewGuideline] = useState('');
  const [newRestriction, setNewRestriction] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNutritionSummary, setShowNutritionSummary] = useState(false);

  const createNewMeal = (type: string): Meal => ({
    id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    mealType: type as any,
    time: type === 'breakfast' ? '08:00' : type === 'lunch' ? '13:00' : type === 'dinner' ? '19:00' : '11:00',
    items: [],
    totalCalories: 0,
    totalNutrients: { protein: 0, fat: 0, carbs: 0, fiber: 0, calories: 0 },
    specialInstructions: ''
  });

  const addMeal = (type: string) => {
    const newMeal = createNewMeal(type);
    setMealPlan(prev => ({ ...prev, meals: [...prev.meals, newMeal] }));
    setSelectedMeal(newMeal);
  };

  const updateMeal = (updatedMeal: Meal) => {
    setMealPlan(prev => ({
      ...prev,
      meals: prev.meals.map(m => m.id === updatedMeal.id ? updatedMeal : m)
    }));
    setSelectedMeal(updatedMeal);
  };

  const deleteMeal = (mealId: string) => {
    setMealPlan(prev => ({
      ...prev,
      meals: prev.meals.filter(m => m.id !== mealId)
    }));
    if (selectedMeal?.id === mealId) {
      setSelectedMeal(null);
    }
  };

  const duplicateMeal = (meal: Meal) => {
    const duplicated = {
      ...meal,
      id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      items: meal.items.map(item => ({
        ...item,
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }))
    };
    setMealPlan(prev => ({ ...prev, meals: [...prev.meals, duplicated] }));
  };

  const addFoodItem = (meal: Meal, foodData: typeof FOOD_ITEMS[0], quantity: number) => {
    const newItem: MealItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: foodData.name,
      quantity,
      unit: foodData.unit,
      calories: (foodData.cal * quantity) / 100,
      nutrients: {
        protein: (foodData.protein * quantity) / 100,
        fat: (foodData.fat * quantity) / 100,
        carbs: (foodData.carbs * quantity) / 100,
        fiber: (foodData.fiber * quantity) / 100,
        calories: (foodData.cal * quantity) / 100
      }
    };

    const updatedItems = [...meal.items, newItem];
    const totalNutrients = calculateTotalNutrients(updatedItems);

    updateMeal({
      ...meal,
      items: updatedItems,
      totalCalories: totalNutrients.calories,
      totalNutrients
    });
  };

  const removeFoodItem = (meal: Meal, itemId: string) => {
    const updatedItems = meal.items.filter(item => item.id !== itemId);
    const totalNutrients = calculateTotalNutrients(updatedItems);

    updateMeal({
      ...meal,
      items: updatedItems,
      totalCalories: totalNutrients.calories,
      totalNutrients
    });
  };

  const calculateTotalNutrients = (items: MealItem[]): NutrientInfo => {
    return items.reduce((total, item) => ({
      protein: total.protein + item.nutrients.protein,
      fat: total.fat + item.nutrients.fat,
      carbs: total.carbs + item.nutrients.carbs,
      fiber: total.fiber + item.nutrients.fiber,
      calories: total.calories + item.nutrients.calories
    }), { protein: 0, fat: 0, carbs: 0, fiber: 0, calories: 0 });
  };

  const calculateDailyTotals = (): NutrientInfo => {
    return mealPlan.meals.reduce((total, meal) => ({
      protein: total.protein + meal.totalNutrients.protein,
      fat: total.fat + meal.totalNutrients.fat,
      carbs: total.carbs + meal.totalNutrients.carbs,
      fiber: total.fiber + meal.totalNutrients.fiber,
      calories: total.calories + meal.totalNutrients.calories
    }), { protein: 0, fat: 0, carbs: 0, fiber: 0, calories: 0 });
  };

  const handleSave = async () => {
    if (!mealPlan.name.trim()) {
      toast.error('Please enter a meal plan name');
      return;
    }

    if (mealPlan.meals.length === 0) {
      toast.error('Please add at least one meal');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/meal-plans`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(mealPlan)
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success('✅ Meal plan saved successfully!');
        if (onSave) onSave(data.planId);
      } else {
        toast.error('Failed to save meal plan');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const dailyTotals = calculateDailyTotals();
  const calorieProgress = (dailyTotals.calories / mealPlan.dailyCalorieTarget) * 100;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <ChefHat className="w-8 h-8 text-orange-600" />
              Meal Plan Creator
            </h1>
            <p className="text-gray-600">Create nutritious meal plans for pets</p>
          </div>
          <div className="flex gap-3">
            {onCancel && (
              <Button onClick={onCancel} variant="outline">
                Cancel
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-gradient-to-r from-orange-500 to-pink-500"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Meal Plan
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left Panel: Plan Configuration */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="font-bold text-lg mb-4">Plan Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    value={mealPlan.name}
                    onChange={(e) => setMealPlan(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Weight Loss Plan"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={mealPlan.description}
                    onChange={(e) => setMealPlan(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the meal plan..."
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Duration (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={mealPlan.duration}
                      onChange={(e) => setMealPlan(prev => ({ ...prev, duration: parseInt(e.target.value) || 7 }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Pet Type
                    </label>
                    <select
                      value={mealPlan.petType}
                      onChange={(e) => setMealPlan(prev => ({ ...prev, petType: e.target.value as any }))}
                      className="w-full px-3 py-2 border rounded-lg capitalize"
                    >
                      {PET_TYPES.map(type => (
                        <option key={type} value={type} className="capitalize">{type}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Age Group
                  </label>
                  <select
                    value={mealPlan.ageGroup}
                    onChange={(e) => setMealPlan(prev => ({ ...prev, ageGroup: e.target.value as any }))}
                    className="w-full px-3 py-2 border rounded-lg capitalize"
                  >
                    {AGE_GROUPS.map(age => (
                      <option key={age} value={age} className="capitalize">{age}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Health Goal
                  </label>
                  <select
                    value={mealPlan.healthGoal}
                    onChange={(e) => setMealPlan(prev => ({ ...prev, healthGoal: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {HEALTH_GOALS.map(goal => (
                      <option key={goal} value={goal}>{goal}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Scale className="w-4 h-4" />
                    Daily Calorie Target
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={mealPlan.dailyCalorieTarget}
                    onChange={(e) => setMealPlan(prev => ({ ...prev, dailyCalorieTarget: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  
                  {/* Calorie Progress */}
                  <div className="mt-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Current Total</span>
                      <span className={`font-semibold ${
                        calorieProgress > 110 ? 'text-red-600' :
                        calorieProgress < 90 ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {dailyTotals.calories.toFixed(0)} cal ({calorieProgress.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          calorieProgress > 110 ? 'bg-red-600' :
                          calorieProgress < 90 ? 'bg-yellow-600' :
                          'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(calorieProgress, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Nutrition Summary */}
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4">Daily Nutrition Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Protein:</span>
                  <span className="font-semibold">{dailyTotals.protein.toFixed(1)}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fat:</span>
                  <span className="font-semibold">{dailyTotals.fat.toFixed(1)}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Carbs:</span>
                  <span className="font-semibold">{dailyTotals.carbs.toFixed(1)}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fiber:</span>
                  <span className="font-semibold">{dailyTotals.fiber.toFixed(1)}g</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-bold text-gray-900">Total Calories:</span>
                  <span className="font-bold text-orange-600">{dailyTotals.calories.toFixed(0)} cal</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Middle Panel: Meals */}
          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">Meals</h2>
                <Button
                  size="sm"
                  onClick={() => setShowNutritionSummary(!showNutritionSummary)}
                  variant="outline"
                >
                  <Apple className="w-4 h-4 mr-2" />
                  Nutrients
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {MEAL_TYPES.map(type => (
                  <Button
                    key={type.value}
                    onClick={() => addMeal(type.value)}
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {type.icon} {type.label}
                  </Button>
                ))}
              </div>

              <div className="space-y-3">
                {mealPlan.meals.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <ChefHat className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No meals added yet</p>
                    <p className="text-sm mt-1">Click above to add meals</p>
                  </div>
                ) : (
                  mealPlan.meals.map(meal => (
                    <div
                      key={meal.id}
                      onClick={() => setSelectedMeal(meal)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedMeal?.id === meal.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold capitalize flex items-center gap-2">
                            {MEAL_TYPES.find(t => t.value === meal.mealType)?.icon}
                            {meal.mealType}
                          </div>
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {meal.time}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); duplicateMeal(meal); }}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteMeal(meal.id); }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="text-sm">
                        <Badge className="bg-orange-100 text-orange-700">
                          {meal.totalCalories.toFixed(0)} cal
                        </Badge>
                        <span className="ml-2 text-gray-600">
                          {meal.items.length} items
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Right Panel: Meal Editor */}
          <div>
            {selectedMeal ? (
              <Card className="p-6">
                <h2 className="font-bold text-lg mb-4 capitalize">
                  Edit {selectedMeal.mealType}
                </h2>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Meal Time
                    </label>
                    <input
                      type="time"
                      value={selectedMeal.time}
                      onChange={(e) => updateMeal({ ...selectedMeal, time: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Add Food Items
                    </label>
                    {FOOD_ITEMS.map(food => (
                      <div key={food.name} className="flex items-center gap-2 mb-2">
                        <span className="flex-1 text-sm">{food.name}</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          className="w-20 px-2 py-1 border rounded text-sm"
                          onChange={(e) => {
                            const qty = parseInt(e.target.value) || 0;
                            if (qty > 0) addFoodItem(selectedMeal, food, qty);
                          }}
                        />
                        <span className="text-xs text-gray-500 w-8">{food.unit}</span>
                      </div>
                    ))}
                  </div>

                  {selectedMeal.items.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Current Items
                      </label>
                      <div className="space-y-2">
                        {selectedMeal.items.map(item => (
                          <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex-1">
                              <div className="text-sm font-medium">{item.name}</div>
                              <div className="text-xs text-gray-600">
                                {item.quantity}{item.unit} • {item.calories.toFixed(0)} cal
                              </div>
                            </div>
                            <button
                              onClick={() => removeFoodItem(selectedMeal, item.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Special Instructions
                    </label>
                    <textarea
                      value={selectedMeal.specialInstructions || ''}
                      onChange={(e) => updateMeal({ ...selectedMeal, specialInstructions: e.target.value })}
                      placeholder="e.g., Serve at room temperature"
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold text-sm mb-3">Meal Nutrition</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Protein:</span>
                      <span className="font-semibold">{selectedMeal.totalNutrients.protein.toFixed(1)}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fat:</span>
                      <span className="font-semibold">{selectedMeal.totalNutrients.fat.toFixed(1)}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Carbs:</span>
                      <span className="font-semibold">{selectedMeal.totalNutrients.carbs.toFixed(1)}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fiber:</span>
                      <span className="font-semibold">{selectedMeal.totalNutrients.fiber.toFixed(1)}g</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex justify-between font-semibold">
                      <span>Total Calories:</span>
                      <span className="text-orange-600">{selectedMeal.totalCalories.toFixed(0)} cal</span>
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-6">
                <div className="text-center py-12 text-gray-500">
                  <Apple className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>Select a meal to edit</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
