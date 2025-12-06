import { useState, useEffect } from 'react';
import { Check, X, Eye, Clock, DollarSign, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';

interface RateChangeRequest {
  id: string;
  vendorId: string;
  vendorName: string;
  businessName: string;
  vendorType: string;
  serviceStyle: string;
  services: Array<{
    serviceId: string;
    serviceName: string;
    customPrice: number;
    customDuration: number;
    customDescription?: string;
    isNewService: boolean;
  }>;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  metadata: {
    totalServices: number;
    newServices: number;
  };
}

interface AdminRateChangeApprovalProps {
  onBack?: () => void;
}

export function AdminRateChangeApproval({ onBack }: AdminRateChangeApprovalProps) {
  const [requests, setRequests] = useState<RateChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<RateChangeRequest | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      
      console.log('📋 Loading rate change requests...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/rate-change-requests`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Requests loaded:', data);
        setRequests(data.requests || []);
      } else {
        const error = await response.text();
        console.error('❌ Failed to load requests:', error);
        toast.error('Failed to load requests');
      }
    } catch (error) {
      console.error('❌ Error loading requests:', error);
      toast.error('Error loading requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    try {
      setProcessing(true);
      
      console.log(`✅ Approving request: ${selectedRequest.id}`);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/rate-change-requests/${selectedRequest.id}/decide`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'approve',
            adminNotes
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Request approved:', data);
        toast.success('Services approved and published successfully!');
        
        setShowApproveDialog(false);
        setSelectedRequest(null);
        setAdminNotes('');
        
        // Reload requests
        await loadRequests();
      } else {
        const error = await response.json();
        console.error('❌ Failed to approve:', error);
        toast.error(error.error || 'Failed to approve request');
      }
    } catch (error) {
      console.error('❌ Error approving request:', error);
      toast.error('Error approving request');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }

    try {
      setProcessing(true);
      
      console.log(`❌ Rejecting request: ${selectedRequest.id}`);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/rate-change-requests/${selectedRequest.id}/decide`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'reject',
            rejectionReason,
            adminNotes
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Request rejected:', data);
        toast.success('Request rejected and vendor notified');
        
        setShowRejectDialog(false);
        setSelectedRequest(null);
        setRejectionReason('');
        setAdminNotes('');
        
        // Reload requests
        await loadRequests();
      } else {
        const error = await response.json();
        console.error('❌ Failed to reject:', error);
        toast.error(error.error || 'Failed to reject request');
      }
    } catch (error) {
      console.error('❌ Error rejecting request:', error);
      toast.error('Error rejecting request');
    } finally {
      setProcessing(false);
    }
  };

  const getServiceStyleBadge = (style: string) => {
    const styles: Record<string, { icon: string; color: string; label: string }> = {
      'at_home': { icon: '🏠', color: 'bg-blue-100 text-blue-700', label: 'Home Visit' },
      'at_center': { icon: '🏥', color: 'bg-green-100 text-green-700', label: 'At Center' },
      'tele_consultation': { icon: '📱', color: 'bg-purple-100 text-purple-700', label: 'Tele' }
    };
    
    const styleInfo = styles[style] || styles['at_center'];
    
    return (
      <Badge className={`${styleInfo.color}`}>
        <span className="mr-1">{styleInfo.icon}</span>
        {styleInfo.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            {onBack && (
              <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold">Rate Change Requests</h1>
              <p className="text-gray-600">Review and approve vendor service submissions</p>
            </div>
          </div>
          
          <div className="flex gap-4 mt-4">
            <div className="bg-white rounded-lg p-4 flex-1 border">
              <div className="text-2xl font-bold text-[#FF8C42]">{requests.length}</div>
              <div className="text-sm text-gray-600">Pending Requests</div>
            </div>
            <div className="bg-white rounded-lg p-4 flex-1 border">
              <div className="text-2xl font-bold text-blue-600">
                {requests.reduce((sum, r) => sum + r.services.length, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Services</div>
            </div>
            <div className="bg-white rounded-lg p-4 flex-1 border">
              <div className="text-2xl font-bold text-green-600">
                {requests.reduce((sum, r) => sum + r.metadata.newServices, 0)}
              </div>
              <div className="text-sm text-gray-600">New Services</div>
            </div>
          </div>
        </div>

        {/* Requests List */}
        {requests.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Check className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="font-semibold text-lg mb-2">All Caught Up!</h3>
                <p className="text-gray-600">No pending rate change requests at the moment.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => (
              <Card key={request.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle>{request.businessName || request.vendorName}</CardTitle>
                        <Badge variant="outline">{request.vendorType}</Badge>
                      </div>
                      <CardDescription className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Submitted {formatDate(request.submittedAt)}
                      </CardDescription>
                    </div>
                    {getServiceStyleBadge(request.serviceStyle)}
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Services:</span>
                      <span className="font-semibold">{request.metadata.totalServices} total</span>
                    </div>
                    
                    {request.metadata.newServices > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-medium text-blue-700">
                            {request.metadata.newServices} custom service(s) added
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Services Preview */}
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                      {request.services.map((service, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-sm bg-white p-2 rounded"
                        >
                          <div className="flex-1">
                            <div className="font-medium flex items-center gap-2">
                              {service.serviceName}
                              {service.isNewService && (
                                <Badge variant="outline" className="text-xs">New</Badge>
                              )}
                            </div>
                            {service.customDescription && (
                              <p className="text-xs text-gray-500 mt-1">{service.customDescription}</p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <div className="font-semibold text-[#FF8C42]">₹{service.customPrice}</div>
                            <div className="text-xs text-gray-500">{service.customDuration} min</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedRequest(request);
                      setShowRejectDialog(true);
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      setSelectedRequest(request);
                      setShowApproveDialog(true);
                    }}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve & Publish
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Services</DialogTitle>
            <DialogDescription>
              This will publish {selectedRequest?.services.length} service(s) to the customer app immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-900 mb-2">Services to be published:</h4>
              <ul className="space-y-1">
                {selectedRequest?.services.map((service, index) => (
                  <li key={index} className="text-sm text-green-700">
                    • {service.serviceName} - ₹{service.customPrice}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <Label>Admin Notes (Optional)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add any notes for internal reference..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? 'Publishing...' : 'Approve & Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Services</DialogTitle>
            <DialogDescription>
              The vendor will be notified and can resubmit with corrections.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Rejection Reason *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why these services are being rejected..."
                rows={4}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                This will be sent to the vendor via notification
              </p>
            </div>

            <div>
              <Label>Admin Notes (Optional)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Internal notes (not sent to vendor)..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={processing || !rejectionReason.trim()}
              variant="destructive"
            >
              {processing ? 'Rejecting...' : 'Reject & Notify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
