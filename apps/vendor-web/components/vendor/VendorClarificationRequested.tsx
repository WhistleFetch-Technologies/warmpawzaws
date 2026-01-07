'use client';

import { AlertCircle, ArrowRight, FileText } from 'lucide-react';

interface VendorClarificationRequestedProps {
  applicationId: string;
  clarificationNotes: string;
  reviewerName?: string;
  onCorrectAndResubmit: () => void;
}

export function VendorClarificationRequested({
  applicationId,
  clarificationNotes,
  reviewerName = 'Admin',
  onCorrectAndResubmit
}: VendorClarificationRequestedProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white w-full max-w-[430px] mx-auto flex flex-col px-0 py-8">
      {/* Icon */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mb-0">
          <AlertCircle className="w-12 h-12 text-primary" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-0">
          Clarification Required
        </h1>
        <p className="text-gray-600 text-sm">
          Application ID: <span className="font-semibold">{applicationId}</span>
        </p>
      </div>

      {/* Admin Comments */}
      <div className="bg-white rounded-2xl p-0 shadow-lg border border-orange-200 mb-0">
        <div className="flex items-start gap-0 mb-4">
          <FileText className="w-5 h-5 text-primary mt-0 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-0">Admin Feedback</h3>
            <p className="text-sm text-gray-600">From: {reviewerName}</p>
          </div>
        </div>
        
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
          <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">
            {clarificationNotes}
          </p>
        </div>
      </div>

      {/* Information Box */}
      <div className="bg-blue-50 rounded-2xl p-0 border border-blue-200 mb-0">
        <h3 className="font-semibold text-blue-900 mb-0">What to do next?</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-0">
            <span className="text-blue-600 font-bold">1.</span>
            <span>Review the admin's feedback carefully</span>
          </li>
          <li className="flex items-start gap-0">
            <span className="text-blue-600 font-bold">2.</span>
            <span>Go back to your application form</span>
          </li>
          <li className="flex items-start gap-0">
            <span className="text-blue-600 font-bold">3.</span>
            <span>Make the requested changes or upload missing documents</span>
          </li>
          <li className="flex items-start gap-0">
            <span className="text-blue-600 font-bold">4.</span>
            <span>Resubmit your application for review</span>
          </li>
        </ul>
      </div>

      {/* Support Info */}
      <div className="text-center mb-8 text-sm text-gray-600">
        <p>Need help? Contact support at</p>
        <a href="mailto:support@warmpawz.com" className="text-primary font-semibold">
          support@warmpawz.com
        </a>
      </div>

      {/* Action Button */}
      <div className="mt-auto">
        <button
          onClick={onCorrectAndResubmit}
          className="w-full bg-gradient-to-r from-primary to-orange-500 text-white py-4 rounded-xl text-lg font-semibold shadow-lg flex items-center justify-center gap-0 transition-all hover:shadow-xl"
        >
          Correct & Resubmit Application
          <ArrowRight className="w-5 h-5" />
        </button>
        
        <p className="text-center text-xs text-gray-500 mt-4">
          Your previous application data will be pre-filled for easy editing
        </p>
      </div>
    </div>
  );
}

