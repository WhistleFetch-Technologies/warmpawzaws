'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  Truck, Package, Search, Filter, MapPin, Clock, Check,
  AlertCircle, ArrowRight, Phone, Calendar, ChevronDown,
  ChevronUp, RefreshCcw, Eye, Edit, X
} from 'lucide-react';

interface Shipment {
  id: string;
  order_id: string;
  order_number: string;
  tracking_number: string;
  carrier: string;
  status: 'pending_pickup' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned' | 'failed';
  origin: {
    name: string;
    address: string;
    city: string;
    pincode: string;
  };
  destination: {
    name: string;
    address: string;
    city: string;
    pincode: string;
    phone: string;
  };
  items_count: number;
  weight: number;
  shipping_cost: number;
  estimated_delivery: string;
  actual_delivery?: string;
  created_at: string;
  updated_at: string;
  tracking_history: {
    status: string;
    location: string;
    timestamp: string;
    remarks?: string;
  }[];
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  pending_pickup: { color: 'text-amber-700', bg: 'bg-amber-100', label: 'Pending Pickup' },
  picked_up: { color: 'text-blue-700', bg: 'bg-blue-100', label: 'Picked Up' },
  in_transit: { color: 'text-indigo-700', bg: 'bg-indigo-100', label: 'In Transit' },
  out_for_delivery: { color: 'text-cyan-700', bg: 'bg-cyan-100', label: 'Out for Delivery' },
  delivered: { color: 'text-emerald-700', bg: 'bg-emerald-100', label: 'Delivered' },
  returned: { color: 'text-orange-700', bg: 'bg-orange-100', label: 'Returned' },
  failed: { color: 'text-red-700', bg: 'bg-red-100', label: 'Failed' },
};

const carriers = [
  { id: 'delhivery', name: 'Delhivery', logo: '🚚' },
  { id: 'bluedart', name: 'Blue Dart', logo: '📦' },
  { id: 'ecom_express', name: 'Ecom Express', logo: '🚀' },
  { id: 'shiprocket', name: 'ShipRocket', logo: '🛳️' },
];

export default function LogisticsManagement() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterCarrier, setFilterCarrier] = useState<string>('');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadShipments();
  }, [filterStatus, filterCarrier]);

  const loadShipments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterCarrier) params.append('carrier', filterCarrier);
      
      const result = await apiClient.get<any>(`/admin/logistics/shipments?${params.toString()}`);
      setShipments((result as any)?.shipments || []);
    } catch (err: any) {
      console.error('Error loading shipments:', err);
      setError(err.message || 'Failed to load shipments');
      setShipments([]);
    } finally {
      setLoading(false);
    }
  };

  const updateShipmentStatus = async (shipmentId: string, status: string, remarks?: string) => {
    try {
      setProcessing(true);
      await apiClient.post<any>(`/admin/logistics/shipments/${shipmentId}/status`, { 
        status,
        remarks,
        location: 'Admin Update'
      });
      await loadShipments();
      if (selectedShipment?.id === shipmentId) {
        setSelectedShipment(prev => prev ? { ...prev, status: status as any } : null);
      }
    } catch (err: any) {
      console.error('Error updating shipment status:', err);
      alert('Failed to update shipment status: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  const schedulePickup = async (shipmentId: string) => {
    try {
      setProcessing(true);
      await apiClient.post<any>(`/admin/logistics/shipments/${shipmentId}/schedule-pickup`, {});
      alert('Pickup scheduled successfully!');
      await loadShipments();
    } catch (err: any) {
      console.error('Error scheduling pickup:', err);
      alert('Failed to schedule pickup: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  const filteredShipments = shipments.filter(shipment => 
    shipment.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shipment.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shipment.destination?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: shipments.length,
    pending: shipments.filter(s => s.status === 'pending_pickup').length,
    inTransit: shipments.filter(s => ['picked_up', 'in_transit', 'out_for_delivery'].includes(s.status)).length,
    delivered: shipments.filter(s => s.status === 'delivered').length,
    issues: shipments.filter(s => ['returned', 'failed'].includes(s.status)).length,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Logistics Management</h1>
        <p className="text-slate-500">Track and manage all shipments</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-sm text-slate-500">Total Shipments</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              <p className="text-sm text-slate-500">Pending Pickup</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Truck className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-indigo-600">{stats.inTransit}</p>
              <p className="text-sm text-slate-500">In Transit</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{stats.delivered}</p>
              <p className="text-sm text-slate-500">Delivered</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.issues}</p>
              <p className="text-sm text-slate-500">Issues</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by tracking number, order..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-3 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        >
          <option value="">All Status</option>
          <option value="pending_pickup">Pending Pickup</option>
          <option value="in_transit">In Transit</option>
          <option value="out_for_delivery">Out for Delivery</option>
          <option value="delivered">Delivered</option>
          <option value="returned">Returned</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={filterCarrier}
          onChange={(e) => setFilterCarrier(e.target.value)}
          className="px-4 py-3 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        >
          <option value="">All Carriers</option>
          {carriers.map(carrier => (
            <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
          ))}
        </select>
        <button
          onClick={loadShipments}
          className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 flex items-center gap-2"
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500" />
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-300" />
          <p className="text-slate-600">{error}</p>
          <button onClick={loadShipments} className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg">
            Retry
          </button>
        </div>
      ) : filteredShipments.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <Truck className="w-16 h-16 mx-auto mb-4 text-slate-200" />
          <p className="text-slate-500">No shipments found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left p-4 font-semibold text-slate-600">Tracking</th>
                <th className="text-left p-4 font-semibold text-slate-600">Order</th>
                <th className="text-left p-4 font-semibold text-slate-600">Carrier</th>
                <th className="text-left p-4 font-semibold text-slate-600">Status</th>
                <th className="text-left p-4 font-semibold text-slate-600">Destination</th>
                <th className="text-left p-4 font-semibold text-slate-600">ETA</th>
                <th className="text-center p-4 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredShipments.map(shipment => {
                const status = statusConfig[shipment.status] || statusConfig.pending_pickup;
                const carrier = carriers.find(c => c.id === shipment.carrier);
                return (
                  <tr key={shipment.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-xl flex items-center justify-center">
                          <Truck className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-mono font-semibold text-slate-900">{shipment.tracking_number}</p>
                          <p className="text-sm text-slate-500">{shipment.items_count} items • {shipment.weight}kg</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-slate-900">#{shipment.order_number}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{carrier?.logo || '📦'}</span>
                        <span className="text-slate-600">{carrier?.name || shipment.carrier}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-slate-900">{shipment.destination?.name}</p>
                        <p className="text-sm text-slate-500">{shipment.destination?.city}, {shipment.destination?.pincode}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-slate-900">{shipment.estimated_delivery}</p>
                        {shipment.actual_delivery && (
                          <p className="text-sm text-emerald-600">Delivered: {shipment.actual_delivery}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setSelectedShipment(shipment); setShowDetails(true); }}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-slate-500" />
                        </button>
                        {shipment.status === 'pending_pickup' && (
                          <button
                            onClick={() => schedulePickup(shipment.id)}
                            disabled={processing}
                            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Schedule Pickup"
                          >
                            <Truck className="w-4 h-4 text-blue-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Shipment Details Modal */}
      {showDetails && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetails(false)} />
          <div className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Shipment Details</h2>
              <button onClick={() => setShowDetails(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Tracking Info */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl">
                <div>
                  <p className="text-sm text-indigo-600">Tracking Number</p>
                  <p className="text-xl font-mono font-bold text-indigo-900">{selectedShipment.tracking_number}</p>
                </div>
                <span className={`px-4 py-2 rounded-xl text-sm font-semibold ${statusConfig[selectedShipment.status].bg} ${statusConfig[selectedShipment.status].color}`}>
                  {statusConfig[selectedShipment.status].label}
                </span>
              </div>

              {/* Route */}
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm text-slate-500">From</span>
                  </div>
                  <p className="font-semibold text-slate-900">{selectedShipment.origin?.name}</p>
                  <p className="text-slate-600">{selectedShipment.origin?.address}</p>
                  <p className="text-slate-500">{selectedShipment.origin?.city} - {selectedShipment.origin?.pincode}</p>
                </div>
                <ArrowRight className="w-6 h-6 text-slate-300 mt-8" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-orange-600" />
                    <span className="text-sm text-slate-500">To</span>
                  </div>
                  <p className="font-semibold text-slate-900">{selectedShipment.destination?.name}</p>
                  <p className="text-slate-600">{selectedShipment.destination?.address}</p>
                  <p className="text-slate-500">{selectedShipment.destination?.city} - {selectedShipment.destination?.pincode}</p>
                  <p className="text-slate-500 flex items-center gap-1 mt-1">
                    <Phone className="w-3 h-3" />
                    {selectedShipment.destination?.phone}
                  </p>
                </div>
              </div>

              {/* Tracking Timeline */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-4">Tracking History</h4>
                {selectedShipment.tracking_history?.length > 0 ? (
                  <div className="space-y-4">
                    {selectedShipment.tracking_history.map((event, index) => (
                      <div key={index} className="flex gap-4">
                        <div className="relative">
                          <div className={`w-4 h-4 rounded-full ${index === 0 ? 'bg-orange-500' : 'bg-slate-300'}`} />
                          {index < selectedShipment.tracking_history.length - 1 && (
                            <div className="absolute top-4 left-1.5 w-1 h-full bg-slate-200" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-slate-900">{event.status}</p>
                            <p className="text-sm text-slate-500">{event.timestamp}</p>
                          </div>
                          <p className="text-slate-600">{event.location}</p>
                          {event.remarks && <p className="text-sm text-slate-500 mt-1">{event.remarks}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">No tracking updates available</p>
                )}
              </div>

              {/* Update Status */}
              <div className="pt-4 border-t border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-4">Update Status</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => updateShipmentStatus(selectedShipment.id, key)}
                      disabled={processing || selectedShipment.status === key}
                      className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                        selectedShipment.status === key
                          ? `${config.bg} ${config.color}`
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
