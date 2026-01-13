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
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  max_participants?: number;
  current_participants?: number;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  category?: string;
  created_at: string;
}

export default function EventManagementPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

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
  const pendingApproval = events.filter(e => e.status === 'upcoming').length;

  const filteredEvents = events.filter(event => {
    const matchesSearch = 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || event.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

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
                    placeholder="Search"
                    className="px-4 py-2 pl-10 border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none text-sm w-64"
                  />
                </div>
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

          {/* Today's Events */}
          {todayEvents.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Upcoming Events for Today</h3>
              <div className="space-y-3">
                {todayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => setSelectedEvent(event)}
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

        {/* Floating Action Button */}
        <button
          onClick={() => setCreateModalOpen(true)}
          className="fixed bottom-8 right-8 w-14 h-14 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-full flex items-center justify-center shadow-lg z-50 transition-all hover:scale-110"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>
    </AdminLayout>
  );
}

// Create Event Modal Component
function CreateEventModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    date: '',
    start_time: '',
    end_time: '',
    location: '',
    expected_attendees: '',
    banner: null as File | null,
  });

  const handleSubmit = async () => {
    if (!formData.title || !formData.date || !formData.start_time) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/admin/events', {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        start_date: `${formData.date}T${formData.start_time}`,
        end_date: `${formData.date}T${formData.end_time || formData.start_time}`,
        location: formData.location,
        max_participants: parseInt(formData.expected_attendees) || undefined,
      });
      toast.success('Event created successfully!');
      onSuccess();
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast.error(error.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <EnhancedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Event"
      subtitle="Create a new event for customer engagement"
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
            Create Event
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
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors"
            placeholder="Enter Event Title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category Name
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors bg-white"
          >
            <option value="">Select Category</option>
            <option value="conference">Conference</option>
            <option value="community">Community</option>
            <option value="training">Training</option>
            <option value="workshop">Workshop</option>
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
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, expected_attendees: e.target.value })}
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
