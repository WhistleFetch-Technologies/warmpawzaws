import React, { useState, useEffect } from 'react';
import { 
  Search, Bell, MessageSquare, User, Plus, RefreshCw, TrendingUp, 
  AlertTriangle, Shield, BarChart3, Calendar, DollarSign, FileText, 
  Send, Download, Check, X, Eye, Phone, Grid3x3, Package, Megaphone, 
  HeadphonesIcon, ClipboardList, Newspaper, PawPrint, Wallet, Users, Settings, MessageCircle, CheckCircle, Globe, ShoppingCart 
} from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { WARM_ORANGE, LOGO_CIRCULAR_ORANGE } from '../../assets/design-tokens';
const logoImage = LOGO_CIRCULAR_ORANGE;
import { CustomDropdown } from './CustomDropdown';
import { DeactivationRequestsTab } from './DeactivationRequestsTab';
import { RateChangesTab } from './RateChangesTab';
import { ReverificationTab } from './ReverificationTab';
import { RenewalNoticesModal } from './RenewalNoticesModal';
import { ExportApplicationsModal } from './ExportApplicationsModal';
import { SuccessModal } from './SuccessModal';
import { SupportVendorTab } from './SupportVendorTab';
import { ComplianceIssuesTab } from './ComplianceIssuesTab';
import { EnhancedPendingApplicationsTab } from './EnhancedPendingApplicationsTab';
import { PaymentDisputesTab } from './PaymentDisputesTab';
import { ActiveVendorsTab } from './ActiveVendorsTab';
import { SuperAdminProfileModal } from './SuperAdminProfileModal';
import { AddVendorModal } from './AddVendorModal';
import { ApplicationDetailModal } from './ApplicationDetailModal';
import { VendorSettingsTab } from './VendorSettingsTab';
import { ClarificationRequestedTab } from './ClarificationRequestedTab';
import { UnifiedAdminSidebar } from './layout/UnifiedAdminSidebar';
import { toast } from 'sonner@2.0.3';
import { RejectVendorModal } from './RejectVendorModal';
import { RequestInfoModal } from './RequestInfoModal';

interface VendorStats {
  activeVendors: { count: number; percentage: number };
  pendingApplications: { count: number; todayCount: number };
  complianceIssues: { count: number; highPriority: number };
  supportTickets: { total: number; open: number };
  distribution: { active: number; deactivated: number; pending: number };
}

interface VendorApplication {
  id: string;
  fullName: string;
  businessName?: string;
  services: string[];
  category: string;
  experience: string;
  submittedAt: string;
  progressPercentage: number;
  daysSinceSubmission: number;
  priority: string;
  phone: string;
  address: string;
  location: string;
  vendorType?: string;
  city?: string;
}

interface QualityAlert {
  vendorId: string;
  vendorName: string;
  alertType: string;
  alertMessage: string;
  priority: 'high' | 'medium' | 'low';
  rating?: number;
  complaintCount: number;
}

interface AdminVendorManagementProps {
  onNavigate?: (view: string) => void;
}

export function AdminVendorManagement({ onNavigate }: AdminVendorManagementProps = {}) {
  const [activeTab, setActiveTab] = useState<'applications' | 'deactivation' | 'rate-changes' | 'reverification' | 'support' | 'compliance' | 'payment-disputes' | 'active-vendors' | 'settings' | 'clarification'>('applications');
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [allVendors, setAllVendors] = useState<VendorApplication[]>([]); // NEW: Store all vendors
  const [qualityAlerts, setQualityAlerts] = useState<QualityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // ✅ ADD: Error state
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_approval' | 'approved' | 'rejected' | 'pending_reverification'>('all'); // NEW: Status filter
  const [alertFilter, setAlertFilter] = useState('all');
  const [expandedSection, setExpandedSection] = useState<string | null>('refund-policies');
  
  // NEW: Advanced search and role filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'vet' | 'grooming' | 'walking' | 'boarding' | 'training'>('all');
  
  // Modal states
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAdminProfile, setShowAdminProfile] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showApplicationDetail, setShowApplicationDetail] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<VendorApplication | null>(null);
  const [successMessage, setSuccessMessage] = useState('Renewal Sent!');
  
  // New modal states for UX improvement
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [rejectingApplication, setRejectingApplication] = useState<VendorApplication | null>(null);
  const [requestingInfoApplication, setRequestingInfoApplication] = useState<VendorApplication | null>(null);
  const [loadingAction, setLoadingAction] = useState<{ type: 'approve' | 'reject' | 'info' | null; id: string | null }>({ type: null, id: null });
  
  // Platform settings state
  const [refundSettings, setRefundSettings] = useState({
    customerCancellation: {
      tiers: [
        { hoursBeforeService: 24, refundPercentage: 75, cancellationFee: 10, vendor: 'grooming' },
        { hoursBeforeService: 6, refundPercentage: 50, cancellationFee: null, vendor: 'grooming' }
      ]
    },
    providerCancellation: {
      refundToCustomer: 100,
      additionalCompensation: 10,
      cancellationFee: 50,
      vendor: 'grooming'
    },
    refundProcessing: {
      mode: 'auto',
      processingTimeBusinessDays: 7,
      actionRefundType: 'immediate',
      disputeResolutionTimeDays: 7,
      refundPreference: 'wallet',
      vendor: 'grooming'
    }
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // ✅ HEALTH CHECK FIRST
      console.log('🏥 Checking server health...');
      try {
        const healthResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/health`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          }
        );
        
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          console.log('✅ Server is healthy:', healthData);
        } else {
          console.warn('⚠️ Health check failed with status:', healthResponse.status);
        }
      } catch (healthError) {
        console.error('❌ Server health check failed:', healthError);
        throw new Error('Server is not responding. Please ensure the backend is deployed and running.');
      }
      
      // Load stats
      const statsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/stats`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      } else {
        console.error('❌ Failed to load stats:', await statsResponse.text());
      }
      
      // Load ALL vendors (not just pending) - NEW!
      const allVendorsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/all`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (allVendorsResponse.ok) {
        const allVendorsData = await allVendorsResponse.json();
        console.log('========================================');
        console.log('📋 FRONTEND: Received vendor data from backend');
        console.log('========================================');
        console.log('📦 Total vendors received:', allVendorsData.vendors?.length || 0);
        console.log('📊 Status breakdown:');
        const statusCounts: any = {};
        (allVendorsData.vendors || []).forEach((v: any) => {
          const status = v.status || 'NO_STATUS';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        console.log(statusCounts);
        console.log('========================================');
        
        const allVendorsList = allVendorsData.vendors || [];
        
        // Deduplicate vendors by ID
        const uniqueVendors = Array.from(new Map(allVendorsList.map((item: any) => [item.id, item])).values());
        
        setAllVendors(uniqueVendors);
        // IMPORTANT: Show ALL vendors initially since statusFilter is 'all'
        setApplications(uniqueVendors);
      } else {
        console.error('❌ Failed to load vendors:', await allVendorsResponse.text());
      }
      
      // Load quality alerts
      const alertsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/quality/alerts`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setQualityAlerts(alertsData.alerts || []);
      }
      
    } catch (error) {
      console.error('❌ Error loading vendor data:', error);
      console.error('Error type:', error instanceof TypeError ? 'Network/Fetch Error' : 'Other Error');
      console.error('Error message:', error.message);
      
      // ✅ FIX: Better error message based on error type
      let errorMessage = 'Failed to load vendor data. Please try again.';
      
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        errorMessage = `Network error: Cannot connect to server.\n\nPossible causes:\n• Server is not responding\n• Network connectivity issue\n• CORS blocking request\n• Database query timeout\n\nPlease check the server logs and try again.`;
      } else if (error.message) {
        errorMessage = `${error.message}\n\nPlease check the console for more details.`;
      }
      
      // Set error state instead of showing alert immediately
      setError(errorMessage);
      
    } finally {
      setLoading(false);
    }
  };

  // NEW: Filter vendors by status
  const filterVendorsByStatus = (status: 'all' | 'pending_approval' | 'approved' | 'rejected' | 'pending_reverification') => {
    setStatusFilter(status);
    
    if (status === 'all') {
      setApplications(allVendors);
    } else {
      setApplications(allVendors.filter(v => v.status === status));
    }
  };

  // NEW: Handle stat card click to filter
  const handleStatCardClick = (status: 'all' | 'pending_approval' | 'approved' | 'rejected' | 'pending_reverification') => {
    filterVendorsByStatus(status);
  };

  // SEED FUNCTION: Reset and seed vendors with proper data
  const resetAndSeedVendors = async () => {
    if (!confirm('⚠️ This will DELETE all existing vendors and create fresh seed data. Continue?')) {
      return;
    }
    
    try {
      console.log('🔄 Resetting and seeding vendors...');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed/reset-and-seed`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Reset and seed complete:', data);
        alert(`✅ Success!\n\nCleared: ${data.results.cleared.deleted?.profiles || 0} vendors\nCreated: ${data.results.seeded.success} new vendors\n\nRefreshing page...`);
        
        // Reload the page to show new data
        window.location.reload();
      } else {
        const errorText = await response.text();
        console.error('❌ Reset failed:', errorText);
        alert('Reset failed - check console');
      }
    } catch (error) {
      console.error('Reset error:', error);
      alert('Reset error - check console');
    }
  };

  // CLEAR FUNCTION: Clear all vendors without reseeding
  const clearAllVendorsOnly = async () => {
    if (!confirm('⚠️ This will DELETE ALL EXISTING VENDORS permanently!\n\nThis is for testing the complete vendor onboarding flow from scratch.\n\nAre you sure you want to continue?')) {
      return;
    }
    
    if (!confirm('🚨 FINAL CONFIRMATION:\n\nAll vendor data including:\n- Vendor profiles\n- Services\n- Bookings\n- Reviews\n- Payouts\n\nWill be PERMANENTLY DELETED.\n\nContinue?')) {
      return;
    }
    
    try {
      console.log('🗑️ Clearing all vendors...');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed/clear-vendors`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Clear complete:', data);
        
        const report = data.results.report;
        alert(`✅ All Vendor Data Cleared!\n\n📊 Deletion Report:\n- Vendor Profiles: ${report.vendorProfiles}\n- Phone Indexes: ${report.phoneIndexes}\n- User Indexes: ${report.userIndexes}\n- Vendor Users: ${report.vendorUsers}\n- Services: ${report.vendorServices}\n- Availability: ${report.vendorAvailability}\n- Bookings: ${report.bookings}\n- Reviews: ${report.reviews}\n- Payouts: ${report.payouts}\n\nSystem is now ready for fresh vendor onboarding test!\n\nRefreshing page...`);
        
        // Reload the page
        setTimeout(() => window.location.reload(), 2000);
      } else {
        const errorText = await response.text();
        console.error('❌ Clear failed:', errorText);
        alert('Clear failed - check console');
      }
    } catch (error) {
      console.error('Clear error:', error);
      alert('Clear error - check console');
    }
  };

  // DEBUG FUNCTION: Check database state for a phone number
  const debugVendorLookup = async () => {
    const phone = prompt('Enter phone number to debug (e.g., 9876543212):');
    if (!phone) return;
    
    try {
      console.log(`🔍 Debugging vendor lookup for: ${phone}`);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/debug/vendor-lookup/${phone}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Debug results:', data.debug);
        
        const debug = data.debug;
        let message = `📱 Phone: ${debug.phone} → ${debug.cleanedPhone}\n\n`;
        message += `📇 Phone Index: ${debug.indexes.phoneIndex}\n\n`;
        message += `👤 Vendor: ${debug.vendor ? 'FOUND' : 'NOT FOUND'}\n`;
        
        if (debug.vendor && debug.vendor !== 'NOT FOUND') {
          message += `   Name: ${debug.vendor.fullName}\n`;
          message += `   Status: ${debug.vendor.status}\n`;
        }
        
        message += `\n📊 Total vendors in DB: ${debug.allVendors.length}\n`;
        
        if (debug.matchingVendor) {
          message += `\n✅ Found matching vendor by scan:\n`;
          message += `   ID: ${debug.matchingVendor.id}\n`;
          message += `   Name: ${debug.matchingVendor.fullName}\n`;
          message += `   Status: ${debug.matchingVendor.status}`;
        } else {
          message += `\n❌ No matching vendor found`;
        }
        
        alert(message);
      } else {
        const errorText = await response.text();
        console.error('❌ Debug failed:', errorText);
        alert('Debug failed - check console');
      }
    } catch (error) {
      console.error('Debug error:', error);
      alert('Debug error - check console');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-orange-600 bg-orange-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getServiceBadgeColor = (service: string) => {
    const colors: any = {
      'vet': 'bg-blue-100 text-blue-700',
      'grooming': 'bg-purple-100 text-purple-700',
      'walking': 'bg-green-100 text-green-700',
      'training': 'bg-orange-100 text-orange-700',
      'boarding': 'bg-indigo-100 text-indigo-700'
    };
    return colors[service] || 'bg-gray-100 text-gray-700';
  };

  const handleApprove = async (applicationId: string) => {
    setLoadingAction({ type: 'approve', id: applicationId });
    
    try {
      console.log('========================================');
      console.log('🔄 APPROVAL INITIATED');
      console.log('========================================');
      console.log('📋 Application ID:', applicationId);
      
      // Find the vendor by application ID
      const vendor = applications.find(app => app.id === applicationId);
      if (!vendor) {
        console.error('❌ VENDOR NOT FOUND IN LOCAL STATE');
        console.error('   Application ID:', applicationId);
        console.error('   Available applications:', applications.map(a => ({ id: a.id, vendorId: a.vendorId, name: a.fullName })));
        toast.error('Vendor not found in local state!');
        setLoadingAction({ type: null, id: null });
        return;
      }
      
      console.log('✅ Vendor found in local state:', { 
        id: vendor.id,
        vendorId: vendor.vendorId, 
        applicationId: vendor.applicationId,
        fullName: vendor.fullName,
        phone: vendor.phone
      });
      
      console.log('🚀 Sending approve request with vendorId:', vendor.vendorId);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vendorId: vendor.vendorId, // Use vendorId, NOT id
            approvedBy: 'Admin',
            notes: 'Approved from admin portal'
          })
        }
      );
      
      console.log('📡 Response status:', response.status);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ APPLICATION APPROVED SUCCESSFULLY');
        console.log('   Response:', responseData);
        console.log('========================================');
        setSuccessMessage('Application Approved! Vendor can now access their dashboard.');
        setShowSuccessModal(true);
        loadData(); // Reload data
      } else {
        const error = await response.text();
        console.error('❌ APPROVAL FAILED');
        console.error('   Status:', response.status);
        console.error('   Error:', error);
        console.error('========================================');
        toast.error('Failed to approve application', { description: error });
      }
    } catch (error) {
      console.error('❌ APPROVAL EXCEPTION:', error);
      console.error('========================================');
      toast.error('Error approving vendor', { description: String(error) });
    } finally {
      setLoadingAction({ type: null, id: null });
    }
  };

  const handleReject = async (reason: string, notes?: string) => {
    if (!rejectingApplication) return;
    
    setLoadingAction({ type: 'reject', id: rejectingApplication.id });
    
    try {
      console.log('🔄 Rejecting application:', rejectingApplication.id);
      console.log('📋 Found vendor for rejection:', { 
        vendorId: rejectingApplication.vendorId, 
        applicationId: rejectingApplication.applicationId,
        fullName: rejectingApplication.fullName 
      });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor/reject`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vendorId: rejectingApplication.vendorId,
            rejectedBy: 'Admin',
            reason: reason,
            rejectionNotes: notes
          })
        }
      );
      
      if (response.ok) {
        console.log('✅ Application rejected successfully');
        toast.success('Application rejected successfully');
        setShowRejectModal(false);
        setRejectingApplication(null);
        loadData(); // Reload data
      } else {
        const error = await response.text();
        console.error('❌ Failed to reject:', error);
        toast.error('Failed to reject application', { description: error });
      }
    } catch (error) {
      console.error('Error rejecting vendor:', error);
      toast.error('Error rejecting vendor', { description: String(error) });
    } finally {
      setLoadingAction({ type: null, id: null });
    }
  };

  const handleRequestMoreInfo = async (message: string, requiredFields: string[]) => {
    if (!requestingInfoApplication) return;
    
    setLoadingAction({ type: 'info', id: requestingInfoApplication.id });
    
    try {
      console.log('🔄 Requesting more info for application:', requestingInfoApplication.id);
      console.log('📋 Found vendor for info request:', { 
        vendorId: requestingInfoApplication.vendorId, 
        applicationId: requestingInfoApplication.applicationId,
        fullName: requestingInfoApplication.fullName 
      });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor/request-info`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vendorId: requestingInfoApplication.vendorId,
            requestedBy: 'Admin',
            message: message,
            requiredFields: requiredFields
          })
        }
      );
      
      if (response.ok) {
        console.log('✅ Info request sent successfully');
        toast.success('Information request sent to vendor');
        setShowRequestInfoModal(false);
        setRequestingInfoApplication(null);
        loadData(); // Reload data
      } else {
        const error = await response.text();
        console.error('❌ Failed to request info:', error);
        toast.error('Failed to send info request', { description: error });
      }
    } catch (error) {
      console.error('Error requesting info:', error);
      toast.error('Error requesting info', { description: String(error) });
    } finally {
      setLoadingAction({ type: null, id: null });
    }
  };

  const handleFlushAllVendors = async () => {
    const confirmed = window.confirm(
      '🗑️ WARNING: This will DELETE ALL vendor data!\n\n' +
      'This includes:\n' +
      '• All vendor profiles\n' +
      '• All applications (pending, approved, rejected)\n' +
      '• All documents\n' +
      '• All vendor services\n\n' +
      'This action CANNOT be undone!\n\n' +
      'Are you absolutely sure you want to flush all vendor data?'
    );
    
    if (!confirmed) return;
    
    const doubleConfirm = window.confirm(
      '⚠️ FINAL CONFIRMATION\n\n' +
      'Type YES in your mind and click OK to proceed with deletion.\n\n' +
      'Click Cancel to abort.'
    );
    
    if (!doubleConfirm) return;
    
    try {
      console.log('🗑️ Flushing all vendor data...');
      setLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor/flush-all`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Flush completed:', result);
        alert(`✅ Success!\n\nDeleted ${result.deletedCount} vendor records.\n\nThe system is now clean for fresh testing.`);
        setSuccessMessage(`Flushed ${result.deletedCount} Records`);
        setShowSuccessModal(true);
        loadData(); // Reload data (should be empty now)
      } else {
        const error = await response.text();
        console.error('❌ Failed to flush:', error);
        alert('❌ Failed to flush vendor data. Check console for details.');
      }
    } catch (error) {
      console.error('Error flushing vendors:', error);
      alert('❌ Error occurred while flushing. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedVendors = async () => {
    const confirmed = window.confirm(
      '🌱 Seed Vendor Data\n\n' +
      'This will create sample vendor applications across all roles with:\n' +
      '• Unique phone numbers (all use OTP: 123456)\n' +
      '• Unique emails and names\n' +
      '• Sample documents (Aadhar, PAN, Cheque, GST, License)\n' +
      '• All vendors in "pending_approval" status\n' +
      '• Minimum 3 vendors per role category\n\n' +
      'Proceed?'
    );
    
    if (!confirmed) return;
    
    try {
      console.log('🌱 Seeding vendor data...');
      setLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed-vendors`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Seed completed:', result);
        alert(
          `✅ Success!\n\n` +
          `Created ${result.totalCreated} vendor applications.\n\n` +
          `${result.note}\n\n` +
          `You can now test the approval/rejection workflow.`
        );
        setSuccessMessage(`Seeded ${result.totalCreated} Vendors`);
        setShowSuccessModal(true);
        loadData(); // Reload data to show new vendors
      } else {
        const error = await response.text();
        console.error('❌ Failed to seed:', error);
        alert('❌ Failed to seed vendor data. Check console for details.\n\nMake sure role configurations exist first.');
      }
    } catch (error) {
      console.error('Error seeding vendors:', error);
      alert('❌ Error occurred while seeding. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleFixCategories = async () => {
    const confirmed = window.confirm(
      '🔧 Fix Vendor Categories\n\n' +
      'This will update all existing vendors with proper service category from their roles.\n\n' +
      'Proceed?'
    );
    
    if (!confirmed) return;
    
    try {
      console.log('🔧 Fixing vendor categories...');
      setLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/fix-vendor-categories`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Fix completed:', result);
        alert(
          `✅ Success!\n\n` +
          `Fixed ${result.fixed} vendors.\n` +
          `Errors: ${result.errors}\n\n` +
          `Service categories are now properly mapped!`
        );
        setSuccessMessage(`Fixed ${result.fixed} Vendors`);
        setShowSuccessModal(true);
        loadData(); // Reload data
      } else {
        const error = await response.text();
        console.error('❌ Failed to fix:', error);
        alert('❌ Failed to fix vendor categories. Check console for details.');
      }
    } catch (error) {
      console.error('Error fixing vendor categories:', error);
      alert('❌ Error occurred while fixing. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleFixVendorIndexes = async () => {
    const confirmed = window.confirm(
      '🔗 Fix Vendor Login Indexes\n\n' +
      'This will create missing phone/user indexes for all existing vendors.\n\n' +
      '⚠️ IMPORTANT: This fixes the issue where approved vendors see "Choose Role" page instead of their dashboard.\n\n' +
      'This is safe to run multiple times and will skip vendors that already have indexes.\n\n' +
      'Proceed?'
    );
    
    if (!confirmed) return;
    
    try {
      console.log('🔗 Fixing vendor indexes...');
      setLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/fix-indexes`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Fix completed:', result);
        alert(
          `✅ Vendor Indexes Fixed Successfully!\n\n` +
          `Total Vendors: ${result.stats.total}\n` +
          `Indexes Created: ${result.stats.fixed}\n` +
          `Already Had Indexes: ${result.stats.skipped}\n\n` +
          `✅ Affected vendors can now log in and see their proper status!\n\n` +
          `Next Steps:\n` +
          `1. Have affected vendors log out and log back in\n` +
          `2. They should now see their dashboard instead of role selection`
        );
        setSuccessMessage(`Fixed ${result.stats.fixed} Vendor Indexes`);
        setShowSuccessModal(true);
        loadData(); // Reload data
      } else {
        const error = await response.text();
        console.error('❌ Failed to fix indexes:', error);
        alert('❌ Failed to fix vendor indexes. Check console for details.');
      }
    } catch (error) {
      console.error('Error fixing vendor indexes:', error);
      alert('❌ Error occurred while fixing. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const addRefundTier = () => {
    setRefundSettings({
      ...refundSettings,
      customerCancellation: {
        tiers: [
          ...refundSettings.customerCancellation.tiers,
          { hoursBeforeService: 12, refundPercentage: 25, cancellationFee: 0, vendor: 'grooming' }
        ]
      }
    });
  };

  // ✅ ADD: Error Display
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-4">
            Failed to Load Vendor Data
          </h2>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <pre className="text-sm text-red-800 whitespace-pre-wrap font-mono">{error}</pre>
          </div>
          <div className="flex gap-4 justify-center">
            <Button 
              onClick={() => {
                setError(null);
                loadData();
              }}
              style={{ backgroundColor: WARM_ORANGE }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FF7A2E';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = WARM_ORANGE;
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </div>
          <div className="mt-6 text-sm text-gray-600 text-center">
            <p className="mb-2 font-semibold">If the problem persists:</p>
            <ul className="text-left max-w-md mx-auto space-y-1">
              <li>• Check if the backend server is deployed and running</li>
              <li>• Verify your network connection</li>
              <li>• Check browser console (F12) for detailed errors</li>
              <li>• Contact support if the issue continues</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ✅ ADD: Loading Display
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 mx-auto mb-6" style={{ borderColor: `${WARM_ORANGE} transparent ${WARM_ORANGE} ${WARM_ORANGE}` }}></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Vendor Data...</h2>
          <p className="text-gray-600">Please wait while we fetch the latest information</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Unified Sidebar */}
      <UnifiedAdminSidebar 
        activeView="vendor-admin" 
        onNavigate={(view) => onNavigate?.(view)} 
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl text-gray-900">Vendor Administration</h1>
                <select 
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1 bg-white"
                  onChange={(e) => setActiveTab(e.target.value as any)}
                  value={activeTab}
                >
                  <option value="settings">/All Vendors</option>
                  <option value="active-vendors">/Active Vendors</option>
                  <option value="support">/Support Vendor</option>
                  <option value="compliance">/Compliance Issues</option>
                  <option value="pending">/Pending Applications</option>
                </select>
              </div>
              <p className="text-sm text-gray-500">Complete vendor lifecycle management and administration</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search"
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64"
                />
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-lg relative">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <User className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <Button variant="outline" className="gap-2 flex-1 sm:flex-initial" onClick={loadData}>
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button 
                variant="outline" 
                className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-50 flex-1 sm:flex-initial" 
                onClick={() => {
                  console.log('👉 Clicked Platform Settings');
                  if (onNavigate) {
                    onNavigate('platform-settings');
                  } else {
                    console.error('❌ onNavigate is undefined');
                    alert('Navigation failed: onNavigate prop is missing');
                  }
                }}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Platform Settings</span>
              </Button>
            </div>
            
            <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E] gap-2 w-full sm:w-auto" onClick={() => setShowAddVendor(true)}>
              <Plus className="w-4 h-4" />
              Add Vendor
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Stats Cards - NOW CLICKABLE! */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div onClick={() => handleStatCardClick('approved')} className="cursor-pointer">
              <StatCard
                icon={<TrendingUp className="w-5 h-5 text-green-600" />}
                title="Active Vendors"
                value={stats?.activeVendors.count.toString() || '0'}
                subtitle={`+${stats?.activeVendors.percentage || 0}%`}
                chart={true}
                isActive={statusFilter === 'approved'}
              />
            </div>
            <div onClick={() => handleStatCardClick('pending_approval')} className="cursor-pointer">
              <StatCard
                icon={<AlertTriangle className="w-5 h-5 text-orange-600" />}
                title="Pending Applications"
                value={stats?.pendingApplications.count.toString() || '0'}
                subtitle={`+${stats?.pendingApplications.todayCount || 0} today`}
                hasBar={true}
                isActive={statusFilter === 'pending_approval'}
              />
            </div>
            <div onClick={() => handleStatCardClick('pending_reverification')} className="cursor-pointer">
              <StatCard
                icon={<Shield className="w-5 h-5 text-red-600" />}
                title="Compliance Issues"
                value={stats?.complianceIssues.count.toString() || '0'}
                subtitle="Past 7 days"
                secondaryValue={stats?.complianceIssues.highPriority || 0}
                secondaryLabel="Requires Attention"
                chart={true}
                isActive={statusFilter === 'pending_reverification'}
              />
            </div>
            <div onClick={() => handleStatCardClick('all')} className="cursor-pointer">
              <StatCard
                icon={<HeadphonesIcon className="w-5 h-5 text-blue-600" />}
                title="Support Tickets"
                value={stats?.supportTickets.open.toString() || '0'}
                chart={true}
                isActive={statusFilter === 'all'}
              />
            </div>
          </div>

          {/* Distribution and Quick Access */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Vendor Distribution */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm">Vendor Distribution</span>
                </div>
                <select className="px-3 py-1 border border-gray-200 rounded-lg text-sm">
                  <option>All Categories</option>
                  <option>Grooming</option>
                  <option>Walking</option>
                  <option>Veterinary</option>
                </select>
              </div>
              
              {/* Pie Chart */}
              <div className="flex items-center justify-center mb-4 relative h-40">
                <svg className="w-32 h-32" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#3B82F6" strokeWidth="20" strokeDasharray="75 25" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#9CA3AF" strokeWidth="20" strokeDasharray="20 80" strokeDashoffset="-75" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#FFA500" strokeWidth="20" strokeDasharray="5 95" strokeDashoffset="-95" transform="rotate(-90 50 50)" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl">{(stats?.distribution.active || 0) + (stats?.distribution.deactivated || 0) + (stats?.distribution.pending || 0)}</div>
                    <div className="text-xs text-gray-500">Total</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <LegendItem color="bg-blue-500" label={`Active Vendors (${stats?.distribution.active || 0})`} />
                <LegendItem color="bg-gray-400" label={`Deactivated Vendors (${stats?.distribution.deactivated || 0})`} />
                <LegendItem color="bg-orange-500" label={`Pending Vendors (${stats?.distribution.pending || 0})`} />
              </div>
            </div>

            {/* Quick Access */}
            <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-sm mb-4">Quick Access</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <QuickAccessCard
                  icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
                  label="Deactivation Requests"
                  bgColor="bg-red-50"
                  onClick={() => setActiveTab('deactivation')}
                />
                <QuickAccessCard
                  icon={<Calendar className="w-5 h-5 text-orange-600" />}
                  label="Schedule Re-verification"
                  bgColor="bg-orange-50"
                  onClick={() => setActiveTab('reverification')}
                />
                <QuickAccessCard
                  icon={<DollarSign className="w-5 h-5 text-red-600" />}
                  label="Payment Disputes"
                  bgColor="bg-red-50"
                  onClick={() => {}}
                />
                <QuickAccessCard
                  icon={<FileText className="w-5 h-5 text-blue-600" />}
                  label="Service Rate Approvals"
                  bgColor="bg-blue-50"
                  onClick={() => setActiveTab('rate-changes')}
                />
                <QuickAccessCard
                  icon={<Send className="w-5 h-5 text-purple-600" />}
                  label="Send Renewal Notices"
                  bgColor="bg-purple-50"
                  onClick={() => setShowRenewalModal(true)}
                />
                <QuickAccessCard
                  icon={<Download className="w-5 h-5 text-blue-600" />}
                  label="Export Applications"
                  bgColor="bg-blue-50"
                  onClick={() => setShowExportModal(true)}
                />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200">

            {/* Tab Content */}
            <div className="p-3 sm:p-6">
              {activeTab === 'applications' && (
                <EnhancedPendingApplicationsTab
                  onViewDetails={(vendor) => {
                    setSelectedApplication(vendor as any);
                    setShowApplicationDetail(true);
                  }}
                />
              )}

              {activeTab === 'deactivation' && (
                <DeactivationRequestsTab />
              )}

              {activeTab === 'rate-changes' && (
                <RateChangesTab />
              )}

              {activeTab === 'reverification' && (
                <ReverificationTab />
              )}

              {activeTab === 'support' && (
                <SupportVendorTab />
              )}

              {activeTab === 'compliance' && (
                <ComplianceIssuesTab />
              )}

              {activeTab === 'payment-disputes' && (
                <PaymentDisputesTab />
              )}

              {activeTab === 'active-vendors' && (
                <ActiveVendorsTab />
              )}

              {activeTab === 'settings' && (
                <VendorSettingsTab />
              )}

              {activeTab === 'clarification' && (
                <ClarificationRequestedTab 
                  onViewDetails={(vendor) => {
                    setSelectedApplication(vendor as any);
                    setShowApplicationDetail(true);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Add Button */}
      {activeTab === 'applications' && (
        <button className="fixed bottom-8 right-8 w-14 h-14 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-full flex items-center justify-center shadow-lg">
          <Plus className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Modals */}
      <RenewalNoticesModal
        isOpen={showRenewalModal}
        onClose={() => setShowRenewalModal(false)}
        onSuccess={() => {
          setShowRenewalModal(false);
          setShowSuccessModal(true);
        }}
      />

      <ExportApplicationsModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        message={successMessage}
      />

      <SuperAdminProfileModal
        isOpen={showAdminProfile}
        onClose={() => setShowAdminProfile(false)}
      />

      <AddVendorModal
        isOpen={showAddVendor}
        onClose={() => setShowAddVendor(false)}
        onSuccess={() => {
          setShowAddVendor(false);
          setSuccessMessage('Vendor Created Successfully!');
          loadData(); // Reload vendor data
          setShowSuccessModal(true);
        }}
      />

      <ApplicationDetailModal
        isOpen={showApplicationDetail}
        onClose={() => setShowApplicationDetail(false)}
        application={selectedApplication}
        onApprove={() => {
          setSuccessMessage('Application Approved!');
          setShowSuccessModal(true);
          loadData();
        }}
        onReject={() => {
          setSuccessMessage('Application Rejected');
          setShowSuccessModal(true);
          loadData();
        }}
        onRequestClarification={() => {
          setSuccessMessage('Clarification Requested');
          setShowSuccessModal(true);
          loadData();
        }}
      />

      {/* New UX-improved modals */}
      <RejectVendorModal
        isOpen={showRejectModal}
        vendorName={rejectingApplication?.fullName || rejectingApplication?.businessName || 'Vendor'}
        onSubmit={handleReject}
        onCancel={() => {
          setShowRejectModal(false);
          setRejectingApplication(null);
        }}
      />

      <RequestInfoModal
        isOpen={showRequestInfoModal}
        vendorName={requestingInfoApplication?.fullName || requestingInfoApplication?.businessName || 'Vendor'}
        onSubmit={handleRequestMoreInfo}
        onCancel={() => {
          setShowRequestInfoModal(false);
          setRequestingInfoApplication(null);
        }}
      />
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-[#FF8C42] text-white'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="text-left">{label}</span>
    </button>
  );
}

function StatCard({ icon, title, value, subtitle, secondaryValue, secondaryLabel, chart, hasBar, isActive }: any) {
  return (
    <div className={`bg-white rounded-xl p-4 border-2 transition-all ${isActive ? 'border-[#FF8C42] shadow-lg' : 'border-gray-200 hover:shadow-md'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {icon}
            <span className="text-xs text-gray-600">{title}</span>
          </div>
          <div className="text-2xl mb-1">{value}</div>
          {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
          {secondaryValue !== undefined && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="text-lg">{secondaryValue}</div>
              <div className="text-xs text-gray-500">{secondaryLabel}</div>
            </div>
          )}
        </div>
      </div>
      {chart && (
        <div className="flex items-end gap-1 h-12">
          {[40, 60, 45, 70, 55, 80, 65].map((height, idx) => (
            <div
              key={idx}
              className="flex-1 bg-gray-200 rounded-t"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      )}
      {hasBar && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
              <span 
                key={day}
                className={day === 'Fri' ? 'bg-[#FF8C42] text-white px-2 py-0.5 rounded' : ''}
              >
                {day}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label }: any) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-3 h-3 rounded-full ${color}`}></div>
      <span className="text-gray-700">{label}</span>
    </div>
  );
}

function QuickAccessCard({ icon, label, bgColor, onClick }: any) {
  return (
    <button className={`${bgColor} rounded-xl p-4 text-left hover:opacity-80 transition-opacity`} onClick={onClick}>
      <div className="mb-2">{icon}</div>
      <div className="text-xs text-gray-700 leading-tight">{label}</div>
    </button>
  );
}

function TabButton({ label, active = false, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm border-b-2 transition-colors ${
        active
          ? 'border-[#FF8C42] text-[#FF8C42]'
          : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  );
}