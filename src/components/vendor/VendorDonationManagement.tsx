import React, { useState, useEffect } from 'react';
import { Heart, Users, TrendingUp, Award, Plus, Download, Calendar } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'react-toastify';

interface Donation {
  id: string;
  donorName: string;
  donorEmail: string;
  donorPhone: string;
  type: 'monetary' | 'food' | 'medicine' | 'supplies' | 'equipment' | 'other';
  amount?: number;
  items?: { name: string; quantity: number; unit: string; value: number }[];
  totalValue: number;
  status: 'pending' | 'received' | 'acknowledged' | 'utilized';
  receiptNumber: string;
  taxBenefit: boolean;
  purpose?: string;
  createdAt: string;
}

interface Donor {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalAmount: number;
  donationCount: number;
  firstDonationDate: string;
  lastDonationDate: string;
  tags: string[];
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  goalAmount: number;
  raisedAmount: number;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  donationCount: number;
}

interface VendorDonationManagementProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

export function VendorDonationManagement({ vendorId, vendorData, onBack }: VendorDonationManagementProps) {
  const [activeTab, setActiveTab] = useState<'donations' | 'donors' | 'campaigns'>('donations');
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddDonation, setShowAddDonation] = useState(false);
  const [showAddCampaign, setShowAddCampaign] = useState(false);

  const [donationForm, setDonationForm] = useState({
    donorName: '',
    donorEmail: '',
    donorPhone: '',
    type: 'monetary' as Donation['type'],
    amount: '',
    purpose: '',
    taxBenefit: false,
    items: [] as { name: string; quantity: string; unit: string; value: string }[]
  });

  const [campaignForm, setCampaignForm] = useState({
    name: '',
    description: '',
    goalAmount: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });

  useEffect(() => {
    loadDashboard();
    loadData();
  }, [vendorId, activeTab]);

  const loadDashboard = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/donation-management/${vendorId}/dashboard`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );
      const data = await response.json();
      // ✅ FIX: Handle standardized response format
      if (data.success) {
        setStats(data.stats || data.data?.stats);
      } else {
        const errorData = data.error || data.message || 'Unknown error';
        console.error('Failed to load dashboard:', errorData);
        // Don't show error toast on initial load - just log
      }
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
      // Don't show error toast on initial load - just log
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'donations') {
        await loadDonations();
      } else if (activeTab === 'donors') {
        await loadDonors();
      } else {
        await loadCampaigns();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDonations = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/donation-management/${vendorId}/list`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );
      const data = await response.json();
      // ✅ FIX: Handle standardized response format
      // Response format: { success: true, donations: [...], stats: {...}, total: ... }
      if (data.success) {
        setDonations(data.donations || data.data?.donations || []);
        setStats(data.stats || data.data?.stats);
      } else {
        const errorData = data.error || data.message || 'Unknown error';
        console.error('Failed to load donations:', errorData);
        // Don't show error toast on initial load - just log
      }
    } catch (error: any) {
      console.error('Error loading donations:', error);
      // Don't show error toast on initial load - just log
    }
  };

  const loadDonors = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/donation-management/${vendorId}/donors`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );
      const data = await response.json();
      // ✅ FIX: Handle standardized response format
      // Response format: { success: true, donors: [...], total: ... }
      if (data.success) {
        setDonors(data.donors || data.data?.donors || []);
      } else {
        const errorData = data.error || data.message || 'Unknown error';
        console.error('Failed to load donors:', errorData);
        // Don't show error toast on initial load - just log
      }
    } catch (error: any) {
      console.error('Error loading donors:', error);
      // Don't show error toast on initial load - just log
    }
  };

  const loadCampaigns = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/donation-management/${vendorId}/campaigns`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );
      const data = await response.json();
      if (data.success) {
        setCampaigns(data.campaigns);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  };

  const handleAddDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/donation-management/${vendorId}/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            ...donationForm,
            amount: donationForm.amount ? parseFloat(donationForm.amount) : undefined,
            items: donationForm.items.map(item => ({
              ...item,
              quantity: parseInt(item.quantity),
              value: parseFloat(item.value)
            })),
            totalValue: donationForm.type === 'monetary' 
              ? parseFloat(donationForm.amount)
              : donationForm.items.reduce((sum, item) => sum + (parseInt(item.quantity) * parseFloat(item.value)), 0)
          })
        }
      );
      const data = await response.json();
      if (data.success) {
        setShowAddDonation(false);
        setDonationForm({
          donorName: '',
          donorEmail: '',
          donorPhone: '',
          type: 'monetary',
          amount: '',
          purpose: '',
          taxBenefit: false,
          items: []
        });
        loadDonations();
        loadDashboard();
      }
    } catch (error) {
      console.error('Error adding donation:', error);
    }
  };

  const handleAddCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/donation-management/${vendorId}/campaigns`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            ...campaignForm,
            goalAmount: parseFloat(campaignForm.goalAmount)
          })
        }
      );
      const data = await response.json();
      if (data.success) {
        setShowAddCampaign(false);
        setCampaignForm({
          name: '',
          description: '',
          goalAmount: '',
          startDate: new Date().toISOString().split('T')[0],
          endDate: ''
        });
        loadCampaigns();
      }
    } catch (error) {
      console.error('Error adding campaign:', error);
    }
  };

  const updateDonationStatus = async (donationId: string, status: Donation['status']) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/donation-management/${vendorId}/${donationId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ status })
        }
      );
      const data = await response.json();
      if (data.success) {
        loadDonations();
        loadDashboard();
      }
    } catch (error) {
      console.error('Error updating donation status:', error);
    }
  };

  // ✅ FIX: Priority 1 Gap #2 - Add DELETE handler
  const handleDeleteDonation = async (donationId: string) => {
    if (!confirm('Are you sure you want to delete this donation? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/donation-management/${vendorId}/${donationId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Donation deleted successfully');
        loadDonations();
        loadDashboard();
      } else {
        toast.error(data.error || 'Failed to delete donation');
      }
    } catch (error) {
      console.error('Error deleting donation:', error);
      toast.error('Error deleting donation');
    }
  };

  const addItemToDonation = () => {
    setDonationForm({
      ...donationForm,
      items: [...donationForm.items, { name: '', quantity: '', unit: '', value: '' }]
    });
  };

  const removeItemFromDonation = (index: number) => {
    setDonationForm({
      ...donationForm,
      items: donationForm.items.filter((_, i) => i !== index)
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'monetary': return '💰';
      case 'food': return '🍖';
      case 'medicine': return '💊';
      case 'supplies': return '📦';
      case 'equipment': return '🔧';
      default: return '🎁';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'received': return 'bg-blue-100 text-blue-800';
      case 'acknowledged': return 'bg-green-100 text-green-800';
      case 'utilized': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
          <h1 className="text-3xl text-gray-900 mb-2">Donation Management</h1>
          <p className="text-gray-600">Track donations, manage donors, and run campaigns</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Total Value</p>
                  <p className="text-2xl text-gray-900 mt-1">₹{stats.donations?.totalValue?.toLocaleString() || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">This Year</p>
                </div>
                <Heart className="text-red-500" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Total Donors</p>
                  <p className="text-2xl text-gray-900 mt-1">{stats.donors?.total || 0}</p>
                  <p className="text-xs text-green-600 mt-1">+{stats.donors?.new || 0} this month</p>
                </div>
                <Users className="text-blue-500" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">This Month</p>
                  <p className="text-2xl text-gray-900 mt-1">₹{stats.donations?.thisMonthValue?.toLocaleString() || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.donations?.thisMonth || 0} donations</p>
                </div>
                <TrendingUp className="text-green-500" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Major Donors</p>
                  <p className="text-2xl text-gray-900 mt-1">{stats.donors?.majorDonors || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">₹10,000+ donated</p>
                </div>
                <Award className="text-purple-500" size={32} />
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <div className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('donations')}
                className={`py-4 px-2 border-b-2 transition-colors ${
                  activeTab === 'donations'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Donations
              </button>
              <button
                onClick={() => setActiveTab('donors')}
                className={`py-4 px-2 border-b-2 transition-colors ${
                  activeTab === 'donors'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Donors
              </button>
              <button
                onClick={() => setActiveTab('campaigns')}
                className={`py-4 px-2 border-b-2 transition-colors ${
                  activeTab === 'campaigns'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Campaigns
              </button>
            </div>
          </div>

          {/* Donations Tab */}
          {activeTab === 'donations' && (
            <div className="p-6">
              <div className="flex justify-between mb-6">
                <div></div>
                <button
                  onClick={() => setShowAddDonation(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus size={20} />
                  Record Donation
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600 mt-2">Loading donations...</p>
                </div>
              ) : donations.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600">No donations recorded yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {donations.map((donation) => (
                    <div key={donation.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{getTypeIcon(donation.type)}</span>
                            <div>
                              <h3 className="text-gray-900">{donation.donorName}</h3>
                              <p className="text-sm text-gray-600">{donation.donorEmail} • {donation.donorPhone}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(donation.status)}`}>
                              {donation.status.toUpperCase()}
                            </span>
                            {donation.taxBenefit && (
                              <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                                80G Eligible
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Type:</span>
                              <p className="text-gray-900 capitalize">{donation.type}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Value:</span>
                              <p className="text-gray-900">₹{donation.totalValue.toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Receipt:</span>
                              <p className="text-gray-900">{donation.receiptNumber}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Date:</span>
                              <p className="text-gray-900">{new Date(donation.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          {donation.purpose && (
                            <p className="text-sm text-gray-600 mt-2">
                              Purpose: {donation.purpose}
                            </p>
                          )}
                          {donation.items && donation.items.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm text-gray-600">Items:</p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {donation.items.map((item, idx) => (
                                  <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                    {item.name} ({item.quantity} {item.unit})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {donation.status === 'pending' && (
                            <button
                              onClick={() => updateDonationStatus(donation.id, 'received')}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            >
                              Mark Received
                            </button>
                          )}
                          {donation.status === 'received' && (
                            <button
                              onClick={() => updateDonationStatus(donation.id, 'acknowledged')}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                            >
                              Send Thank You
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteDonation(donation.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Donors Tab */}
          {activeTab === 'donors' && (
            <div className="p-6">
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600 mt-2">Loading donors...</p>
                </div>
              ) : donors.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600">No donors yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {donors.map((donor) => (
                    <div key={donor.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-gray-900">{donor.name}</h3>
                          <p className="text-sm text-gray-600">{donor.email}</p>
                          <p className="text-sm text-gray-600">{donor.phone}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl text-blue-600">₹{donor.totalAmount.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">{donor.donationCount} donations</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="text-gray-500">First Donation:</span>
                          <p className="text-gray-900">{new Date(donor.firstDonationDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Last Donation:</span>
                          <p className="text-gray-900">{new Date(donor.lastDonationDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {donor.tags && donor.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {donor.tags.map((tag, idx) => (
                            <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Campaigns Tab */}
          {activeTab === 'campaigns' && (
            <div className="p-6">
              <div className="flex justify-between mb-6">
                <div></div>
                <button
                  onClick={() => setShowAddCampaign(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus size={20} />
                  Create Campaign
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600 mt-2">Loading campaigns...</p>
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600">No campaigns created yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {campaigns.map((campaign) => {
                    const progress = (campaign.raisedAmount / campaign.goalAmount) * 100;
                    return (
                      <div key={campaign.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                        <div className="mb-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg text-gray-900">{campaign.name}</h3>
                            <span className={`px-2 py-1 rounded text-xs ${
                              campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                              campaign.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {campaign.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{campaign.description}</p>
                        </div>
                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-600">Progress</span>
                            <span className="text-gray-900">{progress.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-blue-600 h-3 rounded-full transition-all"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-sm mt-2">
                            <span className="text-gray-600">
                              ₹{campaign.raisedAmount.toLocaleString()} raised
                            </span>
                            <span className="text-gray-600">
                              Goal: ₹{campaign.goalAmount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Start Date:</span>
                            <p className="text-gray-900">{new Date(campaign.startDate).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">End Date:</span>
                            <p className="text-gray-900">{new Date(campaign.endDate).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-gray-600">
                          {campaign.donationCount} donations received
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Donation Modal */}
      {showAddDonation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl text-gray-900 mb-4">Record Donation</h2>
              <form onSubmit={handleAddDonation} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Donor Name *</label>
                    <input
                      type="text"
                      required
                      value={donationForm.donorName}
                      onChange={(e) => setDonationForm({ ...donationForm, donorName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={donationForm.donorEmail}
                      onChange={(e) => setDonationForm({ ...donationForm, donorEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Phone *</label>
                    <input
                      type="tel"
                      required
                      value={donationForm.donorPhone}
                      onChange={(e) => setDonationForm({ ...donationForm, donorPhone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Donation Type *</label>
                    <select
                      required
                      value={donationForm.type}
                      onChange={(e) => setDonationForm({ ...donationForm, type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="monetary">Monetary</option>
                      <option value="food">Food</option>
                      <option value="medicine">Medicine</option>
                      <option value="supplies">Supplies</option>
                      <option value="equipment">Equipment</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {donationForm.type === 'monetary' ? (
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-700 mb-1">Amount (₹) *</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={donationForm.amount}
                        onChange={(e) => setDonationForm({ ...donationForm, amount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  ) : (
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-700 mb-2">Items</label>
                      {donationForm.items.map((item, index) => (
                        <div key={index} className="grid grid-cols-5 gap-2 mb-2">
                          <input
                            type="text"
                            required
                            placeholder="Item name"
                            value={item.name}
                            onChange={(e) => {
                              const newItems = [...donationForm.items];
                              newItems[index].name = e.target.value;
                              setDonationForm({ ...donationForm, items: newItems });
                            }}
                            className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <input
                            type="number"
                            required
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => {
                              const newItems = [...donationForm.items];
                              newItems[index].quantity = e.target.value;
                              setDonationForm({ ...donationForm, items: newItems });
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <input
                            type="text"
                            required
                            placeholder="Unit"
                            value={item.unit}
                            onChange={(e) => {
                              const newItems = [...donationForm.items];
                              newItems[index].unit = e.target.value;
                              setDonationForm({ ...donationForm, items: newItems });
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <div className="flex gap-1">
                            <input
                              type="number"
                              required
                              placeholder="Value"
                              value={item.value}
                              onChange={(e) => {
                                const newItems = [...donationForm.items];
                                newItems[index].value = e.target.value;
                                setDonationForm({ ...donationForm, items: newItems });
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => removeItemFromDonation(index)}
                              className="px-2 bg-red-100 text-red-600 rounded hover:bg-red-200"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addItemToDonation}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                      >
                        + Add Item
                      </button>
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">Purpose</label>
                    <textarea
                      value={donationForm.purpose}
                      onChange={(e) => setDonationForm({ ...donationForm, purpose: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={donationForm.taxBenefit}
                      onChange={(e) => setDonationForm({ ...donationForm, taxBenefit: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Eligible for 80G Tax Benefit</span>
                  </label>
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Record Donation
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddDonation(false)}
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

      {/* Add Campaign Modal */}
      {showAddCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-6">
              <h2 className="text-2xl text-gray-900 mb-4">Create Campaign</h2>
              <form onSubmit={handleAddCampaign} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Campaign Name *</label>
                  <input
                    type="text"
                    required
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Description *</label>
                  <textarea
                    required
                    value={campaignForm.description}
                    onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Goal Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={campaignForm.goalAmount}
                    onChange={(e) => setCampaignForm({ ...campaignForm, goalAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={campaignForm.startDate}
                      onChange={(e) => setCampaignForm({ ...campaignForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">End Date *</label>
                    <input
                      type="date"
                      required
                      value={campaignForm.endDate}
                      onChange={(e) => setCampaignForm({ ...campaignForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create Campaign
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddCampaign(false)}
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