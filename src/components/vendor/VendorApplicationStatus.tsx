import { useState, useEffect } from 'react';
import { Clock, CheckCircle, FileText, Mail, Phone, History, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

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

interface HistoryEntry {
  action: string;
  previousStatus?: string;
  newStatus: string;
  actionBy: string;
  notes?: string;
  timestamp: string;
}

export function VendorApplicationStatus({ vendorId, onApproved, onClarificationRequested }: VendorApplicationStatusProps) {
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadApplicationStatus();
    loadHistory();
    
    // Poll every 10 seconds for faster updates
    const interval = setInterval(() => {
      loadApplicationStatus();
      if (showHistory) {
        loadHistory();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [vendorId, showHistory]);

  const loadApplicationStatus = async () => {
    try {
      console.log('🔍 Loading application status for vendorId:', vendorId);
      
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/application/status/${vendorId}`;
      console.log('📡 Fetching from URL:', url);
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      console.log('📡 Application status response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📦 Application data received:', data);
        
        setApplication(data.application);
        
        // If approved, trigger callback
        if (data.application.status === 'approved' && data.canProceedToSetup) {
          setTimeout(() => onApproved(), 2000);
        }
        
        // If clarification requested, trigger callback
        if (data.application.status === 'clarification_requested' && onClarificationRequested && data.application.clarificationNotes) {
          setTimeout(() => onClarificationRequested(data.application.clarificationNotes), 1000);
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Application status error response:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          console.error('❌ Application status error:', errorData);
        } catch (e) {
          console.error('❌ Raw error:', errorText);
        }
      }
    } catch (error) {
      console.error('💥 Error loading application status:', error);
      console.error('💥 Error details:', {
        message: error.message,
        stack: error.stack
      });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/application/${vendorId}/history`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoadingHistory(false);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'pending_approval': 'Pending Approval',
      'under_review': 'Under Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'more_info_required': 'More Info Required',
      'resubmitted': 'Resubmitted',
      'withdrawn': 'Withdrawn'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
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
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white w-full max-w-[430px] mx-auto px-6 py-12">
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

      {/* Status History */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between mb-4"
          >
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 text-[#FF8C42]" />
              <h3 className="font-semibold text-gray-900">Application History</h3>
              <span className="text-sm text-gray-500">({history.length})</span>
            </div>
            {showHistory ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {showHistory && (
            <div className="space-y-4">
              {history.map((entry, index) => (
                <div key={index} className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    entry.newStatus === 'approved' ? 'bg-green-100' :
                    entry.newStatus === 'rejected' ? 'bg-red-100' :
                    entry.newStatus === 'more_info_required' ? 'bg-blue-100' :
                    'bg-gray-100'
                  }`}>
                    {entry.newStatus === 'approved' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Clock className={`w-5 h-5 ${
                        entry.newStatus === 'rejected' ? 'text-red-600' :
                        entry.newStatus === 'more_info_required' ? 'text-blue-600' :
                        'text-gray-600'
                      }`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-gray-900">
                        {getStatusLabel(entry.newStatus)}
                      </h4>
                      <span className="text-xs text-gray-500">{formatDate(entry.timestamp)}</span>
                    </div>
                    {entry.previousStatus && (
                      <p className="text-xs text-gray-500 mb-1">
                        Changed from {getStatusLabel(entry.previousStatus)}
                      </p>
                    )}
                    {entry.notes && (
                      <p className="text-sm text-gray-600 mt-1">{entry.notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">By: {entry.actionBy}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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