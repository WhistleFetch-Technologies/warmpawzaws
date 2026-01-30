import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Badge } from '../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { 
  ArrowLeft, Package, RefreshCw, CheckCircle, XCircle, Clock,
  TruckIcon, DollarSign, Search, Eye, MessageSquare, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface ReturnsManagementProps {
  onBack: () => void;
}

interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  amount: number;
  reason: string;
  reasonCategory: 'damaged' | 'wrong_item' | 'not_as_described' | 'defective' | 'other';
  description: string;
  images: string[];
  requestType: 'return' | 'exchange';
  exchangeProductId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'picked_up' | 'refunded' | 'exchanged';
  createdAt: string;
  approvedAt?: string;
  refundedAt?: string;
  refundAmount?: number;
  refundMethod?: string;
  adminNotes?: string;
  vendorId: string;
  vendorName: string;
}

export function ReturnsManagement({ onBack }: ReturnsManagementProps) {
  const [loading, setLoading] = useState(false);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [filteredReturns, setFilteredReturns] = useState<ReturnRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  // Stats
  const [stats, setStats] = useState({
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    totalRefundAmount: 0
  });

  useEffect(() => {
    loadReturns();
    loadStats();
  }, []);

  useEffect(() => {
    filterReturns();
  }, [searchQuery, statusFilter, returns]);

  const API_BASE = getApiBaseUrl();

  const loadReturns = async () => {
    setLoading(true);
    try {
      // GET /make-server-3dd53475/admin/returns
      const response = await fetch(
        `${API_BASE}/admin/returns`,
        {
          headers: {
            ...getAuthHeaders(),
            'apikey': publicAnonKey
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch returns');
      }

      const data = await response.json();
      setReturns(data.returns || []);
    } catch (error) {
      console.error('Error loading returns:', error);
      toast.error('Failed to load return requests');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // GET /make-server-3dd53475/admin/returns/stats
      const response = await fetch(
        `${API_BASE}/admin/returns/stats`,
        {
          headers: {
            ...getAuthHeaders(),
            'apikey': publicAnonKey
          }
        }
      );

      if (!response.ok) {
        console.warn('Stats endpoint might not be available yet');
        return;
      }

      const data = await response.json();
      if (data.success && data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const filterReturns = () => {
    let filtered = returns;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(r => 
        r.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.productName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredReturns(filtered);
  };

  const approveReturn = async (returnId: string) => {
    setLoading(true);
    try {
      // POST /make-server-3dd53475/admin/returns/{id}/approve
      const response = await fetch(
        `${getApiBaseUrl()}/admin/returns/${returnId}/approve`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ adminNotes })
        }
      );

      if (response.ok) {
        toast.success('Return request approved');
        loadReturns();
        loadStats();
        setShowDetailsModal(false);
      }
    } catch (error) {
      console.error('Error approving return:', error);
      toast.error('Failed to approve return');
    } finally {
      setLoading(false);
    }
  };

  const rejectReturn = async (returnId: string, reason: string) => {
    setLoading(true);
    try {
      // POST /make-server-3dd53475/admin/returns/{id}/reject
      const response = await fetch(
        `${getApiBaseUrl()}/admin/returns/${returnId}/reject`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason })
        }
      );

      if (response.ok) {
        toast.success('Return request rejected');
        loadReturns();
        loadStats();
        setShowDetailsModal(false);
      }
    } catch (error) {
      console.error('Error rejecting return:', error);
      toast.error('Failed to reject return');
    } finally {
      setLoading(false);
    }
  };

  const processRefund = async (returnId: string, amount: number) => {
    setLoading(true);
    try {
      // POST /make-server-3dd53475/admin/returns/{id}/refund
      const response = await fetch(
        `${getApiBaseUrl()}/admin/returns/${returnId}/refund`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            amount,
            method: 'original_payment',
            notes: adminNotes
          })
        }
      );

      if (response.ok) {
        toast.success('Refund processed successfully');
        loadReturns();
        loadStats();
        setShowDetailsModal(false);
      }
    } catch (error) {
      console.error('Error processing refund:', error);
      toast.error('Failed to process refund');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-blue-100 text-blue-700',
      rejected: 'bg-red-100 text-red-700',
      picked_up: 'bg-purple-100 text-purple-700',
      refunded: 'bg-green-100 text-green-700',
      exchanged: 'bg-teal-100 text-teal-700'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getReasonLabel = (category: string) => {
    const labels = {
      damaged: 'Damaged Product',
      wrong_item: 'Wrong Item',
      not_as_described: 'Not As Described',
      defective: 'Defective Product',
      other: 'Other'
    };
    return labels[category as keyof typeof labels] || category;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Returns & Refunds</h1>
                <p className="text-sm text-gray-500">Manage product returns and refund requests</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 text-yellow-700 p-3 rounded-lg">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendingCount}</p>
                <p className="text-sm text-gray-500">Pending</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 text-blue-700 p-3 rounded-lg">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.approvedCount}</p>
                <p className="text-sm text-gray-500">Approved</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 text-red-700 p-3 rounded-lg">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.rejectedCount}</p>
                <p className="text-sm text-gray-500">Rejected</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 text-green-700 p-3 rounded-lg">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{(stats.totalRefundAmount / 1000).toFixed(0)}K</p>
                <p className="text-sm text-gray-500">Total Refunded</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search by order number, customer, or product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {['all', 'pending', 'approved', 'refunded', 'rejected'].map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={statusFilter === status ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(status)}
                  className={statusFilter === status ? 'bg-[#FF8C42] hover:bg-[#ff7a28]' : ''}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Returns List */}
        <div className="space-y-4">
          {filteredReturns.length === 0 ? (
            <Card className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No return requests found</p>
            </Card>
          ) : (
            filteredReturns.map((returnReq) => (
              <Card key={returnReq.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-6">
                  {/* Product Image */}
                  <div className="text-6xl">{returnReq.productImage}</div>

                  {/* Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg mb-1">{returnReq.productName}</h3>
                        <p className="text-sm text-gray-500">Order: {returnReq.orderNumber}</p>
                      </div>
                      <Badge className={getStatusColor(returnReq.status)}>
                        {returnReq.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Customer</p>
                        <p className="font-medium">{returnReq.customerName}</p>
                        <p className="text-xs text-gray-500">{returnReq.customerPhone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Vendor</p>
                        <p className="font-medium">{returnReq.vendorName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Amount</p>
                        <p className="font-bold text-[#FF8C42]">₹{returnReq.amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Type</p>
                        <Badge variant="outline">{returnReq.requestType}</Badge>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-medium mb-1">Reason: {getReasonLabel(returnReq.reasonCategory)}</p>
                      <p className="text-sm text-gray-600">{returnReq.description}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedReturn(returnReq);
                          setAdminNotes(returnReq.adminNotes || '');
                          setShowDetailsModal(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </Button>

                      {returnReq.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => approveReturn(returnReq.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => {
                              const reason = prompt('Enter rejection reason:');
                              if (reason) rejectReturn(returnReq.id, reason);
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}

                      {returnReq.status === 'approved' && returnReq.requestType === 'return' && (
                        <Button
                          size="sm"
                          className="bg-[#FF8C42] hover:bg-[#ff7a28]"
                          onClick={() => processRefund(returnReq.id, returnReq.amount)}
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Process Refund
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Return Request Details</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowDetailsModal(false)}>
                  ✕
                </Button>
              </div>

              <div className="space-y-6">
                {/* Product & Order Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-500">Product</Label>
                    <p className="font-medium">{selectedReturn.productName}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Order Number</Label>
                    <p className="font-medium">{selectedReturn.orderNumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Customer</Label>
                    <p className="font-medium">{selectedReturn.customerName}</p>
                    <p className="text-sm text-gray-500">{selectedReturn.customerPhone}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Vendor</Label>
                    <p className="font-medium">{selectedReturn.vendorName}</p>
                  </div>
                </div>

                {/* Return Details */}
                <div>
                  <Label className="text-sm text-gray-500">Reason</Label>
                  <p className="font-medium mb-2">{getReasonLabel(selectedReturn.reasonCategory)}</p>
                  <p className="text-sm">{selectedReturn.description}</p>
                </div>

                {/* Amount Info */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Order Amount</span>
                    <span className="font-medium">₹{selectedReturn.amount.toLocaleString()}</span>
                  </div>
                  {selectedReturn.refundAmount && (
                    <>
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-600">Refund Amount</span>
                        <span className="font-bold text-green-600">₹{selectedReturn.refundAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Refund Method</span>
                        <span className="font-medium">{selectedReturn.refundMethod}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Admin Notes */}
                <div>
                  <Label>Admin Notes</Label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add internal notes..."
                    className="mt-2"
                    rows={4}
                  />
                </div>

                {/* Timeline */}
                <div>
                  <Label className="mb-3 block">Timeline</Label>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 text-blue-700 p-2 rounded-full">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">Request Created</p>
                        <p className="text-sm text-gray-500">
                          {new Date(selectedReturn.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {selectedReturn.approvedAt && (
                      <div className="flex items-start gap-3">
                        <div className="bg-green-100 text-green-700 p-2 rounded-full">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium">Approved</p>
                          <p className="text-sm text-gray-500">
                            {new Date(selectedReturn.approvedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedReturn.refundedAt && (
                      <div className="flex items-start gap-3">
                        <div className="bg-[#FF8C42] text-white p-2 rounded-full">
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium">Refund Processed</p>
                          <p className="text-sm text-gray-500">
                            {new Date(selectedReturn.refundedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {selectedReturn.status === 'pending' && (
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => approveReturn(selectedReturn.id)}
                      disabled={loading}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve Return
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        const reason = prompt('Enter rejection reason:');
                        if (reason) rejectReturn(selectedReturn.id, reason);
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}

                {selectedReturn.status === 'approved' && !selectedReturn.refundedAt && (
                  <Button
                    className="w-full bg-[#FF8C42] hover:bg-[#ff7a28]"
                    onClick={() => processRefund(selectedReturn.id, selectedReturn.amount)}
                    disabled={loading}
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Process Refund of ₹{selectedReturn.amount.toLocaleString()}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}