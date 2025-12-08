import { useState, useEffect } from 'react';
import { 
  Search, Phone, Building2, User, Filter, Eye, CheckCircle, XCircle, 
  Clock, AlertCircle, RefreshCw, Download, Plus, Loader2, MapPin, AlertTriangle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { ApplicationDetailModal } from './ApplicationDetailModal';
import { AddVendorModal } from './AddVendorModal';
import { DuplicateVendorManagement } from './DuplicateVendorManagement';

interface Vendor {
  id: string;
  fullName: string;
  businessName?: string;
  phone: string;
  email: string;
  category: string;
  roleId?: string;
  services: string[];
  status: 'pending_approval' | 'approved' | 'rejected' | 'pending_reverification';
  submittedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  city?: string;
  state?: string;
  address?: string;
  rating?: number;
  totalBookings?: number;
  isActive?: boolean;
}

interface EnhancedVendorAdministrationProps {
  onNavigate?: (view: string) => void;
}

type TabType = 'new_applications' | 'approved' | 'rejected' | 'reverification' | 'duplicates';
type RoleFilterType = 'all' | 'veterinarian' | 'pet_groomer' | 'pet_trainer' | 'pet_walker' | 'boarding_center' | 'pet_behaviourist' | 'pet_nutritionist' | 'pet_breeder';

export function EnhancedVendorAdministration({ onNavigate }: EnhancedVendorAdministrationProps) {
  const [activeTab, setActiveTab] = useState<TabType>('new_applications');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilterType>('all');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    newApplications: 0,
    approved: 0,
    rejected: 0,
    reverification: 0
  });

  useEffect(() => {
    loadVendors();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [vendors, activeTab, searchQuery, roleFilter]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/all`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const vendorList = data.vendors || [];
        
        // Deduplicate vendors by ID to prevent duplicate key errors
        // Filter out any vendors without IDs first
        const validVendors = vendorList.filter((v: Vendor) => v.id);
        
        const uniqueVendors = Array.from(
          new Map(validVendors.map((v: Vendor) => [v.id, v])).values()
        );
        
        console.log('📊 Loaded vendors:', {
          total: vendorList.length,
          valid: validVendors.length,
          unique: uniqueVendors.length,
          duplicatesRemoved: validVendors.length - uniqueVendors.length
        });
        
        setVendors(uniqueVendors);

        // Calculate stats
        setStats({
          newApplications: uniqueVendors.filter((v: Vendor) => v.status === 'pending_approval').length,
          approved: uniqueVendors.filter((v: Vendor) => v.status === 'approved').length,
          rejected: uniqueVendors.filter((v: Vendor) => v.status === 'rejected').length,
          reverification: uniqueVendors.filter((v: Vendor) => v.status === 'pending_reverification').length
        });
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...vendors];

    // Filter by tab (status)
    switch (activeTab) {
      case 'new_applications':
        filtered = filtered.filter(v => v.status === 'pending_approval');
        break;
      case 'approved':
        filtered = filtered.filter(v => v.status === 'approved');
        break;
      case 'rejected':
        filtered = filtered.filter(v => v.status === 'rejected');
        break;
      case 'reverification':
        filtered = filtered.filter(v => v.status === 'pending_reverification');
        break;
      case 'duplicates':
        filtered = filtered.filter(v => v.id.includes('duplicate'));
        break;
    }

    // Filter by role
    if (roleFilter !== 'all') {
      filtered = filtered.filter(v => v.roleId === roleFilter || v.category === roleFilter);
    }

    // Filter by search query (mobile, name, business name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(v => 
        v.phone?.includes(query) ||
        v.fullName?.toLowerCase().includes(query) ||
        v.businessName?.toLowerCase().includes(query) ||
        v.email?.toLowerCase().includes(query)
      );
    }

    setFilteredVendors(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
      case 'pending_reverification':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Re-verification</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
  };

  const getRoleBadge = (roleId: string) => {
    const roleColors: any = {
      'veterinarian': 'bg-blue-50 text-blue-700 border-blue-200',
      'pet_groomer': 'bg-purple-50 text-purple-700 border-purple-200',
      'pet_trainer': 'bg-green-50 text-green-700 border-green-200',
      'pet_walker': 'bg-pink-50 text-pink-700 border-pink-200',
      'boarding_center': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'pet_behaviourist': 'bg-orange-50 text-orange-700 border-orange-200',
      'pet_nutritionist': 'bg-teal-50 text-teal-700 border-teal-200',
      'pet_breeder': 'bg-amber-50 text-amber-700 border-amber-200'
    };

    const roleNames: any = {
      'veterinarian': 'Veterinarian',
      'pet_groomer': 'Groomer',
      'pet_trainer': 'Trainer',
      'pet_walker': 'Walker',
      'boarding_center': 'Boarding',
      'pet_behaviourist': 'Behaviourist',
      'pet_nutritionist': 'Nutritionist',
      'pet_breeder': 'Breeder'
    };

    return (
      <Badge className={`${roleColors[roleId] || 'bg-gray-50 text-gray-700 border-gray-200'} border`}>
        {roleNames[roleId] || roleId}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const viewDetails = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setShowDetailModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendor Administration</h1>
            <p className="text-sm text-gray-600 mt-1">Manage vendor applications and accounts</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={loadVendors}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
            <Button 
              className="gap-2 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
              onClick={() => setShowAddVendor(true)}
            >
              <Plus className="w-4 h-4" />
              Add Vendor
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-4 gap-4">
          <button
            onClick={() => setActiveTab('new_applications')}
            className={`bg-white rounded-xl p-5 border-2 transition-all ${
              activeTab === 'new_applications' 
                ? 'border-yellow-500 shadow-lg' 
                : 'border-gray-200 hover:border-yellow-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${
                activeTab === 'new_applications' ? 'bg-yellow-100' : 'bg-gray-50'
              }`}>
                <Clock className={`w-5 h-5 ${
                  activeTab === 'new_applications' ? 'text-yellow-600' : 'text-gray-600'
                }`} />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.newApplications}</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">New Applications</p>
              <p className="text-xs text-gray-500 mt-1">Pending approval</p>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={`bg-white rounded-xl p-5 border-2 transition-all ${
              activeTab === 'approved' 
                ? 'border-green-500 shadow-lg' 
                : 'border-gray-200 hover:border-green-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${
                activeTab === 'approved' ? 'bg-green-100' : 'bg-gray-50'
              }`}>
                <CheckCircle className={`w-5 h-5 ${
                  activeTab === 'approved' ? 'text-green-600' : 'text-gray-600'
                }`} />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.approved}</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">Approved Vendors</p>
              <p className="text-xs text-gray-500 mt-1">Active accounts</p>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={`bg-white rounded-xl p-5 border-2 transition-all ${
              activeTab === 'rejected' 
                ? 'border-red-500 shadow-lg' 
                : 'border-gray-200 hover:border-red-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${
                activeTab === 'rejected' ? 'bg-red-100' : 'bg-gray-50'
              }`}>
                <XCircle className={`w-5 h-5 ${
                  activeTab === 'rejected' ? 'text-red-600' : 'text-gray-600'
                }`} />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.rejected}</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">Rejected</p>
              <p className="text-xs text-gray-500 mt-1">Declined applications</p>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('reverification')}
            className={`bg-white rounded-xl p-5 border-2 transition-all ${
              activeTab === 'reverification' 
                ? 'border-orange-500 shadow-lg' 
                : 'border-gray-200 hover:border-orange-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${
                activeTab === 'reverification' ? 'bg-orange-100' : 'bg-gray-50'
              }`}>
                <AlertCircle className={`w-5 h-5 ${
                  activeTab === 'reverification' ? 'text-orange-600' : 'text-gray-600'
                }`} />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.reverification}</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">Re-verification</p>
              <p className="text-xs text-gray-500 mt-1">Requires review</p>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('duplicates')}
            className={`bg-white rounded-xl p-5 border-2 transition-all ${
              activeTab === 'duplicates' 
                ? 'border-red-500 shadow-lg' 
                : 'border-gray-200 hover:border-red-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${
                activeTab === 'duplicates' ? 'bg-red-100' : 'bg-gray-50'
              }`}>
                <AlertTriangle className={`w-5 h-5 ${
                  activeTab === 'duplicates' ? 'text-red-600' : 'text-gray-600'
                }`} />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.reverification}</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">Duplicates</p>
              <p className="text-xs text-gray-500 mt-1">Identified duplicates</p>
            </div>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="px-8 pb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by mobile number, name, or business name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200"
              />
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilterType)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              >
                <option value="all">All Roles</option>
                <option value="veterinarian">Veterinarian</option>
                <option value="pet_groomer">Groomer</option>
                <option value="pet_trainer">Trainer</option>
                <option value="pet_walker">Walker</option>
                <option value="boarding_center">Boarding Center</option>
                <option value="pet_behaviourist">Behaviourist</option>
                <option value="pet_nutritionist">Nutritionist</option>
                <option value="pet_breeder">Breeder</option>
              </select>
            </div>

            {/* Result Count */}
            <div className="text-sm text-gray-600 whitespace-nowrap">
              {filteredVendors.length} {filteredVendors.length === 1 ? 'vendor' : 'vendors'}
            </div>
          </div>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="px-8 pb-8">
        {activeTab === 'duplicates' ? (
          <DuplicateVendorManagement />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" />
              </div>
            ) : filteredVendors.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">No vendors found</p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchQuery || roleFilter !== 'all' 
                    ? 'Try adjusting your search or filters'
                    : 'No vendors in this category yet'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Vendor Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Role/Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Submitted
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredVendors.map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-[#FF8C42] to-[#FF7A2E] rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-sm">
                                {vendor.fullName?.charAt(0) || vendor.businessName?.charAt(0) || 'V'}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{vendor.fullName}</p>
                              {vendor.businessName && (
                                <p className="text-sm text-gray-500 flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {vendor.businessName}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <p className="text-sm text-gray-900 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-gray-400" />
                              {vendor.phone}
                            </p>
                            {vendor.email && (
                              <p className="text-xs text-gray-500">{vendor.email}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getRoleBadge(vendor.roleId || vendor.category)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-1">
                            <MapPin className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-gray-600">
                              {vendor.city && <div>{vendor.city}</div>}
                              {vendor.state && <div className="text-xs text-gray-500">{vendor.state}</div>}
                              {!vendor.city && !vendor.state && <span className="text-gray-400">N/A</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(vendor.status)}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600">{formatDate(vendor.submittedAt)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-2 text-[#FF8C42] hover:text-[#FF7A2E] hover:bg-orange-50"
                              onClick={() => viewDetails(vendor)}
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showDetailModal && selectedVendor && (
        <ApplicationDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedVendor(null);
          }}
          application={selectedVendor as any}
          onApprove={() => {
            // Reload vendors after approval
            loadVendors();
          }}
          onReject={() => {
            // Reload vendors after rejection
            loadVendors();
          }}
          onRequestClarification={() => {
            // Reload vendors after clarification request
            loadVendors();
          }}
        />
      )}

      {showAddVendor && (
        <AddVendorModal
          isOpen={showAddVendor}
          onClose={() => setShowAddVendor(false)}
          onVendorAdded={loadVendors}
        />
      )}
    </div>
  );
}