'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Clock, CheckCircle, FileText, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
// Removed unused imports - using apiClient instead

interface VendorApplicationStatusProps {
  vendorId: string;
  onApproved: () => void;
  onClarificationRequested?: (notes: string) => void;
  onBack?: () => void;
}

interface Application {
  id: string;
  status: string;
  submittedAt: string;
  fullName: string;
  reviewedAt?: string;
  clarificationNotes?: string;
}

export function VendorApplicationStatus({ vendorId, onApproved, onClarificationRequested, onBack }: VendorApplicationStatusProps) {
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApplicationStatus();
    
    // Poll every 10 seconds for faster updates
    const interval = setInterval(loadApplicationStatus, 10000);
    return () => clearInterval(interval);
  }, [vendorId]);

  const loadApplicationStatus = async () => {
    try {
      console.log('🔍 Loading application status for vendorId:', vendorId);
      
      // AWS Serverless compatible - use apiClient
      const data = await apiClient.get(`/vendor/application/status/${vendorId}`) as any;

      console.log('📦 Application data received:', data);
      
      // Handle response data (apiClient returns data directly, not Response object)
      const applicationData = data.application || data;
      setApplication(applicationData);
      
      // If approved, trigger callback
      if (applicationData.status === 'approved' && (data.canProceedToSetup || applicationData.canProceedToSetup)) {
        setTimeout(() => onApproved(), 2000);
      }
      
      // If clarification requested, trigger callback
      if (applicationData.status === 'clarification_requested' && onClarificationRequested && applicationData.clarificationNotes) {
        setTimeout(() => onClarificationRequested(applicationData.clarificationNotes), 1000);
      }
    } catch (error) {
      console.error('💥 Error loading application status:', error);
      console.error('💥 Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const submitted = new Date(dateString);
    const diffMs = now.getTime() - submitted.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white vendor-app-column flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-white vendor-app-column p-6">
        <p className="text-center text-gray-600">Application not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white vendor-app-column px-6 py-12">
      {onBack && (
        <div className="flex justify-start -mt-2 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
      )}
      {/* Status Icon */}
      <div className="text-center mb-8">
        <div className="w-32 h-32 bg-[#FF8C42] rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl animate-pulse">
          <Clock className="w-16 h-16 text-white" strokeWidth={2.5} />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Application<br/>Under Review
        </h1>
      </div>

      {/* Review Message */}
      <div className="text-center mb-6">
        <p className="text-gray-700 mb-4">
          We're reviewing your WARMPAWZ<br/>provider application
        </p>
        
        <div className="inline-flex items-center gap-2 bg-orange-100 border border-orange-200 rounded-full px-4 py-2">
          <Clock className="w-4 h-4 text-[#FF8C42]" />
          <span className="text-sm text-[#FF8C42] font-medium">
            Your application was submitted {getTimeAgo(application.submittedAt)}
          </span>
        </div>
      </div>

      {/* Review Process */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <FileText className="w-6 h-6 text-[#FF8C42]" />
          <h3 className="font-semibold text-gray-900">Review Process</h3>
        </div>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 mb-1">Application Submitted</h4>
              <p className="text-sm text-gray-600">Documents and profile received</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 animate-pulse">
              <div className="w-5 h-5 rounded-full bg-[#FF8C42]"></div>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 mb-1">Document Verification</h4>
              <p className="text-sm text-gray-600">Checking credentials and certificates</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <div className="w-5 h-5 rounded-full bg-gray-300"></div>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-400 mb-1">Final Approval</h4>
              <p className="text-sm text-gray-400">Account activation and setup</p>
            </div>
          </div>
        </div>
      </div>

      {/* Clarification Notes (if any) */}
      {application.clarificationNotes && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6">
          <h4 className="font-semibold text-blue-900 mb-2">Additional Information Requested</h4>
          <p className="text-sm text-blue-800">{application.clarificationNotes}</p>
        </div>
      )}

      {/* Expected Timeline */}
      <div className="bg-orange-50 rounded-2xl border border-orange-100 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-6 h-6 text-[#FF8C42]" />
          <h3 className="font-semibold text-gray-900">Expected Timeline</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Most applications are reviewed within</span>
            <span className="font-semibold text-[#FF8C42]">24-48 hours</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Peak hours:</span>
            <span className="font-semibold text-gray-900">9 AM - 6 PM (Mon-Fri)</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Current status:</span>
            <span className="font-semibold text-[#FF8C42]">Under Review</span>
          </div>
        </div>
      </div>

      {/* Support Options */}
      <div className="space-y-3">
        <p className="text-center text-sm text-gray-600 mb-3">Need Help?<br/>Have questions about your application status?</p>
        
        <Button
          variant="outline"
          className="w-full h-12 border-2 border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50 rounded-xl font-semibold"
          onClick={() => window.location.href = 'mailto:support@warmpawz.com'}
        >
          <Mail className="w-5 h-5 mr-2" />
          Email Support
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 border-2 border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50 rounded-xl font-semibold"
          onClick={() => window.location.href = 'tel:+919876543210'}
        >
          <Phone className="w-5 h-5 mr-2" />
          Call Support
        </Button>
      </div>
    </div>
  );
}