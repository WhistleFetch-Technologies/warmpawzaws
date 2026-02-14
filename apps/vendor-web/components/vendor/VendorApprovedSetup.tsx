'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Check } from 'lucide-react';

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
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center w-full max-w-[430px] mx-auto px-6">
      <div className="w-full bg-white rounded-3xl shadow-sm border border-green-100 p-8 text-center">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <Check className="w-10 h-10 text-white" strokeWidth={3} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">You're Approved!</h1>
        <p className="text-gray-700 text-base mb-8">
          Welcome to WARMPAWS. Your account is approved and ready to go.
        </p>
        <Button
          onClick={handleGetStarted}
          disabled={isSubmitting}
          className="w-full bg-[#FF8C42] hover:bg-[#FF7A2F] text-white h-12 rounded-xl font-bold text-base disabled:opacity-70"
        >
          {isSubmitting ? 'Starting...' : 'Get started'}
        </Button>
      </div>
    </div>
  );
}
