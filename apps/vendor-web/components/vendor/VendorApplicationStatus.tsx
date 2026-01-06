'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Clock, CheckCircle, FileText, Loader2 } from 'lucide-react';

interface VendorApplicationStatusProps {
  vendorId: string;
  onApproved: () => void;
  onClarificationRequested?: (notes: string) => void;
}

interface Application {
  id: string;
  status: string;
  submittedAt: string;
  fullName: string;
  reviewedAt?: string;
  clarificationNotes?: string;
}

export function VendorApplicationStatus({ vendorId, onApproved, onClarificationRequested }: VendorApplicationStatusProps) {
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApplicationStatus();
    const interval = setInterval(loadApplicationStatus, 10000);
    return () => clearInterval(interval);
  }, [vendorId]);

  const loadApplicationStatus = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/application/status/${vendorId}`);
      
      if (response.success && response.application) {
        setApplication(response.application);
        
        if (response.application.status === 'approved' && response.canProceedToSetup) {
          setTimeout(() => onApproved(), 2000);
        }
        
        if (response.application.status === 'clarification_requested' && onClarificationRequested && response.application.clarificationNotes) {
          setTimeout(() => onClarificationRequested(response.application.clarificationNotes), 1000);
        }
      }
    } catch (error) {
      console.error('Error loading application status:', error);
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
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto p-6">
        <p className="text-center text-gray-600">Application not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <div className="w-32 h-32 bg-orange-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl">
          <Clock className="w-16 h-16 text-white" strokeWidth={2.5} />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Application<br/>Under Review
        </h1>
      </div>

      <div className="text-center mb-6">
        <p className="text-gray-700 mb-4">
          We're reviewing your WARMPAWZ<br/>provider application
        </p>
        
        <div className="inline-flex items-center gap-2 bg-orange-100 border border-orange-200 rounded-full px-4 py-2">
          <Clock className="w-4 h-4 text-orange-600" />
          <span className="text-sm text-orange-600 font-medium">
            Submitted {getTimeAgo(application.submittedAt)}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <FileText className="w-6 h-6 text-orange-600" />
          <h3 className="font-semibold text-gray-900">Review Process</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Application Submitted</p>
              <p className="text-sm text-gray-600">Your application has been received</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-orange-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Under Review</p>
              <p className="text-sm text-gray-600">Our team is reviewing your application</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-500">Approval</p>
              <p className="text-sm text-gray-500">We'll notify you once approved</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>What's next?</strong> We typically review applications within 24-48 hours. You'll receive a notification once your application is reviewed.
        </p>
      </div>
    </div>
  );
}

