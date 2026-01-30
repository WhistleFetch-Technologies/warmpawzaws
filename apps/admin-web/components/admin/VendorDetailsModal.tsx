'use client';

import { X, MapPin, Star, TrendingUp, ShoppingBag, Package, Shield, User, Building2, FileText, Download, Eye, Clock, Activity, Phone, Mail, Calendar, Users, Briefcase, PowerOff, Power, Home, Video, Search, BarChart3, Gift } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface VendorDocument {
  id: string;
  type: string;
  name: string;
  url: string;
  uploadedAt?: string;
  status: string;
  verified: boolean;
}

interface VendorActivity {
  activity_type: string;
  id: string;
  status: string;
  amount: number;
  timestamp: string;
  description: string;
  customer_name?: string;
  related_entity?: string;
}

interface VendorService {
  id: string;
  name: string;
  basePrice: number;
  isActive: boolean;
  category: string;
  serviceStyle?: string;
  duration?: number;
  description?: string;
}

interface VendorPackage {
  id: string;
  name: string;
  description: string;
  price: number;
  services: string[];
  isActive: boolean;
  validityDays?: number;
}

interface VendorStaff {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role?: string;
  specialization?: string;
  isActive: boolean;
  rating?: number;
  servicesHandled?: string[];
}

interface BankDetails {
  accountHolderName?: string;
  accountNumber?: string;
  bankName?: string;
  branchName?: string;
  ifscCode?: string;
  accountType?: 'savings' | 'current';
  upiId?: string;
  isVerified?: boolean;
  razorpayAccountId?: string;
}

interface VendorDetails {
  id: string;
  name: string;
  businessName: string;
  ownerName: string;
  tier: string;
  tierColor: string;
  rating: number;
  reviewCount: number;
  complaints: number;
  location: string;
  experience: string;
  lastActive: string;
  businessHours: string;
  monthlyRevenue: number;
  revenueChange: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  ordersPeriod: string;
  products: number;
  productsType: string;
  complianceScore: number;
  complianceLabel: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  primaryContact: string;
  email: string;
  phone: string;
  website: string;
  joinDate: string;
  documents: string;
  documentsList: VendorDocument[];
  totalRevenue: number;
  avgOrderValue: number;
  refundRate: number;
  commissionRate: number;
  paymentMethod: string;
  bankAccount: string;
  bankDetails: BankDetails | null;
  frequency: string;
  taxId: string;
  gstNumber: string;
  panNumber: string;
  registrationNumber: string;
  recentOrders: Array<{
    id: string;
    service: string;
    customer: string;
    amount: number;
    status: string;
    date: string;
    createdAt: string;
  }>;
  // Vendor type and role
  vendorType: 'solo' | 'business';
  roleId: string;
  roleName: string;
  roleDisplayName: string;
  category: string;
  status: string;
  isActive: boolean;
  // Services
  services: VendorService[];
  activeServicesCount: number;
  servicesByStyle?: {
    at_home: VendorService[];
    at_center: VendorService[];
    tele: VendorService[];
  };
  // Packages
  packages?: VendorPackage[];
  activePackagesCount?: number;
  // Staff
  staffCount: number;
  staffList?: VendorStaff[];
  // Activity
  activityHistory: VendorActivity[];
  createdAt: string;
  approvedAt: string;
}

interface VendorDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  onVendorUpdated?: () => void;
}

export function VendorDetailsModal({ isOpen, onClose, vendorId, onVendorUpdated }: VendorDetailsModalProps) {
  const [vendor, setVendor] = useState<VendorDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'activity' | 'services' | 'staff' | 'packages' | 'analytics'>('overview');
  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceStyleFilter, setServiceStyleFilter] = useState<'all' | 'at_home' | 'at_center' | 'tele'>('all');

  // Filter services based on search and style filter
  const filteredServices = useMemo(() => {
    if (!vendor?.services) return [];
    let services = vendor.services;
    
    // Apply style filter
    if (serviceStyleFilter !== 'all' && vendor.servicesByStyle) {
      services = vendor.servicesByStyle[serviceStyleFilter] || [];
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      services = services.filter(s => 
        s.name?.toLowerCase().includes(query) || 
        s.category?.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query)
      );
    }
    
    return services;
  }, [vendor?.services, vendor?.servicesByStyle, searchQuery, serviceStyleFilter]);

  // Filter bookings based on search
  const filteredBookings = useMemo(() => {
    if (!vendor?.recentOrders) return [];
    if (!searchQuery.trim()) return vendor.recentOrders;
    
    const query = searchQuery.toLowerCase();
    return vendor.recentOrders.filter(order => 
      order.service?.toLowerCase().includes(query) ||
      order.customer?.toLowerCase().includes(query) ||
      order.status?.toLowerCase().includes(query)
    );
  }, [vendor?.recentOrders, searchQuery]);

  // Filter activity based on search
  const filteredActivity = useMemo(() => {
    if (!vendor?.activityHistory) return [];
    if (!searchQuery.trim()) return vendor.activityHistory;
    
    const query = searchQuery.toLowerCase();
    return vendor.activityHistory.filter(activity => 
      activity.description?.toLowerCase().includes(query) ||
      activity.customer_name?.toLowerCase().includes(query) ||
      activity.status?.toLowerCase().includes(query)
    );
  }, [vendor?.activityHistory, searchQuery]);

  useEffect(() => {
    if (isOpen && vendorId) {
      loadVendorDetails();
    }
  }, [isOpen, vendorId]);

  const loadVendorDetails = async () => {
    try {
      setLoading(true);
      
      const data = await apiClient.get<any>(`/admin/vendors/${vendorId}/details`);
      const raw = data.vendor;
      const vendorWithRoleId = raw
        ? { ...raw, roleId: (raw.roleId ?? raw.role_id ?? '').toString() }
        : null;
      setVendor(vendorWithRoleId);
      
      // Also load documents if available
      if (data.vendor?.documentsList) {
        setDocuments(data.vendor.documentsList);
      }
    } catch (error) {
      console.error('Error loading vendor details:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      setDocumentsLoading(true);
      const data = await apiClient.get<any>(`/admin/vendors/${vendorId}/documents`);
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!vendor) return;
    const reason = prompt(`Enter reason for deactivating ${vendor.name}:`);
    if (!reason) return;
    
    const confirmed = confirm(`Are you sure you want to deactivate ${vendor.name}?`);
    if (!confirmed) return;

    try {
      await apiClient.post(`/admin/vendors/${vendorId}/deactivate`, { reason });
      alert('Vendor deactivated successfully');
      onVendorUpdated?.();
      onClose();
    } catch (error: any) {
      alert(error.message || 'Failed to deactivate vendor');
    }
  };

  const handleReactivate = async () => {
    if (!vendor) return;
    const confirmed = confirm(`Are you sure you want to reactivate ${vendor.name}?`);
    if (!confirmed) return;

    try {
      await apiClient.post(`/admin/vendors/${vendorId}/reactivate`, {});
      alert('Vendor reactivated successfully');
      onVendorUpdated?.();
      loadVendorDetails();
    } catch (error: any) {
      alert(error.message || 'Failed to reactivate vendor');
    }
  };

  const getVendorTypeBadge = (vendorType: string) => {
    if (vendorType === 'solo') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700 border border-purple-200">
          <User className="w-3 h-3" />
          Solo Provider
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">
        <Building2 className="w-3 h-3" />
        Business
      </span>
    );
  };

  const handleViewDocument = (doc: VendorDocument) => {
    if (doc.url) {
      window.open(doc.url, '_blank');
    } else {
      alert('Document URL not available');
    }
  };

  const handleDownloadDocument = async (doc: VendorDocument) => {
    if (doc.url) {
      try {
        // Try to get a fresh presigned URL
        const response = await apiClient.get<any>(`/storage/presigned-url?fileKey=${encodeURIComponent(doc.url)}`);
        const downloadUrl = response.url || doc.url;
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = doc.name || `${doc.type}.pdf`;
        link.click();
      } catch {
        // Fallback to direct URL
        window.open(doc.url, '_blank');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {loading || !vendor ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
            <div className="text-sm text-gray-500">Loading vendor details...</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{vendor.name}</h2>
                {getVendorTypeBadge(vendor.vendorType)}
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                  vendor.tierColor === 'gold' ? 'bg-yellow-100 text-yellow-700' :
                  vendor.tierColor === 'silver' ? 'bg-gray-200 text-gray-700' :
                  vendor.tierColor === 'platinum' ? 'bg-purple-100 text-purple-700' :
                  'bg-orange-100 text-orange-700'
                }`}>
                  {vendor.tier} Tier
                </span>
                {!vendor.isActive && (
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                    Inactive
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {vendor.isActive ? (
                  <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={handleDeactivate}>
                    <PowerOff className="w-4 h-4 mr-1" />
                    Deactivate
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="text-green-600 hover:bg-green-50" onClick={handleReactivate}>
                    <Power className="w-4 h-4 mr-1" />
                    Reactivate
                  </Button>
                )}
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Info Bar */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
                <span className="font-medium">{vendor.rating?.toFixed(1) || '0.0'}/5</span>
                <span className="text-gray-500">({vendor.reviewCount || 0} reviews)</span>
              </div>
              {vendor.complaints > 0 && (
                <div className="text-red-600">{vendor.complaints} complaints</div>
              )}
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span>{vendor.location || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-gray-400" />
                <span>{vendor.roleDisplayName || vendor.category || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>{vendor.experience || 'N/A'}</span>
              </div>
              <div className="text-gray-500 ml-auto text-xs">
                Joined: {vendor.joinDate}
              </div>
            </div>

            {/* Search Bar */}
            <div className="px-6 py-3 bg-white border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search services, bookings, activity..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/20 focus:border-[#FF8C42]"
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b border-gray-200 overflow-x-auto">
              <div className="flex gap-4 min-w-max">
                {[
                  { id: 'overview', label: 'Overview', icon: Activity },
                  { id: 'services', label: 'Services', icon: Package },
                  { id: 'staff', label: 'Staff', icon: Users, showIf: vendor?.vendorType === 'business' },
                  { id: 'packages', label: 'Packages', icon: Gift },
                  { id: 'activity', label: 'Bookings & Activity', icon: Clock },
                  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
                  { id: 'documents', label: 'Documents', icon: FileText }
                ].filter(tab => tab.showIf !== false).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      if (tab.id === 'documents' && documents.length === 0) {
                        loadDocuments();
                      }
                    }}
                    className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-[#FF8C42] text-[#FF8C42]'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'overview' && (
                <>
                  {/* Stats Cards */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-600">Monthly Revenue</span>
                        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        </div>
                      </div>
                      <div className="text-2xl font-semibold">₹{(vendor.monthlyRevenue || 0).toLocaleString('en-IN')}</div>
                      <div className="text-xs text-green-600">↑ {vendor.revenueChange || 0}% from last month</div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-600">Total Bookings</span>
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                          <ShoppingBag className="w-4 h-4 text-blue-600" />
                        </div>
                      </div>
                      <div className="text-2xl font-semibold">{vendor.totalOrders || 0}</div>
                      <div className="text-xs text-gray-500">{vendor.completedOrders || 0} completed, {vendor.pendingOrders || 0} pending</div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-600">Services</span>
                        <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center">
                          <Package className="w-4 h-4 text-yellow-600" />
                        </div>
                      </div>
                      <div className="text-2xl font-semibold">{vendor.activeServicesCount || vendor.products || 0}</div>
                      <div className="text-xs text-gray-500">Active services</div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-600">Compliance Score</span>
                        <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                          <Shield className="w-4 h-4 text-purple-600" />
                        </div>
                      </div>
                      <div className="text-2xl font-semibold">{vendor.complianceScore || 100}%</div>
                      <div className={`text-xs ${vendor.complianceScore >= 80 ? 'text-green-600' : 'text-red-600'}`}>
                        {vendor.complianceLabel || 'Good Standing'}
                      </div>
                    </div>
                  </div>

                  {/* Information Sections */}
                  <div className="grid grid-cols-3 gap-6">
                    {/* Basic Information */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h3 className="text-sm font-semibold mb-4 text-gray-800">Basic Information</h3>
                      <div className="space-y-3">
                        <InfoItem icon="👤" label="Owner Name" value={vendor.ownerName || 'N/A'} />
                        <InfoItem icon="🏢" label="Business Name" value={vendor.businessName || 'N/A'} />
                        <InfoItem icon="📍" label="Address" value={vendor.address || 'N/A'} />
                        <InfoItem icon="🌆" label="City/State" value={vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : (vendor.city || vendor.state || 'N/A')} />
                        <InfoItem icon="📮" label="Pincode" value={vendor.pincode || 'N/A'} />
                        <InfoItem icon="📞" label="Phone" value={vendor.phone || vendor.primaryContact || 'N/A'} />
                        <InfoItem icon="✉️" label="Email" value={vendor.email || 'N/A'} />
                        {vendor.vendorType === 'business' && (
                          <InfoItem icon="👥" label="Staff Count" value={`${vendor.staffCount || 0} members`} />
                        )}
                      </div>
                    </div>

                    {/* Business & Financial */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h3 className="text-sm font-semibold mb-4 text-gray-800">Business & Financial</h3>
                      <div className="space-y-3">
                        <InfoItem icon="📝" label="GST Number" value={vendor.gstNumber || 'N/A'} />
                        <InfoItem icon="💳" label="PAN Number" value={vendor.panNumber || 'N/A'} />
                        <InfoItem icon="🔢" label="Registration No." value={vendor.registrationNumber || 'N/A'} />
                        <div className="flex items-center justify-between text-sm border-t border-gray-200 pt-3 mt-3">
                          <span className="text-gray-600">Total Revenue</span>
                          <span className="font-medium">₹{(vendor.totalRevenue || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Avg Order Value</span>
                          <span className="font-medium">₹{vendor.avgOrderValue || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Commission Rate</span>
                          <span className="font-medium">{vendor.commissionRate || 15}%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Refund Rate</span>
                          <span className={`font-medium ${(vendor.refundRate || 0) > 5 ? 'text-red-600' : 'text-green-600'}`}>{vendor.refundRate || 0}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Payment Info */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h3 className="text-sm font-semibold mb-4 text-gray-800">Payment Info</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Payment Method</span>
                          <span>{vendor.paymentMethod || 'Bank Transfer'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Bank Account</span>
                          <span>{vendor.bankAccount || 'N/A'}</span>
                        </div>
                        {vendor.bankDetails && (
                          <>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Bank Name</span>
                              <span>{vendor.bankDetails.bankName || 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">IFSC Code</span>
                              <span>{vendor.bankDetails.ifscCode || 'N/A'}</span>
                            </div>
                          </>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Settlement Frequency</span>
                          <span>{vendor.frequency || 'Weekly'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Orders */}
                  {vendor.recentOrders && vendor.recentOrders.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-semibold mb-4 text-gray-800">Recent Bookings</h3>
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Service</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Customer</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vendor.recentOrders.slice(0, 5).map((order, idx) => (
                              <tr key={order.id || idx} className="border-t border-gray-100">
                                <td className="px-4 py-2">{order.service}</td>
                                <td className="px-4 py-2 text-gray-600">{order.customer}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                                    order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                    order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {order.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right font-medium">₹{order.amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'documents' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-800">Uploaded Documents</h3>
                    <Button variant="outline" size="sm" onClick={loadDocuments} disabled={documentsLoading}>
                      {documentsLoading ? 'Loading...' : 'Refresh'}
                    </Button>
                  </div>
                  
                  {documentsLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading documents...</div>
                  ) : documents.length === 0 && (!vendor.documentsList || vendor.documentsList.length === 0) ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No documents uploaded</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {(documents.length > 0 ? documents : vendor.documentsList || []).map((doc, idx) => (
                        <div key={doc.id || idx} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-gray-500" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">{doc.name || doc.type}</div>
                              <div className="text-xs text-gray-500">
                                {doc.verified ? (
                                  <span className="text-green-600">✓ Verified</span>
                                ) : (
                                  <span className="text-yellow-600">Pending verification</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewDocument(doc)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(doc)}>
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'activity' && (
                <div>
                  {/* Recent Bookings Section */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-800">Recent Bookings</h3>
                      <span className="text-xs text-gray-500">{filteredBookings.length} bookings</span>
                    </div>
                    
                    {filteredBookings.length > 0 ? (
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Service</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Customer</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredBookings.map((order, idx) => (
                              <tr key={order.id || idx} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium">{order.service}</td>
                                <td className="px-4 py-3 text-gray-600">{order.customer}</td>
                                <td className="px-4 py-3 text-gray-500">
                                  {order.date ? new Date(order.date).toLocaleDateString('en-IN') : 
                                   order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                                    order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                    order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                    order.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {order.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-medium">₹{order.amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-xl">
                        <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">
                          {searchQuery ? 'No bookings match your search' : 'No bookings yet'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Activity History Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-800">Activity Timeline</h3>
                      <span className="text-xs text-gray-500">{filteredActivity.length} activities</span>
                    </div>
                    
                    {filteredActivity.length > 0 ? (
                      <div className="relative">
                        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
                        <div className="space-y-4">
                          {filteredActivity.map((activity, idx) => (
                            <div key={activity.id || idx} className="relative flex items-start gap-4 pl-2">
                              <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                activity.activity_type === 'booking' ? 'bg-blue-100' :
                                activity.activity_type === 'payment' ? 'bg-green-100' :
                                'bg-gray-100'
                              }`}>
                                {activity.activity_type === 'booking' ? (
                                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                                ) : activity.activity_type === 'payment' ? (
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Activity className="w-4 h-4 text-gray-600" />
                                )}
                              </div>
                              <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-medium">{activity.description}</div>
                                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                                    activity.status === 'completed' ? 'bg-green-100 text-green-700' :
                                    activity.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {activity.status}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <div className="text-xs text-gray-500">
                                    {activity.customer_name && <span>{activity.customer_name} • </span>}
                                    {new Date(activity.timestamp).toLocaleString('en-IN')}
                                  </div>
                                  {activity.amount > 0 && (
                                    <div className="text-sm font-medium text-[#FF8C42]">₹{activity.amount}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-xl">
                        <Activity className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">
                          {searchQuery ? 'No activities match your search' : 'No activity history available'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'services' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-800">Vendor Services</h3>
                    <div className="flex gap-2">
                      {[
                        { value: 'all', label: 'All', icon: Package },
                        { value: 'at_home', label: 'Home Visit', icon: Home },
                        { value: 'at_center', label: 'At Center', icon: Building2 },
                        { value: 'tele', label: 'Tele', icon: Video }
                      ].map((filter) => (
                        <button
                          key={filter.value}
                          onClick={() => setServiceStyleFilter(filter.value as any)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            serviceStyleFilter === filter.value
                              ? 'bg-[#FF8C42] text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <filter.icon className="w-3.5 h-3.5" />
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Service counts by style */}
                  {vendor.servicesByStyle && (
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <Home className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                        <div className="text-lg font-semibold text-blue-700">{vendor.servicesByStyle.at_home?.length || 0}</div>
                        <div className="text-xs text-blue-600">Home Visit</div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3 text-center">
                        <Building2 className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                        <div className="text-lg font-semibold text-purple-700">{vendor.servicesByStyle.at_center?.length || 0}</div>
                        <div className="text-xs text-purple-600">At Center</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <Video className="w-5 h-5 text-green-600 mx-auto mb-1" />
                        <div className="text-lg font-semibold text-green-700">{vendor.servicesByStyle.tele?.length || 0}</div>
                        <div className="text-xs text-green-600">Tele-consultation</div>
                      </div>
                    </div>
                  )}
                  
                  {filteredServices.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {filteredServices.map((service: VendorService, idx: number) => (
                        <div key={service.id || idx} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium">{service.name}</div>
                            <div className="flex items-center gap-2">
                              {service.serviceStyle && (
                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                  service.serviceStyle === 'at_home' ? 'bg-blue-100 text-blue-700' :
                                  service.serviceStyle === 'at_center' ? 'bg-purple-100 text-purple-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {service.serviceStyle === 'at_home' ? 'Home' : 
                                   service.serviceStyle === 'at_center' ? 'Center' : 'Tele'}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                service.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {service.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                          <div className="text-lg font-semibold text-[#FF8C42]">₹{service.basePrice || 0}</div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-gray-500">{service.category || 'General'}</span>
                            {service.duration && <span className="text-xs text-gray-400">{service.duration} min</span>}
                          </div>
                          {service.description && (
                            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{service.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">
                        {searchQuery || serviceStyleFilter !== 'all' 
                          ? 'No services match your filters' 
                          : 'No services configured'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Staff Tab */}
              {activeTab === 'staff' && vendor.vendorType === 'business' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-800">Staff Members</h3>
                    <span className="text-sm text-gray-500">{vendor.staffCount || 0} members</span>
                  </div>
                  
                  {vendor.staffList && vendor.staffList.length > 0 ? (
                    <div className="space-y-3">
                      {vendor.staffList.map((staff: VendorStaff, idx: number) => (
                        <div key={staff.id || idx} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-gray-500" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{staff.name}</span>
                              {staff.role && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                                  {staff.role}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                staff.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {staff.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            {staff.specialization && (
                              <div className="text-xs text-gray-500 mt-1">Specialization: {staff.specialization}</div>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              {staff.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{staff.phone}</span>}
                              {staff.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{staff.email}</span>}
                              {staff.rating && <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500" />{staff.rating.toFixed(1)}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No staff members added</p>
                    </div>
                  )}
                </div>
              )}

              {/* Packages Tab */}
              {activeTab === 'packages' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-800">Custom Packages</h3>
                    <span className="text-sm text-gray-500">{vendor.activePackagesCount || 0} active</span>
                  </div>
                  
                  {vendor.packages && vendor.packages.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {vendor.packages.map((pkg: VendorPackage, idx: number) => (
                        <div key={pkg.id || idx} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Gift className="w-5 h-5 text-[#FF8C42]" />
                              <span className="font-medium">{pkg.name}</span>
                            </div>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              pkg.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {pkg.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div className="text-2xl font-bold text-[#FF8C42] mb-2">₹{pkg.price || 0}</div>
                          {pkg.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{pkg.description}</p>
                          )}
                          {pkg.validityDays && (
                            <div className="text-xs text-gray-500 mb-2">Valid for {pkg.validityDays} days</div>
                          )}
                          {pkg.services && pkg.services.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <div className="text-xs font-medium text-gray-600 mb-1">Includes:</div>
                              <div className="flex flex-wrap gap-1">
                                {(Array.isArray(pkg.services) ? pkg.services : []).slice(0, 3).map((s: any, i: number) => (
                                  <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                    {typeof s === 'string' ? s : s.name || 'Service'}
                                  </span>
                                ))}
                                {pkg.services.length > 3 && (
                                  <span className="text-xs text-gray-400">+{pkg.services.length - 3} more</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl">
                      <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No custom packages configured</p>
                    </div>
                  )}
                </div>
              )}

              {/* Analytics Tab */}
              {activeTab === 'analytics' && (
                <div>
                  <h3 className="text-sm font-semibold mb-4 text-gray-800">Performance Analytics</h3>
                  
                  {/* Key Metrics */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
                      <div className="text-xs text-green-600 mb-1">Total Revenue</div>
                      <div className="text-2xl font-bold text-green-700">₹{(vendor.totalRevenue || 0).toLocaleString('en-IN')}</div>
                      <div className="text-xs text-green-600 mt-1">All time</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                      <div className="text-xs text-blue-600 mb-1">Total Bookings</div>
                      <div className="text-2xl font-bold text-blue-700">{vendor.totalOrders || 0}</div>
                      <div className="text-xs text-blue-600 mt-1">{vendor.completedOrders || 0} completed</div>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4">
                      <div className="text-xs text-yellow-600 mb-1">Avg Rating</div>
                      <div className="text-2xl font-bold text-yellow-700">{vendor.rating?.toFixed(1) || '0.0'}</div>
                      <div className="text-xs text-yellow-600 mt-1">{vendor.reviewCount || 0} reviews</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                      <div className="text-xs text-purple-600 mb-1">Success Rate</div>
                      <div className="text-2xl font-bold text-purple-700">
                        {vendor.totalOrders > 0 
                          ? Math.round((vendor.completedOrders / vendor.totalOrders) * 100) 
                          : 0}%
                      </div>
                      <div className="text-xs text-purple-600 mt-1">Completion</div>
                    </div>
                  </div>

                  {/* Additional Metrics */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-medium mb-3 text-gray-700">Financial Summary</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Monthly Revenue</span>
                          <span className="font-semibold">₹{(vendor.monthlyRevenue || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Avg Order Value</span>
                          <span className="font-semibold">₹{vendor.avgOrderValue || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Commission Rate</span>
                          <span className="font-semibold">{vendor.commissionRate || 15}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Refund Rate</span>
                          <span className={`font-semibold ${(vendor.refundRate || 0) > 5 ? 'text-red-600' : 'text-green-600'}`}>
                            {vendor.refundRate || 0}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-medium mb-3 text-gray-700">Service Overview</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Active Services</span>
                          <span className="font-semibold">{vendor.activeServicesCount || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total Services</span>
                          <span className="font-semibold">{vendor.services?.length || 0}</span>
                        </div>
                        {vendor.vendorType === 'business' && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Staff Members</span>
                            <span className="font-semibold">{vendor.staffCount || 0}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Active Packages</span>
                          <span className="font-semibold">{vendor.activePackagesCount || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Booking Status Breakdown */}
                  <div className="mt-6 bg-gray-50 rounded-xl p-4">
                    <h4 className="text-sm font-medium mb-3 text-gray-700">Booking Status Breakdown</h4>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="h-4 rounded-full bg-gray-200 overflow-hidden flex">
                          {vendor.totalOrders > 0 && (
                            <>
                              <div 
                                className="h-full bg-green-500" 
                                style={{ width: `${(vendor.completedOrders / vendor.totalOrders) * 100}%` }}
                              />
                              <div 
                                className="h-full bg-yellow-500" 
                                style={{ width: `${(vendor.pendingOrders / vendor.totalOrders) * 100}%` }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-6 mt-3 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span>Completed ({vendor.completedOrders || 0})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span>Pending ({vendor.pendingOrders || 0})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-300" />
                        <span>Others ({(vendor.totalOrders || 0) - (vendor.completedOrders || 0) - (vendor.pendingOrders || 0)})</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="text-sm flex items-start gap-2">
      <span className="text-base flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-gray-900 font-medium truncate">{value || 'N/A'}</div>
      </div>
    </div>
  );
}

