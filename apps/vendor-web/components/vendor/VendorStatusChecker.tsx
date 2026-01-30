'use client';

/**
 * Vendor Status Checker Component
 * Checks vendor application status and routes accordingly
 */

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { CheckCircle, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '@/lib/api-config';

interface VendorStatusResponse {
  status: 'pending' | 'approved' | 'rejected' | 'more_info_required' | 'resubmitted' | 'not_found';
  hasApplication: boolean;
  vendorId?: string;
  applicationId?: string;
  fullName?: string;
  roleId?: string;
  roleName?: string;
  submittedAt?: string;
  canAccessDashboard?: boolean;
  rejectionReason?: string;
  canReapply?: boolean;
  infoRequestMessage?: string;
  infoRequiredFields?: string[];
  canEdit?: boolean;
  canResubmit?: boolean;
  approvedAt?: string;
  approvedBy?: string;
}

interface VendorStatusCheckerProps {
  phone: string;
  onStatusChecked: (status: VendorStatusResponse) => void;
  onNavigateToDashboard?: () => void;
  onNavigateToEdit?: (vendorId: string) => void;
}

export function VendorStatusChecker({ 
  phone, 
  onStatusChecked,
  onNavigateToDashboard,
  onNavigateToEdit
}: VendorStatusCheckerProps) {
  const [status, setStatus] = useState<VendorStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, [phone]);

  const checkStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Checking vendor status for phone:', phone);
      
      const data = await apiClient.get(`/vendor/status/${phone}`) as any;

      if (data && data.success) {
        console.log('✅ Status response:', data);
        setStatus(data);
        onStatusChecked(data);

        // Auto-navigate based on status
        if (data.status === 'approved' && data.canAccessDashboard) {
          // Vendor approved - navigate to dashboard
          setTimeout(() => {
            onNavigateToDashboard?.();
          }, 2000);
        }
      } else {
        console.error('❌ Failed to check status:', data);
        setError(data?.error || 'Failed to check application status');
      }
    } catch (err) {
      console.error('Error checking status:', err);
      setError('An error occurred while checking status');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#FF8C42] border-t-transparent mx-auto mb-4"></div>
          <h3 className="text-xl mb-2">Checking Application Status</h3>
          <p className="text-sm text-gray-600">Please wait...</p>
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md mx-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl text-center mb-2">Error</h3>
          <p className="text-sm text-gray-600 text-center mb-6">{error || 'Unknown error occurred'}</p>
          <button
            onClick={checkStatus}
            className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white rounded-xl flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render status-specific UI
  if (status.status === 'not_found') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md mx-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-xl text-center mb-2">No Application Found</h3>
          <p className="text-sm text-gray-600 text-center mb-6">
            We couldn't find any application associated with this phone number. Please complete the onboarding process first.
          </p>
        </div>
      </div>
    );
  }

  if (status.status === 'pending' || status.status === 'resubmitted') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md mx-4">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 relative">
            <Clock className="w-8 h-8 text-orange-600" />
            <div className="absolute top-0 right-0 w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
          </div>
          <h3 className="text-xl text-center mb-2">Application Under Review</h3>
          <p className="text-sm text-gray-600 text-center mb-4">
            Hi {status.fullName}! Your application for <strong>{status.roleName}</strong> is currently being reviewed by our team.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-900 mb-1">What happens next?</p>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Our team will review your documents</li>
                  <li>• You'll receive an SMS notification</li>
                  <li>• Approval usually takes 24-48 hours</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Submitted on {new Date(status.submittedAt || '').toLocaleDateString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Application ID: {status.applicationId}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status.status === 'approved') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md mx-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl text-center mb-2">🎉 Congratulations!</h3>
          <p className="text-sm text-gray-600 text-center mb-4">
            Your application has been <strong className="text-green-600">approved</strong>!
          </p>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-green-900 mb-1">You can now:</p>
                <ul className="text-xs text-green-800 space-y-1">
                  <li>• Access your vendor dashboard</li>
                  <li>• Manage your services and bookings</li>
                  <li>• Start earning with Warmpawz</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="text-center text-xs text-gray-500 mb-6">
            <p>Approved on {new Date(status.approvedAt || '').toLocaleDateString()}</p>
            <p className="mt-1">Redirecting to dashboard...</p>
          </div>
          <button
            onClick={() => onNavigateToDashboard?.()}
            className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white rounded-xl"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (status.status === 'rejected') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md mx-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl text-center mb-2">Application Not Approved</h3>
          <p className="text-sm text-gray-600 text-center mb-4">
            Unfortunately, your application for <strong>{status.roleName}</strong> was not approved at this time.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-900 mb-1">Reason:</p>
            <p className="text-sm text-red-800">{status.rejectionReason}</p>
          </div>
          {status.canReapply && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-blue-900">You can apply again</p>
                  <p className="text-xs text-blue-800 mt-1">
                    Please address the issues mentioned above and submit a new application.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status.status === 'more_info_required') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md mx-4">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </div>
          <h3 className="text-xl text-center mb-2">Additional Information Required</h3>
          <p className="text-sm text-gray-600 text-center mb-4">
            Our team needs some additional information to process your application.
          </p>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-orange-900 mb-2">Admin's message:</p>
            <p className="text-sm text-orange-800">{status.infoRequestMessage}</p>
            
            {status.infoRequiredFields && status.infoRequiredFields.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-orange-900 mb-1">Fields requiring attention:</p>
                <ul className="text-xs text-orange-800 space-y-1">
                  {status.infoRequiredFields.map((field, idx) => (
                    <li key={idx}>• {field}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button
            onClick={() => status.vendorId && onNavigateToEdit?.(status.vendorId)}
            className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white rounded-xl mb-3"
          >
            Edit & Resubmit Application
          </button>
          <p className="text-xs text-center text-gray-500">
            Application ID: {status.applicationId}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
