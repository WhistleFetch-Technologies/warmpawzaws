import React, { useState, useEffect } from 'react';
import { Bell, Package, AlertTriangle, Calendar, Plus, Trash2, Search, Filter } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface ProductBatch {
  id: string;
  vendorId: string;
  productId: string;
  productName: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  quantity: number;
  remainingQuantity: number;
  costPrice: number;
  sellingPrice: number;
  supplier: string;
  storageLocation?: string;
  status: 'active' | 'expiring_soon' | 'expired' | 'depleted';
  alertDays: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ExpiryAlert {
  id: string;
  vendorId: string;
  batchId: string;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
  quantity: number;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedAt?: string;
  createdAt: string;
}

interface DisposalRecord {
  id: string;
  vendorId: string;
  batchId: string;
  productName: string;
  batchNumber: string;
  quantity: number;
  reason: 'expired' | 'damaged' | 'recalled' | 'other';
  disposalMethod: 'returned_to_supplier' | 'destroyed' | 'donated' | 'other';
  disposalDate: string;
  cost: number;
  authorizedBy: string;
  notes?: string;
  createdAt: string;
}

interface VendorExpiryManagementProps {
  vendorId: string;
  onBack?: () => void;
}

export function VendorExpiryManagement({ vendorId, onBack }: VendorExpiryManagementProps) {
  const [activeTab, setActiveTab] = useState<'batches' | 'alerts' | 'disposal'>('batches');
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [disposals, setDisposals] = useState<DisposalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [showDisposal, setShowDisposal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ProductBatch | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state for adding batch
  const [batchForm, setBatchForm] = useState({
    productName: '',
    batchNumber: '',
    manufacturingDate: '',
    expiryDate: '',
    quantity: '',
    costPrice: '',
    sellingPrice: '',
    supplier: '',
    storageLocation: '',
    alertDays: '30',
    notes: ''
  });

  // Form state for disposal
  const [disposalForm, setDisposalForm] = useState({
    quantity: '',
    reason: 'expired' as 'expired' | 'damaged' | 'recalled' | 'other',
    disposalMethod: 'destroyed' as 'returned_to_supplier' | 'destroyed' | 'donated' | 'other',
    disposalDate: new Date().toISOString().split('T')[0],
    cost: '',
    authorizedBy: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [vendorId, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'batches') {
        await loadBatches();
      } else if (activeTab === 'alerts') {
        await loadAlerts();
      } else if (activeTab === 'disposal') {
        await loadDisposals();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBatches = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/expiry-management/${vendorId}/batches`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );
      const data = await response.json();
      if (data.success) {
        setBatches(data.batches);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading batches:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/expiry-management/${vendorId}/alerts`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );
      const data = await response.json();
      if (data.success) {
        setAlerts(data.alerts);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const loadDisposals = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/expiry-management/${vendorId}/disposal`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );
      const data = await response.json();
      if (data.success) {
        setDisposals(data.disposals);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading disposals:', error);
    }
  };

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/expiry-management/${vendorId}/batches`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            ...batchForm,
            productId: `product-${Date.now()}`,
            quantity: parseInt(batchForm.quantity),
            costPrice: parseFloat(batchForm.costPrice),
            sellingPrice: parseFloat(batchForm.sellingPrice),
            alertDays: parseInt(batchForm.alertDays)
          })
        }
      );
      const data = await response.json();
      if (data.success) {
        setShowAddBatch(false);
        setBatchForm({
          productName: '',
          batchNumber: '',
          manufacturingDate: '',
          expiryDate: '',
          quantity: '',
          costPrice: '',
          sellingPrice: '',
          supplier: '',
          storageLocation: '',
          alertDays: '30',
          notes: ''
        });
        loadBatches();
      }
    } catch (error) {
      console.error('Error adding batch:', error);
    }
  };

  const handleDisposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/expiry-management/${vendorId}/disposal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            batchId: selectedBatch.id,
            productName: selectedBatch.productName,
            batchNumber: selectedBatch.batchNumber,
            ...disposalForm,
            quantity: parseInt(disposalForm.quantity),
            cost: parseFloat(disposalForm.cost)
          })
        }
      );
      const data = await response.json();
      if (data.success) {
        setShowDisposal(false);
        setSelectedBatch(null);
        setDisposalForm({
          quantity: '',
          reason: 'expired',
          disposalMethod: 'destroyed',
          disposalDate: new Date().toISOString().split('T')[0],
          cost: '',
          authorizedBy: '',
          notes: ''
        });
        loadBatches();
      }
    } catch (error) {
      console.error('Error recording disposal:', error);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/expiry-management/${vendorId}/alerts/${alertId}/acknowledge`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );
      const data = await response.json();
      if (data.success) {
        loadAlerts();
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expiring_soon': return 'bg-yellow-100 text-yellow-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'depleted': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = batch.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         batch.batchNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = !filterStatus || batch.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          {onBack && (
            <button onClick={onBack} className="text-blue-600 hover:text-blue-700 mb-4">
              ← Back to Dashboard
            </button>
          )}
          <h1 className="text-3xl text-gray-900 mb-2">Expiry Management</h1>
          <p className="text-gray-600">Track product batches, expiry alerts, and disposal records</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Total Batches</p>
                  <p className="text-2xl text-gray-900 mt-1">{stats.total || 0}</p>
                </div>
                <Package className="text-blue-500" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Expiring Soon</p>
                  <p className="text-2xl text-yellow-600 mt-1">{stats.expiringSoon || 0}</p>
                </div>
                <AlertTriangle className="text-yellow-500" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Expired</p>
                  <p className="text-2xl text-red-600 mt-1">{stats.expired || 0}</p>
                </div>
                <Calendar className="text-red-500" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Active Alerts</p>
                  <p className="text-2xl text-orange-600 mt-1">{stats.active || stats.total || 0}</p>
                </div>
                <Bell className="text-orange-500" size={32} />
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <div className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('batches')}
                className={`py-4 px-2 border-b-2 transition-colors ${
                  activeTab === 'batches'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Product Batches
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`py-4 px-2 border-b-2 transition-colors ${
                  activeTab === 'alerts'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Expiry Alerts
              </button>
              <button
                onClick={() => setActiveTab('disposal')}
                className={`py-4 px-2 border-b-2 transition-colors ${
                  activeTab === 'disposal'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Disposal Records
              </button>
            </div>
          </div>

          {/* Batches Tab */}
          {activeTab === 'batches' && (
            <div className="p-6">
              {/* Filters and Actions */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search by product name or batch number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="expiring_soon">Expiring Soon</option>
                  <option value="expired">Expired</option>
                  <option value="depleted">Depleted</option>
                </select>
                <button
                  onClick={() => setShowAddBatch(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus size={20} />
                  Add Batch
                </button>
              </div>

              {/* Batches List */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600 mt-2">Loading batches...</p>
                </div>
              ) : filteredBatches.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600">No batches found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredBatches.map((batch) => {
                    const daysUntilExpiry = getDaysUntilExpiry(batch.expiryDate);
                    return (
                      <div key={batch.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-gray-900">{batch.productName}</h3>
                              <span className={`px-2 py-1 rounded text-xs ${getStatusColor(batch.status)}`}>
                                {batch.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Batch Number:</span>
                                <p className="text-gray-900">{batch.batchNumber}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Expiry Date:</span>
                                <p className="text-gray-900">{new Date(batch.expiryDate).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Remaining Qty:</span>
                                <p className="text-gray-900">{batch.remainingQuantity} / {batch.quantity}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Days Until Expiry:</span>
                                <p className={`${daysUntilExpiry <= 7 ? 'text-red-600' : daysUntilExpiry <= 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                                  {daysUntilExpiry > 0 ? `${daysUntilExpiry} days` : 'Expired'}
                                </p>
                              </div>
                            </div>
                          </div>
                          {(batch.status === 'expired' || batch.status === 'expiring_soon') && batch.remainingQuantity > 0 && (
                            <button
                              onClick={() => {
                                setSelectedBatch(batch);
                                setShowDisposal(true);
                              }}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center gap-2 text-sm"
                            >
                              <Trash2 size={16} />
                              Record Disposal
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>Supplier: {batch.supplier}</div>
                          <div>Location: {batch.storageLocation || 'N/A'}</div>
                          <div>Cost: ₹{batch.costPrice}</div>
                          <div>Selling: ₹{batch.sellingPrice}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <div className="p-6">
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600 mt-2">Loading alerts...</p>
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600">No active alerts</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`border-2 rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-gray-900">{alert.productName}</h3>
                            <span className="px-2 py-1 rounded text-xs bg-white bg-opacity-70">
                              {alert.severity.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-gray-700 mb-2">
                            Batch {alert.batchNumber} expires in {alert.daysUntilExpiry} days
                          </p>
                          <p className="text-sm text-gray-600">
                            Expiry Date: {new Date(alert.expiryDate).toLocaleDateString()} | Quantity: {alert.quantity}
                          </p>
                        </div>
                        {alert.status === 'active' && (
                          <button
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="px-4 py-2 bg-white text-gray-700 rounded hover:bg-gray-100 text-sm"
                          >
                            Acknowledge
                          </button>
                        )}
                        {alert.status === 'acknowledged' && (
                          <span className="text-sm text-gray-600">
                            ✓ Acknowledged {new Date(alert.acknowledgedAt!).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Disposal Tab */}
          {activeTab === 'disposal' && (
            <div className="p-6">
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600 mt-2">Loading disposals...</p>
                </div>
              ) : disposals.length === 0 ? (
                <div className="text-center py-12">
                  <Trash2 className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600">No disposal records</p>
                </div>
              ) : (
                <div>
                  {stats && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                      <p className="text-sm text-gray-600">Total Financial Loss from Disposals</p>
                      <p className="text-2xl text-red-600">₹{stats.totalCost?.toLocaleString() || 0}</p>
                    </div>
                  )}
                  <div className="space-y-4">
                    {disposals.map((disposal) => (
                      <div key={disposal.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h3 className="text-gray-900 mb-2">{disposal.productName}</h3>
                            <p className="text-sm text-gray-600">Batch: {disposal.batchNumber}</p>
                            <p className="text-sm text-gray-600">Quantity Disposed: {disposal.quantity}</p>
                          </div>
                          <div className="text-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-gray-500">Reason:</span>
                                <p className="text-gray-900">{disposal.reason}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Method:</span>
                                <p className="text-gray-900">{disposal.disposalMethod.replace(/_/g, ' ')}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Date:</span>
                                <p className="text-gray-900">{new Date(disposal.disposalDate).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Cost:</span>
                                <p className="text-red-600">₹{disposal.cost}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Authorized By:</span>
                                <p className="text-gray-900">{disposal.authorizedBy}</p>
                              </div>
                            </div>
                            {disposal.notes && (
                              <div className="mt-2">
                                <span className="text-gray-500">Notes:</span>
                                <p className="text-gray-900">{disposal.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Batch Modal */}
      {showAddBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl text-gray-900 mb-4">Add Product Batch</h2>
              <form onSubmit={handleAddBatch} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Product Name *</label>
                    <input
                      type="text"
                      required
                      value={batchForm.productName}
                      onChange={(e) => setBatchForm({ ...batchForm, productName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Batch Number *</label>
                    <input
                      type="text"
                      required
                      value={batchForm.batchNumber}
                      onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Manufacturing Date *</label>
                    <input
                      type="date"
                      required
                      value={batchForm.manufacturingDate}
                      onChange={(e) => setBatchForm({ ...batchForm, manufacturingDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Expiry Date *</label>
                    <input
                      type="date"
                      required
                      value={batchForm.expiryDate}
                      onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Quantity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={batchForm.quantity}
                      onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Alert Days Before Expiry</label>
                    <input
                      type="number"
                      min="1"
                      value={batchForm.alertDays}
                      onChange={(e) => setBatchForm({ ...batchForm, alertDays: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Cost Price (₹) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={batchForm.costPrice}
                      onChange={(e) => setBatchForm({ ...batchForm, costPrice: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Selling Price (₹) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={batchForm.sellingPrice}
                      onChange={(e) => setBatchForm({ ...batchForm, sellingPrice: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Supplier *</label>
                    <input
                      type="text"
                      required
                      value={batchForm.supplier}
                      onChange={(e) => setBatchForm({ ...batchForm, supplier: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Storage Location</label>
                    <input
                      type="text"
                      value={batchForm.storageLocation}
                      onChange={(e) => setBatchForm({ ...batchForm, storageLocation: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={batchForm.notes}
                    onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Batch
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddBatch(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Disposal Modal */}
      {showDisposal && selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-6">
              <h2 className="text-2xl text-gray-900 mb-4">Record Disposal</h2>
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <p className="text-gray-900">{selectedBatch.productName}</p>
                <p className="text-sm text-gray-600">Batch: {selectedBatch.batchNumber}</p>
              </div>
              <form onSubmit={handleDisposal} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Quantity to Dispose *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={selectedBatch.remainingQuantity}
                    value={disposalForm.quantity}
                    onChange={(e) => setDisposalForm({ ...disposalForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Available: {selectedBatch.remainingQuantity}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Reason *</label>
                  <select
                    required
                    value={disposalForm.reason}
                    onChange={(e) => setDisposalForm({ ...disposalForm, reason: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="expired">Expired</option>
                    <option value="damaged">Damaged</option>
                    <option value="recalled">Recalled</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Disposal Method *</label>
                  <select
                    required
                    value={disposalForm.disposalMethod}
                    onChange={(e) => setDisposalForm({ ...disposalForm, disposalMethod: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="destroyed">Destroyed</option>
                    <option value="returned_to_supplier">Returned to Supplier</option>
                    <option value="donated">Donated</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Financial Loss (₹) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={disposalForm.cost}
                    onChange={(e) => setDisposalForm({ ...disposalForm, cost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Authorized By *</label>
                  <input
                    type="text"
                    required
                    value={disposalForm.authorizedBy}
                    onChange={(e) => setDisposalForm({ ...disposalForm, authorizedBy: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={disposalForm.notes}
                    onChange={(e) => setDisposalForm({ ...disposalForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Record Disposal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDisposal(false);
                      setSelectedBatch(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
