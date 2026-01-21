'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  ArrowLeft, Shield, Clock, DollarSign, RefreshCw, 
  AlertTriangle, CheckCircle, XCircle, Calendar,
  FileText, HelpCircle, ChevronRight, Send, Truck,
  RotateCcw, CreditCard, Percent, Info, Star
} from 'lucide-react';
import { toast } from 'sonner';

interface VendorPolicyManagementProps {
  vendorId: string;
  onBack?: () => void;
  onClose?: () => void;
}

interface CancellationPolicy {
  cancellation_cutoff_hours: number;
  full_refund_before_hours: number;
  partial_refund_before_hours: number;
  partial_refund_percentage: number;
  no_refund_before_hours: number;
  reschedule_allowed: boolean;
  reschedule_cutoff_hours: number;
  max_reschedules: number;
}

interface RefundSummary {
  fullRefund: string;
  partialRefund: string;
  processingTime: string;
  methods: string;
}

interface ComplianceData {
  overallStatus: 'compliant' | 'warning' | 'non_compliant';
  score: number;
  metrics: {
    completionRate: number;
    cancellationRate: number;
    noShowRate: number;
    bookingsLast30Days: number;
  };
  documentCompliance: {
    gst: boolean;
    pan: boolean;
    bankDetails: boolean;
  };
  issues: string[];
  recommendations: string[];
}

interface PolicyData {
  vendor: {
    id: string;
    businessName: string;
    tier: string;
    commissionPercentage: number;
  };
  policies: {
    cancellation: {
      vendorRules: CancellationPolicy;
      summary: {
        fullRefund: string;
        partialRefund: string;
        noRefund: string;
        reschedule: string;
      };
    };
    refund: {
      summary: RefundSummary;
    };
    ecommerce: {
      hasReturnPolicy: boolean;
      hasShippingPolicy: boolean;
    };
    payout: {
      holdPeriodDays: number;
    };
  };
}

export function VendorPolicyManagement({ vendorId, onBack, onClose }: VendorPolicyManagementProps) {
  const handleBack = onBack || onClose;
  const [loading, setLoading] = useState(true);
  const [policyData, setPolicyData] = useState<PolicyData | null>(null);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'cancellation' | 'refund' | 'compliance' | 'request'>('overview');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    policyType: 'cancellation',
    requestType: '',
    justification: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [policiesRes, complianceRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/policies`),
        apiClient.get<any>(`/vendor/${vendorId}/policies/compliance`),
      ]);

      if (policiesRes.success) {
        setPolicyData(policiesRes as any);
      }
      if (complianceRes.success) {
        setCompliance(complianceRes.compliance);
      }
    } catch (error) {
      console.error('Error loading policy data:', error);
      // Set default data if API fails
      setPolicyData({
        vendor: {
          id: vendorId,
          businessName: 'Your Business',
          tier: 'Bronze',
          commissionPercentage: 15,
        },
        policies: {
          cancellation: {
            vendorRules: {
              cancellation_cutoff_hours: 24,
              full_refund_before_hours: 48,
              partial_refund_before_hours: 24,
              partial_refund_percentage: 50,
              no_refund_before_hours: 2,
              reschedule_allowed: true,
              reschedule_cutoff_hours: 12,
              max_reschedules: 2,
            },
            summary: {
              fullRefund: 'Cancel 48+ hours before for 100% refund',
              partialRefund: 'Cancel 24-48 hours before for 50% refund',
              noRefund: 'Cancel less than 2 hours before - no refund',
              reschedule: 'Reschedule allowed up to 12 hours before (max 2 times)',
            },
          },
          refund: {
            summary: {
              fullRefund: '48+ hours before booking',
              partialRefund: '50% refund for 24-48 hours',
              processingTime: '5-7 business days',
              methods: 'Wallet credit or original payment method',
            },
          },
          ecommerce: {
            hasReturnPolicy: false,
            hasShippingPolicy: false,
          },
          payout: {
            holdPeriodDays: 7,
          },
        },
      });
      setCompliance({
        overallStatus: 'compliant',
        score: 100,
        metrics: {
          completionRate: 100,
          cancellationRate: 0,
          noShowRate: 0,
          bookingsLast30Days: 0,
        },
        documentCompliance: {
          gst: false,
          pan: false,
          bankDetails: false,
        },
        issues: [],
        recommendations: ['Complete your profile to get started'],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!requestForm.requestType || !requestForm.justification) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post(`/vendor/${vendorId}/policies/exception-request`, requestForm);
      toast.success('Your request has been submitted. We will respond within 2-3 business days.');
      setShowRequestModal(false);
      setRequestForm({ policyType: 'cancellation', requestType: '', justification: '' });
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-600 bg-green-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'non_compliant': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'non_compliant': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-[#FF8C42] text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {handleBack && (
            <button onClick={handleBack} className="p-2 hover:bg-white/10 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold">Policy Management</h1>
            <p className="text-sm text-white/80">View policies & compliance</p>
          </div>
          <button 
            onClick={loadData}
            className="p-2 hover:bg-white/10 rounded-full"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex">
          {[
            { id: 'overview', label: 'Overview', icon: Shield },
            { id: 'cancellation', label: 'Cancellation', icon: XCircle },
            { id: 'refund', label: 'Refund', icon: RotateCcw },
            { id: 'compliance', label: 'Compliance', icon: CheckCircle },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && policyData && (
          <>
            {/* Tier & Commission Card */}
            <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B1A] rounded-xl p-4 text-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  <span className="font-semibold">{policyData.vendor.tier} Tier</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{policyData.vendor.commissionPercentage}%</div>
                  <div className="text-xs text-white/80">Platform Commission</div>
                </div>
              </div>
              <p className="text-sm text-white/90">
                Complete more bookings to unlock lower commission rates!
              </p>
            </div>

            {/* Compliance Status */}
            {compliance && (
              <div className={`rounded-xl p-4 ${getStatusColor(compliance.overallStatus)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(compliance.overallStatus)}
                    <span className="font-semibold capitalize">{compliance.overallStatus.replace('_', ' ')}</span>
                  </div>
                  <div className="text-2xl font-bold">{compliance.score}%</div>
                </div>
                <p className="text-sm">
                  {compliance.overallStatus === 'compliant' 
                    ? 'Great job! You are meeting all policy requirements.'
                    : `${compliance.issues.length} issue(s) need attention`}
                </p>
                <button
                  onClick={() => setActiveTab('compliance')}
                  className="text-sm font-medium mt-2 underline"
                >
                  View Details →
                </button>
              </div>
            )}

            {/* Quick Policy Summary */}
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Active Policies</h3>
                
                {/* Cancellation */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Cancellation Policy</div>
                      <div className="text-xs text-gray-500">
                        {policyData.policies.cancellation.vendorRules.full_refund_before_hours}h full, 
                        {policyData.policies.cancellation.vendorRules.partial_refund_before_hours}h partial
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>

                {/* Refund */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                      <RotateCcw className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Refund Policy</div>
                      <div className="text-xs text-gray-500">
                        {policyData.policies.refund.summary.processingTime}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>

                {/* Payout */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Payout Policy</div>
                      <div className="text-xs text-gray-500">
                        {policyData.policies.payout.holdPeriodDays} days hold period
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Request Change Button */}
            <button
              onClick={() => setShowRequestModal(true)}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 flex items-center justify-center gap-2"
            >
              <HelpCircle className="w-5 h-5" />
              Request Policy Exception
            </button>
          </>
        )}

        {/* Cancellation Tab */}
        {activeTab === 'cancellation' && policyData && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#FF8C42]" />
                Cancellation Windows
              </h3>

              <div className="space-y-4">
                {/* Full Refund */}
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">
                    100%
                  </div>
                  <div>
                    <div className="font-medium text-green-800">Full Refund</div>
                    <div className="text-sm text-green-700">
                      {policyData.policies.cancellation.summary.fullRefund}
                    </div>
                  </div>
                </div>

                {/* Partial Refund */}
                <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-yellow-500 text-white flex items-center justify-center font-bold text-sm">
                    {policyData.policies.cancellation.vendorRules.partial_refund_percentage}%
                  </div>
                  <div>
                    <div className="font-medium text-yellow-800">Partial Refund</div>
                    <div className="text-sm text-yellow-700">
                      {policyData.policies.cancellation.summary.partialRefund}
                    </div>
                  </div>
                </div>

                {/* No Refund */}
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm">
                    0%
                  </div>
                  <div>
                    <div className="font-medium text-red-800">No Refund</div>
                    <div className="text-sm text-red-700">
                      {policyData.policies.cancellation.summary.noRefund}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Reschedule Policy */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#FF8C42]" />
                Reschedule Policy
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Reschedule Allowed:</span>
                  <span className={`font-medium ${policyData.policies.cancellation.vendorRules.reschedule_allowed ? 'text-green-600' : 'text-red-600'}`}>
                    {policyData.policies.cancellation.vendorRules.reschedule_allowed ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cutoff Time:</span>
                  <span className="font-medium text-gray-900">
                    {policyData.policies.cancellation.vendorRules.reschedule_cutoff_hours} hours before
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Maximum Reschedules:</span>
                  <span className="font-medium text-gray-900">
                    {policyData.policies.cancellation.vendorRules.max_reschedules} times
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-800">
                    These policies are set by the platform to ensure fair treatment for both vendors and customers.
                    If you need a custom policy for your business, you can request an exception.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Refund Tab */}
        {activeTab === 'refund' && policyData && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#FF8C42]" />
                Refund Policy Details
              </h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <div className="font-medium text-gray-900">Full Refund Window</div>
                    <div className="text-sm text-gray-600">
                      {policyData.policies.refund.summary.fullRefund}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Percent className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <div className="font-medium text-gray-900">Partial Refund</div>
                    <div className="text-sm text-gray-600">
                      {policyData.policies.refund.summary.partialRefund}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <div className="font-medium text-gray-900">Processing Time</div>
                    <div className="text-sm text-gray-600">
                      {policyData.policies.refund.summary.processingTime}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <CreditCard className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <div className="font-medium text-gray-900">Refund Methods</div>
                    <div className="text-sm text-gray-600">
                      {policyData.policies.refund.summary.methods}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Impact on Vendor */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <h4 className="font-medium text-yellow-800 mb-2">Impact on Your Earnings</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Customer refunds are processed from collected payments</li>
                <li>• Your commission is adjusted based on refund amount</li>
                <li>• Vendor-initiated cancellations may affect your tier status</li>
              </ul>
            </div>
          </>
        )}

        {/* Compliance Tab */}
        {activeTab === 'compliance' && compliance && (
          <>
            {/* Score Card */}
            <div className={`rounded-xl p-4 ${getStatusColor(compliance.overallStatus)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium mb-1">Compliance Score</div>
                  <div className="text-4xl font-bold">{compliance.score}%</div>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-current flex items-center justify-center">
                  {getStatusIcon(compliance.overallStatus)}
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Performance Metrics (Last 30 Days)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {compliance.metrics.completionRate}%
                  </div>
                  <div className="text-xs text-gray-600">Completion Rate</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {compliance.metrics.cancellationRate}%
                  </div>
                  <div className="text-xs text-gray-600">Cancellation Rate</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {compliance.metrics.noShowRate}%
                  </div>
                  <div className="text-xs text-gray-600">No-Show Rate</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {compliance.metrics.bookingsLast30Days}
                  </div>
                  <div className="text-xs text-gray-600">Total Bookings</div>
                </div>
              </div>
            </div>

            {/* Document Compliance */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Document Compliance</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-700">GST Number</span>
                  {compliance.documentCompliance.gst ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle className="w-4 h-4" /> Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600 text-sm">
                      <XCircle className="w-4 h-4" /> Missing
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-700">PAN Number</span>
                  {compliance.documentCompliance.pan ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle className="w-4 h-4" /> Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-600 text-sm">
                      <AlertTriangle className="w-4 h-4" /> Not Provided
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-700">Bank Details</span>
                  {compliance.documentCompliance.bankDetails ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle className="w-4 h-4" /> Complete
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600 text-sm">
                      <XCircle className="w-4 h-4" /> Incomplete
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Issues */}
            {compliance.issues.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Issues to Address
                </h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {compliance.issues.map((issue, i) => (
                    <li key={i}>• {issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Recommendations
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                {compliance.recommendations.map((rec, i) => (
                  <li key={i}>• {rec}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Request Exception Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-[430px] rounded-t-2xl p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Policy Exception</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy Type
                </label>
                <select
                  value={requestForm.policyType}
                  onChange={(e) => setRequestForm({ ...requestForm, policyType: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                >
                  <option value="cancellation">Cancellation Policy</option>
                  <option value="refund">Refund Policy</option>
                  <option value="commission">Commission Rate</option>
                  <option value="payout">Payout Timing</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Request Type *
                </label>
                <select
                  value={requestForm.requestType}
                  onChange={(e) => setRequestForm({ ...requestForm, requestType: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                >
                  <option value="">Select request type...</option>
                  <option value="extend_window">Extend cancellation window</option>
                  <option value="reduce_window">Reduce cancellation window</option>
                  <option value="custom_percentage">Custom refund percentage</option>
                  <option value="reduce_commission">Request lower commission</option>
                  <option value="faster_payout">Request faster payout</option>
                  <option value="other">Other (specify in justification)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Justification *
                </label>
                <textarea
                  value={requestForm.justification}
                  onChange={(e) => setRequestForm({ ...requestForm, justification: e.target.value })}
                  placeholder="Explain why you need this exception..."
                  rows={4}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRequestModal(false)}
                className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={submitting || !requestForm.requestType || !requestForm.justification}
                className="flex-1 py-3 bg-[#FF8C42] text-white rounded-lg font-medium hover:bg-[#E67A32] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? 'Submitting...' : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VendorPolicyManagement;
