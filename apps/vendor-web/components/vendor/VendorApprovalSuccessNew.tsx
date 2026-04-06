'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { getApiBaseUrl, getAuthHeaders } from '@/lib/api-config';
import { toast } from 'sonner';

interface VendorApprovalSuccessProps {
  vendorId: string;
  vendorType: string;
  serviceStyle: 'at_home' | 'at_center' | 'both';
  onSetupComplete: () => void;
}

export function VendorApprovalSuccessNew({ 
  vendorId, 
  onSetupComplete 
}: VendorApprovalSuccessProps) {
  const [loading, setLoading] = useState(false);

  const handleGetStarted = async () => {
    setLoading(true);
    try {
      // Mark vendor setup as complete - AWS Serverless compatible
      await apiClient.post('/vendor/setup/complete', { 
        vendorId,
        setupCompleted: true
      });
      toast.success('Welcome to Warmpawz! Taking you to your dashboard...');
      setTimeout(() => onSetupComplete(), 1000);
    } catch (error) {
      console.error('Error completing setup:', error);
      toast.error('Error completing setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white vendor-app-column flex flex-col items-center justify-center px-6">
      {/* Success Icon */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center shadow-2xl mb-6 animate-bounce">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center">
            <svg className="w-16 h-16 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
          🎉 You're<br/>Approved!
        </h1>

        {/* Welcome Message */}
        <div className="text-center mb-6">
          <p className="text-lg text-gray-800 mb-3">
            Welcome to WARMPAWZ! Set up<br/>your services to start earning
          </p>
          <p className="text-base text-green-600 font-semibold">
            Your profile is now live and visible to pet parents
          </p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 mb-8 shadow-lg w-full">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#FF8C42] flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-white font-bold">1</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Complete Your Dashboard Setup</h3>
              <p className="text-sm text-gray-600">Add your services, set pricing, and configure availability</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#FF8C42] flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-white font-bold">2</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Start Receiving Bookings</h3>
              <p className="text-sm text-gray-600">Pet parents can now find and book your services</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#FF8C42] flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-white font-bold">3</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Grow Your Business</h3>
              <p className="text-sm text-gray-600">Track earnings, manage bookings, and build your reputation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Get Started Button */}
      <Button
        onClick={handleGetStarted}
        disabled={loading}
        className="w-full h-14 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white font-semibold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Loading Dashboard...' : 'Get Started'}
      </Button>
      
      <p className="text-sm text-center text-gray-500 mt-4">
        You can add and modify your services anytime<br/>from your dashboard
      </p>
    </div>
  );
}