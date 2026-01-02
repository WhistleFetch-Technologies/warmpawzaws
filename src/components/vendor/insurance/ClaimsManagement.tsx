import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Download, Eye, CheckCircle, XCircle, AlertCircle, Calendar, User, DollarSign } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import { Textarea } from '../../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/dialog';
// ✅ FIX: Removed Supabase imports - using API Gateway now
import { toast } from 'sonner';

interface Claim {
  id: string;
  claimNumber: string;
  policyNumber: string;
  planName: string;
  customerName: string;
  customerPhone: string;
  petName: string;
  petType: string;
  claimAmount: number;
  claimType: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'info_requested';
  submittedAt: string;
  documents: Array<{
    name: string;
    url: string;
    type: string;
  }>;
  vetDetails?: {
    name: string;
    clinicName: string;
    phone: string;
  };
  vendorResponse?: string;
  responseDate?: string;
}

export function ClaimsManagement({ 
  vendorId,
  claimId,
  onBack 
}: {
  vendorId: string;
  claimId: string;
  onBack: () => void;
}) {
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | 'request_info' | null>(null);
  const [response, setResponse] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadClaimDetails();
  }, [claimId]);

  const loadClaimDetails = async () => {
    try {
      setLoading(true);
      
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      const data = await apiCallJson<any>(
        `${API_GATEWAY_URL}/make-server-3dd53475/vendor/${vendorId}/insurance/claims/${claimId}`
      );

      // ✅ FIX: Handle standardized response format
      // Response format: { success: true, claim: {...}, ... }
      if (data.success) {
        setClaim(data.claim || data.data?.claim);
      } else {
        toast.error(data.error || data.message || 'Failed to load claim details');
      }
    } catch (error: any) {
      console.error('Error loading claim:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedAction || !response.trim()) {
      toast.error('Please provide a response');
      return;
    }

    try {
      setProcessing(true);

      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      const data = await apiCallJson<any>(
        `${API_GATEWAY_URL}/make-server-3dd53475/vendor/${vendorId}/insurance/claims/${claimId}/action`,
        {
          method: 'POST',
          body: JSON.stringify({
            action: selectedAction,
            response: response.trim()
          })
        }
      );

      if (data.success) {
        const actionLabel = selectedAction.replace('_', ' ');
        toast.success(`Claim ${actionLabel} successfully`);
        setActionDialogOpen(false);
        setResponse(''); // Clear response field
        await loadClaimDetails(); // ✅ Ensure claim details reload
      } else {
        toast.error(data.error || data.message || 'Failed to process claim action');
      }
    } catch (error: any) {
      console.error('Error processing claim:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading claim details...</div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Claim not found</div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'info_requested': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-xs text-blue-100">Claim #{claim.claimNumber}</div>
            <h1 className="text-lg font-bold">Claim Details</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Status Card */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Badge className={getStatusColor(claim.status)}>
              {claim.status === 'pending' && <AlertCircle className="w-4 h-4 mr-1" />}
              {claim.status === 'approved' && <CheckCircle className="w-4 h-4 mr-1" />}
              {claim.status === 'rejected' && <XCircle className="w-4 h-4 mr-1" />}
              {claim.status === 'info_requested' && <AlertCircle className="w-4 h-4 mr-1" />}
              {claim.status.replace('_', ' ').toUpperCase()}
            </Badge>
            <span className="text-xs text-gray-500">
              {new Date(claim.submittedAt).toLocaleDateString()}
            </span>
          </div>

          <div className="bg-orange-50 rounded-xl p-4 text-center">
            <div className="text-xs text-orange-600 mb-1">Claim Amount</div>
            <div className="text-3xl font-bold text-orange-900">
              ₹{claim.claimAmount.toLocaleString()}
            </div>
          </div>
        </Card>

        {/* Customer & Pet Details */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Customer & Pet Information</h3>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="w-5 h-5 text-gray-600" />
              <div>
                <div className="text-xs text-gray-500">Customer</div>
                <div className="font-semibold">{claim.customerName}</div>
                <div className="text-sm text-gray-600">{claim.customerPhone}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <span className="text-2xl">🐾</span>
              <div>
                <div className="text-xs text-blue-600">Pet</div>
                <div className="font-semibold text-blue-900">{claim.petName}</div>
                <div className="text-sm text-blue-700">{claim.petType}</div>
              </div>
            </div>

            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="text-xs text-purple-600">Policy</div>
              <div className="font-semibold text-purple-900">{claim.planName}</div>
              <div className="text-sm text-purple-700">#{claim.policyNumber}</div>
            </div>
          </div>
        </Card>

        {/* Claim Details */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Claim Information</h3>
          
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">Claim Type</div>
              <div className="font-medium">{claim.claimType}</div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Description</div>
              <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                {claim.description}
              </div>
            </div>

            {claim.vetDetails && (
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-xs text-green-600 mb-2">Veterinarian Details</div>
                <div className="text-sm">
                  <div className="font-semibold text-green-900">{claim.vetDetails.name}</div>
                  <div className="text-green-700">{claim.vetDetails.clinicName}</div>
                  <div className="text-green-700">{claim.vetDetails.phone}</div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Documents */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Supporting Documents ({claim.documents.length})
          </h3>
          
          <div className="space-y-2">
            {claim.documents.map((doc, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-sm font-medium">{doc.name}</div>
                    <div className="text-xs text-gray-500">{doc.type}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-gray-200 rounded-full">
                    <Eye className="w-4 h-4 text-gray-600" />
                  </button>
                  <button className="p-2 hover:bg-gray-200 rounded-full">
                    <Download className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Vendor Response */}
        {claim.vendorResponse && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Your Response</h3>
            <div className="text-sm text-blue-800 mb-2">{claim.vendorResponse}</div>
            <div className="text-xs text-blue-600">
              Responded on {new Date(claim.responseDate!).toLocaleDateString()}
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        {claim.status === 'pending' && (
          <div className="space-y-2">
            <Button
              onClick={() => {
                setSelectedAction('approve');
                setActionDialogOpen(true);
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve Claim
            </Button>

            <Button
              onClick={() => {
                setSelectedAction('request_info' as any);
                setActionDialogOpen(true);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Request More Information
            </Button>

            <Button
              onClick={() => {
                setSelectedAction('reject');
                setActionDialogOpen(true);
              }}
              variant="outline"
              className="w-full border-red-500 text-red-600 hover:bg-red-50"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject Claim
            </Button>
          </div>
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {selectedAction === 'approve' ? 'Approve Claim' : 
               selectedAction === 'reject' ? 'Reject Claim' : 
               'Request More Information'}
            </DialogTitle>
            <DialogDescription>
              {selectedAction === 'approve' ? 'Confirm claim approval and settlement amount.' : 
               selectedAction === 'reject' ? 'Provide a reason for claim rejection.' : 
               'Request additional information from the customer.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                {selectedAction === 'approve' && 'Approval Notes'}
                {selectedAction === 'reject' && 'Rejection Reason'}
                {selectedAction === 'request_info' && 'Information Needed'}
              </label>
              <Textarea
                value={response}
                onChange={e => setResponse(e.target.value)}
                placeholder={
                  selectedAction === 'approve'
                    ? 'e.g., Claim approved. Settlement will be processed within 3 business days.'
                    : selectedAction === 'reject'
                    ? 'e.g., Pre-existing condition not covered under policy.'
                    : 'e.g., Please provide original vet invoice and prescription.'
                }
                rows={4}
                className="mt-2"
              />
            </div>

            {selectedAction === 'approve' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-xs text-green-600 mb-1">Settlement Amount</div>
                <div className="text-2xl font-bold text-green-900">
                  ₹{claim.claimAmount.toLocaleString()}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Will be credited to customer account
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setActionDialogOpen(false);
                  setResponse('');
                  setSelectedAction(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={processing || !response.trim()}
                className={`flex-1 ${
                  selectedAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : selectedAction === 'reject'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {processing ? 'Processing...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}