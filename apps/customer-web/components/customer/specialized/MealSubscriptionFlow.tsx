'use client';

/**
 * ============================================================================
 * MEAL SUBSCRIPTION FLOW COMPONENT
 * ============================================================================
 * 
 * Customer interface for ordering and managing meal subscriptions
 * - Browse meal plans from local nutritionists
 * - Filter by category and purpose
 * - Subscribe to daily/weekly/monthly plans
 * - Manage existing subscriptions
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Filter, MapPin, Clock, Star, ChevronRight,
  Loader2, CheckCircle2, CalendarDays, Repeat, X,
  ShoppingBag, Leaf, Snowflake, Zap, Heart, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import {
  urlCustomerAddressesByCustomerId,
  urlCustomerPetsByCustomerId,
} from '@/lib/customer-service-list-urls';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface MealPlan {
  id: string;
  vendorId: string;
  vendorName: string;
  name: string;
  description: string;
  category: 'fresh' | 'frozen' | 'instant' | 'raw' | 'prescription';
  purposes: string[];
  price: number;
  discountedPrice?: number;
  servings: number;
  deliveryRadius: number;
  preparationTime: number;
  availableSubscriptionTypes: string[];
  image?: string;
  distance?: string;
  eta?: string;
}

interface Subscription {
  id: string;
  mealPlanId: string;
  mealPlanName: string;
  mealPlanImage?: string;
  category: string;
  vendorName: string;
  subscriptionType: string;
  status: string;
  quantity: number;
  pricePerDelivery: number;
  nextDeliveryDate: string;
  totalDeliveries: number;
  autoRenew: boolean;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string;
}

interface Address {
  id: string;
  label: string;
  fullAddress: string;
  isDefault?: boolean;
}

interface MealSubscriptionFlowProps {
  customerId: string;
  location?: { lat: number; lng: number };
  onClose?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  fresh: { label: 'Fresh', icon: <Leaf className="w-4 h-4" />, color: 'bg-green-100 text-green-700' },
  frozen: { label: 'Frozen', icon: <Snowflake className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700' },
  instant: { label: 'Instant', icon: <Zap className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-700' },
  raw: { label: 'Raw', icon: <Heart className="w-4 h-4" />, color: 'bg-red-100 text-red-700' },
  prescription: { label: 'Prescription', icon: <AlertCircle className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700' },
};

const PURPOSE_LABELS: Record<string, string> = {
  weight_management: 'Weight Management',
  allergies: 'Allergy Friendly',
  senior: 'Senior Pets',
  puppy: 'Puppies/Kittens',
  digestive: 'Digestive Health',
  general: 'General Nutrition',
};

const SUBSCRIPTION_TYPES: Record<string, { label: string; savings: string }> = {
  one_time: { label: 'One Time', savings: '' },
  daily: { label: 'Daily', savings: 'Save 10%' },
  weekly: { label: 'Weekly', savings: 'Save 15%' },
  monthly: { label: 'Monthly', savings: 'Save 20%' },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function MealSubscriptionFlow({
  customerId,
  location,
  onClose,
}: MealSubscriptionFlowProps) {
  // State
  const [loading, setLoading] = useState(true);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState<string | null>(null);
  
  // View state
  const [view, setView] = useState<'browse' | 'detail' | 'subscribe' | 'manage'>('browse');
  const [selectedPlan, setSelectedPlan] = useState<MealPlan | null>(null);
  
  // Subscription form
  const [subscriptionType, setSubscriptionType] = useState<string>('weekly');
  const [quantity, setQuantity] = useState(1);
  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [preferredTime, setPreferredTime] = useState<string>('');
  const [autoRenew, setAutoRenew] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Load data
  useEffect(() => {
    fetchData();
  }, [selectedCategory, selectedPurpose]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (location) {
        params.append('lat', location.lat.toString());
        params.append('lng', location.lng.toString());
      }
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedPurpose) params.append('purpose', selectedPurpose);

      const [plansRes, subsRes, petsRes, addressRes] = await Promise.all([
        apiClient.get<any>(`/meals/plans?${params}`),
        apiClient.get<any>(`/meals/subscriptions/customer/${customerId}`),
        apiClient.get<any>(urlCustomerPetsByCustomerId(customerId)),
        apiClient.get<any>(urlCustomerAddressesByCustomerId(customerId)),
      ]);

      if (plansRes.success) setMealPlans(plansRes.mealPlans || []);
      if (subsRes.success) setSubscriptions(subsRes.subscriptions || []);
      if (petsRes.pets) setPets(petsRes.pets || []);
      if (addressRes.addresses) {
        setAddresses(addressRes.addresses || []);
        const defaultAddr = addressRes.addresses?.find((a: Address) => a.isDefault);
        if (defaultAddr) setSelectedAddressId(defaultAddr.id);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (plan: MealPlan) => {
    setSelectedPlan(plan);
    setSubscriptionType(plan.availableSubscriptionTypes.includes('weekly') ? 'weekly' : plan.availableSubscriptionTypes[0]);
    setView('detail');
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    if (!selectedPetId) {
      toast.error('Please select a pet');
      return;
    }
    if (!selectedAddressId) {
      toast.error('Please select a delivery address');
      return;
    }

    const selectedAddress = addresses.find(a => a.id === selectedAddressId);
    
    setSubmitting(true);
    try {
      const res = await apiClient.post<any>('/meals/subscriptions', {
        customerId,
        petId: selectedPetId,
        vendorId: selectedPlan.vendorId,
        mealPlanId: selectedPlan.id,
        subscriptionType,
        quantity,
        deliveryAddress: selectedAddress?.fullAddress,
        preferredDeliveryTime: preferredTime || undefined,
        autoRenew,
      });

      if (res.success) {
        toast.success('Subscription created! 🎉');
        await fetchData(); // Refresh subscriptions
        setView('manage');
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast.error(error.message || 'Failed to create subscription');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManageSubscription = async (subscriptionId: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      const res = await apiClient.post<any>(`/meals/subscriptions/${subscriptionId}/manage`, {
        action,
        reason: action === 'cancel' ? 'User requested' : undefined,
      });

      if (res.success) {
        toast.success(`Subscription ${action}d successfully`);
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update subscription');
    }
  };

  const calculatePrice = () => {
    if (!selectedPlan) return 0;
    const basePrice = selectedPlan.discountedPrice || selectedPlan.price;
    let discount = 0;
    
    switch (subscriptionType) {
      case 'daily': discount = 0.10; break;
      case 'weekly': discount = 0.15; break;
      case 'monthly': discount = 0.20; break;
    }

    return (basePrice * quantity * (1 - discount));
  };

  const formatPrice = (price: number) => `₹${price.toFixed(0)}`;

  // ============================================================================
  // RENDER BROWSE VIEW
  // ============================================================================

  const renderBrowseView = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">Fresh Pet Meals</h2>
          <p className="text-sm text-gray-500">Nutritionist-prepared meals delivered fresh</p>
        </div>
        {subscriptions.length > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setView('manage')}
          >
            <Repeat className="w-4 h-4 mr-1" />
            Subscriptions
          </Button>
        )}
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
            !selectedCategory
              ? 'bg-[#FF8C42] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition flex items-center gap-1 ${
              selectedCategory === key
                ? 'bg-[#FF8C42] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {config.icon}
            {config.label}
          </button>
        ))}
      </div>

      {/* Purpose Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Object.entries(PURPOSE_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelectedPurpose(selectedPurpose === key ? null : key)}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition ${
              selectedPurpose === key
                ? 'bg-orange-100 text-orange-700 border border-orange-300'
                : 'bg-gray-50 text-gray-600 border border-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" />
        </div>
      )}

      {/* Meal Plans */}
      {!loading && mealPlans.length > 0 && (
        <div className="space-y-3">
          {mealPlans.map((plan) => (
            <Card
              key={plan.id}
              onClick={() => handlePlanSelect(plan)}
              className="overflow-hidden cursor-pointer hover:shadow-md transition"
            >
              <div className="flex">
                {/* Image */}
                <div className="w-28 h-28 bg-gray-100 flex-shrink-0">
                  {plan.image ? (
                    <img src={plan.image} alt={plan.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      🍽️
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                      <p className="text-xs text-gray-500">{plan.vendorName}</p>
                    </div>
                    <Badge className={CATEGORY_CONFIG[plan.category]?.color || 'bg-gray-100'}>
                      {CATEGORY_CONFIG[plan.category]?.label || plan.category}
                    </Badge>
                  </div>

                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {plan.description}
                  </p>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {plan.distance || 'Nearby'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {plan.eta || '45 min'}
                      </span>
                    </div>
                    <div className="text-right">
                      {plan.discountedPrice && plan.discountedPrice < plan.price ? (
                        <div>
                          <span className="text-sm text-gray-400 line-through">₹{plan.price}</span>
                          <span className="text-lg font-bold text-[#FF8C42] ml-1">₹{plan.discountedPrice}</span>
                        </div>
                      ) : (
                        <span className="text-lg font-bold text-[#FF8C42]">₹{plan.price}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* No Results */}
      {!loading && mealPlans.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">No meal plans available</h3>
          <p className="text-sm text-gray-500">
            Try changing the filters or check back later
          </p>
        </div>
      )}
    </div>
  );

  // ============================================================================
  // RENDER DETAIL VIEW
  // ============================================================================

  const renderDetailView = () => {
    if (!selectedPlan) return null;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setView('browse')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-xl font-bold text-gray-900">Meal Details</h2>
        </div>

        {/* Plan Image */}
        <div className="w-full h-48 bg-gray-100 rounded-xl overflow-hidden">
          {selectedPlan.image ? (
            <img src={selectedPlan.image} alt={selectedPlan.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">🍽️</div>
          )}
        </div>

        {/* Plan Info */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className={CATEGORY_CONFIG[selectedPlan.category]?.color || 'bg-gray-100'}>
              {CATEGORY_CONFIG[selectedPlan.category]?.label}
            </Badge>
            {selectedPlan.purposes.map(p => (
              <Badge key={p} variant="outline" className="text-xs">
                {PURPOSE_LABELS[p] || p}
              </Badge>
            ))}
          </div>
          <h3 className="text-xl font-bold text-gray-900">{selectedPlan.name}</h3>
          <p className="text-sm text-gray-500">{selectedPlan.vendorName}</p>
          <p className="text-gray-600 mt-2">{selectedPlan.description}</p>
        </div>

        {/* Subscription Type */}
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Subscription Type</h4>
          <div className="grid grid-cols-2 gap-2">
            {selectedPlan.availableSubscriptionTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSubscriptionType(type)}
                className={`p-3 rounded-xl border-2 text-center transition ${
                  subscriptionType === type
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium">{SUBSCRIPTION_TYPES[type]?.label || type}</p>
                {SUBSCRIPTION_TYPES[type]?.savings && (
                  <p className="text-xs text-green-600">{SUBSCRIPTION_TYPES[type].savings}</p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Quantity</h4>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold"
            >
              -
            </button>
            <span className="text-2xl font-bold w-12 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold"
            >
              +
            </button>
            <span className="text-gray-500 text-sm">{selectedPlan.servings} servings each</span>
          </div>
        </div>

        {/* Pet Selection */}
        <div>
          <h4 className="font-medium text-gray-900 mb-2">For Which Pet?</h4>
          <div className="flex gap-2 flex-wrap">
            {pets.map((pet) => (
              <button
                key={pet.id}
                onClick={() => setSelectedPetId(pet.id)}
                className={`px-4 py-2 rounded-xl border-2 transition ${
                  selectedPetId === pet.id
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{pet.species === 'dog' ? '🐕' : '🐈'}</span>
                {pet.name}
              </button>
            ))}
          </div>
        </div>

        {/* Address Selection */}
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Delivery Address</h4>
          <div className="space-y-2">
            {addresses.map((addr) => (
              <button
                key={addr.id}
                onClick={() => setSelectedAddressId(addr.id)}
                className={`w-full p-3 rounded-xl border-2 text-left transition ${
                  selectedAddressId === addr.id
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium">{addr.label}</p>
                <p className="text-sm text-gray-500 truncate">{addr.fullAddress}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Auto Renew */}
        {subscriptionType !== 'one_time' && (
          <Card 
            className={`p-4 cursor-pointer transition ${autoRenew ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'}`}
            onClick={() => setAutoRenew(!autoRenew)}
          >
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                autoRenew ? 'border-[#FF8C42] bg-[#FF8C42]' : 'border-gray-300'
              }`}>
                {autoRenew && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
              <div>
                <p className="font-medium text-gray-900">Auto-renew subscription</p>
                <p className="text-sm text-gray-500">Never miss a delivery</p>
              </div>
            </div>
          </Card>
        )}

        {/* Price Summary */}
        <Card className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100">Total per delivery</p>
              <p className="text-3xl font-bold">{formatPrice(calculatePrice())}</p>
            </div>
            <Button 
              onClick={handleSubscribe}
              disabled={submitting}
              className="bg-white text-orange-600 hover:bg-orange-50"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <ShoppingBag className="w-5 h-5 mr-2" />
              )}
              Subscribe
            </Button>
          </div>
        </Card>
      </div>
    );
  };

  // ============================================================================
  // RENDER MANAGE VIEW
  // ============================================================================

  const renderManageView = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setView('browse')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">My Subscriptions</h2>
          <p className="text-sm text-gray-500">{subscriptions.filter(s => s.status === 'active').length} active</p>
        </div>
      </div>

      {/* Subscriptions List */}
      {subscriptions.length > 0 ? (
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <Card key={sub.id} className="p-4">
              <div className="flex gap-3">
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                  {sub.mealPlanImage ? (
                    <img src={sub.mealPlanImage} alt={sub.mealPlanName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">🍽️</div>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{sub.mealPlanName}</h4>
                      <p className="text-xs text-gray-500">{sub.vendorName}</p>
                    </div>
                    <Badge className={
                      sub.status === 'active' ? 'bg-green-100 text-green-700' :
                      sub.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }>
                      {sub.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Repeat className="w-3 h-3" />
                      {SUBSCRIPTION_TYPES[sub.subscriptionType]?.label || sub.subscriptionType}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      Next: {new Date(sub.nextDeliveryDate).toLocaleDateString()}
                    </span>
                  </div>

                  {sub.status === 'active' && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleManageSubscription(sub.id, 'pause')}
                      >
                        Pause
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleManageSubscription(sub.id, 'cancel')}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}

                  {sub.status === 'paused' && (
                    <Button
                      size="sm"
                      className="mt-3 bg-[#FF8C42] hover:bg-[#E67A35]"
                      onClick={() => handleManageSubscription(sub.id, 'resume')}
                    >
                      Resume
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Repeat className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">No subscriptions yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Subscribe to fresh meals for your pet
          </p>
          <Button 
            onClick={() => setView('browse')}
            className="bg-[#FF8C42] hover:bg-[#E67A35]"
          >
            Browse Meal Plans
          </Button>
        </div>
      )}
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        {view === 'browse' && renderBrowseView()}
        {view === 'detail' && renderDetailView()}
        {view === 'manage' && renderManageView()}
      </div>
    </div>
  );
}

export default MealSubscriptionFlow;
