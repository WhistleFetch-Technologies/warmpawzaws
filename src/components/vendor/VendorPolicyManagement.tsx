import { useState, useEffect } from 'react';
import { X, Shield, Plus, Edit2, Trash2, Search, DollarSign, Calendar, CheckCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface PolicyManagementProps {
  vendorId: string;
  onClose: () => void;
}

interface InsurancePolicy {
  id: string;
  policyNumber: string;
  policyName: string;
  policyType: 'comprehensive' | 'accident_only' | 'illness_only' | 'wellness' | 'custom';
  provider: string;
  premium: number;
  coverageAmount: number;
  deductible: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  petTypes: string[];
  ageRestrictions: string;
  preExistingConditions: boolean;
  waitingPeriod: number; // days
  features: string[];
  exclusions: string[];
  renewalDate?: string;
  createdAt: string;
}

export function VendorPolicyManagement({ vendorId, onClose }: PolicyManagementProps) {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('active');

  // Form state
  const [formData, setFormData] = useState({
    policyNumber: '',
    policyName: '',
    policyType: 'comprehensive' as InsurancePolicy['policyType'],
    provider: '',
    premium: '',
    coverageAmount: '',
    deductible: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    petTypes: [] as string[],
    ageRestrictions: '',
    preExistingConditions: false,
    waitingPeriod: '30',
    features: [] as string[],
    exclusions: [] as string[]
  });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchPolicies();
  }, [vendorId, filter]);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/vendor/policy-management/${vendorId}?status=${filter === 'all' ? '' : filter}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      const data = await response.json();
      if (data.success) {
        setPolicies(data.policies || []);
      }
    } catch (error) {
      console.error('Error fetching policies:', error);
      toast.error('Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  const savePolicy = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/vendor/policy-management/${vendorId}${selectedPolicy ? `/${selectedPolicy.id}` : ''}`,
        {
          method: selectedPolicy ? 'PUT' : 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success(`Policy ${selectedPolicy ? 'updated' : 'created'} successfully`);
        setShowCreateModal(false);
        setSelectedPolicy(null);
        resetForm();
        fetchPolicies();
      } else {
        toast.error(data.error || 'Failed to save policy');
      }
    } catch (error) {
      console.error('Error saving policy:', error);
      toast.error('Failed to save policy');
    }
  };

  const deletePolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;

    try {
      const response = await fetch(
        `${API_BASE}/vendor/policy-management/${vendorId}/${policyId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Policy deleted');
        fetchPolicies();
      }
    } catch (error) {
      console.error('Error deleting policy:', error);
      toast.error('Failed to delete policy');
    }
  };

  const resetForm = () => {
    setFormData({
      policyNumber: '',
      policyName: '',
      policyType: 'comprehensive',
      provider: '',
      premium: '',
      coverageAmount: '',
      deductible: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      petTypes: [],
      ageRestrictions: '',
      preExistingConditions: false,
      waitingPeriod: '30',
      features: [],
      exclusions: []
    });
  };

  const filteredPolicies = policies.filter(p => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        p.policyNumber.toLowerCase().includes(query) ||
        p.policyName.toLowerCase().includes(query) ||
        p.provider.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const stats = {
    active: policies.filter(p => p.status === 'active').length,
    expired: policies.filter(p => p.status === 'expired').length,
    total: policies.length,
    totalCoverage: policies.filter(p => p.status === 'active').reduce((sum, p) => sum + p.coverageAmount, 0)
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700 border-green-200';
      case 'expired': return 'bg-red-100 text-red-700 border-red-200';
      case 'cancelled': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Shield className="w-7 h-7 text-blue-600" />
                Insurance Policy Management
              </h2>
              <p className="text-sm text-gray-600 mt-1">Manage pet insurance policies and coverage</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-600">Total Policies</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
              <div className="text-2xl font-bold text-green-700">{stats.active}</div>
              <div className="text-xs text-green-700">Active</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
              <div className="text-2xl font-bold text-red-700">{stats.expired}</div>
              <div className="text-xs text-red-700">Expired</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
              <div className="text-lg font-bold text-blue-700">₹{(stats.totalCoverage / 100000).toFixed(1)}L</div>
              <div className="text-xs text-blue-700">Total Coverage</div>
            </div>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-3 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by policy number, name, or provider..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Policy
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'active' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Active ({stats.active})
            </button>
            <button
              onClick={() => setFilter('expired')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'expired' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Expired
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-gray-600">Loading policies...</p>
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No insurance policies found</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Create First Policy
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPolicies.map((policy) => (
                <div
                  key={policy.id}
                  className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{policy.policyName}</h3>
                      <div className="text-sm text-gray-600 mt-1">{policy.policyNumber}</div>
                      <div className="text-xs text-gray-500 mt-1">{policy.provider}</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setSelectedPolicy(policy);
                          setFormData(policy as any);
                          setShowCreateModal(true);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => deletePolicy(policy.id)}
                        className="p-2 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>

                  <div className={`inline-block mb-3 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(policy.status)}`}>
                    {policy.status.toUpperCase()}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                      <div className="text-xs text-green-700 mb-1">Coverage</div>
                      <div className="text-sm font-semibold text-green-900">₹{(policy.coverageAmount / 100000).toFixed(1)}L</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                      <div className="text-xs text-blue-700 mb-1">Premium</div>
                      <div className="text-sm font-semibold text-blue-900">₹{policy.premium.toLocaleString()}/yr</div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-2 mb-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Deductible</span>
                      <span className="font-medium text-gray-900">₹{policy.deductible.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-gray-600">Waiting Period</span>
                      <span className="font-medium text-gray-900">{policy.waitingPeriod} days</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 mb-2">
                    <div className="flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3" />
                      <span>Valid: {new Date(policy.startDate).toLocaleDateString()} - {new Date(policy.endDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      <span>Covers: {policy.petTypes.join(', ')}</span>
                    </div>
                  </div>

                  {policy.features && policy.features.length > 0 && (
                    <div className="text-xs text-gray-600">
                      <div className="font-medium mb-1">Features:</div>
                      <div className="flex flex-wrap gap-1">
                        {policy.features.slice(0, 3).map((feature, idx) => (
                          <span key={idx} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                            {feature}
                          </span>
                        ))}
                        {policy.features.length > 3 && (
                          <span className="text-gray-500">+{policy.features.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full my-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {selectedPolicy ? 'Edit' : 'Create'} Insurance Policy
              </h3>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Policy Number</label>
                    <input
                      type="text"
                      value={formData.policyNumber}
                      onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="POL-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                    <input
                      type="text"
                      value={formData.provider}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Pet Insurance Co."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Policy Name</label>
                  <input
                    type="text"
                    value={formData.policyName}
                    onChange={(e) => setFormData({ ...formData, policyName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Comprehensive Pet Care Plan"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={formData.policyType}
                      onChange={(e) => setFormData({ ...formData, policyType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="comprehensive">Comprehensive</option>
                      <option value="accident_only">Accident Only</option>
                      <option value="illness_only">Illness Only</option>
                      <option value="wellness">Wellness</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Premium (₹/year)</label>
                    <input
                      type="number"
                      value={formData.premium}
                      onChange={(e) => setFormData({ ...formData, premium: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="12000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Coverage (₹)</label>
                    <input
                      type="number"
                      value={formData.coverageAmount}
                      onChange={(e) => setFormData({ ...formData, coverageAmount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="500000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deductible (₹)</label>
                    <input
                      type="number"
                      value={formData.deductible}
                      onChange={(e) => setFormData({ ...formData, deductible: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="5000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pet Types Covered</label>
                  <input
                    type="text"
                    value={formData.petTypes.join(', ')}
                    onChange={(e) => setFormData({ ...formData, petTypes: e.target.value.split(',').map(s => s.trim()) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Dogs, Cats, Birds (comma-separated)"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.preExistingConditions}
                    onChange={(e) => setFormData({ ...formData, preExistingConditions: e.target.checked })}
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-700">Covers pre-existing conditions</label>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedPolicy(null);
                    resetForm();
                  }}
                  className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={savePolicy}
                  className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  {selectedPolicy ? 'Update' : 'Create'} Policy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
