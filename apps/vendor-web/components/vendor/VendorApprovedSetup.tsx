'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Check, ArrowRight, MapPin, Wrench, Sparkles } from 'lucide-react';

interface VendorApprovedSetupProps {
  vendorId: string;
  roleId?: string;
  onComplete: () => void;
}

export function VendorApprovedSetup({ vendorId, roleId, onComplete }: VendorApprovedSetupProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGetStarted = async () => {
    setIsSubmitting(true);

    try {
      // ✅ FIX: Get phone from localStorage (stored during auth)
      const phone = localStorage.getItem('vendorPhone') || localStorage.getItem('vendor_phone');
      
      if (!phone) {
        console.warn('⚠️ [VendorApprovedSetup] Phone not found in localStorage, proceeding to dashboard');
        toast.success('Welcome to your dashboard!');
        setTimeout(() => onComplete(), 800);
        return;
      }

      // ✅ FIX: Send phone (required by backend) instead of vendorId
      const payload = {
        phone, // Backend expects phone to look up vendor identity
        action: 'activate_dashboard_access'
      };

      console.log('📤 Activating dashboard access...', payload);

      // Try to update vendor status to allow dashboard access
      const data = await apiClient.post('/vendor/onboarding/activate', payload) as any;

      if (data && data.success) {
        console.log('✅ [VendorApprovedSetup] Dashboard access activated:', data);
        toast.success('Welcome to your dashboard! Complete your setup to go live.');
        
        // Short delay for smooth transition
        setTimeout(() => onComplete(), 800);
      } else {
        // If the endpoint doesn't exist or fails, still proceed to dashboard
        // The dashboard will show incomplete setup warnings
        console.warn('⚠️ [VendorApprovedSetup] Activate endpoint response:', data);
        toast.success('Welcome to your dashboard!');
        setTimeout(() => onComplete(), 800);
      }
    } catch (error: any) {
      console.warn('⚠️ [VendorApprovedSetup] Activate error (proceeding anyway):', error);
      // ✅ Even if endpoint fails, proceed to dashboard
      // Dashboard will show setup incomplete warnings and guide vendor
      toast.success('Welcome to your dashboard!');
      setTimeout(() => onComplete(), 800);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col w-full max-w-[430px] mx-auto">
      {/* Light Green Header Section */}
      <div className="bg-green-50 px-6 pt-12 pb-8 flex flex-col items-center">
        {/* Success Icon */}
        <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg">
          <Check className="w-12 h-12 text-white" strokeWidth={3} />
        </div>
        
        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">
          You're Approved!
        </h1>
        
        {/* Welcome Message */}
        <p className="text-gray-700 text-center mb-4 text-base">
          Welcome to WARMPAWS! Set up your services to start earning.
        </p>
        
        {/* Live Profile Banner */}
        <div className="bg-green-100 rounded-xl px-4 py-2.5 flex items-center gap-2 mt-2">
          <Sparkles className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-800 font-medium">
            Your profile is now live and visible to pet parents
          </p>
        </div>
      </div>

      {/* White Setup Section */}
      <div className="flex-1 -mt-6 bg-white rounded-t-[32px] px-6 pt-8 pb-12 space-y-6">
        {/* Service Coverage Area Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FF8C42] rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Service Coverage Area</h3>
              <p className="text-xs text-gray-500">Set how far you're willing to travel</p>
            </div>
          </div>
          
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 font-medium">Service Radius</span>
              <span className="text-[#FF8C42] font-semibold">2 KM</span>
            </div>
            
            {/* Slider placeholder - simplified */}
            <div className="relative h-2 bg-blue-100 rounded-full">
              <div className="absolute h-2 bg-[#FF8C42] rounded-full" style={{ width: '20%' }}></div>
              <div className="absolute w-6 h-6 bg-[#FF8C42] rounded-full -top-2 shadow-md" style={{ left: '18%' }}></div>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-3 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-red-500 mt-0.5" />
              <p className="text-xs text-gray-700">
                You'll receive bookings within 10 km of your location
              </p>
            </div>
          </div>
        </div>

        {/* Choose Your Service Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FF8C42] rounded-lg flex items-center justify-center">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900">Choose your Service</h3>
            </div>
            <button className="w-8 h-8 bg-[#FF8C42] rounded-full flex items-center justify-center">
              <span className="text-white text-xl font-bold">+</span>
            </button>
          </div>
          
          <div className="border-t border-gray-200 pt-4 space-y-3">
            {['General Consultation', 'Vaccination', 'Minor Surgery', 'Emergency Care', 'Health Checkup'].map((service, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-6 bg-gray-300 rounded-full relative">
                    <div className="absolute w-5 h-5 bg-gray-400 rounded-full top-0.5 left-0.5"></div>
                  </div>
                  <span className="text-sm text-gray-900 font-medium">{service}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 block">Suggested</span>
                  <span className="text-sm text-gray-600 font-medium">
                    ₹{['500', '1,500', '4,000', '1,000', '800'][idx]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Setup Process Section */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FF8C42] rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900">Setup Process</h3>
          </div>
          
          <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
            <span className="text-yellow-600 text-lg">⚠️</span>
            <p className="text-sm text-red-600 font-medium">
              Please select at least one service to continue
            </p>
          </div>
          
          <Button 
            onClick={handleGetStarted}
            disabled={isSubmitting}
            className="w-full bg-orange-200 text-gray-600 h-14 rounded-xl font-bold text-base disabled:opacity-70"
          >
            {isSubmitting ? 'Starting...' : 'Get started'}
          </Button>
          
          <div className="flex items-center gap-2 text-center justify-center pt-2">
            <span className="text-lg">💡</span>
            <p className="text-sm text-orange-300">
              You can always modify your services and prices later from the dashboard
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}