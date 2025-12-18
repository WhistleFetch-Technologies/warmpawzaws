import React, { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Calendar, Clock, User, MapPin, Phone, CheckCircle, XCircle, AlertCircle, Users, TrendingUp, Package, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface HomeSampleCollectionManagerProps {
  vendorId: string;
  vendorName: string;
}

interface Staff {
  id: string;
  name: string;
  phone: string;
  photo?: string;
  role: string;
  isAvailable: boolean;
}

interface Assignment {
  id: string;
  bookingId: string;
  staffId: string;
  staffName: string;
  staffPhone: string;
  customerName: string;
  customerPhone: string;
  customerAddress: any;
  petName: string;
  diagnosticTests: any[];
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  collectionOTP: string;
  notes: string;
  assignedAt: string;
  departureTime?: string;
  arrivalTime?: string;
  collectionStartTime?: string;
  collectionEndTime?: string;
  completionTime?: string;
}

interface PendingBooking {
  id: string;
  customerName: string;
  customerPhone: string;
  petName: string;
  address: any;
  serviceDetails: any;
  scheduledDate: string;
  scheduledTime: string;
}

export function HomeSampleCollectionManager({ vendorId, vendorName }: HomeSampleCollectionManagerProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'assigned' | 'completed' | 'stats'>('pending');
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<PendingBooking | null>(null);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignmentTime, setAssignmentTime] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    assigned: 0,
    inTransit: 0,
    completed: 0,
    cancelled: 0,
    averageCollectionTime: 0,
    onTimePercentage: 0
  });

  useEffect(() => {
    loadStaff();
    loadAssignments();
    loadStats();
  }, [vendorId, selectedDate, activeTab]);

  const loadStaff = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/staff`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        // Filter for lab technicians or sample collection staff
        const labStaff = data.staff?.filter((s: Staff) => 
          s.role === 'lab_technician' || s.role === 'phlebotomist' || s.role === 'sample_collector'
        ) || [];
        setStaffList(labStaff);
      }
    } catch (error) {
      console.error('Error loading staff:', error);
    }
  };

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const statusFilter = activeTab === 'pending' ? '' : (activeTab === 'completed' ? 'completed' : 'assigned');
      
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/sample-collection/assignments?date=${selectedDate}${statusFilter ? `&status=${statusFilter}` : ''}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAssignments(data.assignments || []);
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
      toast.error('Failed to load sample collection assignments');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/sample-collection/stats`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleAssignStaff = async () => {
    if (!selectedBooking || !selectedStaff || !assignmentTime) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/sample-collection/assign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            bookingId: selectedBooking.id,
            staffId: selectedStaff,
            scheduledDate: assignmentDate,
            scheduledTime: assignmentTime,
            estimatedDuration: 30,
            notes: assignmentNotes
          })
        }
      );

      if (response.ok) {
        toast.success('Staff assigned successfully!');
        setShowAssignModal(false);
        resetAssignmentForm();
        loadAssignments();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to assign staff');
      }
    } catch (error) {
      console.error('Error assigning staff:', error);
      toast.error('Error assigning staff');
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async (assignmentId: string, newStaffId: string, reason: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/sample-collection/${assignmentId}/reassign`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ newStaffId, reason })
        }
      );

      if (response.ok) {
        toast.success('Staff reassigned successfully');
        loadAssignments();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to reassign staff');
      }
    } catch (error) {
      console.error('Error reassigning staff:', error);
      toast.error('Error reassigning staff');
    }
  };

  const resetAssignmentForm = () => {
    setSelectedBooking(null);
    setSelectedStaff('');
    setAssignmentDate(new Date().toISOString().split('T')[0]);
    setAssignmentTime('');
    setAssignmentNotes('');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      assigned: { color: 'bg-blue-100 text-blue-800', icon: Clock, label: 'Assigned' },
      in_transit: { color: 'bg-yellow-100 text-yellow-800', icon: Activity, label: 'In Transit' },
      arrived: { color: 'bg-purple-100 text-purple-800', icon: MapPin, label: 'Arrived' },
      collecting: { color: 'bg-orange-100 text-orange-800', icon: Package, label: 'Collecting' },
      collected: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Collected' },
      completed: { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle, label: 'Completed' },
      cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Cancelled' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.assigned;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    );
  };

  const renderStatsView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Collections</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Package className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Collection Time</p>
              <p className="text-2xl font-bold text-gray-900">{stats.averageCollectionTime} min</p>
            </div>
            <Clock className="w-10 h-10 text-orange-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">On-Time Rate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.onTimePercentage}%</p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-600">Assigned</p>
          <p className="text-xl font-bold text-blue-900">{stats.assigned}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-600">In Transit</p>
          <p className="text-xl font-bold text-yellow-900">{stats.inTransit}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <p className="text-sm text-green-600">Completed</p>
          <p className="text-xl font-bold text-green-900">{stats.completed}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <p className="text-sm text-red-600">Cancelled</p>
          <p className="text-xl font-bold text-red-900">{stats.cancelled}</p>
        </div>
      </div>
    </div>
  );

  const renderAssignmentCard = (assignment: Assignment) => (
    <div key={assignment.id} className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-gray-900">{assignment.customerName}</h3>
            {getStatusBadge(assignment.status)}
          </div>
          <p className="text-sm text-gray-600">Pet: {assignment.petName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User className="w-4 h-4" />
          <span>{assignment.staffName}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Phone className="w-4 h-4" />
          <span>{assignment.customerPhone}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>{new Date(assignment.scheduledDate).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>{assignment.scheduledTime}</span>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-1">Tests:</p>
        <div className="flex flex-wrap gap-2">
          {assignment.diagnosticTests.map((test: any, idx: number) => (
            <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
              {test.testName || test.name}
            </span>
          ))}
        </div>
      </div>

      {assignment.customerAddress && (
        <div className="flex items-start gap-2 mb-4 text-sm text-gray-600">
          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">
            {assignment.customerAddress.street}, {assignment.customerAddress.city}
          </span>
        </div>
      )}

      {assignment.status === 'assigned' && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
          <p className="text-xs text-blue-600 font-medium mb-1">Collection OTP</p>
          <p className="text-lg font-mono font-bold text-blue-900">{assignment.collectionOTP}</p>
          <p className="text-xs text-blue-600 mt-1">Share this with the staff member</p>
        </div>
      )}

      {assignment.notes && (
        <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 mb-4">
          <p className="font-medium text-xs text-gray-500 mb-1">Notes:</p>
          {assignment.notes}
        </div>
      )}

      <div className="flex gap-2">
        <Button 
          size="sm" 
          variant="outline"
          className="flex-1"
          onClick={() => {
            // Show reassignment modal
            const reason = prompt('Reason for reassignment:');
            if (reason) {
              const newStaffId = prompt('Enter new staff ID:');
              if (newStaffId) {
                handleReassign(assignment.id, newStaffId, reason);
              }
            }
          }}
        >
          Reassign Staff
        </Button>
        
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(assignment.collectionOTP);
            toast.success('OTP copied to clipboard');
          }}
        >
          Copy OTP
        </Button>
      </div>

      {/* Timeline */}
      {(assignment.departureTime || assignment.arrivalTime || assignment.collectionStartTime) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-500 mb-2">Timeline</p>
          <div className="space-y-1 text-xs text-gray-600">
            {assignment.departureTime && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span>Departed: {new Date(assignment.departureTime).toLocaleTimeString()}</span>
              </div>
            )}
            {assignment.arrivalTime && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>Arrived: {new Date(assignment.arrivalTime).toLocaleTimeString()}</span>
              </div>
            )}
            {assignment.collectionStartTime && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>Started: {new Date(assignment.collectionStartTime).toLocaleTimeString()}</span>
              </div>
            )}
            {assignment.collectionEndTime && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Completed: {new Date(assignment.collectionEndTime).toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Home Sample Collection Management</h1>
        <p className="text-gray-600">Assign staff and track sample collections</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <Button onClick={() => setActiveTab('pending')} className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'pending'
              ? 'text-orange-600 border-b-2 border-orange-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Pending Assignment
        </Button>
        <Button onClick={() => setActiveTab('assigned')} className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'assigned'
              ? 'text-orange-600 border-b-2 border-orange-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Assigned
        </Button>
        <Button onClick={() => setActiveTab('completed')} className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'completed'
              ? 'text-orange-600 border-b-2 border-orange-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Completed
        </Button>
        <Button onClick={() => setActiveTab('stats')} className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'stats'
              ? 'text-orange-600 border-b-2 border-orange-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Statistics
        </Button>
      </div>

      {/* Date Filter */}
      {activeTab !== 'stats' && (
        <div className="mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      ) : activeTab === 'stats' ? (
        renderStatsView()
      ) : (
        <div className="space-y-4">
          {assignments.length === 0 ? (
            <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No sample collections found</p>
              <p className="text-sm text-gray-500 mt-1">
                {activeTab === 'pending' ? 'All bookings have staff assigned' : 'No assignments in this status'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignments.map(renderAssignmentCard)}
            </div>
          )}
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Assign Staff for Sample Collection</h3>
            
            {selectedBooking && (
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">Customer: {selectedBooking.customerName}</p>
                <p className="text-sm text-gray-600">Pet: {selectedBooking.petName}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member *</label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select staff</option>
                  {staffList.filter(s => s.isAvailable).map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} - {staff.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Collection Date *</label>
                <input
                  type="date"
                  value={assignmentDate}
                  onChange={(e) => setAssignmentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Collection Time *</label>
                <input
                  type="time"
                  value={assignmentTime}
                  onChange={(e) => setAssignmentTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  rows={3}
                  placeholder="Special instructions..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={() => {
                  setShowAssignModal(false);
                  resetAssignmentForm();
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignStaff}
                disabled={loading || !selectedStaff || !assignmentTime}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                {loading ? 'Assigning...' : 'Assign Staff'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
