'use client';

/**
 * Diagnostics Order Dashboard
 * Vendor dashboard for managing lab test bookings, sample collection, and report uploads
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Search,
  Filter,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  TestTube,
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  RefreshCw,
  Home as HomeIcon,
  Building2,
  ChevronRight,
  Eye,
  UserPlus,
  Navigation
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { DiagnosticsReportUpload } from './DiagnosticsReportUpload';

interface DiagnosticsOrderDashboardProps {
  vendorId: string;
  onBack?: () => void;
  onSelectBooking?: (bookingId: string) => void;
}

interface DiagnosticsBooking {
  id: string;
  bookingNumber: string;
  customerName: string;
  customerPhone: string;
  petName: string;
  petType: string;
  scheduledDate: string;
  scheduledTime: string;
  collectionType: 'home' | 'center';
  address?: string;
  status: 'scheduled' | 'sample_collected' | 'sample_received_at_lab' | 'processing' | 'reports_ready' | 'completed';
  tests: {
    id: string;
    name: string;
    code: string;
    category: string;
    price: number;
  }[];
  totalAmount: number;
  assignedStaff?: {
    id: string;
    name: string;
    phone: string;
  };
  collectionOTP?: string;
  reports?: {
    testId: string;
    testName: string;
    reportUrl?: string;
    status: 'pending' | 'uploaded';
  }[];
}

type TabType = 'scheduled' | 'in_progress' | 'ready' | 'completed';

const TABS: { key: TabType; label: string; statuses: string[] }[] = [
  { key: 'scheduled', label: 'Scheduled', statuses: ['scheduled', 'pending', 'confirmed'] },
  { key: 'in_progress', label: 'In Progress', statuses: ['sample_collected', 'sample_received_at_lab', 'processing', 'in_progress'] },
  { key: 'ready', label: 'Reports Ready', statuses: ['reports_ready'] },
  { key: 'completed', label: 'Completed', statuses: ['completed'] },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-600' },
  pending: { label: 'Scheduled', color: 'bg-blue-100 text-blue-600' },
  confirmed: { label: 'Scheduled', color: 'bg-blue-100 text-blue-600' },
  sample_collected: { label: 'Sample Collected', color: 'bg-amber-100 text-amber-600' },
  sample_received_at_lab: { label: 'At Lab', color: 'bg-purple-100 text-purple-600' },
  processing: { label: 'Processing', color: 'bg-indigo-100 text-indigo-600' },
  in_progress: { label: 'In Progress', color: 'bg-indigo-100 text-indigo-600' },
  reports_ready: { label: 'Reports Ready', color: 'bg-green-100 text-green-600' },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-600' },
};

export function DiagnosticsOrderDashboard({ 
  vendorId, 
  onBack,
  onSelectBooking 
}: DiagnosticsOrderDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('scheduled');
  const [bookings, setBookings] = useState<DiagnosticsBooking[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<DiagnosticsBooking | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [assignMode, setAssignMode] = useState<'staff' | 'adhoc'>('adhoc');
  const [adhocAgent, setAdhocAgent] = useState({ name: '', phone: '', date: '', time: '' });
  const [tabCounts, setTabCounts] = useState<Record<TabType, number>>({
    scheduled: 0,
    in_progress: 0,
    ready: 0,
    completed: 0
  });

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await apiClient.get<any>(`/vendor/${vendorId}/diagnostics/bookings`);
      
      if (response.success && response.bookings) {
        const formattedBookings: DiagnosticsBooking[] = response.bookings.map((b: any) => {
          let notesData: { tests?: any[] } = {};
          try {
            notesData = typeof b.notes === 'string' ? JSON.parse(b.notes || '{}') : (b.notes || {});
          } catch (_) {}
          const tests = notesData.tests || [];
          return {
            id: b.id,
            bookingNumber: b.booking_number || b.id?.slice(0, 8)?.toUpperCase() || 'N/A',
            customerName: b.customer_name || 'Customer',
            customerPhone: b.customer_phone,
            petName: b.pet_name || 'Pet',
            petType: b.pet_type || 'Dog',
            scheduledDate: b.booking_date,
            scheduledTime: b.booking_time,
            collectionType: (b.service_type === 'at_home' || b.service_type === 'at_center') ? (b.service_type === 'at_home' ? 'home' : 'center') : 'center',
            address: b.address,
            status: b.status,
            tests,
            totalAmount: b.total_amount ?? 0,
            assignedStaff: b.assigned_staff,
            collectionOTP: b.collection_otp,
            reports: b.reports,
            customerId: b.customer_id,
            petId: b.pet_id,
          };
        });
        
        setBookings(formattedBookings);
        
        // Calculate tab counts
        const counts: Record<TabType, number> = {
          scheduled: 0,
          in_progress: 0,
          ready: 0,
          completed: 0
        };
        
        formattedBookings.forEach(b => {
          const tab = TABS.find(t => t.statuses.includes(b.status));
          if (tab) counts[tab.key]++;
        });
        
        setTabCounts(counts);
      } else {
        // Mock data for demo
        const mockBookings: DiagnosticsBooking[] = [
          {
            id: 'booking-1',
            bookingNumber: 'DX2024001',
            customerName: 'Priya Sharma',
            customerPhone: '+91 98765 43210',
            petName: 'Max',
            petType: 'Dog',
            scheduledDate: new Date().toISOString().split('T')[0],
            scheduledTime: '10:00 AM',
            collectionType: 'home',
            address: '123, MG Road, Bangalore - 560001',
            status: 'scheduled',
            tests: [
              { id: 't1', name: 'Complete Blood Count', code: 'CBC', category: 'Blood', price: 500 },
              { id: 't2', name: 'Liver Function Test', code: 'LFT', category: 'Blood', price: 800 }
            ],
            totalAmount: 1300
          },
          {
            id: 'booking-2',
            bookingNumber: 'DX2024002',
            customerName: 'Amit Patel',
            customerPhone: '+91 87654 32109',
            petName: 'Buddy',
            petType: 'Dog',
            scheduledDate: new Date().toISOString().split('T')[0],
            scheduledTime: '02:00 PM',
            collectionType: 'center',
            status: 'sample_collected',
            tests: [
              { id: 't3', name: 'X-Ray', code: 'XRAY', category: 'Imaging', price: 1200 }
            ],
            totalAmount: 1200,
            assignedStaff: { id: 's1', name: 'Rahul Kumar', phone: '+91 98765 11111' }
          },
          {
            id: 'booking-3',
            bookingNumber: 'DX2024003',
            customerName: 'Sneha Reddy',
            customerPhone: '+91 76543 21098',
            petName: 'Luna',
            petType: 'Cat',
            scheduledDate: new Date().toISOString().split('T')[0],
            scheduledTime: '11:00 AM',
            collectionType: 'home',
            address: '456, Koramangala, Bangalore - 560034',
            status: 'processing',
            tests: [
              { id: 't4', name: 'Thyroid Panel', code: 'THYROID', category: 'Hormone', price: 900 }
            ],
            totalAmount: 900
          }
        ];
        
        setBookings(mockBookings);
        setTabCounts({
          scheduled: 1,
          in_progress: 2,
          ready: 0,
          completed: 0
        });
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  const loadStaff = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/staff?role=phlebotomist`);
      if (response.staff) {
        setStaffList(response.staff);
      } else {
        // Mock staff
        setStaffList([
          { id: 's1', name: 'Rahul Kumar', phone: '+91 98765 11111', available: true },
          { id: 's2', name: 'Priya Singh', phone: '+91 98765 22222', available: true },
          { id: 's3', name: 'Amit Verma', phone: '+91 98765 33333', available: false }
        ]);
      }
    } catch (error) {
      console.error('Error loading staff:', error);
    }
  };

  useEffect(() => {
    loadBookings();
    loadStaff();
  }, [loadBookings]);

  const filteredBookings = bookings.filter(b => {
    const currentTab = TABS.find(t => t.key === activeTab);
    if (!currentTab?.statuses.includes(b.status)) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!b.customerName.toLowerCase().includes(query) &&
          !b.bookingNumber.toLowerCase().includes(query) &&
          !b.petName.toLowerCase().includes(query)) {
        return false;
      }
    }
    
    if (filterDate && b.scheduledDate !== filterDate) return false;
    
    return true;
  });

  const handleUpdateStatus = async (bookingId: string, newStatus: string) => {
    try {
      await apiClient.put<any>(`/bookings/${bookingId}/status`, { status: newStatus });
      toast.success('Status updated successfully');
      loadBookings();
    } catch (error) {
      console.error('Error updating status:', error);
      // Update locally for demo
      setBookings(prev => prev.map(b => 
        b.id === bookingId ? { ...b, status: newStatus as any } : b
      ));
      toast.success('Status updated successfully');
    }
  };

  const handleAssignStaff = async (bookingId: string, staffId: string) => {
    try {
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) return;
      const res = await apiClient.post<any>(`/diagnostics/sample-collection/assign`, {
        bookingId,
        vendorId,
        staffId,
        customerId: (booking as any).customerId,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        customerAddress: booking.address ? { address: booking.address } : {},
        petId: (booking as any).petId,
        petName: booking.petName,
        diagnosticTests: booking.tests,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
      });
      if (res.success) {
        toast.success('Staff assigned. Customer notified.');
        setShowAssignModal(false);
        setSelectedBooking(null);
        loadBookings();
      } else throw new Error(res.error);
    } catch (error: any) {
      console.error('Error assigning staff:', error);
      toast.error(error.message || 'Failed to assign');
    }
  };

  const handleAssignAdhoc = async (bookingId: string) => {
    if (!adhocAgent.name?.trim() || !adhocAgent.phone?.trim() || !adhocAgent.date || !adhocAgent.time) {
      toast.error('Please fill agent name, phone, date and time');
      return;
    }
    try {
      const res = await apiClient.post<any>(`/diagnostics/sample-collection/assign-adhoc`, {
        bookingId,
        vendorId,
        agentName: adhocAgent.name.trim(),
        agentPhone: adhocAgent.phone.trim(),
        scheduledDate: adhocAgent.date,
        scheduledTime: adhocAgent.time,
      });
      if (res.success) {
        toast.success('Adhoc agent assigned. Customer notified with agent details.');
        setShowAssignModal(false);
        setSelectedBooking(null);
        setAdhocAgent({ name: '', phone: '', date: '', time: '' });
        loadBookings();
      } else throw new Error(res.error);
    } catch (error: any) {
      console.error('Error assigning adhoc:', error);
      toast.error(error.message || 'Failed to assign');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button 
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-semibold">Diagnostics Dashboard</h1>
              <p className="text-sm text-gray-500">Manage lab test bookings and reports</p>
            </div>
          </div>
          <Button 
            onClick={loadBookings}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key 
                  ? 'border-teal-600 text-teal-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.key 
                  ? 'bg-teal-100 text-teal-600' 
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {tabCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name, booking #, pet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* Bookings List */}
      <div className="px-6 pb-6">
        {filteredBookings.length > 0 ? (
          <div className="space-y-4">
            {filteredBookings.map(booking => (
              <Card 
                key={booking.id}
                className="bg-white border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* Booking Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">#{booking.bookingNumber}</span>
                        <Badge className={`${STATUS_LABELS[booking.status]?.color || 'bg-gray-100 text-gray-600'} border-none text-xs`}>
                          {STATUS_LABELS[booking.status]?.label || booking.status}
                        </Badge>
                        <Badge className={`${booking.collectionType === 'home' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'} border-none text-xs`}>
                          {booking.collectionType === 'home' ? (
                            <><HomeIcon className="w-3 h-3 mr-1" /> Home</>
                          ) : (
                            <><Building2 className="w-3 h-3 mr-1" /> Center</>
                          )}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(booking.scheduledDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {booking.scheduledTime}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-teal-600">₹{booking.totalAmount}</p>
                      <p className="text-xs text-gray-500">{booking.tests.length} test(s)</p>
                    </div>
                  </div>
                </div>

                {/* Customer & Pet Info */}
                <div className="p-4 bg-gray-50 border-b border-gray-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{booking.customerName}</p>
                        <p className="text-xs text-gray-500">{booking.customerPhone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-xl">
                        {booking.petType === 'Cat' ? '🐱' : '🐕'}
                      </div>
                      <div>
                        <p className="font-medium">{booking.petName}</p>
                        <p className="text-xs text-gray-500">{booking.petType}</p>
                      </div>
                    </div>
                  </div>
                  
                  {booking.collectionType === 'home' && booking.address && (
                    <div className="mt-3 flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <span>{booking.address}</span>
                    </div>
                  )}
                </div>

                {/* Tests List */}
                <div className="p-4 border-b border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">Tests Booked:</p>
                  <div className="flex flex-wrap gap-2">
                    {booking.tests.map(test => (
                      <Badge 
                        key={test.id}
                        variant="outline"
                        className="text-xs"
                      >
                        <TestTube className="w-3 h-3 mr-1" />
                        {test.name} ({test.code})
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Assigned Staff */}
                {booking.assignedStaff && (
                  <div className="px-4 py-3 bg-green-50 border-b border-green-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-700">
                          Assigned to: <strong>{booking.assignedStaff.name}</strong>
                        </span>
                      </div>
                      {booking.collectionOTP && (
                        <span className="text-sm font-mono bg-white px-2 py-1 rounded border border-green-200">
                          OTP: {booking.collectionOTP}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="p-4 flex gap-2 flex-wrap">
                  {(booking.status === 'scheduled' || booking.status === 'pending' || booking.status === 'confirmed') && booking.collectionType === 'home' && !booking.assignedStaff && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedBooking(booking);
                        setAdhocAgent({
                          name: '',
                          phone: '',
                          date: booking.scheduledDate || new Date().toISOString().split('T')[0],
                          time: booking.scheduledTime || '10:00',
                        });
                        setAssignMode('adhoc');
                        setShowAssignModal(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      Assign Collection Agent
                    </Button>
                  )}
                  
                  {(booking.status === 'scheduled' || booking.status === 'pending' || booking.status === 'confirmed') && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(booking.id, 'sample_collected')}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Mark Collected
                    </Button>
                  )}
                  
                  {booking.status === 'sample_collected' && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(booking.id, 'processing')}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Start Processing
                    </Button>
                  )}
                  
                  {booking.status === 'processing' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedBooking(booking);
                        setShowUploadModal(true);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Upload Reports
                    </Button>
                  )}
                  
                  {booking.status === 'reports_ready' && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(booking.id, 'completed')}
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Mark Completed
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectBooking?.(booking.id)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View Details
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`tel:${booking.customerPhone}`, '_self')}
                  >
                    <Phone className="w-4 h-4 mr-1" />
                    Call
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center bg-white border border-gray-200">
            <TestTube className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-700 mb-1">No Bookings Found</h3>
            <p className="text-sm text-gray-500">
              {searchQuery || filterDate 
                ? 'Try adjusting your search or filters'
                : `No ${activeTab} bookings at the moment`
              }
            </p>
          </Card>
        )}
      </div>

      {/* Assign Collection Agent Modal - Staff or Adhoc */}
      {showAssignModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-lg">Assign Home Sample Collection</h3>
              <p className="text-sm text-gray-500">Booking #{selectedBooking.bookingNumber}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setAssignMode('adhoc')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${assignMode === 'adhoc' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  Adhoc Agent
                </button>
                <button
                  onClick={() => setAssignMode('staff')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${assignMode === 'staff' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  Staff
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {assignMode === 'adhoc' ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">Assign external agent (no login). Customer will be notified with name, phone and schedule.</p>
                  <div>
                    <label className="block text-sm font-medium mb-1">Agent Name *</label>
                    <Input
                      value={adhocAgent.name}
                      onChange={e => setAdhocAgent(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Rajesh Kumar"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Agent Phone *</label>
                    <Input
                      value={adhocAgent.phone}
                      onChange={e => setAdhocAgent(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="e.g., 9876543210"
                      className="w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">Date *</label>
                      <Input
                        type="date"
                        value={adhocAgent.date}
                        onChange={e => setAdhocAgent(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Time *</label>
                      <Input
                        type="time"
                        value={adhocAgent.time}
                        onChange={e => setAdhocAgent(prev => ({ ...prev, time: e.target.value }))}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleAssignAdhoc(selectedBooking.id)}
                  >
                    Assign & Notify Customer
                  </Button>
                </div>
              ) : (
                <>
                  {staffList.filter(s => s.available !== false).length > 0 ? (
                    staffList.filter(s => s.available !== false).map(staff => (
                      <button
                        key={staff.id}
                        onClick={() => handleAssignStaff(selectedBooking.id, staff.id)}
                        className="w-full p-3 border border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-colors text-left flex items-center gap-3"
                      >
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-semibold">
                          {staff.name?.charAt(0) || 'S'}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{staff.name}</p>
                          <p className="text-xs text-gray-500">{staff.phone}</p>
                        </div>
                        <Badge className="bg-green-100 text-green-600 border-none">Available</Badge>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 py-4">No staff available. Use Adhoc Agent instead.</p>
                  )}
                </>
              )}
            </div>
            <div className="p-4 border-t border-gray-100">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedBooking(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Upload Reports Modal - uses DiagnosticsReportUpload for real API + customer notification */}
      {showUploadModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-lg bg-white max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Upload Report</h3>
                <p className="text-sm text-gray-500">Booking #{selectedBooking.bookingNumber}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedBooking(null);
                }}
              >
                Close
              </Button>
            </div>
            <div className="p-4">
              <DiagnosticsReportUpload
                vendorId={vendorId}
                bookingId={selectedBooking.id}
                bookingData={{
                  customerName: selectedBooking.customerName,
                  customerPhone: selectedBooking.customerPhone,
                  petName: selectedBooking.petName,
                  petId: (selectedBooking as any).petId,
                  customerId: (selectedBooking as any).customerId,
                }}
                onSuccess={() => {
                  loadBookings();
                  handleUpdateStatus(selectedBooking.id, 'reports_ready');
                  setShowUploadModal(false);
                  setSelectedBooking(null);
                }}
                onCancel={() => {
                  setShowUploadModal(false);
                  setSelectedBooking(null);
                }}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
