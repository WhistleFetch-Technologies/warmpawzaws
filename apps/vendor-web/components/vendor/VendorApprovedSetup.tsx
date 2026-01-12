'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { projectId, publicAnonKey } from '@/lib/supabase/info';
import { toast } from 'sonner';
import { Check, ArrowRight } from 'lucide-react';

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
      // Mark setup as complete without service configuration
      // The services will be configured in the dashboard or via specific role capabilities
      const payload = {
        vendorId,
        setupCompleted: true
      };

      console.log('📤 Completing setup (informative only)...', payload);

      const data = await apiClient.post('/vendor/setup/complete', payload) as any;

      if (data && data.success) {
        console.log('✅ [VendorApprovedSetup] Setup marked complete:', data);
        toast.success('Welcome to your dashboard!');
        
        // Short delay for smooth transition
        setTimeout(() => onComplete(), 800);
      } else {
        console.error('❌ [VendorApprovedSetup] Failed to complete setup:', data);
        toast.error(data?.error || 'Failed to proceed. Please try again.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('❌ [VendorApprovedSetup] Error completing setup:', error);
      toast.error('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-green-50 p-4 flex items-center justify-center">
      <div className="w-full max-w-[430px] mx-auto space-y-8">
        
        {/* Success Animation/Icon */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-28 h-28 bg-green-500 rounded-full flex items-center justify-center shadow-xl animate-bounce">
              <div className="w-20 h-20 border-4 border-white rounded-full flex items-center justify-center">
                <Check className="w-10 h-10 text-white" strokeWidth={4} />
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl">🎉</span>
            <h1 className="text-3xl font-bold text-gray-900">You're</h1>
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">Approved!</h1>
          
          <div className="space-y-1">
            <p className="text-lg text-gray-700 font-medium">Welcome to WARMPAWS!</p>
            <p className="text-gray-600">Your application has been verified.</p>
          </div>
        </div>

        {/* Informative Card */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 mx-2">
          <h3 className="font-bold text-gray-900 text-lg mb-4 text-center">What happens next?</h3>
          
          <div className="space-y-5">
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1 text-[#FF8C42] font-bold">1</div>
              <div>
                <h4 className="font-semibold text-gray-900">Access your Dashboard</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Get full access to manage your business, staff, and appointments.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1 text-[#FF8C42] font-bold">2</div>
              <div>
                <h4 className="font-semibold text-gray-900">Configure Services</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Set up your specific offerings, pricing, and availability from the settings.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1 text-[#FF8C42] font-bold">3</div>
              <div>
                <h4 className="font-semibold text-gray-900">Start Earning</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Once configured, you'll be visible to customers and ready to receive bookings.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 px-2">
          <Button 
            onClick={handleGetStarted}
            disabled={isSubmitting}
            className="w-full bg-[#FF8C42] hover:bg-[#e67a30] text-white h-14 rounded-xl font-bold text-lg shadow-lg transition-all transform hover:scale-[1.02] disabled:opacity-70 disabled:scale-100"
          >
            {isSubmitting ? 'Starting...' : 'Get Started'}
            {!isSubmitting && <ArrowRight className="w-5 h-5 ml-2" />}
          </Button>
        </div>

      </div>
    </div>
  );
}