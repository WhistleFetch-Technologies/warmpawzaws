import { useState, useEffect } from 'react';
import { 
  Users, Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw, 
  Filter, Search, TrendingUp, Activity, BarChart3, Download, Eye,
  Calendar, MapPin, Phone, Mail, Award, FileText, Shield
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { toast } from 'sonner';

/**
 * Enhanced Vendor Administration
 * Clear tabs for different vendor statuses with working filters and metrics in popups
 */

interface Vendor {
  id: string;
  fullName: string;
  businessName?: string;
  roleName: string;
  serviceCategory: string;
  serviceStyle: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'pending_reverification';
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  totalServices?: number;
  activeServices?: number;
  rating?: number;
  totalBookings?: number;
  revenue?: number;
  lastActivityAt?: string;
  vendorType?: string;
}

interface VendorStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  reverification: number;
  activeToday: number;
  newThisWeek: number;
  conversionRate: number;
  avgApprovalTime: number;
}

type TabType = 'pending' | 'approved' | 'reverification' | 'rejected';

interface EnhancedVendorAdministrationProps {
  onNavigate?: (view: string) => void;
}

export function EnhancedVendorAdministration({ onNavigate }: EnhancedVendorAdministrationProps = {}) {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [styleFilter, setStyleFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  
  // Modal states
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showVendorDetail, setShowVendorDetail] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadVendors();
    loadStats();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [vendors, activeTab, searchQuery, roleFilter, styleFilter, cityFilter]);

  // Load all vendors
  const loadVendors = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE}/admin/vendors/all`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load vendors');
      }
      
      const data = await response.json();
      setVendors(data.vendors || []);
      
    } catch (error) {
      console.error('Error loading vendors:', error);
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  // Load statistics
  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/vendors/stats-enhanced`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Apply filters
  const applyFilters = () => {
    let filtered = vendors;

    // Filter by tab (status)
    switch (activeTab) {
      case 'pending':
        filtered = filtered.filter(v => v.status === 'pending_approval');
        break;
      case 'approved':
        filtered = filtered.filter(v => v.status === 'approved');
        break;
      case 'reverification':
        filtered = filtered.filter(v => v.status === 'pending_reverification');
        break;
      case 'rejected':
        filtered = filtered.filter(v => v.status === 'rejected');
        break;
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v => 
        v.fullName?.toLowerCase().includes(query) ||
        v.businessName?.toLowerCase().includes(query) ||
        v.phone?.includes(query) ||
        v.email?.toLowerCase().includes(query) ||
        v.city?.toLowerCase().includes(query)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(v => v.roleName === roleFilter);
    }

    // Service style filter
    if (styleFilter !== 'all') {
      filtered = filtered.filter(v => v.serviceStyle === styleFilter);
    }

    // City filter
    if (cityFilter !== 'all') {
      filtered = filtered.filter(v => v.city === cityFilter);
    }

    setFilteredVendors(filtered);
  };

  // Get unique values for filters
  const getUniqueRoles = () => {
    const roles = new Set(vendors.map(v => v.roleName).filter(Boolean));
    return Array.from(roles).sort();
  };

  const getUniqueCities = () => {
    const cities = new Set(vendors.map(v => v.city).filter(Boolean));
    return Array.from(cities).sort();
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setStyleFilter('all');
    setCityFilter('all');
  };

  // Quick stats for current tab
  const getTabStats = () => {
    return {
      total: filteredVendors.length,
      newToday: filteredVendors.filter(v => {
        const date = new Date(v.submittedAt || '');
        const today = new Date();
        return date.toDateString() === today.toDateString();
      }).length,
      newThisWeek: filteredVendors.filter(v => {
        const date = new Date(v.submittedAt || '');
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return date >= weekAgo;
      }).length
    };
  };

  const tabStats = getTabStats();

  // Approve vendor
  const approveVendor = async (vendor: Vendor) => {
    if (!confirm(`Approve ${vendor.fullName || vendor.businessName}?`)) return;

    try {
      const response = await fetch(`${API_BASE}/admin/vendors/${vendor.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          adminId: 'admin-user',
          adminName: 'Admin'
        })
      });

      if (!response.ok) throw new Error('Approval failed');

      toast.success('Vendor approved successfully');
      loadVendors();
      loadStats();
    } catch (error) {
      toast.error('Failed to approve vendor');
    }
  };

  // Reject vendor
  const rejectVendor = async (vendor: Vendor) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const response = await fetch(`${API_BASE}/admin/vendors/${vendor.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          adminId: 'admin-user',
          adminName: 'Admin',
          reason
        })
      });

      if (!response.ok) throw new Error('Rejection failed');

      toast.success('Vendor rejected');
      loadVendors();
      loadStats();
    } catch (error) {
      toast.error('Failed to reject vendor');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-gray-900 mb-1">Vendor Administration</h1>
            <p className="text-gray-600">Manage vendor applications and accounts</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={loadVendors}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowStatsModal(true)}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              View Analytics
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          {/* Pending Applications */}
          <Card 
            className={`p-4 cursor-pointer transition-all ${activeTab === 'pending' ? 'ring-2 ring-orange-500' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                {stats?.pending || 0}
              </Badge>
            </div>
            <h3 className="text-gray-900 mb-1">Pending Approval</h3>
            <p className="text-gray-600">New applications</p>
          </Card>

          {/* Approved Vendors */}
          <Card 
            className={`p-4 cursor-pointer transition-all ${activeTab === 'approved' ? 'ring-2 ring-green-500' : ''}`}
            onClick={() => setActiveTab('approved')}
          >
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                {stats?.approved || 0}
              </Badge>
            </div>
            <h3 className="text-gray-900 mb-1">Approved</h3>
            <p className="text-gray-600">Active vendors</p>
          </Card>

          {/* Re-verification */}
          <Card 
            className={`p-4 cursor-pointer transition-all ${activeTab === 'reverification' ? 'ring-2 ring-yellow-500' : ''}`}
            onClick={() => setActiveTab('reverification')}
          >
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                {stats?.reverification || 0}
              </Badge>
            </div>
            <h3 className="text-gray-900 mb-1">Re-verification</h3>
            <p className="text-gray-600">Needs review</p>
          </Card>

          {/* Rejected */}
          <Card 
            className={`p-4 cursor-pointer transition-all ${activeTab === 'rejected' ? 'ring-2 ring-red-500' : ''}`}
            onClick={() => setActiveTab('rejected')}
          >
            <div className="flex items-center justify-between mb-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <Badge variant="secondary" className="bg-red-100 text-red-700">
                {stats?.rejected || 0}
              </Badge>
            </div>
            <h3 className="text-gray-900 mb-1">Rejected</h3>
            <p className="text-gray-600">Declined apps</p>
          </Card>

          {/* Total */}
          <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 text-orange-600" />
              <Badge className="bg-orange-600">
                {stats?.total || 0}
              </Badge>
            </div>
            <h3 className="text-gray-900 mb-1">Total Vendors</h3>
            <p className="text-gray-600">All time</p>
          </Card>
        </div>

        {/* Filters Bar */}
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name, phone, email, city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Roles</option>
              {getUniqueRoles().map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>

            {/* Service Style Filter */}
            <select
              value={styleFilter}
              onChange={(e) => setStyleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Styles</option>
              <option value="at_home">At Home</option>
              <option value="at_center">At Center</option>
              <option value="both">Both</option>
              <option value="tele">Tele</option>
            </select>

            {/* City Filter */}
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Cities</option>
              {getUniqueCities().map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>

            {/* Reset Filters */}
            {(searchQuery || roleFilter !== 'all' || styleFilter !== 'all' || cityFilter !== 'all') && (
              <Button variant="outline" onClick={resetFilters} size="sm">
                <XCircle className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            )}

            {/* Results Count */}
            <div className="ml-auto text-gray-600">
              Showing <span className="font-semibold text-gray-900">{filteredVendors.length}</span> vendors
            </div>
          </div>
        </Card>

        {/* Tab Statistics */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2 text-gray-600">
            <Activity className="w-4 h-4" />
            <span>
              <span className="font-semibold text-gray-900">{tabStats.newToday}</span> new today
            </span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <TrendingUp className="w-4 h-4" />
            <span>
              <span className="font-semibold text-gray-900">{tabStats.newThisWeek}</span> this week
            </span>
          </div>
        </div>

        {/* Vendors Table */}
        <Card>
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Loading vendors...</p>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-900 mb-1">No vendors found</h3>
              <p className="text-gray-600">
                {searchQuery || roleFilter !== 'all' || styleFilter !== 'all' || cityFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No vendors in this category yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-gray-700">Vendor</th>
                    <th className="px-6 py-3 text-left text-gray-700">Role</th>
                    <th className="px-6 py-3 text-left text-gray-700">Service Style</th>
                    <th className="px-6 py-3 text-left text-gray-700">Location</th>
                    <th className="px-6 py-3 text-left text-gray-700">Contact</th>
                    {activeTab === 'approved' && (
                      <>
                        <th className="px-6 py-3 text-left text-gray-700">Services</th>
                        <th className="px-6 py-3 text-left text-gray-700">Rating</th>
                      </>
                    )}
                    {activeTab === 'pending' && (
                      <th className="px-6 py-3 text-left text-gray-700">Submitted</th>
                    )}
                    {activeTab === 'rejected' && (
                      <th className="px-6 py-3 text-left text-gray-700">Reason</th>
                    )}
                    <th className="px-6 py-3 text-right text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredVendors.map((vendor) => (
                    <tr key={vendor.id} className="hover:bg-gray-50">
                      {/* Vendor Info */}
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">
                            {vendor.fullName || vendor.businessName}
                          </div>
                          {vendor.businessName && vendor.fullName && (
                            <div className="text-gray-600">{vendor.businessName}</div>
                          )}
                          <div className="text-gray-500" style={{ fontSize: '0.875rem' }}>
                            ID: {vendor.id.substring(0, 8)}...
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4">
                        <Badge variant="outline">{vendor.roleName}</Badge>
                      </td>

                      {/* Service Style */}
                      <td className="px-6 py-4">
                        <Badge 
                          variant="secondary"
                          className={
                            vendor.serviceStyle === 'at_home' ? 'bg-blue-100 text-blue-700' :
                            vendor.serviceStyle === 'at_center' ? 'bg-purple-100 text-purple-700' :
                            vendor.serviceStyle === 'both' ? 'bg-green-100 text-green-700' :
                            'bg-orange-100 text-orange-700'
                          }
                        >
                          {vendor.serviceStyle === 'at_home' ? 'At Home' :
                           vendor.serviceStyle === 'at_center' ? 'At Center' :
                           vendor.serviceStyle === 'both' ? 'Both' :
                           'Tele'}
                        </Badge>
                      </td>

                      {/* Location */}
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <div className="text-gray-900">{vendor.city}</div>
                            <div className="text-gray-600">{vendor.state}</div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-gray-700">
                            <Phone className="w-3 h-3 text-gray-400" />
                            <span style={{ fontSize: '0.875rem' }}>{vendor.phone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700">
                            <Mail className="w-3 h-3 text-gray-400" />
                            <span style={{ fontSize: '0.875rem' }}>{vendor.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Approved: Services & Rating */}
                      {activeTab === 'approved' && (
                        <>
                          <td className="px-6 py-4">
                            <div className="text-gray-900">
                              {vendor.activeServices || 0} active
                            </div>
                            <div className="text-gray-600">
                              of {vendor.totalServices || 0} total
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <Award className="w-4 h-4 text-yellow-500" />
                              <span className="text-gray-900">
                                {vendor.rating?.toFixed(1) || 'N/A'}
                              </span>
                            </div>
                          </td>
                        </>
                      )}

                      {/* Pending: Submitted Date */}
                      {activeTab === 'pending' && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-gray-700">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span style={{ fontSize: '0.875rem' }}>
                              {vendor.submittedAt 
                                ? new Date(vendor.submittedAt).toLocaleDateString()
                                : 'N/A'}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* Rejected: Reason */}
                      {activeTab === 'rejected' && (
                        <td className="px-6 py-4">
                          <div className="text-gray-700 max-w-xs truncate">
                            {vendor.rejectionReason || 'No reason provided'}
                          </div>
                        </td>
                      )}

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedVendor(vendor);
                              setShowVendorDetail(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          
                          {activeTab === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => approveVendor(vendor)}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => rejectVendor(vendor)}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Analytics Modal */}
      <Dialog open={showStatsModal} onOpenChange={setShowStatsModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Vendor Analytics & Metrics</DialogTitle>
            <DialogDescription>
              View comprehensive analytics and performance metrics across all vendors
            </DialogDescription>
          </DialogHeader>
          
          {stats && (
            <div className="space-y-6">
              {/* Overview Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="text-gray-600 mb-1">Total Vendors</div>
                  <div className="text-gray-900" style={{ fontSize: '1.875rem' }}>
                    {stats.total}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-gray-600 mb-1">Approval Rate</div>
                  <div className="text-green-600" style={{ fontSize: '1.875rem' }}>
                    {stats.conversionRate.toFixed(1)}%
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-gray-600 mb-1">Avg Approval Time</div>
                  <div className="text-gray-900" style={{ fontSize: '1.875rem' }}>
                    {stats.avgApprovalTime.toFixed(0)}h
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-gray-600 mb-1">Active Today</div>
                  <div className="text-orange-600" style={{ fontSize: '1.875rem' }}>
                    {stats.activeToday}
                  </div>
                </Card>
              </div>

              {/* Status Breakdown */}
              <Card className="p-6">
                <h3 className="text-gray-900 mb-4">Status Distribution</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700">Pending Approval</span>
                      <span className="font-semibold text-gray-900">{stats.pending}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-500"
                        style={{ width: `${(stats.pending / stats.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700">Approved</span>
                      <span className="font-semibold text-gray-900">{stats.approved}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500"
                        style={{ width: `${(stats.approved / stats.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700">Re-verification</span>
                      <span className="font-semibold text-gray-900">{stats.reverification}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-500"
                        style={{ width: `${(stats.reverification / stats.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700">Rejected</span>
                      <span className="font-semibold text-gray-900">{stats.rejected}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500"
                        style={{ width: `${(stats.rejected / stats.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Recent Activity */}
              <Card className="p-6">
                <h3 className="text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-700">New this week</span>
                    <Badge variant="secondary">{stats.newThisWeek}</Badge>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-700">Active vendors today</span>
                    <Badge className="bg-orange-600">{stats.activeToday}</Badge>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Vendor Detail Modal */}
      <Dialog open={showVendorDetail} onOpenChange={setShowVendorDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vendor Details</DialogTitle>
            <DialogDescription>
              View detailed information about this vendor's application and status
            </DialogDescription>
          </DialogHeader>
          
          {selectedVendor && (
            <div className="space-y-6">
              {/* Basic Info */}
              <Card className="p-6">
                <h3 className="text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-600">Full Name</label>
                    <p className="text-gray-900">{selectedVendor.fullName}</p>
                  </div>
                  {selectedVendor.businessName && (
                    <div>
                      <label className="text-gray-600">Business Name</label>
                      <p className="text-gray-900">{selectedVendor.businessName}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-gray-600">Role</label>
                    <p className="text-gray-900">{selectedVendor.roleName}</p>
                  </div>
                  <div>
                    <label className="text-gray-600">Service Style</label>
                    <p className="text-gray-900">{selectedVendor.serviceStyle}</p>
                  </div>
                  <div>
                    <label className="text-gray-600">Phone</label>
                    <p className="text-gray-900">{selectedVendor.phone}</p>
                  </div>
                  <div>
                    <label className="text-gray-600">Email</label>
                    <p className="text-gray-900">{selectedVendor.email}</p>
                  </div>
                  <div>
                    <label className="text-gray-600">City</label>
                    <p className="text-gray-900">{selectedVendor.city}</p>
                  </div>
                  <div>
                    <label className="text-gray-600">State</label>
                    <p className="text-gray-900">{selectedVendor.state}</p>
                  </div>
                </div>
              </Card>

              {/* Status Info */}
              <Card className="p-6">
                <h3 className="text-gray-900 mb-4">Status Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Current Status</span>
                    <Badge 
                      className={
                        selectedVendor.status === 'approved' ? 'bg-green-600' :
                        selectedVendor.status === 'rejected' ? 'bg-red-600' :
                        selectedVendor.status === 'pending_reverification' ? 'bg-yellow-600' :
                        'bg-orange-600'
                      }
                    >
                      {selectedVendor.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  {selectedVendor.submittedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Submitted</span>
                      <span className="text-gray-900">
                        {new Date(selectedVendor.submittedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedVendor.approvedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Approved</span>
                      <span className="text-gray-900">
                        {new Date(selectedVendor.approvedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedVendor.rejectionReason && (
                    <div>
                      <label className="text-gray-600">Rejection Reason</label>
                      <p className="text-gray-900 mt-1">{selectedVendor.rejectionReason}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowVendorDetail(false)}>
                  Close
                </Button>
                {selectedVendor.status === 'pending_approval' && (
                  <>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        approveVendor(selectedVendor);
                        setShowVendorDetail(false);
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve Vendor
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        rejectVendor(selectedVendor);
                        setShowVendorDetail(false);
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject Vendor
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}