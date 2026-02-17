'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { StatCard } from '@/components/admin/shared/StatCard';
import { EnhancedButton } from '@/components/admin/shared/EnhancedButton';
import { EnhancedModal } from '@/components/admin/shared/EnhancedModal';
import { 
  Calendar, 
  Plus, 
  Edit, 
  Trash2, 
  MapPin, 
  Clock, 
  Users, 
  Search, 
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface Event {
  id: string;
  title: string;
  name?: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  max_participants?: number;
  current_participants?: number;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled' | 'draft' | 'published';
  category?: string;
  created_at: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  created_by?: 'admin' | 'vendor';
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  vendor_id?: string;
  vendor_name?: string;
}

export default function EventManagementPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterApproval, setFilterApproval] = useState<string>('all');
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvingEvent, setApprovingEvent] = useState<Event | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingEvent, setViewingEvent] = useState<Event | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/events');
      setEvents(Array.isArray(data) ? data : (data.events || data.data || []));
    } catch (error: any) {
      console.error('Error loading events:', error);
      setEvents([]);
      if (error.status !== 404) {
        toast.error('Failed to load events');
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const todayEvents = events.filter(e => {
    const eventDate = new Date(e.start_date);
    const today = new Date();
    return eventDate.toDateString() === today.toDateString();
  });

  const thisMonthEvents = events.filter(e => {
    const eventDate = new Date(e.start_date);
    const now = new Date();
    return eventDate.getMonth() === now.getMonth() && eventDate.getFullYear() === now.getFullYear();
  });

  const completedEvents = events.filter(e => e.status === 'completed');
  const pendingApproval = events.filter(e => e.approval_status === 'pending').length;

  const handleApprove = async (eventId: string) => {
    try {
      await apiClient.post(`/admin/events/${eventId}/approve`);
      toast.success('Event approved successfully');
      loadEvents();
      setApprovalModalOpen(false);
      setApprovingEvent(null);
    } catch (error: any) {
      console.error('Error approving event:', error);
      toast.error(error.message || 'Failed to approve event');
    }
  };

  const handleReject = async () => {
    if (!approvingEvent) return;
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    
    try {
      await apiClient.post(`/admin/events/${approvingEvent.id}/reject`, {
        reason: rejectionReason,
      });
      toast.success('Event rejected');
      loadEvents();
      setApprovalModalOpen(false);
      setApprovingEvent(null);
      setRejectionReason('');
    } catch (error: any) {
      console.error('Error rejecting event:', error);
      toast.error(error.message || 'Failed to reject event');
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = 
      (event.title || event.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || event.status === filterStatus;
    const matchesApproval = filterApproval === 'all' || event.approval_status === filterApproval;
    
    return matchesSearch && matchesFilter && matchesApproval;
  });

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setEditModalOpen(true);
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    try {
      await apiClient.delete(`/admin/events/${eventId}`);
      toast.success('Event deleted successfully');
      loadEvents();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast.error(error.message || 'Failed to delete event');
    }
  };

  const handleView = async (eventId: string) => {
    try {
      const event = await apiClient.get<any>(`/admin/events/${eventId}`);
      setViewingEvent(event);
      setViewModalOpen(true);
    } catch (error: any) {
      console.error('Error fetching event:', error);
      toast.error('Failed to load event details');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'ongoing':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading events...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Event Management</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Efficiently plan, organise, and execute events across all venues and categories.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    className="px-4 py-2 pl-10 border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none text-sm w-64"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select
                  value={filterApproval}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterApproval(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none text-sm"
                >
                  <option value="all">All Approval</option>
                  <option value="pending">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Today's Events"
              value={todayEvents.length}
              icon={Calendar}
              iconColor="green"
            />
            <StatCard
              title="This Month"
              value={thisMonthEvents.length}
              icon={Calendar}
              iconColor="blue"
            />
            <StatCard
              title="Host Rating"
              value="4.7"
              icon={TrendingUp}
              iconColor="orange"
            />
            <StatCard
              title="Pending Approval"
              value={pendingApproval}
              icon={AlertCircle}
              iconColor="red"
            />
          </div>

          {/* Calendar Navigation */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    const newDate = new Date(currentDate);
                    newDate.setMonth(newDate.getMonth() - 1);
                    setCurrentDate(newDate);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h2 className="text-xl font-bold text-gray-900">
                  {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <button
                  onClick={() => {
                    const newDate = new Date(currentDate);
                    newDate.setMonth(newDate.getMonth() + 1);
                    setCurrentDate(newDate);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'month'
                      ? 'bg-[#FF8C42] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'week'
                      ? 'bg-[#FF8C42] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setViewMode('agenda')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'agenda'
                      ? 'bg-[#FF8C42] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Agenda
                </button>
                <EnhancedButton
                  variant="primary"
                  onClick={() => setCreateModalOpen(true)}
                  icon={Plus}
                  iconPosition="left"
                >
                  New Event
                </EnhancedButton>
              </div>
            </div>

            {/* Calendar View Placeholder */}
            <div className="bg-gray-50 rounded-lg p-8 text-center border-2 border-dashed border-gray-300">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Calendar View</p>
              <p className="text-sm text-gray-500 mt-1">
                {viewMode === 'month' && 'Monthly calendar view will be displayed here'}
                {viewMode === 'week' && 'Weekly calendar view will be displayed here'}
                {viewMode === 'agenda' && 'Agenda list view will be displayed here'}
              </p>
            </div>
          </div>

          {/* Events List */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">All Events</h3>
              <span className="text-sm text-gray-500">{filteredEvents.length} events</span>
            </div>
            {filteredEvents.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Events Found</h3>
                <p className="text-gray-600">
                  {events.length === 0
                    ? 'Get started by clicking "New Event" above to create your first event'
                    : 'Try adjusting your search or filter criteria'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">{event.title || event.name}</h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(event.status)}`}>
                          {event.status}
                        </span>
                        {event.approval_status && (
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            event.approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                            event.approval_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {event.approval_status === 'approved' ? '✓ Approved' :
                             event.approval_status === 'pending' ? '⏳ Pending' :
                             '✗ Rejected'}
                          </span>
                        )}
                        {event.created_by === 'vendor' && (
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            Vendor Created
                          </span>
                        )}
                        {event.category && (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                            {event.category}
                          </span>
                        )}
                      </div>
                      {event.vendor_name && (
                        <p className="text-xs text-gray-500 mb-1">Created by: {event.vendor_name}</p>
                      )}
                      {event.rejection_reason && (
                        <p className="text-xs text-red-600 mb-1">Rejection reason: {event.rejection_reason}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDate(event.start_date)}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {event.location}
                          </span>
                        )}
                        {(event.max_participants || event.current_participants) && (
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {event.current_participants || 0} / {event.max_participants || '∞'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {event.approval_status === 'pending' && (
                        <>
                          <EnhancedButton
                            variant="primary"
                            size="sm"
                            onClick={() => handleApprove(event.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Approve
                          </EnhancedButton>
                          <EnhancedButton
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setApprovingEvent(event);
                              setApprovalModalOpen(true);
                            }}
                          >
                            Reject
                          </EnhancedButton>
                        </>
                      )}
                      <EnhancedButton
                        variant="outline"
                        size="sm"
                        icon={Edit}
                        onClick={() => handleEdit(event)}
                      >
                        Edit
                      </EnhancedButton>
                      <EnhancedButton
                        variant="outline"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleDelete(event.id)}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        Delete
                      </EnhancedButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's Events */}
          {todayEvents.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 mt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Upcoming Events for Today</h3>
              <div className="space-y-3">
                {todayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => handleView(event.id)}
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{event.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatDate(event.start_date)} | {event.location}
                      </p>
                    </div>
                    <EnhancedButton variant="outline" size="sm">
                      View Details
                    </EnhancedButton>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Create Event Modal */}
        {createModalOpen && (
          <CreateEventModal
            isOpen={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            onSuccess={() => {
              loadEvents();
              setCreateModalOpen(false);
            }}
          />
        )}

        {/* Edit Event Modal */}
        {editModalOpen && editingEvent && (
          <CreateEventModal
            isOpen={editModalOpen}
            onClose={() => {
              setEditModalOpen(false);
              setEditingEvent(null);
            }}
            onSuccess={() => {
              loadEvents();
              setEditModalOpen(false);
              setEditingEvent(null);
            }}
            event={editingEvent}
          />
        )}

        {/* View Event Modal */}
        {viewModalOpen && viewingEvent && (
          <ViewEventModal
            isOpen={viewModalOpen}
            onClose={() => {
              setViewModalOpen(false);
              setViewingEvent(null);
            }}
            event={viewingEvent}
            onEdit={() => {
              setViewModalOpen(false);
              handleEdit(viewingEvent);
            }}
            onDelete={() => {
              setViewModalOpen(false);
              handleDelete(viewingEvent.id);
            }}
          />
        )}

      </div>
      {/* Rejection Modal */}
      {approvalModalOpen && approvingEvent && (
        <EnhancedModal
          isOpen={approvalModalOpen}
          onClose={() => {
            setApprovalModalOpen(false);
            setApprovingEvent(null);
            setRejectionReason('');
          }}
          title="Reject Event"
          subtitle={`Reject "${approvingEvent.title || approvingEvent.name}"`}
          icon={<AlertCircle className="w-5 h-5" />}
          footer={
            <div className="flex justify-end gap-3">
              <EnhancedButton
                variant="outline"
                onClick={() => {
                  setApprovalModalOpen(false);
                  setApprovingEvent(null);
                  setRejectionReason('');
                }}
              >
                Cancel
              </EnhancedButton>
              <EnhancedButton
                variant="danger"
                onClick={handleReject}
              >
                Reject Event
              </EnhancedButton>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectionReason(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent resize-none"
                rows={4}
                placeholder="Please provide a reason for rejecting this event..."
              />
              <p className="text-xs text-gray-500 mt-1">
                This reason will be visible to the vendor
              </p>
            </div>
          </div>
        </EnhancedModal>
      )}
    </AdminLayout>
  );
}

// Create/Edit Event Modal Component
function CreateEventModal({
  isOpen,
  onClose,
  onSuccess,
  event,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  event?: Event | null;
}) {
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<{ id: string; business_name?: string; name?: string }[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    date: '',
    start_time: '',
    end_time: '',
    location: '',
    expected_attendees: '',
    status: 'draft',
    vendor_id: '',
    banner: null as File | null,
  });

  useEffect(() => {
    if (isOpen && !event) {
      apiClient.get<any>('/admin/vendors?limit=500').then((r) => {
        const list = r?.vendors ?? r?.data ?? [];
        setVendors(Array.isArray(list) ? list : []);
      }).catch(() => setVendors([]));
    }
  }, [isOpen, event]);

  useEffect(() => {
    if (event) {
      const eventDate = event.start_date.split('T')[0];
      const startTime = event.start_date.includes('T') ? event.start_date.split('T')[1].substring(0, 5) : '';
      const endTime = event.end_date && event.end_date.includes('T') ? event.end_date.split('T')[1].substring(0, 5) : '';
      
      setFormData({
        title: event.title || '',
        description: event.description || '',
        category: event.category || '',
        date: eventDate,
        start_time: startTime,
        end_time: endTime,
        location: event.location || '',
        expected_attendees: event.max_participants?.toString() || '',
        status: event.status || 'draft',
        vendor_id: event.vendor_id || '',
        banner: null,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        category: '',
        date: '',
        start_time: '',
        end_time: '',
        location: '',
        expected_attendees: '',
        status: 'draft',
        vendor_id: '',
        banner: null,
      });
    }
  }, [event, isOpen]);

  const handleSubmit = async () => {
    if (!formData.title || !formData.date || !formData.start_time) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!event && !formData.vendor_id) {
      toast.error('Please select a host vendor for the event');
      return;
    }

    try {
      setLoading(true);
      const payload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description,
        category: formData.category || 'other',
        start_date: formData.date,
        start_time: formData.start_time,
        end_date: formData.date,
        end_time: formData.end_time || formData.start_time,
        location: formData.location,
        max_participants: parseInt(formData.expected_attendees) || undefined,
        status: formData.status,
      };
      if (formData.vendor_id) payload.vendor_id = formData.vendor_id;

      if (event) {
        await apiClient.put(`/admin/events/${event.id}`, payload);
        toast.success('Event updated successfully!');
      } else {
        await apiClient.post('/admin/events', payload);
        toast.success('Event created successfully!');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast.error(error.message || `Failed to ${event ? 'update' : 'create'} event`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <EnhancedModal
      isOpen={isOpen}
      onClose={onClose}
      title={event ? "Edit Event" : "Create New Event"}
      subtitle={event ? "Update event details" : "Create a new event for customer engagement"}
      icon={<Calendar className="w-5 h-5 text-white" />}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-end gap-3">
          <EnhancedButton variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </EnhancedButton>
          <EnhancedButton
            variant="primary"
            onClick={handleSubmit}
            disabled={loading}
            loading={loading}
          >
            {event ? 'Update Event' : 'Create Event'}
          </EnhancedButton>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Event Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors"
            placeholder="Enter Event Title"
          />
        </div>

        {!event && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Host Vendor <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.vendor_id}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, vendor_id: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors bg-white"
              required
            >
              <option value="">Select vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.business_name || v.name || v.id}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category Name
          </label>
          <select
            value={formData.category}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors bg-white"
          >
            <option value="">Select Category</option>
            <option value="adoption">Adoption</option>
            <option value="workshop">Workshop</option>
            <option value="exhibition">Exhibition</option>
            <option value="charity">Charity</option>
            <option value="training">Training</option>
            <option value="meetup">Meetup</option>
            <option value="competition">Competition</option>
            <option value="festival">Festival</option>
            <option value="webinar">Webinar</option>
            <option value="fundraiser">Fundraiser</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors bg-white"
          >
            <option value="draft">Draft</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End time
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors resize-none"
            rows={4}
            placeholder="Describe the event ......"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, location: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors"
            placeholder="Event location"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expected Attendees
          </label>
          <input
            type="number"
            value={formData.expected_attendees}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, expected_attendees: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors"
            placeholder="Expected Number of Attendees"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add banner for your event
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#FF8C42] transition-colors cursor-pointer">
            <div className="text-gray-400 mb-2">
              <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">No media added yet</p>
            <p className="text-xs text-gray-500 mt-1">Click to upload banner image</p>
          </div>
        </div>
      </div>
    </EnhancedModal>
  );
}

// View Event Modal Component
function ViewEventModal({
  isOpen,
  onClose,
  event,
  onEdit,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'ongoing':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <EnhancedModal
      isOpen={isOpen}
      onClose={onClose}
      title={event.title}
      subtitle={event.category || 'Event Details'}
      icon={<Calendar className="w-5 h-5 text-white" />}
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-end gap-3">
          <EnhancedButton variant="outline" onClick={onDelete} className="text-red-600 hover:text-red-700">
            Delete
          </EnhancedButton>
          <EnhancedButton variant="outline" onClick={onEdit}>
            Edit
          </EnhancedButton>
          <EnhancedButton variant="primary" onClick={onClose}>
            Close
          </EnhancedButton>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 text-sm font-medium rounded ${getStatusColor(event.status)}`}>
            {event.status}
          </span>
          {event.category && (
            <span className="px-3 py-1 text-sm font-medium bg-gray-200 text-gray-700 rounded">
              {event.category}
            </span>
          )}
        </div>

        {event.description && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
            <p className="text-gray-600">{event.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Start Date</h4>
            <p className="text-gray-600">{formatDate(event.start_date)}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">End Date</h4>
            <p className="text-gray-600">{formatDate(event.end_date || event.start_date)}</p>
          </div>
        </div>

        {event.location && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Location
            </h4>
            <p className="text-gray-600">{event.location}</p>
          </div>
        )}

        {(event.max_participants || event.current_participants !== undefined) && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participants
            </h4>
            <p className="text-gray-600">
              {event.current_participants || 0} / {event.max_participants || '∞'}
            </p>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Created At</h4>
          <p className="text-gray-600">{formatDate(event.created_at)}</p>
        </div>
      </div>
    </EnhancedModal>
  );
}
