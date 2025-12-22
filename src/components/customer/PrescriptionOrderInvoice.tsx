import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  CreditCard,
  Download,
  Eye,
  XCircle,
  Package,
  Truck
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { RazorpayPayment } from '../payment/RazorpayPayment';

interface PrescriptionOrder {
  id: string;
  prescriptionId: string;
  prescriptionNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vendorId: string;
  vendorName: string;
  status: 'pending_verification' | 'verified' | 'invoice_sent' | 'paid' | 'dispatched' | 'delivered' | 'rejected';
  prescriptionImage?: string;
  medications: Array<{
    name: string;
    dosage: string;
    quantity: number;
    frequency: string;
  }>;
  totalAmount?: number;
  invoiceId?: string;
  invoiceUrl?: string;
  invoiceNotes?: string;
  invoiceSentAt?: string;
  paymentConfirmedAt?: string;
  deliveryPartnerId?: string;
  trackingNumber?: string;
  createdAt: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

interface PrescriptionOrderInvoiceProps {
  phone: string;
  onBack: () => void;
  onPaymentSuccess?: (orderId: string) => void;
  onTrackOrder?: (orderId: string) => void;
}

export function PrescriptionOrderInvoice({ 
  phone, 
  onBack, 
  onPaymentSuccess,
  onTrackOrder 
}: PrescriptionOrderInvoiceProps) {
  const [orders, setOrders] = useState<PrescriptionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PrescriptionOrder | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadPrescriptionOrders();
  }, [phone]);

  const loadPrescriptionOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/customer/prescription-orders?phone=${phone}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      } else {
        console.error('Failed to load prescription orders');
        toast.error('Failed to load prescription orders');
      }
    } catch (error) {
      console.error('Error loading prescription orders:', error);
      toast.error('Error loading prescription orders');
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = (order: PrescriptionOrder) => {
    setSelectedOrder(order);
    setShowInvoiceModal(true);
  };

  const handlePayInvoice = (order: PrescriptionOrder) => {
    setSelectedOrder(order);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async (paymentId: string, orderId: string) => {
    try {
      // Confirm payment with backend
      const response = await fetch(
        `${API_BASE}/customer/prescription-orders/${orderId}/confirm-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            paymentId,
            invoiceId: selectedOrder?.invoiceId
          })
        }
      );

      if (response.ok) {
        toast.success('Payment confirmed! Order will be dispatched soon.');
        setShowPaymentModal(false);
        setSelectedOrder(null);
        await loadPrescriptionOrders();
        if (onPaymentSuccess) {
          onPaymentSuccess(orderId);
        }
      } else {
        toast.error('Failed to confirm payment');
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error('Error confirming payment');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_verification':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending Verification</Badge>;
      case 'verified':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case 'invoice_sent':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200"><FileText className="w-3 h-3 mr-1" />Invoice Sent</Badge>;
      case 'paid':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>;
      case 'dispatched':
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200"><Truck className="w-3 h-3 mr-1" />Dispatched</Badge>;
      case 'delivered':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><Package className="w-3 h-3 mr-1" />Delivered</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading prescription orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100">
        <div className="px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg">Prescription Orders</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {orders.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Prescription Orders</h3>
            <p className="text-gray-500">You haven't placed any prescription orders yet.</p>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">Order #{order.prescriptionNumber}</h3>
                  <p className="text-sm text-gray-500 mt-1">{order.vendorName}</p>
                </div>
                {getStatusBadge(order.status)}
              </div>

              <Separator className="my-3" />

              {/* Medications */}
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Medications:</p>
                <div className="space-y-1">
                  {order.medications?.slice(0, 2).map((med, idx) => (
                    <p key={idx} className="text-sm text-gray-600">
                      {med.name} - {med.dosage} ({med.quantity} units)
                    </p>
                  ))}
                  {order.medications?.length > 2 && (
                    <p className="text-sm text-gray-500">+{order.medications.length - 2} more</p>
                  )}
                </div>
              </div>

              {/* Invoice Amount */}
              {order.totalAmount && (
                <div className="mb-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Total Amount:</span> ₹{order.totalAmount}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                {order.prescriptionImage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedOrder(order);
                      setShowPrescriptionModal(true);
                    }}
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View Prescription
                  </Button>
                )}
                
                {order.status === 'invoice_sent' && order.totalAmount && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewInvoice(order)}
                      className="flex-1"
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      View Invoice
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handlePayInvoice(order)}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <CreditCard className="w-4 h-4 mr-1" />
                      Pay Now
                    </Button>
                  </>
                )}

                {order.status === 'dispatched' && order.trackingNumber && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (onTrackOrder) {
                        onTrackOrder(order.id);
                      }
                    }}
                    className="flex-1"
                  >
                    <Truck className="w-4 h-4 mr-1" />
                    Track Order
                  </Button>
                )}

                {order.status === 'paid' && (
                  <p className="text-sm text-green-600 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Payment confirmed. Order will be dispatched soon.
                  </p>
                )}
              </div>

              {/* Rejection Reason */}
              {order.status === 'rejected' && order.rejectionReason && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    <span className="font-medium">Rejected:</span> {order.rejectionReason}
                  </p>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Invoice Modal */}
      {showInvoiceModal && selectedOrder && (
        <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Proforma Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Invoice ID</p>
                <p className="font-medium">{selectedOrder.invoiceId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Pharmacy</p>
                <p className="font-medium">{selectedOrder.vendorName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="font-bold text-lg">₹{selectedOrder.totalAmount}</p>
              </div>
              {selectedOrder.invoiceNotes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-sm">{selectedOrder.invoiceNotes}</p>
                </div>
              )}
              {selectedOrder.invoiceUrl && (
                <Button
                  variant="outline"
                  onClick={() => window.open(selectedOrder.invoiceUrl, '_blank')}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Invoice
                </Button>
              )}
              <Button
                onClick={() => {
                  setShowInvoiceModal(false);
                  handlePayInvoice(selectedOrder);
                }}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                Pay Now
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedOrder && selectedOrder.totalAmount && (
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Pay Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Amount to Pay</p>
                <p className="text-2xl font-bold">₹{selectedOrder.totalAmount}</p>
              </div>
              <RazorpayPayment
                amount={selectedOrder.totalAmount * 100} // Convert to paise
                orderId={selectedOrder.id}
                customerId={phone}
                customerPhone={phone}
                customerName={selectedOrder.customerName}
                description={`Payment for prescription order ${selectedOrder.prescriptionNumber}`}
                onSuccess={(paymentId) => {
                  handlePaymentSuccess(paymentId, selectedOrder.id);
                }}
                onError={(error) => {
                  toast.error(`Payment failed: ${error}`);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Prescription View Modal */}
      {showPrescriptionModal && selectedOrder && selectedOrder.prescriptionImage && (
        <Dialog open={showPrescriptionModal} onOpenChange={setShowPrescriptionModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Prescription</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <img
                src={selectedOrder.prescriptionImage}
                alt="Prescription"
                className="w-full rounded-lg border border-gray-200"
              />
              <Button
                variant="outline"
                onClick={() => window.open(selectedOrder.prescriptionImage, '_blank')}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Prescription
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

