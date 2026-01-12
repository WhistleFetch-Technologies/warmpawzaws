import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Calendar, Package, Truck, MapPin, Clock, Phone, ChevronRight, Navigation, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface NutritionistServiceRouterProps {
  customerId: string;
  petId: string;
  petName: string;
  onBack?: () => void;
}

export function NutritionistServiceRouter({ customerId, petId, petName, onBack }: NutritionistServiceRouterProps) {
  const [step, setStep] = useState<'service' | 'consultation' | 'mealplan' | 'delivery' | 'tracking'>('service');
  const [selectedService, setSelectedService] = useState<'consultation' | 'mealplan' | null>(null);
  const [nutritionists, setNutritionists] = useState<any[]>([]);
  const [selectedNutritionist, setSelectedNutritionist] = useState<any>(null);
  const [mealPlans, setMealPlans] = useState<any[]>([]);
  const [selectedMealPlan, setSelectedMealPlan] = useState<any>(null);
  const [deliveryDetails, setDeliveryDetails] = useState<any>(null);
  const [activeDelivery, setActiveDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const services = [
    {
      id: 'consultation',
      title: 'Nutritionist Consultation',
      description: 'Get personalized diet plan from certified pet nutritionists',
      icon: Calendar,
      color: 'bg-blue-50 border-blue-200',
      iconColor: 'text-blue-600'
    },
    {
      id: 'mealplan',
      title: 'Meal Plan & Delivery',
      description: 'Subscribe to custom meal plans with hyperlocal delivery',
      icon: Package,
      color: 'bg-green-50 border-green-200',
      iconColor: 'text-green-600'
    }
  ];

  useEffect(() => {
    if (selectedService === 'consultation' || selectedService === 'mealplan') {
      loadNutritionists();
    }
  }, [selectedService]);

  useEffect(() => {
    if (selectedNutritionist && selectedService === 'mealplan') {
      loadMealPlans();
    }
  }, [selectedNutritionist]);

  const loadNutritionists = async () => {
    try {
      setLoading(true);

      // Get customer location (from profile or browser)
      const customerLocation = { lat: 28.6139, lng: 77.2090 }; // Delhi

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/hyperlocal/vendors?lat=${customerLocation.lat}&lng=${customerLocation.lng}&maxDistance=10`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setNutritionists(data.vendors || []);
      }
    } catch (error) {
      console.error('Error loading nutritionists:', error);
      toast.error('Failed to load nutritionists');
    } finally {
      setLoading(false);
    }
  };

  const loadMealPlans = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${selectedNutritionist.id}/meal-plans`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setMealPlans(data.mealPlans || []);
      }
    } catch (error) {
      console.error('Error loading meal plans:', error);
      toast.error('Failed to load meal plans');
    } finally {
      setLoading(false);
    }
  };

  const handleConsultationBooking = async () => {
    try {
      setLoading(true);

      const bookingData = {
        customerId,
        petId,
        vendorId: selectedNutritionist.id,
        serviceType: 'nutritionist',
        serviceName: 'Nutritionist Consultation',
        serviceStyle: 'tele_consultation',
        totalAmount: 500
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/bookings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(bookingData)
        }
      );

      if (response.ok) {
        toast.success('Consultation booked successfully!');
        if (onBack) onBack();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to book consultation');
      }
    } catch (error) {
      console.error('Error booking consultation:', error);
      toast.error('Error booking consultation');
    } finally {
      setLoading(false);
    }
  };

  const handleMealPlanDelivery = async () => {
    if (!deliveryDetails) {
      toast.error('Please enter delivery details');
      return;
    }

    try {
      setLoading(true);

      // Create order
      const orderId = `ORDER-${Date.now()}`;

      // Get customer address (would come from profile)
      const customerAddress = {
        address: '123 Main Street, Delhi',
        lat: 28.6139,
        lng: 77.2090,
        contactName: 'Customer Name',
        contactPhone: '9876543210'
      };

      const vendorAddress = {
        address: selectedNutritionist.address || 'Vendor Address',
        lat: selectedNutritionist.location?.lat || 28.6200,
        lng: selectedNutritionist.location?.lng || 77.2100,
        contactName: selectedNutritionist.businessName,
        contactPhone: selectedNutritionist.phone || '9876543211'
      };

      // Create delivery
      const deliveryData = {
        orderId,
        customerId,
        vendorId: selectedNutritionist.id,
        nutritionistId: selectedNutritionist.id,
        items: [
          {
            mealPlanId: selectedMealPlan.id,
            name: selectedMealPlan.name,
            quantity: 1,
            price: selectedMealPlan.price
          }
        ],
        pickupLocation: vendorAddress,
        dropoffLocation: customerAddress,
        instructions: deliveryDetails.instructions || ''
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/hyperlocal/delivery/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(deliveryData)
        }
      );

      if (response.ok) {
        const data = await response.json();
        setActiveDelivery(data.delivery);
        setStep('tracking');
        toast.success('Meal plan delivery ordered successfully!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create delivery');
      }
    } catch (error) {
      console.error('Error creating delivery:', error);
      toast.error('Error creating delivery');
    } finally {
      setLoading(false);
    }
  };

  const renderServiceSelection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Nutritionist Service</h2>
        <p className="text-gray-600">Select the service you need for {petName}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <button
              key={service.id}
              onClick={() => {
                setSelectedService(service.id as any);
                setStep(service.id as any);
              }}
              className={`p-6 rounded-xl border-2 ${service.color} hover:shadow-lg transition-all text-left`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${service.color}`}>
                  <Icon className={`w-6 h-6 ${service.iconColor}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900 mb-1">{service.title}</h3>
                  <p className="text-sm text-gray-600 mb-3">{service.description}</p>
                  <div className="flex items-center gap-2 text-orange-600 font-semibold text-sm">
                    <span>Select Service</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderNutritionistSelection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => setStep('service')} className="text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Choose Nutritionist</h2>
          <p className="text-gray-600">Nearby certified pet nutritionists</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-gray-600">Finding nutritionists...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {nutritionists.map((nutritionist) => (
            <button
              key={nutritionist.id}
              onClick={() => {
                setSelectedNutritionist(nutritionist);
                if (selectedService === 'consultation') {
                  // Show confirmation for consultation
                } else {
                  setStep('mealplan');
                }
              }}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                selectedNutritionist?.id === nutritionist.id
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 bg-white hover:border-orange-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{nutritionist.businessName || nutritionist.fullName}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{nutritionist.distance?.toFixed(1)} km away</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{nutritionist.estimatedDuration} min</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-semibold text-orange-600">
                      Delivery: ₹{nutritionist.deliveryFee}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedNutritionist && selectedService === 'consultation' && (
        <Button
          onClick={handleConsultationBooking}
          disabled={loading}
          className="w-full bg-orange-600 hover:bg-orange-700 py-6 text-lg"
        >
          {loading ? 'Booking...' : 'Book Consultation - ₹500'}
        </Button>
      )}
    </div>
  );

  const renderMealPlanSelection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => setStep('consultation')} className="text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Choose Meal Plan</h2>
          <p className="text-gray-600">from {selectedNutritionist?.businessName}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-gray-600">Loading meal plans...</p>
        </div>
      ) : mealPlans.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No meal plans available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mealPlans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => {
                setSelectedMealPlan(plan);
                setStep('delivery');
              }}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                selectedMealPlan?.id === plan.id
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 bg-white hover:border-orange-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                  <div className="flex items-center gap-3 text-sm text-gray-600 mt-2">
                    <span>Duration: {plan.duration} days</span>
                    <span>•</span>
                    <span>Meals: {plan.mealsPerDay}/day</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-orange-600">₹{plan.price}</p>
                  <p className="text-xs text-gray-500">+ delivery</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderDeliveryDetails = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => setStep('mealplan')} className="text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Delivery Details</h2>
          <p className="text-gray-600">Confirm your delivery address</p>
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Order Summary</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">{selectedMealPlan?.name}</span>
            <span className="font-semibold">₹{selectedMealPlan?.price}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Delivery Fee</span>
            <span className="font-semibold">₹{selectedNutritionist?.deliveryFee}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-orange-300">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-bold text-orange-600 text-lg">
              ₹{(selectedMealPlan?.price || 0) + (selectedNutritionist?.deliveryFee || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Delivery Instructions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Delivery Instructions (Optional)
        </label>
        <textarea
          placeholder="Any special instructions for delivery..."
          rows={3}
          onChange={(e) => setDeliveryDetails({ ...deliveryDetails, instructions: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      {/* Estimated Delivery */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-blue-900">Estimated Delivery Time</p>
          <p className="text-sm text-blue-700">{selectedNutritionist?.estimatedDuration} minutes from order confirmation</p>
        </div>
      </div>

      <Button
        onClick={handleMealPlanDelivery}
        disabled={loading}
        className="w-full bg-orange-600 hover:bg-orange-700 py-6 text-lg"
      >
        {loading ? 'Placing Order...' : 'Place Order & Track Delivery'}
      </Button>
    </div>
  );

  const renderDeliveryTracking = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Track Your Delivery</h2>
        <p className="text-gray-600">Order #{activeDelivery?.orderId}</p>
      </div>

      {/* Delivery Status */}
      <div className="bg-white rounded-xl border-2 border-orange-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
            <Truck className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 capitalize">
              {activeDelivery?.status?.replace(/_/g, ' ')}
            </p>
            <p className="text-sm text-gray-600">
              {activeDelivery?.deliveryPartnerName || 'Finding delivery partner...'}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-3">
          {['pending', 'confirmed', 'preparing', 'picked_up', 'in_transit', 'delivered'].map((status, idx) => {
            const isCompleted = activeDelivery?.status === status || idx < ['pending', 'confirmed', 'preparing', 'picked_up', 'in_transit', 'delivered'].indexOf(activeDelivery?.status);
            
            return (
              <div key={status} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  isCompleted ? 'bg-green-500' : 'bg-gray-200'
                }`}>
                  {isCompleted && <CheckCircle className="w-4 h-4 text-white" />}
                </div>
                <span className={`text-sm capitalize ${isCompleted ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                  {status.replace(/_/g, ' ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delivery Partner */}
      {activeDelivery?.deliveryPartnerName && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Navigation className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{activeDelivery.deliveryPartnerName}</p>
              <p className="text-sm text-gray-600">Delivery Partner</p>
            </div>
          </div>
          {activeDelivery.deliveryPartnerPhone && (
            <a href={`tel:${activeDelivery.deliveryPartnerPhone}`}>
              <Button variant="outline" size="sm">
                <Phone className="w-4 h-4 mr-2" />
                Call
              </Button>
            </a>
          )}
        </div>
      )}

      {/* OTP */}
      {activeDelivery?.deliveryOtp && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="font-semibold text-yellow-900 mb-1">Delivery OTP</p>
          <p className="text-3xl font-bold text-yellow-600 tracking-wider">{activeDelivery.deliveryOtp}</p>
          <p className="text-sm text-yellow-700 mt-1">Share this OTP with delivery partner</p>
        </div>
      )}

      <Button onClick={() => onBack?.()} variant="outline" className="w-full">
        Back to Home
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">
        {step === 'service' && renderServiceSelection()}
        {(step === 'consultation' || step === 'mealplan') && renderNutritionistSelection()}
        {step === 'mealplan' && selectedNutritionist && renderMealPlanSelection()}
        {step === 'delivery' && renderDeliveryDetails()}
        {step === 'tracking' && renderDeliveryTracking()}
      </div>
    </div>
  );
}
