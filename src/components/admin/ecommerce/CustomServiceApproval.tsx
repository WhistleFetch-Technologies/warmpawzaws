/**
 * CUSTOM SERVICE APPROVAL UI
 * 
 * Admin component for reviewing and approving custom services
 * Located in Admin > E-Commerce > Service Approval
 */

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../ui/dialog';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { 
  Package, CheckCircle, XCircle, Eye, Clock, Building2, DollarSign, 
  Calendar, User, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface CustomService {
  id: string;
  vendorId: string;
  vendorName: string;
  serviceName: string;
  description: string;
  price: number;
  duration: number;
  categoryName: string;
  subCategoryName: string;
  publishStatus: string;
  submittedForApprovalAt: string;
  createdAt: string;
  isPackage: boolean;
  packageDetails?: any;
}

export function CustomServiceApproval() {
  const [services, setServices] = useState<CustomService[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<CustomService | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadPendingServices();
  }, []);

  const loadPendingServices = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/custom-services/pending`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
      }
    } catch (error) {
      console.error('Error loading pending services:', error);
      toast.error('Failed to load pending services');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedService) return;

    setProcessing(true);
    try {
      const response = await fetch(
        `${API_BASE}/admin/custom-services/${selectedService.id}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            adminId: 'admin', // TODO: Get from session
            adminName: 'Admin',
            adminNote: adminNote || undefined
          })
        }
      );

      if (response.ok) {
        toast.success('Service approved successfully');
        setIsApprovalModalOpen(false);
        setIsDetailModalOpen(false);
        setSelectedService(null);
        setAdminNote('');
        loadPendingServices();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to approve service');
      }
    } catch (error) {
      toast.error('Error approving service');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedService) return;

    setProcessing(true);
    try {
      const response = await fetch(
        `${API_BASE}/admin/custom-services/${selectedService.id}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            adminId: 'admin', // TODO: Get from session
            adminName: 'Admin',
            rejectionReason: adminNote || 'Service does not meet platform standards'
          })
        }
      );

      if (response.ok) {
        toast.success('Service rejected');
        setIsRejectionModalOpen(false);
        setIsDetailModalOpen(false);
        setSelectedService(null);
        setAdminNote('');
        loadPendingServices();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to reject service');
      }
    } catch (error) {
      toast.error('Error rejecting service');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Custom Service Approval</h2>
          <p className="text-sm text-slate-500">
            Review and approve custom services created by vendors ({services.length} pending)
          </p>
        </div>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Clear!</h3>
            <p className="text-gray-600">No pending custom services for approval.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {services.map((service) => (
            <Card key={service.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-lg">{service.serviceName}</CardTitle>
                      {service.isPackage && (
                        <Badge variant="outline">Package</Badge>
                      )}
                      <Badge className="bg-yellow-100 text-yellow-700">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        <span>{service.vendorName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        <span>₹{service.price}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{service.duration} min</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        <span>{service.categoryName}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedService(service);
                        setIsDetailModalOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {service.description}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedService(service);
                      setIsRejectionModalOpen(true);
                    }}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
                    onClick={() => {
                      setSelectedService(service);
                      setIsApprovalModalOpen(true);
                    }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Service Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedService?.serviceName}</DialogTitle>
            <DialogDescription>
              Review service details before approval
            </DialogDescription>
          </DialogHeader>

          {selectedService && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Vendor</Label>
                  <p className="font-medium">{selectedService.vendorName}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Category</Label>
                  <p className="font-medium">{selectedService.categoryName}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Price</Label>
                  <p className="font-medium">₹{selectedService.price}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Duration</Label>
                  <p className="font-medium">{selectedService.duration} minutes</p>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-xs text-gray-500 mb-2 block">Description</Label>
                <p className="text-sm">{selectedService.description}</p>
              </div>

              {selectedService.isPackage && selectedService.packageDetails && (
                <div>
                  <Label className="text-xs text-gray-500 mb-2 block">Package Details</Label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <pre className="text-xs whitespace-pre-wrap">
                      {JSON.stringify(selectedService.packageDetails, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setIsRejectionModalOpen(true);
                  }}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button
                  className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setIsApprovalModalOpen(true);
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Modal */}
      <Dialog open={isApprovalModalOpen} onOpenChange={setIsApprovalModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Service</DialogTitle>
            <DialogDescription>
              Approve "{selectedService?.serviceName}" for publishing?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Admin Note (Optional)</Label>
              <Textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Add any notes about this approval..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing}
              className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
            >
              {processing ? 'Approving...' : 'Approve Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Modal */}
      <Dialog open={isRejectionModalOpen} onOpenChange={setIsRejectionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Service</DialogTitle>
            <DialogDescription>
              Reject "{selectedService?.serviceName}"? Vendor will be notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rejection Reason *</Label>
              <Textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Please provide a reason for rejection..."
                rows={4}
                required
              />
              <p className="text-xs text-gray-500">
                This reason will be shared with the vendor
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={processing || !adminNote.trim()}
              variant="destructive"
            >
              {processing ? 'Rejecting...' : 'Reject Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

