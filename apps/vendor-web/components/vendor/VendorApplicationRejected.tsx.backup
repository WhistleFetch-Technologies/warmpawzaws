'use client';

import { X, AlertCircle, RefreshCw, Edit } from 'lucide-react';

interface VendorApplicationRejectedProps {
  applicationId: string;
  rejectionReason: string;
  allowResubmit: boolean;
  onResubmit: () => void;
  onCorrectAndResubmit: () => void;
}

export function VendorApplicationRejected({ 
  applicationId, 
  rejectionReason, 
  allowResubmit,
  onResubmit,
  onCorrectAndResubmit 
}: VendorApplicationRejectedProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white w-full max-w-[430px] mx-auto px-6 py-12">
      {/* Rejection Icon */}
      <div className="text-center mb-8">
        <div className="w-32 h-32 bg-red-500 rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl">
          <X className="w-16 h-16 text-white" strokeWidth={3} />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Application<br/>Needs Revision
        </h1>
      </div>

      {/* Rejection Reason */}
      <div className="bg-white rounded-2xl border-2 border-red-200 p-6 mb-6 shadow-lg">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Reason for Revision</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{rejectionReason}</p>
          </div>
        </div>
      </div>

      {/* Application ID */}
      <div className="text-center mb-6">
        <p className="text-sm text-gray-600">
          Application ID: <span className="font-semibold">#{applicationId}</span>
        </p>
      </div>

      {/* Next Actions */}
      {allowResubmit && (
        <div className="bg-orange-50 rounded-2xl p-6 mb-6">
          <h3 className="text-primary font-semibold mb-4">What's Next?</h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-white font-semibold">1</span>
              </div>
              <p className="text-sm text-gray-700">
                Review the feedback and understand what needs to be corrected
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-white font-semibold">2</span>
              </div>
              <p className="text-sm text-gray-700">
                Update your application with the required corrections
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
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
            <button
              onClick={onCorrectAndResubmit}
              className="w-full h-14 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 transition-all"
            >
              <Edit className="w-5 h-5" />
              Correct & Resubmit Application
            </button>

            <button
              onClick={onResubmit}
              className="w-full h-14 border-2 border-primary text-primary hover:bg-orange-50 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              Start Fresh Application
            </button>
          </>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <p className="text-sm text-red-800 text-center">
              Unfortunately, you cannot resubmit this application at this time. Please contact support for assistance.
            </p>
            <button
              className="w-full h-12 mt-4 border-2 border-red-500 text-red-500 hover:bg-red-50 rounded-xl font-semibold transition-all"
              onClick={() => window.location.href = 'mailto:support@warmpawz.com'}
            >
              Contact Support
            </button>
          </div>
        )}
      </div>

      {/* Support Message */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-500">
          Need help? Contact us at<br/>
          <a href="mailto:support@warmpawz.com" className="text-primary font-medium">support@warmpawz.com</a>
          {' '}or{' '}
          <a href="tel:+919876543210" className="text-primary font-medium">+91 98765 43210</a>
        </p>
      </div>
    </div>
  );
}

