'use client';

import React from 'react';
import { CheckCircle, Mail, Phone } from 'lucide-react';

interface VendorRegistrationSuccessProps {
  vendorName?: string;
  email?: string;
  phone?: string;
  onContinue?: () => void;
}

export function VendorRegistrationSuccess({ 
  vendorName, 
  email, 
  phone,
  onContinue 
}: VendorRegistrationSuccessProps) {
  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex flex-col items-center justify-center px-0">
      <div className="flex flex-col items-center mb-8">
        <div className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center shadow-2xl mb-0">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center">
            <CheckCircle className="w-16 h-16 text-green-500" strokeWidth={3} />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
          Registration<br/>Successful!
        </h1>

        <div className="text-center mb-0">
          <p className="text-lg text-gray-800 mb-0">
            Thank you for registering with WARMPAWZ
          </p>
          {vendorName && (
            <p className="text-base text-gray-600">
              Welcome, <strong>{vendorName}</strong>!
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 p-0 mb-8 w-full">
        <h3 className="font-semibold text-gray-900 mb-4">What's Next?</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-0">
            <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0 mt-0">
              <span className="text-white font-bold text-sm">1</span>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-0">Check Your Email</h4>
              {email && (
                <div className="flex items-center gap-0 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span>{email}</span>
                </div>
              )}
              <p className="text-sm text-gray-600 mt-0">We've sent you a verification email</p>
            </div>
          </div>
          
          <div className="flex items-start gap-0">
            <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0 mt-0">
              <span className="text-white font-bold text-sm">2</span>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-0">Complete Your Profile</h4>
              <p className="text-sm text-gray-600">Add your business details and services</p>
            </div>
          </div>

          <div className="flex items-start gap-0">
            <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0 mt-0">
              <span className="text-white font-bold text-sm">3</span>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-0">Wait for Approval</h4>
              <p className="text-sm text-gray-600">Our team will review your application</p>
            </div>
          </div>
        </div>
      </div>

      {onContinue && (
        <button
          onClick={onContinue}
          className="w-full py-4 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-semibold"
        >
          Continue to Dashboard
        </button>
      )}
    </div>
  );
}

