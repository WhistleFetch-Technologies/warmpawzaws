'use client';

import { X, AlertCircle, RefreshCw, Edit, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VendorApplicationRejectedProps {
  applicationId: string;
  rejectionReason: string;
  allowResubmit: boolean;
  onResubmit: () => void;
  onCorrectAndResubmit: () => void;
  onGoBack?: () => void;
}

export function VendorApplicationRejected({ 
  applicationId, 
  rejectionReason, 
  allowResubmit,
  onResubmit,
  onCorrectAndResubmit,
  onGoBack,
}: VendorApplicationRejectedProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white vendor-app-column px-6 py-12">
      {/* Rejection Icon */}
      <div className="text-center mb-8">
        <div className="w-32 h-32 bg-red-500 rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl">
          <X className="w-16 h-16 text-white" strokeWidth={3} />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Application Rejected
        </h1>
      </div>

      {/* Rejection Reason – shown to vendor so they can correct and re-submit */}
      <div className="bg-white rounded-2xl border-2 border-red-200 p-6 mb-6 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Reason</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{rejectionReason}</p>
            {rejectionReason === 'No reason provided' && (
              <p className="text-xs text-gray-500 mt-2">The admin did not add additional details. You can still correct and resubmit or choose another role.</p>
            )}
          </div>
        </div>
      </div>

      {/* Application ID */}
      <div className="text-center mb-6">
        <p className="text-sm text-gray-600">
          Application ID: <span className="font-semibold">#{applicationId}</span>
        </p>
      </div>

      {/* Next Actions when resubmit allowed */}
      {allowResubmit && (
        <div className="bg-orange-50 rounded-2xl p-6 mb-6">
          <h3 className="text-[#FF8C42] font-semibold mb-4">What&apos;s Next?</h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#FF8C42] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-white font-semibold">1</span>
              </div>
              <p className="text-sm text-gray-700">
                Review the feedback and understand what needs to be corrected
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#FF8C42] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-white font-semibold">2</span>
              </div>
              <p className="text-sm text-gray-700">
                Update your application with the required corrections
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#FF8C42] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-white font-semibold">3</span>
              </div>
              <p className="text-sm text-gray-700">
                Resubmit your application for review
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {allowResubmit ? (
          <>
            <Button
              onClick={onCorrectAndResubmit}
              className="w-full h-14 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white font-semibold rounded-xl shadow-lg"
            >
              <Edit className="w-5 h-5 mr-2" />
              Correct & Resubmit Application
            </Button>

            <Button
              onClick={onResubmit}
              variant="outline"
              className="w-full h-14 border-2 border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50 rounded-xl font-semibold"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Start Fresh Application
            </Button>
          </>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <p className="text-sm text-red-800 text-center">
              Unfortunately, you cannot resubmit this application at this time. Please contact support for assistance.
            </p>
            <Button
              variant="outline"
              className="w-full h-12 mt-4 border-2 border-red-500 text-red-500 hover:bg-red-50 rounded-xl font-semibold"
              onClick={() => window.location.href = 'mailto:support@warmpawz.com'}
            >
              Contact Support
            </Button>
          </div>
        )}

        {/* Go back: choose your role and re-submit, or log out – always shown */}
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-3">You can choose your role again and submit a new application, or log out.</p>
          {onGoBack ? (
            <Button
              variant="outline"
              onClick={onGoBack}
              className="w-full h-12 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-semibold"
            >
              <User className="w-5 h-5 mr-2" />
              Go back – Choose your role
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('vendorData');
                  localStorage.removeItem('vendorApplicationStatus');
                  localStorage.removeItem('vendorPhone');
                  localStorage.removeItem('vendorRole');
                  window.location.href = '/';
                }
              }}
              className="w-full h-12 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-semibold"
            >
              <User className="w-5 h-5 mr-2" />
              Go back – Choose your role
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.removeItem('vendorData');
                localStorage.removeItem('vendorApplicationStatus');
                localStorage.removeItem('vendorPhone');
                localStorage.removeItem('vendorRole');
                window.location.href = '/';
              }
            }}
            className="w-full h-11 mt-2 text-gray-600 hover:text-gray-800"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
      </div>

      {/* Support Message */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-500">
          Need help? Contact us at<br/>
          <a href="mailto:support@warmpawz.com" className="text-[#FF8C42] font-medium">support@warmpawz.com</a>
          {' '}or{' '}
          <a href="tel:+919876543210" className="text-[#FF8C42] font-medium">+91 98765 43210</a>
        </p>
      </div>
    </div>
  );
}
