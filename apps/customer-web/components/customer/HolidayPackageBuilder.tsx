"use client";

import { useState } from 'react';
import { ArrowLeft, Palmtree, Calendar, MapPin, Users, Check, Plus, Minus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface HolidayPackageBuilderProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
}

export function HolidayPackageBuilder({
  phone,
  customerPhone,
  customerId,
  onBack,
  onNavigate,
  onSuccess,
}: HolidayPackageBuilderProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    destination: '',
    startDate: '',
    endDate: '',
    numberOfPets: 1,
    petTypes: ['dog'] as string[],
    accommodationType: 'standard' as 'standard' | 'premium' | 'luxury',
    activities: [] as string[],
    specialRequests: '',
  });

  const userPhone = customerPhone || phone;

  const destinations = [
    { id: 'goa', name: 'Goa Beach Resort', icon: '🏖️', popular: true },
    { id: 'himachal', name: 'Himachal Hills', icon: '⛰️', popular: true },
    { id: 'kerala', name: 'Kerala Backwaters', icon: '🌴', popular: false },
    { id: 'rajasthan', name: 'Rajasthan Desert Camp', icon: '🏜️', popular: false },
    { id: 'uttarakhand', name: 'Uttarakhand Mountains', icon: '🏔️', popular: true },
    { id: 'custom', name: 'Custom Destination', icon: '✨', popular: false },
  ];

  const accommodationOptions = [
    { id: 'standard', name: 'Standard', price: '₹5,000/day', desc: 'Comfortable pet-friendly rooms' },
    { id: 'premium', name: 'Premium', price: '₹8,000/day', desc: 'Spacious suites with garden access' },
    { id: 'luxury', name: 'Luxury', price: '₹12,000/day', desc: 'Private villa with pet amenities' },
  ];

  const activityOptions = [
    { id: 'beach_walk', name: 'Beach Walk', icon: '🏖️', price: 1500 },
    { id: 'hiking', name: 'Pet Hiking Trail', icon: '🥾', price: 2000 },
    { id: 'spa', name: 'Pet Spa Session', icon: '💆', price: 2500 },
    { id: 'photography', name: 'Pet Photoshoot', icon: '📸', price: 3000 },
    { id: 'training', name: 'Training Session', icon: '🎯', price: 2000 },
    { id: 'swimming', name: 'Pet Swimming', icon: '🏊', price: 1500 },
    { id: 'agility', name: 'Agility Course', icon: '🏃', price: 1800 },
    { id: 'socialization', name: 'Group Play', icon: '🐾', price: 1000 },
  ];

  const toggleActivity = (activityId: string) => {
    setFormData(prev => ({
      ...prev,
      activities: prev.activities.includes(activityId)
        ? prev.activities.filter(a => a !== activityId)
        : [...prev.activities, activityId],
    }));
  };

  const calculateDuration = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const calculatePrice = () => {
    const duration = calculateDuration();
    if (duration <= 0) return 0;

    let basePrice = 5000;
    if (formData.accommodationType === 'premium') basePrice = 8000;
    if (formData.accommodationType === 'luxury') basePrice = 12000;

    const accommodationTotal = basePrice * duration * formData.numberOfPets;
    const activitiesTotal = formData.activities.reduce((sum, actId) => {
      const activity = activityOptions.find(a => a.id === actId);
      return sum + (activity?.price || 0);
    }, 0);

    return accommodationTotal + activitiesTotal;
  };

  const handleSubmit = async () => {
    if (!formData.destination || !formData.startDate || !formData.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.post<any>('/holidays/build-package', {
        customerId,
        customerPhone: userPhone,
        ...formData,
      });

      setEstimatedPrice(response.customPackage?.estimatedPrice || calculatePrice());
      toast.success('Custom package request submitted!');
      setStep(4); // Show confirmation
    } catch (error) {
      console.error('Error submitting package request:', error);
      toast.error('Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Where would you like to go?</h2>
        <div className="grid grid-cols-2 gap-3">
          {destinations.map((dest) => (
            <button
              key={dest.id}
              onClick={() => setFormData({ ...formData, destination: dest.id === 'custom' ? '' : dest.name })}
              className={`p-4 rounded-2xl border text-left transition-all relative ${
                formData.destination === dest.name
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {dest.popular && (
                <span className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                  Popular
                </span>
              )}
              <span className="text-2xl mb-2 block">{dest.icon}</span>
              <h3 className="font-semibold text-sm text-gray-900">{dest.name}</h3>
            </button>
          ))}
        </div>
        {formData.destination === '' && (
          <div className="mt-4">
            <Input
              placeholder="Enter your destination..."
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              className="w-full"
            />
          </div>
        )}
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-2 block">Start Date</Label>
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div>
            <Label className="mb-2 block">End Date</Label>
            <Input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              min={formData.startDate || new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Number of Pets</Label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setFormData({ ...formData, numberOfPets: Math.max(1, formData.numberOfPets - 1) })}
              className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
            >
              <Minus className="w-5 h-5" />
            </button>
            <span className="text-2xl font-bold text-gray-900 w-8 text-center">{formData.numberOfPets}</span>
            <button
              onClick={() => setFormData({ ...formData, numberOfPets: Math.min(5, formData.numberOfPets + 1) })}
              className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </Card>

      <Button
        onClick={() => setStep(2)}
        disabled={!formData.destination || !formData.startDate || !formData.endDate}
        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-6"
      >
        Continue to Accommodation
      </Button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Choose your accommodation</h2>
        <div className="space-y-3">
          {accommodationOptions.map((acc) => (
            <button
              key={acc.id}
              onClick={() => setFormData({ ...formData, accommodationType: acc.id as any })}
              className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                formData.accommodationType === acc.id
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div>
                <h3 className="font-semibold text-gray-900">{acc.name}</h3>
                <p className="text-sm text-gray-500">{acc.desc}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-orange-600">{acc.price}</p>
                {formData.accommodationType === acc.id && (
                  <Check className="w-5 h-5 text-orange-600 ml-auto" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
          Back
        </Button>
        <Button
          onClick={() => setStep(3)}
          className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white"
        >
          Add Activities
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Add fun activities</h2>
        <div className="grid grid-cols-2 gap-3">
          {activityOptions.map((activity) => (
            <button
              key={activity.id}
              onClick={() => toggleActivity(activity.id)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                formData.activities.includes(activity.id)
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{activity.icon}</span>
                {formData.activities.includes(activity.id) && (
                  <Check className="w-5 h-5 text-orange-600" />
                )}
              </div>
              <h3 className="font-semibold text-sm text-gray-900">{activity.name}</h3>
              <p className="text-sm font-bold text-orange-600">₹{activity.price.toLocaleString()}</p>
            </button>
          ))}
        </div>
      </div>

      <Card className="p-4">
        <Label className="mb-2 block">Special Requests (Optional)</Label>
        <Textarea
          placeholder="Any dietary requirements, medical needs, or special requests..."
          value={formData.specialRequests}
          onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
          rows={3}
        />
      </Card>

      {/* Price Summary */}
      <Card className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
        <h3 className="font-semibold text-gray-900 mb-3">Package Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Destination</span>
            <span className="font-medium">{formData.destination}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Duration</span>
            <span className="font-medium">{calculateDuration()} days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Pets</span>
            <span className="font-medium">{formData.numberOfPets}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Accommodation</span>
            <span className="font-medium capitalize">{formData.accommodationType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Activities</span>
            <span className="font-medium">{formData.activities.length} selected</span>
          </div>
          <div className="border-t border-orange-200 pt-2 mt-2 flex justify-between">
            <span className="font-semibold text-gray-900">Estimated Total</span>
            <span className="font-bold text-xl text-orange-600">₹{calculatePrice().toLocaleString()}</span>
          </div>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white"
        >
          {loading ? 'Submitting...' : 'Get Quote'}
        </Button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <Check className="w-10 h-10 text-green-600" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Package Request Submitted!</h2>
        <p className="text-gray-600">
          We'll match you with the best travel partners and send you personalized quotes within 24 hours.
        </p>
      </div>

      <Card className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Estimated Price</span>
          <span className="text-2xl font-bold text-orange-600">
            ₹{(estimatedPrice || calculatePrice()).toLocaleString()}
          </span>
        </div>
      </Card>

      <div className="space-y-3">
        <Button
          onClick={() => onNavigate?.('bookings')}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-6"
        >
          View My Requests
        </Button>
        <Button
          variant="outline"
          onClick={onBack}
          className="w-full"
        >
          Back to Home
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto pb-24">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={step > 1 && step < 4 ? () => setStep(step - 1) : onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Build Your Holiday</h1>
            <p className="text-white/80 text-sm">Step {step} of 4</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full ${
                s <= step ? 'bg-white' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-t-[32px] px-6 pt-8 min-h-[calc(100vh-180px)]">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  );
}
