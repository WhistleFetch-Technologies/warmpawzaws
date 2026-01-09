'use client';

import { CheckCircle2, Clock, FileText, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

const logoImage = '/logo.png';

export function VendorRegistrationSuccess({ vendorId }: { vendorId: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="px-6 pt-16 pb-8 text-center">
        {/* Success Icon */}
        <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-2xl animate-bounce">
          <CheckCircle2 className="w-14 h-14 text-white" strokeWidth={3} />
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          Registration Submitted!
        </h1>
        <p className="text-gray-600 text-sm px-4">
          Your application has been successfully submitted for review
        </p>
      </div>

      {/* Reference ID Card */}
      <div className="px-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <p className="text-xs text-gray-600 mb-2 text-center">Your Reference ID</p>
          <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] rounded-xl p-4 mb-3">
            <p className="text-center text-white font-mono text-lg tracking-wider">
              {vendorId}
            </p>
          </div>
          <p className="text-xs text-gray-500 text-center">
            Save this ID for future reference
          </p>
        </div>
      </div>

      {/* Next Steps */}
      <div className="px-6 mb-8">
        <h3 className="font-bold text-gray-800 mb-4 text-center">What Happens Next?</h3>
        
        <div className="space-y-4">
          {/* Step 1 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800 mb-1">Document Verification</h4>
                <p className="text-sm text-gray-600">
                  Our team will verify your documents within 24-48 hours
                </p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-[#FF8C42]" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800 mb-1">Review Process</h4>
                <p className="text-sm text-gray-600">
                  Admin will review your application and may contact you if needed
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Home className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800 mb-1">Get Started</h4>
                <p className="text-sm text-gray-600">
                  Once approved, you'll receive login credentials to access your vendor dashboard
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Boxes */}
      <div className="px-6 space-y-4 mb-8">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-800 text-center">
            📧 You'll receive an email notification once your application is reviewed
          </p>
        </div>

        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <p className="text-sm text-amber-800 text-center">
            ⏱️ Average approval time: 24-48 hours
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4">
            <img src={logoImage} alt="Warmpawz" className="w-full h-full" />
          </div>
          <p className="text-sm text-gray-600 mb-1">Thank you for joining</p>
          <p className="font-bold text-gray-800">WARMPAWZ</p>
          <p className="text-xs text-gray-500 mt-4">
            For queries: support@warmpawz.com
          </p>
        </div>
      </div>
    </div>
  );
}
