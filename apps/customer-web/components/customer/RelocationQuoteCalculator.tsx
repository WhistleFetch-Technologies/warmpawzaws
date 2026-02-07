"use client";

import { useState } from 'react';
import { ArrowLeft, Plane, Truck, Package, Shield, MapPin, Calculator, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface RelocationQuoteCalculatorProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
}

interface Quote {
  id: string;
  origin: string;
  destination: string;
  transportType: string;
  breakdown: {
    basePrice: number;
    cageCost: number;
    insuranceCost: number;
    handlingFee: number;
  };
  totalQuote: number;
  validUntil: string;
}

export function RelocationQuoteCalculator({
  phone,
  customerPhone,
  customerId,
  onBack,
  onNavigate,
  onSuccess,
}: RelocationQuoteCalculatorProps) {
  const [step, setStep] = useState<'form' | 'quote' | 'booking'>('form');
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    transportType: 'road' as 'road' | 'air',
    petType: 'dog',
    petSize: 'medium' as 'small' | 'medium' | 'large' | 'extra_large',
    petWeight: '',
    numberOfPets: 1,
    preferredDate: '',
    specialRequirements: '',
    cageRequired: false,
    insuranceRequired: false,
  });

  const userPhone = customerPhone || phone;

  const transportOptions = [
    { id: 'road', icon: Truck, label: 'Road Transport', desc: 'Cost-effective for long distances', price: '₹8,000+' },
    { id: 'air', icon: Plane, label: 'Air Transport', desc: 'Faster for national/international', price: '₹15,000+' },
  ];

  const petSizes = [
    { id: 'small', label: 'Small', desc: 'Up to 5kg' },
    { id: 'medium', label: 'Medium', desc: '5-15kg' },
    { id: 'large', label: 'Large', desc: '15-30kg' },
    { id: 'extra_large', label: 'Extra Large', desc: '30kg+' },
  ];

  const handleGetQuote = async () => {
    if (!formData.origin || !formData.destination) {
      toast.error('Please enter origin and destination');
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.post<any>('/relocation/quote', {
        customerPhone: userPhone,
        customerId: customerId,
        ...formData,
        petWeight: formData.petWeight ? parseFloat(formData.petWeight) : undefined,
      });

      setQuote(response.quote);
      setStep('quote');
      toast.success('Quote generated successfully!');
    } catch (error) {
      console.error('Error generating quote:', error);
      toast.error('Failed to generate quote');
    } finally {
      setLoading(false);
    }
  };

  const handleBookRelocation = async () => {
    if (!quote) return;

    try {
      setLoading(true);
      const response = await apiClient.post<any>('/relocation/book', {
        quoteId: quote.id,
        customerId: customerId,
        paymentMethod: 'online',
      });

      toast.success('Relocation booked successfully!');
      onSuccess?.(response.booking?.id);
      // Navigate to booking confirmation or payment
      onNavigate?.('bookings', { bookingId: response.booking?.id });
    } catch (error) {
      console.error('Error booking relocation:', error);
      toast.error('Failed to book relocation');
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => (
    <div className="px-6 py-6 space-y-6">
      {/* Origin & Destination */}
      <Card className="p-4 space-y-4">
        <div>
          <Label className="mb-2 block">Origin City</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-500 w-5 h-5" />
            <Input
              placeholder="Enter pickup city"
              value={formData.origin}
              onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>
        <div>
          <Label className="mb-2 block">Destination City</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-red-500 w-5 h-5" />
            <Input
              placeholder="Enter delivery city"
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      {/* Transport Type */}
      <div>
        <Label className="mb-3 block">Transport Type</Label>
        <div className="grid grid-cols-2 gap-3">
          {transportOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setFormData({ ...formData, transportType: option.id as any })}
              className={`p-4 rounded-2xl border text-left transition-all ${
                formData.transportType === option.id
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <option.icon className={`w-6 h-6 mb-2 ${
                formData.transportType === option.id ? 'text-orange-600' : 'text-gray-400'
              }`} />
              <h3 className="font-semibold text-sm text-gray-900">{option.label}</h3>
              <p className="text-xs text-gray-500">{option.desc}</p>
              <p className="text-sm font-bold text-orange-600 mt-1">{option.price}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Pet Details */}
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Pet Details</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-2 block">Pet Type</Label>
            <select
              value={formData.petType}
              onChange={(e) => setFormData({ ...formData, petType: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="dog">Dog</option>
              <option value="cat">Cat</option>
              <option value="bird">Bird</option>
              <option value="rabbit">Rabbit</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <Label className="mb-2 block">Number of Pets</Label>
            <select
              value={formData.numberOfPets}
              onChange={(e) => setFormData({ ...formData, numberOfPets: parseInt(e.target.value) })}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label className="mb-3 block">Pet Size</Label>
          <div className="grid grid-cols-2 gap-2">
            {petSizes.map((size) => (
              <button
                key={size.id}
                onClick={() => setFormData({ ...formData, petSize: size.id as any })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  formData.petSize === size.id
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <h4 className="font-medium text-sm text-gray-900">{size.label}</h4>
                <p className="text-xs text-gray-500">{size.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Preferred Date */}
      <Card className="p-4">
        <Label className="mb-2 block">Preferred Date</Label>
        <Input
          type="date"
          value={formData.preferredDate}
          onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
          min={new Date().toISOString().split('T')[0]}
        />
      </Card>

      {/* Additional Options */}
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Additional Options</h3>
        
        <div className="space-y-3">
          <button
            onClick={() => setFormData({ ...formData, cageRequired: !formData.cageRequired })}
            className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
              formData.cageRequired
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Package className={`w-5 h-5 ${formData.cageRequired ? 'text-orange-600' : 'text-gray-400'}`} />
              <div className="text-left">
                <h4 className="font-medium text-sm text-gray-900">Travel Cage</h4>
                <p className="text-xs text-gray-500">IATA approved crate</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-orange-600">+₹2,000</span>
              {formData.cageRequired && <Check className="w-5 h-5 text-orange-600" />}
            </div>
          </button>

          <button
            onClick={() => setFormData({ ...formData, insuranceRequired: !formData.insuranceRequired })}
            className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
              formData.insuranceRequired
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Shield className={`w-5 h-5 ${formData.insuranceRequired ? 'text-orange-600' : 'text-gray-400'}`} />
              <div className="text-left">
                <h4 className="font-medium text-sm text-gray-900">Pet Insurance</h4>
                <p className="text-xs text-gray-500">Coverage during transit</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-orange-600">+₹1,500</span>
              {formData.insuranceRequired && <Check className="w-5 h-5 text-orange-600" />}
            </div>
          </button>
        </div>
      </Card>

      {/* Special Requirements */}
      <Card className="p-4">
        <Label className="mb-2 block">Special Requirements (Optional)</Label>
        <Textarea
          placeholder="Any special care instructions or requirements..."
          value={formData.specialRequirements}
          onChange={(e) => setFormData({ ...formData, specialRequirements: e.target.value })}
          rows={3}
        />
      </Card>

      {/* Get Quote Button */}
      <Button
        onClick={handleGetQuote}
        disabled={loading || !formData.origin || !formData.destination}
        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-6 text-lg"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Calculating...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Get Instant Quote
          </span>
        )}
      </Button>
    </div>
  );

  const renderQuote = () => (
    <div className="px-6 py-6 space-y-6">
      {quote && (
        <>
          {/* Quote Summary Card */}
          <Card className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <div className="text-center mb-6">
              <p className="text-sm text-orange-600 font-medium mb-1">Your Quote</p>
              <p className="text-4xl font-bold text-gray-900">₹{quote.totalQuote.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Valid until {new Date(quote.validUntil).toLocaleDateString()}</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Route</span>
                <span className="font-medium text-gray-900">{quote.origin} → {quote.destination}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Transport</span>
                <span className="font-medium text-gray-900 capitalize">{quote.transportType}</span>
              </div>
            </div>
          </Card>

          {/* Price Breakdown */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Price Breakdown</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Base Price</span>
                <span className="font-medium text-gray-900">₹{quote.breakdown.basePrice.toLocaleString()}</span>
              </div>
              {quote.breakdown.cageCost > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Travel Cage</span>
                  <span className="font-medium text-gray-900">₹{quote.breakdown.cageCost.toLocaleString()}</span>
                </div>
              )}
              {quote.breakdown.insuranceCost > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Insurance</span>
                  <span className="font-medium text-gray-900">₹{quote.breakdown.insuranceCost.toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Handling Fee</span>
                <span className="font-medium text-gray-900">₹{quote.breakdown.handlingFee.toLocaleString()}</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold text-xl text-orange-600">₹{quote.totalQuote.toLocaleString()}</span>
              </div>
            </div>
          </Card>

          {/* What's Included */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3">What's Included</h3>
            <div className="space-y-2">
              {[
                'Door-to-door pickup and delivery',
                'Climate-controlled transport',
                'Real-time GPS tracking',
                'Pet health check before travel',
                'Food and water during journey',
                '24/7 customer support',
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setStep('form')}
              className="flex-1"
            >
              Modify Quote
            </Button>
            <Button
              onClick={handleBookRelocation}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white"
            >
              {loading ? 'Booking...' : 'Book Now'}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto pb-24">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={step === 'quote' ? () => setStep('form') : onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {step === 'form' ? 'Get Relocation Quote' : 'Your Quote'}
            </h1>
            <p className="text-white/80 text-sm">
              {step === 'form' ? 'Calculate instant price' : 'Review and book'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-t-[32px] min-h-[calc(100vh-180px)]">
        {step === 'form' ? renderForm() : renderQuote()}
      </div>
    </div>
  );
}
