import { useState, useEffect } from 'react';
import { X, Truck, Package, MapPin, Clock, Phone, CheckCircle, AlertCircle, Search, Filter } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner@2.0.3';

interface DeliveryManagementProps {
  vendorId: string;
  onClose: () => void;
}

interface Delivery {
  id: string;
  orderId: string;
  trackingNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  status: 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed';
  estimatedDelivery: string;
  actualDelivery?: string;
  courierPartner: string;
  items: any[];
  totalValue: number;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export function VendorDeliveryManagement({ vendorId, onClose }: DeliveryManagementProps) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_transit' | 'delivered'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    fetchDeliveries();
  }, [vendorId, filter]);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/vendor/delivery/${vendorId}?status=${filter === 'all' ? '' : filter}`,
        {
          headers: getAuthHeaders()
        }
      );

      const data = await response.json();
      if (data.success) {
        setDeliveries(data.deliveries || []);
      }
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      toast.error('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  };

  const updateDeliveryStatus = async (deliveryId: string, newStatus: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/vendor/delivery/${vendorId}/${deliveryId}/status`,
        {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: newStatus })
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Delivery status updated');
        fetchDeliveries();
        setShowDetailsModal(false);
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating delivery:', error);
      toast.error('Failed to update delivery status');
    }
  };

  const filteredDeliveries = deliveries.filter(d => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        d.customerName.toLowerCase().includes(query) ||
        d.trackingNumber.toLowerCase().includes(query) ||
        d.orderId.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const stats = {
    pending: deliveries.filter(d => d.status === 'pending').length,
    inTransit: deliveries.filter(d => d.status === 'in_transit' || d.status === 'out_for_delivery').length,
    delivered: deliveries.filter(d => d.status === 'delivered').length,
    total: deliveries.length
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-700 border-green-200';
      case 'out_for_delivery': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_transit': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'picked_up': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'failed': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return CheckCircle;
      case 'out_for_delivery':
      case 'in_transit':
      case 'picked_up': return Truck;
      case 'failed': return AlertCircle;
      default: return Package;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Truck className="w-7 h-7 text-purple-600" />
                Delivery Management
              </h2>
              <p className="text-sm text-gray-600 mt-1">Track and manage order deliveries</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-600">Total</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
              <div className="text-xs text-yellow-700">Pending</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-200">
              <div className="text-2xl font-bold text-purple-700">{stats.inTransit}</div>
              <div className="text-xs text-purple-700">In Transit</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
              <div className="text-2xl font-bold text-green-700">{stats.delivered}</div>
              <div className="text-xs text-green-700">Delivered</div>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-3 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer, tracking #, or order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'all' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Pending ({stats.pending})
            </button>
            <button
              onClick={() => setFilter('in_transit')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'in_transit' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              In Transit ({stats.inTransit})
            </button>
            <button
              onClick={() => setFilter('delivered')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'delivered' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Delivered
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-gray-600">Loading deliveries...</p>
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No deliveries found</p>
              <p className="text-sm text-gray-500 mt-1">
                {filter === 'pending' ? 'No pending deliveries' : 'Try changing your filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDeliveries.map((delivery) => {
                const StatusIcon = getStatusIcon(delivery.status);
                
                return (
                  <div
                    key={delivery.id}
                    className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-purple-300 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedDelivery(delivery);
                      setShowDetailsModal(true);
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getStatusColor(delivery.status).replace('text-', 'bg-').split(' ')[0]}`}>
                          <StatusIcon className={`w-6 h-6 ${getStatusColor(delivery.status).split(' ')[1]}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{delivery.customerName}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <Package className="w-4 h-4" />
                            <span>Order: {delivery.orderId}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <Truck className="w-4 h-4" />
                            <span>Tracking: {delivery.trackingNumber}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <MapPin className="w-4 h-4" />
                            <span className="line-clamp-1">{delivery.deliveryAddress}</span>
                          </div>
                        </div>
                      </div>

                      <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(delivery.status)}`}>
                        {delivery.status.replace('_', ' ').toUpperCase()}
                      </div>
                    </div>

                    {/* Delivery Info */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-xs text-gray-600 mb-1">Courier</div>
                        <div className="text-sm font-medium text-gray-900">{delivery.courierPartner}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-xs text-gray-600 mb-1">Est. Delivery</div>
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(delivery.estimatedDelivery).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-700 mb-2">
                        Items ({delivery.items?.length || 0})
                      </div>
                      <div className="flex gap-2 overflow-x-auto">
                        {delivery.items?.slice(0, 3).map((item: any, idx: number) => (
                          <div key={idx} className="flex-shrink-0 bg-purple-50 rounded-lg px-3 py-1 text-xs">
                            {item.name} (x{item.quantity})
                          </div>
                        ))}
                        {delivery.items?.length > 3 && (
                          <div className="flex-shrink-0 bg-gray-100 rounded-lg px-3 py-1 text-xs text-gray-600">
                            +{delivery.items.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `tel:${delivery.customerPhone}`;
                        }}
                        className="flex-1 py-2 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Phone className="w-4 h-4" />
                        Call Customer
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDelivery(delivery);
                          setShowDetailsModal(true);
                        }}
                        className="flex-1 py-2 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-medium transition-colors"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Details Modal */}
        {showDetailsModal && selectedDelivery && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Delivery Details
                </h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Customer</div>
                  <div className="text-gray-900">{selectedDelivery.customerName}</div>
                  <div className="text-sm text-gray-600">{selectedDelivery.customerPhone}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Delivery Address</div>
                  <div className="text-gray-900">{selectedDelivery.deliveryAddress}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Tracking</div>
                  <div className="text-gray-900">{selectedDelivery.trackingNumber}</div>
                  <div className="text-sm text-gray-600">via {selectedDelivery.courierPartner}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Status</div>
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedDelivery.status)}`}>
                    {selectedDelivery.status.replace('_', ' ').toUpperCase()}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Items</div>
                  <div className="space-y-2">
                    {selectedDelivery.items?.map((item: any, idx: number) => (
                      <div key={idx} className="bg-gray-50 rounded-lg p-2 flex justify-between">
                        <span className="text-sm">{item.name} (x{item.quantity})</span>
                        <span className="text-sm font-medium">₹{item.price}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between font-semibold">
                    <span>Total Value</span>
                    <span>₹{selectedDelivery.totalValue}</span>
                  </div>
                </div>

                {/* Update Status */}
                {selectedDelivery.status !== 'delivered' && selectedDelivery.status !== 'failed' && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Update Status</div>
                    <div className="flex flex-col gap-2">
                      {selectedDelivery.status === 'pending' && (
                        <button
                          onClick={() => updateDeliveryStatus(selectedDelivery.id, 'picked_up')}
                          className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                        >
                          Mark as Picked Up
                        </button>
                      )}
                      {(selectedDelivery.status === 'picked_up' || selectedDelivery.status === 'pending') && (
                        <button
                          onClick={() => updateDeliveryStatus(selectedDelivery.id, 'in_transit')}
                          className="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                        >
                          Mark as In Transit
                        </button>
                      )}
                      {(selectedDelivery.status === 'in_transit' || selectedDelivery.status === 'picked_up') && (
                        <button
                          onClick={() => updateDeliveryStatus(selectedDelivery.id, 'out_for_delivery')}
                          className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                          Mark as Out for Delivery
                        </button>
                      )}
                      {selectedDelivery.status === 'out_for_delivery' && (
                        <button
                          onClick={() => updateDeliveryStatus(selectedDelivery.id, 'delivered')}
                          className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                        >
                          Mark as Delivered
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
