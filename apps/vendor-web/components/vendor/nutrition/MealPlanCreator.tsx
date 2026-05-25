"use client";

import { useEffect, useState } from 'react';
import { 
  Plus, Minus, Save, Upload, Trash2, Clock, Calendar, 
  Leaf, AlertCircle, ChevronDown, ChevronUp, Info, Scale,
  Loader2, X, Check, ImagePlus
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
  is_allergen: boolean;
}

interface NutritionInfo {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
}

interface DeliverySlot {
  start: string;
  end: string;
}

interface MealPlanCreatorProps {
  vendorId: string;
  existingPlan?: any;
  onSave?: (plan: any) => void;
  onCancel?: () => void;
}

export function MealPlanCreator({ vendorId, existingPlan, onSave, onCancel }: MealPlanCreatorProps) {
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('basic');

  // Basic Info
  const [name, setName] = useState(existingPlan?.name || '');
  const [description, setDescription] = useState(existingPlan?.description || '');
  const [shortDescription, setShortDescription] = useState(existingPlan?.short_description || '');
  const [photos, setPhotos] = useState<string[]>(existingPlan?.photos || []);

  // Type & Suitability
  const [mealType, setMealType] = useState(existingPlan?.meal_type || 'fresh_daily');
  const [dietTypes, setDietTypes] = useState<string[]>(existingPlan?.diet_type || []);
  const [suitableSpecies, setSuitableSpecies] = useState<string[]>(existingPlan?.suitable_for?.species || ['dog']);
  const [suitableSizes, setSuitableSizes] = useState<string[]>(existingPlan?.suitable_for?.sizes || ['medium']);
  const [suitableAges, setSuitableAges] = useState<string[]>(existingPlan?.suitable_for?.ages || ['adult']);

  // Ingredients & Nutrition
  const [ingredients, setIngredients] = useState<Ingredient[]>(existingPlan?.ingredients || [
    { name: '', quantity: '', unit: 'g', is_allergen: false }
  ]);
  const [nutrition, setNutrition] = useState<NutritionInfo>(existingPlan?.nutrition_info || {
    calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0
  });
  const [allergens, setAllergens] = useState<string[]>(existingPlan?.allergens || []);

  // Pricing
  const [pricePerMeal, setPricePerMeal] = useState(existingPlan?.price_per_meal || '');
  const [pricePerWeek, setPricePerWeek] = useState(existingPlan?.price_per_week || '');
  const [pricePerMonth, setPricePerMonth] = useState(existingPlan?.price_per_month || '');

  // Preparation & Delivery (prep time is required; empty until set for new plans)
  const initialPrep =
    existingPlan?.prep_time_minutes != null && Number(existingPlan.prep_time_minutes) >= 1
      ? Number(existingPlan.prep_time_minutes)
      : '';
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number | ''>(initialPrep);
  const [shelfLifeDays, setShelfLifeDays] = useState(existingPlan?.shelf_life_days || 1);
  const [leadTimeHours, setLeadTimeHours] = useState(existingPlan?.lead_time_hours || 24);
  const [leadBounds, setLeadBounds] = useState({ min: 0, max: 72, defaultHours: 24 });
  const [sameDayEnabled, setSameDayEnabled] = useState(true);
  const [orderCutoffTime, setOrderCutoffTime] = useState(existingPlan?.order_cutoff_time || '18:00');

  useEffect(() => {
    apiClient
      .get<{ success?: boolean; bounds?: { minHours: number; maxHours: number; defaultHours: number }; sameDay?: { enabled: boolean } }>(
        '/vendor/meal-booking-policy',
      )
      .then((res) => {
        if (res?.bounds) {
          setLeadBounds({
            min: res.bounds.minHours,
            max: res.bounds.maxHours,
            defaultHours: res.bounds.defaultHours,
          });
        }
        if (res?.sameDay) setSameDayEnabled(!!res.sameDay.enabled);
      })
      .catch(() => undefined);
  }, []);
  const [availableDays, setAvailableDays] = useState<string[]>(existingPlan?.available_days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
  const [deliverySlots, setDeliverySlots] = useState<DeliverySlot[]>(existingPlan?.delivery_slots || [
    { start: '09:00', end: '12:00' },
    { start: '14:00', end: '17:00' },
  ]);
  const [storageInstructions, setStorageInstructions] = useState(existingPlan?.storage_instructions || '');
  const [servingInstructions, setServingInstructions] = useState(existingPlan?.serving_instructions || '');

  // Toggle helpers
  const toggleArray = (arr: string[], item: string, setter: (arr: string[]) => void) => {
    if (arr.includes(item)) {
      setter(arr.filter(i => i !== item));
    } else {
      setter([...arr, item]);
    }
  };

  // Add/Remove ingredients
  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: '', unit: 'g', is_allergen: false }]);
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: any) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  // Add/Remove delivery slots
  const addDeliverySlot = () => {
    setDeliverySlots([...deliverySlots, { start: '10:00', end: '13:00' }]);
  };

  const updateDeliverySlot = (index: number, field: 'start' | 'end', value: string) => {
    const updated = [...deliverySlots];
    updated[index] = { ...updated[index], [field]: value };
    setDeliverySlots(updated);
  };

  const removeDeliverySlot = (index: number) => {
    setDeliverySlots(deliverySlots.filter((_, i) => i !== index));
  };

  // Save plan
  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      toast.error('Please enter a meal plan name');
      return;
    }
    if (!pricePerMeal || parseFloat(pricePerMeal) <= 0) {
      toast.error('Please enter a valid price per meal');
      return;
    }
    if (ingredients.filter(i => i.name.trim()).length === 0) {
      toast.error('Please add at least one ingredient');
      return;
    }
    const prepMins = prepTimeMinutes === '' ? NaN : Number(prepTimeMinutes);
    if (!Number.isFinite(prepMins) || prepMins < 1) {
      toast.error('Please enter preparation time (at least 1 minute)');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        vendorId,
        name,
        description,
        shortDescription,
        photos,
        mealType,
        dietType: dietTypes,
        suitableFor: {
          species: suitableSpecies,
          sizes: suitableSizes,
          ages: suitableAges,
        },
        ingredients: ingredients.filter(i => i.name.trim()),
        nutritionInfo: nutrition,
        allergens,
        pricePerMeal: parseFloat(pricePerMeal),
        pricePerWeek: pricePerWeek ? parseFloat(pricePerWeek) : null,
        pricePerMonth: pricePerMonth ? parseFloat(pricePerMonth) : null,
        prepTimeMinutes: prepMins,
        shelfLifeDays,
        leadTimeHours,
        orderCutoffTime,
        availableDays,
        deliverySlots,
        storageInstructions,
        servingInstructions,
      };

      let response;
      if (existingPlan?.id) {
        response = await apiClient.put(`/meal-plans/${existingPlan.id}`, payload);
      } else {
        response = await apiClient.post('/meal-plans/create', payload);
      }

      if ((response as any).success) {
        toast.success(existingPlan ? 'Meal plan updated!' : 'Meal plan created!');
        onSave?.((response as any).mealPlan);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save meal plan');
    } finally {
      setSaving(false);
    }
  };

  const SectionHeader = ({ id, title, icon: Icon }: { id: string; title: string; icon: any }) => (
    <button
      onClick={() => setActiveSection(activeSection === id ? '' : id)}
      className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-green-600" />
        <span className="font-semibold text-gray-900">{title}</span>
      </div>
      {activeSection === id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">{existingPlan ? 'Edit Meal Plan' : 'Create Meal Plan'}</h1>
            <p className="text-sm text-white/80">Design your nutritious pet meal</p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Basic Info Section */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <SectionHeader id="basic" title="Basic Information" icon={Info} />
          {activeSection === 'basic' && (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meal Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Chicken & Rice Power Bowl"
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                <input
                  type="text"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Brief tagline for the meal"
                  maxLength={100}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description of the meal..."
                  rows={3}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              {/* Photos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Photos</label>
                <div className="flex gap-2 flex-wrap">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-orange-400 hover:text-orange-400 transition-colors">
                    <ImagePlus className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Type & Suitability Section */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <SectionHeader id="type" title="Type & Suitability" icon={Leaf} />
          {activeSection === 'type' && (
            <div className="p-4 space-y-4">
              {/* Meal Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Meal Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'fresh_daily', label: '🥗 Fresh Daily' },
                    { value: 'fresh_weekly', label: '📦 Fresh Weekly' },
                    { value: 'preserved_monthly', label: '🥫 Preserved (Monthly)' },
                    { value: 'frozen', label: '❄️ Frozen' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setMealType(opt.value)}
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                        mealType === opt.value
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Diet Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Diet Purpose</label>
                <div className="flex flex-wrap gap-2">
                  {['weight_loss', 'muscle_gain', 'maintenance', 'medical', 'sensitive_stomach', 'allergy_friendly'].map(diet => (
                    <button
                      key={diet}
                      onClick={() => toggleArray(dietTypes, diet, setDietTypes)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        dietTypes.includes(diet)
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {diet.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Suitable For - Species */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Suitable For (Species)</label>
                <div className="flex gap-2">
                  {['dog', 'cat', 'bird', 'rabbit'].map(species => (
                    <button
                      key={species}
                      onClick={() => toggleArray(suitableSpecies, species, setSuitableSpecies)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        suitableSpecies.includes(species)
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {species.charAt(0).toUpperCase() + species.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Suitable For - Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pet Size</label>
                <div className="flex gap-2">
                  {['small', 'medium', 'large', 'giant'].map(size => (
                    <button
                      key={size}
                      onClick={() => toggleArray(suitableSizes, size, setSuitableSizes)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        suitableSizes.includes(size)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Suitable For - Age */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pet Age</label>
                <div className="flex gap-2">
                  {['puppy', 'adult', 'senior'].map(age => (
                    <button
                      key={age}
                      onClick={() => toggleArray(suitableAges, age, setSuitableAges)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        suitableAges.includes(age)
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {age.charAt(0).toUpperCase() + age.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ingredients Section */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <SectionHeader id="ingredients" title="Ingredients & Nutrition" icon={Scale} />
          {activeSection === 'ingredients' && (
            <div className="p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Ingredients *</label>
                  <button onClick={addIngredient} className="text-orange-500 text-sm font-medium flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {ingredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={ing.name}
                        onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                        placeholder="Ingredient name"
                        className="flex-1 p-2 border border-gray-200 rounded-lg text-sm"
                      />
                      <input
                        type="text"
                        value={ing.quantity}
                        onChange={(e) => updateIngredient(idx, 'quantity', e.target.value)}
                        placeholder="Qty"
                        className="w-16 p-2 border border-gray-200 rounded-lg text-sm"
                      />
                      <select
                        value={ing.unit}
                        onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                        className="w-16 p-2 border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                      </select>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={ing.is_allergen}
                          onChange={(e) => updateIngredient(idx, 'is_allergen', e.target.checked)}
                          className="w-4 h-4 text-orange-500 rounded"
                        />
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      </label>
                      {ingredients.length > 1 && (
                        <button onClick={() => removeIngredient(idx)} className="p-1 text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Nutrition Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nutrition per Serving</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(nutrition).map(([key, value]) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 capitalize">{key.replace('_', ' ')}</label>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => setNutrition({ ...nutrition, [key]: parseFloat(e.target.value) || 0 })}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pricing Section */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <SectionHeader id="pricing" title="Pricing" icon={Scale} />
          {activeSection === 'pricing' && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price per Meal *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="number"
                      value={pricePerMeal}
                      onChange={(e) => setPricePerMeal(e.target.value)}
                      placeholder="150"
                      className="w-full p-3 pl-8 border border-gray-200 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weekly Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="number"
                      value={pricePerWeek}
                      onChange={(e) => setPricePerWeek(e.target.value)}
                      placeholder="900"
                      className="w-full p-3 pl-8 border border-gray-200 rounded-xl"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                  <input
                    type="number"
                    value={pricePerMonth}
                    onChange={(e) => setPricePerMonth(e.target.value)}
                    placeholder="3200"
                    className="w-full p-3 pl-8 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preparation & Delivery Section */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <SectionHeader id="delivery" title="Preparation & Delivery" icon={Clock} />
          {activeSection === 'delivery' && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prep time (minutes) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    inputMode="numeric"
                    placeholder="e.g. 60"
                    value={prepTimeMinutes === '' ? '' : prepTimeMinutes}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '') {
                        setPrepTimeMinutes('');
                        return;
                      }
                      const n = parseInt(v, 10);
                      setPrepTimeMinutes(Number.isNaN(n) ? '' : n);
                    }}
                    className="w-full p-3 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lead Time (hrs)</label>
                  <input
                    type="number"
                    min={leadBounds.min}
                    max={leadBounds.max}
                    value={leadTimeHours}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      const v = Number.isFinite(n) ? n : leadBounds.defaultHours;
                      setLeadTimeHours(Math.min(leadBounds.max, Math.max(leadBounds.min, v)));
                    }}
                    className="w-full p-3 border border-gray-200 rounded-xl"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Platform allows {leadBounds.min}–{leadBounds.max}h
                    {sameDayEnabled ? ' (low values enable same-day delivery).' : '.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shelf Life (days)</label>
                  <input
                    type="number"
                    value={shelfLifeDays}
                    onChange={(e) => setShelfLifeDays(parseInt(e.target.value) || 1)}
                    className="w-full p-3 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order Cutoff</label>
                  <input
                    type="time"
                    value={orderCutoffTime}
                    onChange={(e) => setOrderCutoffTime(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Available Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Available Days</label>
                <div className="flex gap-2 flex-wrap">
                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => (
                    <button
                      key={day}
                      onClick={() => toggleArray(availableDays, day, setAvailableDays)}
                      className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                        availableDays.includes(day)
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {day.charAt(0).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delivery Slots */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Delivery Slots</label>
                  <button onClick={addDeliverySlot} className="text-orange-500 text-sm font-medium flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {deliverySlots.map((slot, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={slot.start}
                        onChange={(e) => updateDeliverySlot(idx, 'start', e.target.value)}
                        className="flex-1 p-2 border border-gray-200 rounded-lg"
                      />
                      <span className="text-gray-400">to</span>
                      <input
                        type="time"
                        value={slot.end}
                        onChange={(e) => updateDeliverySlot(idx, 'end', e.target.value)}
                        className="flex-1 p-2 border border-gray-200 rounded-lg"
                      />
                      {deliverySlots.length > 1 && (
                        <button onClick={() => removeDeliverySlot(idx)} className="p-1 text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Storage Instructions</label>
                <textarea
                  value={storageInstructions}
                  onChange={(e) => setStorageInstructions(e.target.value)}
                  placeholder="How to store the meal..."
                  rows={2}
                  className="w-full p-3 border border-gray-200 rounded-xl resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serving Instructions</label>
                <textarea
                  value={servingInstructions}
                  onChange={(e) => setServingInstructions(e.target.value)}
                  placeholder="How to serve the meal..."
                  rows={2}
                  className="w-full p-3 border border-gray-200 rounded-xl resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Save Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 border border-gray-300 rounded-xl font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Meal Plan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
