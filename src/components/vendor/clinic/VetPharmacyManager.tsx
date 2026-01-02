import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Pill, 
  Plus,
  Edit2,
  Trash2,
  Upload,
  FileText,
  Check,
  X,
  Clock,
  DollarSign,
  Package,
  AlertCircle,
  Send,
  Truck,
  Eye,
  Download
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';

interface VetPharmacyManagerProps {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
  embedded?: boolean;
}

interface Medicine {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  stock: number;
  minStock: number;
  price: number;
  expiryDate: string;
  batchNumber: string;
  requiresPrescription: boolean;
  isControlled: boolean;
}

interface PrescriptionOrder {
  id: string;
  orderId: string;
  customerName: string;
  petName: string;
  prescriptionUrl: string;
  medicines: Array<{
    medicineId: string;
    name: string;
    quantity: number;
    dosage: string;
  }>;
  totalAmount: number;
  status: 'pending_verification' | 'verified' | 'invoice_sent' | 'paid' | 'dispatched' | 'delivered';
  createdAt: string;
  verifiedAt?: string;
  invoiceUrl?: string;
  paymentConfirmedAt?: string;
  deliveryPartnerId?: string;
}

export function VetPharmacyManager({ vendorId, vendorData, onBack, embedded }: VetPharmacyManagerProps) {
  const [activeTab, setActiveTab] = useState<'inventory' | 'prescriptions' | 'orders'>('prescriptions');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [prescriptionOrders, setPrescriptionOrders] = useState<PrescriptionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PrescriptionOrder | null>(null);
  const [showAddMedicine, setShowAddMedicine] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadPharmacyData();
  }, [vendorId]);

  const loadPharmacyData = async () => {
    try {
      setLoading(true);
      
      // Load pharmacy inventory
      const inventoryRes = await fetch(`${API_BASE}/vendor/${vendorId}/pharmacy/inventory`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (inventoryRes.ok) {
        const data = await inventoryRes.json();
        setMedicines(data.medicines || []);
      }

      // Load prescription orders
      const ordersRes = await fetch(`${API_BASE}/vendor/${vendorId}/pharmacy/prescription-orders`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setPrescriptionOrders(data.orders || []);
      }

    } catch (error) {
      console.error('Error loading pharmacy data:', error);
      toast.error('Failed to load pharmacy data');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPrescription = async (orderId: string) => {
    try {
      const res = await fetch(`${API_BASE}/vendor/${vendorId}/pharmacy/verify-prescription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderId })
      });

      if (res.ok) {
        toast.success('Prescription verified successfully');
        loadPharmacyData();
      } else {
        toast.error('Failed to verify prescription');
      }
    } catch (error) {
      console.error('Error verifying prescription:', error);
      toast.error('Error verifying prescription');
    }
  };

  const handleSendInvoice = async () => {
    if (!selectedOrder) return;

    try {
      const res = await fetch(`${API_BASE}/vendor/${vendorId}/pharmacy/send-invoice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          amount: parseFloat(invoiceAmount),
          notes: invoiceNotes
        })
      });

      if (res.ok) {
        toast.success('Invoice sent to customer');
        setShowInvoiceModal(false);
        setSelectedOrder(null);
        setInvoiceAmount('');
        setInvoiceNotes('');
        loadPharmacyData();
      } else {
        toast.error('Failed to send invoice');
      }
    } catch (error) {
      console.error('Error sending invoice:', error);
      toast.error('Error sending invoice');
    }
  };

  const handleDispatchOrder = async (orderId: string) => {
    try {
      const res = await fetch(`${API_BASE}/vendor/${vendorId}/pharmacy/dispatch-order`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderId })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Delivery partner notified for pickup');
        loadPharmacyData();
      } else {
        toast.error('Failed to dispatch order');
      }
    } catch (error) {
      console.error('Error dispatching order:', error);
      toast.error('Error dispatching order');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending_verification: 'bg-yellow-100 text-yellow-700',
      verified: 'bg-blue-100 text-blue-700',
      invoice_sent: 'bg-purple-100 text-purple-700',
      paid: 'bg-green-100 text-green-700',
      dispatched: 'bg-orange-100 text-orange-700',
      delivered: 'bg-gray-100 text-gray-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending_verification: 'Pending Verification',
      verified: 'Verified',
      invoice_sent: 'Invoice Sent',
      paid: 'Payment Confirmed',
      dispatched: 'Out for Delivery',
      delivered: 'Delivered'
    };
    return labels[status] || status;
  };

  const renderPrescriptionOrders = () => (
    <div className="p-4 space-y-4">
      <div className="mb-4">
        <h2 className="font-semibold text-gray-900">Prescription Orders</h2>
        <p className="text-sm text-gray-600">Verify prescriptions and manage orders</p>
      </div>

      {prescriptionOrders.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">No Prescription Orders</h3>
          <p className="text-sm text-gray-600">
            Orders from customers will appear here
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {prescriptionOrders.map((order) => (
            <Card key={order.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">Order #{order.orderId}</h3>
                    <Badge className={getStatusColor(order.status)}>
                      {getStatusLabel(order.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{order.customerName} • {order.petName}</p>
                  <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg text-gray-900">₹{order.totalAmount}</p>
                </div>
              </div>

              {/* Prescription Preview */}
              <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Prescription Attached</span>
                  </div>
                  <a 
                    href={order.prescriptionUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </a>
                </div>
              </div>

              {/* Medicines List */}
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Medicines:</p>
                <div className="space-y-1">
                  {order.medicines.map((med, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                      <div>
                        <span className="font-medium text-gray-900">{med.name}</span>
                        <span className="text-gray-600 ml-2">({med.dosage})</span>
                      </div>
                      <span className="text-gray-600">Qty: {med.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions based on status */}
              <div className="flex gap-2 pt-3 border-t">
                {order.status === 'pending_verification' && (
                  <>
                    <Button 
                      onClick={() => handleVerifyPrescription(order.id)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Verify Prescription
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-red-600"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </>
                )}
                
                {order.status === 'verified' && (
                  <Button 
                    onClick={() => {
                      setSelectedOrder(order);
                      setInvoiceAmount(order.totalAmount.toString());
                      setShowInvoiceModal(true);
                    }}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                    size="sm"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    Send Invoice
                  </Button>
                )}

                {order.status === 'invoice_sent' && (
                  <Button 
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled
                  >
                    <Clock className="w-4 h-4 mr-1" />
                    Awaiting Payment
                  </Button>
                )}

                {order.status === 'paid' && (
                  <Button 
                    onClick={() => handleDispatchOrder(order.id)}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                    size="sm"
                  >
                    <Truck className="w-4 h-4 mr-1" />
                    Notify Delivery Partner
                  </Button>
                )}

                {order.status === 'dispatched' && (
                  <div className="flex-1 text-center py-2 bg-orange-50 rounded-lg text-sm font-medium text-orange-700">
                    Out for Delivery
                  </div>
                )}

                {order.status === 'delivered' && (
                  <div className="flex-1 text-center py-2 bg-green-50 rounded-lg text-sm font-medium text-green-700">
                    <Check className="w-4 h-4 inline mr-1" />
                    Delivered
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderInventory = () => (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">Pharmacy Inventory</h2>
          <p className="text-sm text-gray-600">Manage medicines and vaccines</p>
        </div>
        <Button 
          onClick={() => setShowAddMedicine(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Medicine
        </Button>
      </div>

      {medicines.length === 0 ? (
        <Card className="p-8 text-center">
          <Pill className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">No Medicines Added</h3>
          <p className="text-sm text-gray-600 mb-4">
            Add medicines to your pharmacy inventory
          </p>
          <Button onClick={() => setShowAddMedicine(true)}>
            Add Your First Medicine
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {medicines.map((medicine) => (
            <Card key={medicine.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Pill className="w-6 h-6 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{medicine.name}</h3>
                    <p className="text-sm text-gray-600">{medicine.manufacturer}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {medicine.requiresPrescription && (
                        <Badge className="bg-blue-100 text-blue-700 text-xs">Rx Required</Badge>
                      )}
                      {medicine.isControlled && (
                        <Badge className="bg-red-100 text-red-700 text-xs">Controlled</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">₹{medicine.price}</p>
                  <p className="text-xs text-gray-500">Batch: {medicine.batchNumber}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <span className="text-gray-600">Stock: </span>
                  <span className={`font-semibold ${medicine.stock <= medicine.minStock ? 'text-red-600' : 'text-green-600'}`}>
                    {medicine.stock} units
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Min Stock: </span>
                  <span className="font-semibold text-gray-900">{medicine.minStock} units</span>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Expires: </span>
                  <span className={`font-medium ${
                    new Date(medicine.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                      ? 'text-orange-600'
                      : 'text-gray-900'
                  }`}>
                    {new Date(medicine.expiryDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {medicine.stock <= medicine.minStock && (
                <div className="mb-3 p-2 bg-red-50 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4" />
                  <span>Low stock - Reorder required</span>
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t">
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-700">
                  <Trash2 className="w-3 h-3 mr-1" />
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Pill className="w-8 h-8 text-teal-600 animate-pulse mx-auto mb-2" />
          <p className="text-gray-600">Loading pharmacy...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        {!embedded && (
          <div className="p-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white sticky top-0 z-10">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={onBack} className="p-2 hover:bg-teal-500 rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="font-semibold text-lg">Pharmacy Management</h1>
                <p className="text-sm text-teal-100">{vendorData?.businessName}</p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('prescriptions')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'prescriptions'
                    ? 'bg-white text-teal-700'
                    : 'bg-teal-500 text-white hover:bg-teal-400'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-1" />
                Prescriptions
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'inventory'
                    ? 'bg-white text-teal-700'
                    : 'bg-teal-500 text-white hover:bg-teal-400'
                }`}
              >
                <Package className="w-4 h-4 inline mr-1" />
                Inventory
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {activeTab === 'prescriptions' && renderPrescriptionOrders()}
        {activeTab === 'inventory' && renderInventory()}
      </div>

      {/* Invoice Modal */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Proforma Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Total Amount (₹)
              </label>
              <Input
                type="number"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Additional Notes
              </label>
              <Textarea
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                placeholder="Payment instructions, delivery details, etc."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowInvoiceModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendInvoice}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Send className="w-4 h-4 mr-1" />
                Send Invoice
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
