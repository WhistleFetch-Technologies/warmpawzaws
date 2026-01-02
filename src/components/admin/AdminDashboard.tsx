import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import { 
  Users,
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  LogOut,
  TrendingUp,
  DollarSign,
  Package,
  LayoutDashboard,
  Megaphone,
  Headphones,
  BookOpen,
  Calendar,
  FileText,
  Wallet,
  UserCog,
  Bell,
  MessageSquare,
  Settings,
  BarChart3,
  RefreshCw,
  Plus,
  ChevronDown,
  AlertCircle,
  FileCheck,
  Send,
  Globe,
  Download as DownloadIcon,
  CalendarCheck,
  DollarSignIcon,
  Database,
  Briefcase
} from 'lucide-react';
import { supabase } from '../../utils/supabase/client';
import { projectId } from '../../utils/supabase/info';
import { toast } from 'sonner';

import { MarketingPromotionsTab } from './MarketingPromotionsTab';
import { EnterpriseLogicTab } from './EnterpriseLogicTab';
import { AdminAnalyticsDashboard } from './analytics/AdminAnalyticsDashboard'; // ✅ NEW
import { UnifiedAdminSidebar } from './layout/UnifiedAdminSidebar';
import { NotificationBellWrapper } from '../common/NotificationBellWrapper';

interface AdminDashboardProps {
  session: any;
  onNavigate?: (view: string) => void;
  initialView?: string;
}

export function AdminDashboard({ session, onNavigate, initialView }: AdminDashboardProps) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeView, setActiveView] = useState(initialView || 'vendor-admin');

  useEffect(() => {
    loadVendors();
  }, []);

  useEffect(() => {
    filterVendors();
  }, [vendors, searchQuery, statusFilter]);

  const loadVendors = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || []);
      } else {
        toast.error('Failed to load vendors');
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
      toast.error('Error loading vendors');
    } finally {
      setLoading(false);
    }
  };

  const filterVendors = () => {
    let filtered = vendors;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(v => v.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(v => 
        v.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.ownerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.phone?.includes(searchQuery)
      );
    }

    setFilteredVendors(filtered);
  };

  const handleVerifyVendor = async (vendorId: string, status: 'approved' | 'rejected', remarks: string = '') => {
    setActionLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/${vendorId}/verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ status, remarks }),
        }
      );

      if (response.ok) {
        toast.success(`Vendor ${status === 'approved' ? 'approved' : 'rejected'} successfully`);
        await loadVendors();
        setShowDetailsModal(false);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update vendor status');
      }
    } catch (error) {
      console.error('Error verifying vendor:', error);
      toast.error('Error updating vendor status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const approveAllVendors = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/fix/approve-all-vendors`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(`✅ ${data.message}. Approved ${data.details.approved} vendors!`);
        await loadVendors();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to approve vendors');
      }
    } catch (error) {
      console.error('Error approving vendors:', error);
      toast.error('Error approving vendors');
    } finally {
      setActionLoading(false);
    }
  };

  const publishVendorServices = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/fix/publish-vendor-services`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(`✅ ${data.message}. Published ${data.details.published} vendor services!`);
        await loadVendors();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to publish vendor services');
      }
    } catch (error) {
      console.error('Error publishing vendor services:', error);
      toast.error('Error publishing vendor services');
    } finally {
      setActionLoading(false);
    }
  };

  const stats = {
    total: vendors.length,
    pending: vendors.filter(v => v.status === 'pending').length,
    approved: vendors.filter(v => v.status === 'approved').length,
    rejected: vendors.filter(v => v.status === 'rejected').length,
    totalRevenue: vendors.reduce((sum, v) => sum + (v.revenue || 0), 0)
  };

  const navigationItems = [
    { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
    { icon: BarChart3, label: 'Analytics', id: 'analytics' }, // ✅ NEW
    { icon: Briefcase, label: 'Enterprise & Revenue', id: 'enterprise' },
    { icon: Users, label: 'Vendor Administration', id: 'vendor-admin', active: true },
    { icon: Globe, label: 'Region Manager', id: 'region-manager' }, // Multi-region management
    { icon: Megaphone, label: 'Marketing & Promotions', id: 'marketing' },
    { icon: Headphones, label: 'Support & CRM', id: 'support' },
    { icon: BookOpen, label: 'Catalog & Services', id: 'catalog' },
    { icon: Database, label: 'Database Seeding', id: 'database-seeding' }, // Added Database Seeding
    { icon: Calendar, label: 'Event Management', id: 'events' },
    { icon: FileText, label: 'Content Management', id: 'content' },
    { icon: Package, label: 'Pet Info Management', id: 'pet-info' },
    { icon: Wallet, label: 'Finance & Logistics', id: 'finance' },
    { icon: UserCog, label: 'Role & User Management', id: 'roles' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Unified Sidebar */}
      <UnifiedAdminSidebar 
        activeView={activeView} 
        onNavigate={(view) => {
          setActiveView(view);
          if (onNavigate) {
            onNavigate(view);
          }
        }} 
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-2">
                <img src="/warmpawz-logo-1.svg" alt="Warmpawz" className="w-10 h-10" />
                <div>
                  <h1 className="text-[#FF8C42]">Vendor Administration</h1>
                  <p className="text-xs text-gray-500">Complete vendor lifecycle management and administration</p>
                </div>
              </div>

              <div className="flex-1 max-w-md relative ml-8">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9 border-gray-300"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={loadVendors}
                className="h-9 gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>

              <Button
                size="sm"
                className="bg-[#FF8C42] hover:bg-[#FF7A2E] h-9 gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Vendor
              </Button>
              <NotificationBellWrapper
                className="p-2 hover:bg-gray-100 rounded-lg"
                fetchNotifications={async () => {
                  // TODO: Replace with actual API call when backend is ready
                  // Fetch admin notifications
                  return [];
                }}
                onNotificationClick={(notification) => {
                  if (notification.actionUrl && onNavigate) {
                    onNavigate(notification.actionUrl);
                  }
                }}
              />
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg" onClick={handleSignOut}>
                <LogOut className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeView === 'analytics' ? (
             <AdminAnalyticsDashboard onBack={() => setActiveView('dashboard')} />
          ) : activeView === 'marketing' ? (
            <MarketingPromotionsTab />
          ) : activeView === 'enterprise' ? (
            <EnterpriseLogicTab />
          ) : activeView === 'vendor-admin' ? (
            <>
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
            {/* Active Vendors */}
            <Card className="p-4 border-green-200 bg-green-50/50">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">+12%</span>
              </div>
              <div>
                <p className="text-gray-600 text-sm mb-1">Active Vendors</p>
                <p className="text-2xl mb-2">{stats.approved}</p>
                {/* Mini line chart placeholder */}
                <div className="h-8 flex items-end gap-0.5">
                  {[20, 30, 25, 40, 35, 50, 45, 55, 50, 60].map((h, i) => (
                    <div key={i} className="flex-1 bg-green-200 rounded-t" style={{ height: `${h}%` }}></div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>
              </div>
            </Card>

            {/* Pending Applications */}
            <Card className="p-4 border-orange-200 bg-orange-50/50">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">+3 today</span>
              </div>
              <div>
                <p className="text-gray-600 text-sm mb-1">Pending Applications</p>
                <p className="text-2xl mb-2">{stats.pending}</p>
                {/* Mini bar chart placeholder */}
                <div className="h-8 flex items-end gap-0.5">
                  {[40, 30, 50, 35, 60].map((h, i) => (
                    <div key={i} className="flex-1 bg-orange-300 rounded-t" style={{ height: `${h}%` }}></div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                </div>
              </div>
            </Card>

            {/* Compliance Issues */}
            <Card className="p-4 border-red-200 bg-red-50/50">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
              </div>
              <div>
                <p className="text-gray-600 text-sm mb-1">Compliance Issues</p>
                <div className="mb-2">
                  <span className="text-sm">Past 7 Days</span>
                  <p className="text-xl">{stats.rejected}</p>
                  <span className="text-xs text-gray-500">Requires Attention</span>
                </div>
                {/* Mini line chart */}
                <div className="h-8 flex items-end gap-0.5">
                  {[30, 20, 40, 25, 35, 20, 30].map((h, i) => (
                    <div key={i} className="flex-1 bg-red-200 rounded-t" style={{ height: `${h}%` }}></div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Mo</span>
                  <span>Tu</span>
                  <span>We</span>
                  <span>Th</span>
                  <span>Fr</span>
                  <span>Sa</span>
                  <span>Su</span>
                </div>
              </div>
            </Card>

            {/* Support Tickets */}
            <Card className="p-4 border-blue-200 bg-blue-50/50">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Headphones className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div>
                <p className="text-gray-600 text-sm mb-1">Support Tickets</p>
                <p className="text-2xl mb-2">15</p>
                {/* Mini line chart */}
                <div className="h-8 flex items-end gap-0.5">
                  {[40, 35, 50, 45, 55, 50, 60, 55, 65].map((h, i) => (
                    <div key={i} className="flex-1 bg-blue-200 rounded-t" style={{ height: `${h}%` }}></div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                  <span>Qua</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Vendor Distribution & Quick Access */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            {/* Vendor Distribution */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-600" />
                <h3>Vendor Distribution</h3>
              </div>
              
              <div className="mb-4">
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option>All Categories</option>
                </select>
              </div>

              {/* Pie Chart Placeholder */}
              <div className="flex justify-center mb-4">
                <div className="relative w-40 h-40">
                  <svg viewBox="0 0 100 100" className="transform -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#4169E1" strokeWidth="20" strokeDasharray="75.4 251.2" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#87CEEB" strokeWidth="20" strokeDasharray="62.8 251.2" strokeDashoffset="-75.4" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#B0C4DE" strokeWidth="20" strokeDasharray="50.2 251.2" strokeDashoffset="-138.2" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-gray-500">60%</span>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                    <span>Active Vendors (1,267)</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-300"></div>
                    <span>Deactivated Vendors (342)</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-200"></div>
                    <span>Pending Vendors (1,873)</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Access */}
            <Card className="p-4 col-span-2">
              <h3 className="mb-4">Quick Access</h3>
              
              <div className="grid grid-cols-3 gap-3">
                <button className="flex flex-col items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-[#FF8C42] hover:bg-orange-50 transition-colors">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <XCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs">Deactivation</p>
                    <p className="text-xs text-gray-500">Requests</p>
                  </div>
                </button>

                <button className="flex flex-col items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-[#FF8C42] hover:bg-orange-50 transition-colors">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CalendarCheck className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs">Schedule Re-</p>
                    <p className="text-xs text-gray-500">verification</p>
                  </div>
                </button>

                <button className="flex flex-col items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-[#FF8C42] hover:bg-orange-50 transition-colors">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs">Payment</p>
                    <p className="text-xs text-gray-500">Disputes</p>
                  </div>
                </button>

                <button className="flex flex-col items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-[#FF8C42] hover:bg-orange-50 transition-colors">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs">Service Rate</p>
                    <p className="text-xs text-gray-500">Approvals</p>
                  </div>
                </button>

                <button className="flex flex-col items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-[#FF8C42] hover:bg-orange-50 transition-colors">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Send className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs">Send Renewal</p>
                    <p className="text-xs text-gray-500">Notices</p>
                  </div>
                </button>

                <button className="flex flex-col items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-[#FF8C42] hover:bg-orange-50 transition-colors">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <DownloadIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs">Export</p>
                    <p className="text-xs text-gray-500">Applications</p>
                  </div>
                </button>
              </div>
            </Card>
          </div>

          {/* Tabs */}
          <div className="mb-4">
            <div className="flex gap-2 border-b">
              <button className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                New Vendor Applications
              </button>
              <button className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Deactivation Requests
              </button>
              <button className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Rate Changes
              </button>
              <button className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Re-Verification List
              </button>
              <button className="px-4 py-2 text-sm text-[#FF8C42] border-b-2 border-[#FF8C42]">
                Vendor Settings
              </button>
            </div>
          </div>

          {/* Collapsible Sections */}
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="refund" className="bg-white rounded-lg border">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  <span>Refund Policies</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-sm text-gray-600">Configure refund policies for vendor services...</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="reservation" className="bg-white rounded-lg border">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span>Reservation & Payment Type</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-sm text-gray-600">Manage reservation and payment settings...</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="booking" className="bg-white rounded-lg border">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Booking Rules</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-sm text-gray-600">Set up booking rules and restrictions...</p>
              </AccordionContent>
            </AccordionItem>
            </Accordion>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p>Module {activeView} is under development.</p>
            </div>
          )}
        </div>
      </div>

      {/* Vendor Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vendor Details</DialogTitle>
            <DialogDescription>
              Review vendor information and approve or reject the application
            </DialogDescription>
          </DialogHeader>

          {selectedVendor && (
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Current Status</p>
                  <Badge
                    className={
                      selectedVendor.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : selectedVendor.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }
                  >
                    {selectedVendor.status || 'pending'}
                  </Badge>
                </div>
                <div className="text-right text-sm text-gray-600">
                  Registered: {new Date(selectedVendor.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Business Info */}
              <div>
                <h4 className="font-semibold mb-3">Business Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Business Name</p>
                    <p className="font-medium">{selectedVendor.businessName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Owner Name</p>
                    <p className="font-medium">{selectedVendor.ownerName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Email</p>
                    <p className="font-medium">{selectedVendor.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Phone</p>
                    <p className="font-medium">{selectedVendor.phone}</p>
                  </div>
                </div>
              </div>

              {/* Services */}
              <div>
                <h4 className="font-semibold mb-3">Services Offered</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedVendor.services?.map((service: string, idx: number) => (
                    <Badge key={idx} variant="secondary">
                      {service}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Address */}
              <div>
                <h4 className="font-semibold mb-3">Business Address</h4>
                <div className="text-sm">
                  <p>{selectedVendor.address}</p>
                  <p>{selectedVendor.city}, {selectedVendor.state} - {selectedVendor.pincode}</p>
                </div>
              </div>

              {/* Documents */}
              <div>
                <h4 className="font-semibold mb-3">Business Documents</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">GSTIN</p>
                    <p className="font-medium">{selectedVendor.gstin || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">PAN</p>
                    <p className="font-medium">{selectedVendor.pan}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Aadhar</p>
                    <p className="font-medium">{selectedVendor.aadhar}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Bank Account</p>
                    <p className="font-medium">{selectedVendor.bankAccount}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-600">IFSC Code</p>
                    <p className="font-medium">{selectedVendor.ifsc}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            {selectedVendor?.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleVerifyVendor(selectedVendor.id, 'rejected', 'Application rejected by admin')}
                  disabled={actionLoading}
                  className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleVerifyVendor(selectedVendor.id, 'approved', 'Application approved')}
                  disabled={actionLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}