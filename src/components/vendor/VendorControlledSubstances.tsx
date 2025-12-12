import { useState, useEffect } from 'react';
import { Pill, Plus, X, AlertTriangle, Clock, Package, TrendingDown, Search, Download } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface ControlledSubstance {
  id: string;
  drugName: string;
  genericName?: string;
  scheduleClass: 'I' | 'II' | 'III' | 'IV' | 'V';
  strength: string;
  unit: string;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  manufacturer: string;
  batchNumber: string;
  expiryDate: string;
  storageLocation: string;
}

interface VendorControlledSubstancesProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

export function VendorControlledSubstances({ vendorId, vendorData, onBack }: VendorControlledSubstancesProps) {
  const [substances, setSubstances] = useState<ControlledSubstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSchedule, setFilterSchedule] = useState<string>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [selectedSubstance, setSelectedSubstance] = useState<ControlledSubstance | null>(null);
  const [stats, setStats] = useState({ total: 0, lowStock: 0, expiringSoon: 0 });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchSubstances();
  }, [vendorId]);

  const fetchSubstances = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/controlled-substances/${vendorId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSubstances(data.substances || []);
        setStats(data.stats || { total: 0, lowStock: 0, expiringSoon: 0 });
      } else {
        setSubstances([]);
      }
    } catch (error) {
      console.error('Error fetching controlled substances:', error);
      setSubstances([]);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (substance: ControlledSubstance) => {
    const stockPercent = (substance.currentStock / substance.maxStockLevel) * 100;
    if (substance.currentStock <= substance.minStockLevel) {
      return { color: 'text-red-600 bg-red-100', label: 'Low Stock', icon: AlertTriangle };
    } else if (stockPercent < 30) {
      return { color: 'text-orange-600 bg-orange-100', label: 'Running Low', icon: TrendingDown };
    }
    return { color: 'text-green-600 bg-green-100', label: 'In Stock', icon: Package };
  };

  const getScheduleColor = (schedule: string) => {
    const colors = {
      'I': 'bg-red-100 text-red-700 border-red-300',
      'II': 'bg-orange-100 text-orange-700 border-orange-300',
      'III': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'IV': 'bg-blue-100 text-blue-700 border-blue-300',
      'V': 'bg-green-100 text-green-700 border-green-300'
    };
    return colors[schedule as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const filteredSubstances = substances.filter(s => {
    const matchesSearch = s.drugName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         s.genericName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSchedule = filterSchedule === 'all' || s.scheduleClass === filterSchedule;
    return matchesSearch && matchesSchedule;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Pill className="w-12 h-12 text-orange-500 animate-pulse mx-auto mb-3" />
          <p className="text-gray-600">Loading controlled substances...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {onBack && (
                  <button onClick={onBack} className="text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                )}
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Controlled Substances</h1>
                  <p className="text-sm text-gray-500">Pharmacy Inventory Management</p>
                </div>
              </div>
              <button
                onClick={() => setAddModalOpen(true)}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600"
              >
                <Plus className="w-4 h-4 inline mr-1" />
                Add
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
                <div className="text-xs text-blue-600">Total Items</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-700">{stats.lowStock}</div>
                <div className="text-xs text-red-600">Low Stock</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-700">{stats.expiringSoon}</div>
                <div className="text-xs text-orange-600">Expiring Soon</div>
              </div>
            </div>

            {/* Search & Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search drugs..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-2">
                {['all', 'I', 'II', 'III', 'IV', 'V'].map(schedule => (
                  <button
                    key={schedule}
                    onClick={() => setFilterSchedule(schedule)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filterSchedule === schedule
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {schedule === 'all' ? 'All' : `Schedule ${schedule}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Substances List */}
        <div className="p-4">
          {filteredSubstances.length === 0 ? (
            <div className="text-center py-12">
              <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No matches found' : 'No Controlled Substances'}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchQuery ? 'Try a different search term' : 'Add controlled substances to your inventory'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setAddModalOpen(true)}
                  className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600"
                >
                  Add First Item
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubstances.map(substance => {
                const status = getStockStatus(substance);
                const StatusIcon = status.icon;
                const daysUntilExpiry = Math.floor((new Date(substance.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={substance.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{substance.drugName}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getScheduleColor(substance.scheduleClass)}`}>
                            Class {substance.scheduleClass}
                          </span>
                        </div>
                        {substance.genericName && (
                          <p className="text-sm text-gray-600">{substance.genericName}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {substance.strength} {substance.unit} • {substance.manufacturer}
                        </p>
                      </div>
                    </div>

                    {/* Stock Info */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`px-2 py-1 rounded-lg ${status.color} flex items-center gap-1`}>
                          <StatusIcon className="w-3 h-3" />
                          <span className="text-xs font-medium">{status.label}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          {substance.currentStock} {substance.unit}
                        </span>
                      </div>
                      
                      {daysUntilExpiry <= 30 && daysUntilExpiry > 0 && (
                        <div className="flex items-center gap-1 text-orange-600">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">Expires in {daysUntilExpiry}d</span>
                        </div>
                      )}
                    </div>

                    {/* Stock Progress Bar */}
                    <div className="mb-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            substance.currentStock <= substance.minStockLevel
                              ? 'bg-red-500'
                              : substance.currentStock / substance.maxStockLevel < 0.3
                              ? 'bg-orange-500'
                              : 'bg-green-500'
                          }`}
                          style={{
                            width: `${Math.min((substance.currentStock / substance.maxStockLevel) * 100, 100)}%`
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Min: {substance.minStockLevel}</span>
                        <span>Max: {substance.maxStockLevel}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedSubstance(substance);
                          setTransactionModalOpen(true);
                        }}
                        className="flex-1 px-3 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-100"
                      >
                        Record Transaction
                      </button>
                      <button className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                        History
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Modal */}
        {addModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Add Controlled Substance</h2>
                  <button onClick={() => setAddModalOpen(false)}>
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
              </div>

              <form className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Drug Name *
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="e.g., Morphine Sulfate"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule Class *
                  </label>
                  <select className="w-full border border-gray-300 rounded-lg p-2" required>
                    <option value="">Select schedule...</option>
                    <option value="I">Schedule I - No medical use</option>
                    <option value="II">Schedule II - High abuse potential</option>
                    <option value="III">Schedule III - Moderate abuse potential</option>
                    <option value="IV">Schedule IV - Low abuse potential</option>
                    <option value="V">Schedule V - Limited abuse potential</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Strength
                    </label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-lg p-2"
                      placeholder="e.g., 10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unit
                    </label>
                    <select className="w-full border border-gray-300 rounded-lg p-2">
                      <option value="mg">mg</option>
                      <option value="ml">ml</option>
                      <option value="tablets">tablets</option>
                      <option value="capsules">capsules</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Stock
                    </label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-lg p-2"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Min Level
                    </label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-lg p-2"
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Level
                    </label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-lg p-2"
                      placeholder="100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg p-2"
                    required
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium mb-1">Compliance Notice</p>
                      <p>All controlled substance transactions are logged for regulatory compliance.</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    onClick={(e) => {
                      e.preventDefault();
                      toast.success('Controlled substance added');
                      setAddModalOpen(false);
                      fetchSubstances();
                    }}
                    className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  >
                    Add Substance
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Transaction Modal */}
        {transactionModalOpen && selectedSubstance && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Record Transaction</h2>
                <button onClick={() => setTransactionModalOpen(false)}>
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="font-semibold text-gray-900">{selectedSubstance.drugName}</p>
                <p className="text-sm text-gray-600">Current Stock: {selectedSubstance.currentStock} {selectedSubstance.unit}</p>
              </div>

              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transaction Type
                  </label>
                  <select className="w-full border border-gray-300 rounded-lg p-2">
                    <option value="stock_in">Stock In (Received)</option>
                    <option value="stock_out">Stock Out (Dispensed)</option>
                    <option value="adjustment">Adjustment</option>
                    <option value="expired">Expired/Damaged</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg p-2"
                    rows={3}
                    placeholder="Enter reason for transaction..."
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setTransactionModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    onClick={(e) => {
                      e.preventDefault();
                      toast.success('Transaction recorded');
                      setTransactionModalOpen(false);
                      fetchSubstances();
                    }}
                    className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  >
                    Record
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
