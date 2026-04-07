'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  ArrowLeft, Plus, Eye, Calendar, User, Award, Target,
  Camera, FileText, BarChart3, CheckCircle, AlertCircle,
  Clock, Heart, Activity, Weight, Ruler, Brain,
  Search, Filter, Download, Upload, Video, Edit, Trash2
} from 'lucide-react';
import { toast } from 'sonner';

interface ProgressTracker {
  id: string;
  petId: string;
  petName: string;
  petImage: string;
  customerName: string;
  programType: 'training' | 'behavioral' | 'nutrition' | 'rehabilitation';
  programName: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  currentPhase: string;
  completionPercentage: number;
  sessionsCompleted: number;
  totalSessions: number;
}

interface ProgressNote {
  id: string;
  date: string;
  sessionNumber: number;
  title: string;
  observations: string;
  rating: number;
}

interface ProgressTrackingDashboardProps {
  vendorId: string;
  roleType?: 'trainer' | 'behaviorist' | 'nutritionist';
  onBack?: () => void;
}

export function ProgressTrackingDashboard({ vendorId, roleType = 'trainer', onBack }: ProgressTrackingDashboardProps) {
  const [trackers, setTrackers] = useState<ProgressTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTracker, setSelectedTracker] = useState<ProgressTracker | null>(null);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadTrackers();
  }, [vendorId]);

  const loadTrackers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/progress-trackers`);

      if (response.success) {
        setTrackers(response.trackers || []);
      } else {
        // Use mock data if API fails
        setTrackers([
          {
            id: '1',
            petId: 'pet1',
            petName: 'Bruno',
            petImage: '',
            customerName: 'Rahul Sharma',
            programType: 'training',
            programName: 'Basic Obedience Training',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            currentPhase: 'Foundation',
            completionPercentage: 40,
            sessionsCompleted: 4,
            totalSessions: 10
          },
          {
            id: '2',
            petId: 'pet2',
            petName: 'Max',
            petImage: '',
            customerName: 'Priya Patel',
            programType: 'behavioral',
            programName: 'Anxiety Management',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            currentPhase: 'Assessment',
            completionPercentage: 20,
            sessionsCompleted: 2,
            totalSessions: 8
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading trackers:', error);
    } finally {
      setLoading(false);
    }
  };

  const addProgressNote = async (note: { title: string; observations: string; rating: number }) => {
    if (!selectedTracker) return;

    try {
      const response = await apiClient.post<any>(`/vendor/${vendorId}/progress-trackers/${selectedTracker.id}/notes`, {
        ...note,
        sessionNumber: selectedTracker.sessionsCompleted + 1,
        date: new Date().toISOString()
      });

      if (response.success) {
        toast.success('Progress note added successfully');
        await loadTrackers();
        setShowAddNoteModal(false);
      } else {
        toast.error(response.error || 'Failed to add progress note');
      }
    } catch (error: any) {
      console.error('Error adding note:', error);
      toast.error(error?.message || 'Failed to add note');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgramIcon = (type: string) => {
    switch (type) {
      case 'training': return <Target className="w-5 h-5" />;
      case 'behavioral': return <Brain className="w-5 h-5" />;
      case 'nutrition': return <Heart className="w-5 h-5" />;
      case 'rehabilitation': return <Activity className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const filteredTrackers = trackers.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (searchQuery && !t.petName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !t.customerName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 vendor-app-column">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading progress trackers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 vendor-app-column">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B2C] text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold">Progress Tracking</h1>
            <p className="text-sm text-white/80">{trackers.length} active programs</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by pet or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white text-gray-800 placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-4 overflow-x-auto">
        {['all', 'active', 'completed', 'paused'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
              statusFilter === status
                ? 'bg-[#FF8C42] text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Tracker List */}
      <div className="p-4 space-y-4">
        {filteredTrackers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Progress Trackers</h3>
            <p className="text-gray-500 mb-4">Start tracking pet progress</p>
            <button className="bg-[#FF8C42] text-white px-6 py-2 rounded-lg font-medium">
              <Plus className="w-4 h-4 inline mr-2" />
              New Tracker
            </button>
          </div>
        ) : (
          filteredTrackers.map((tracker) => (
            <div
              key={tracker.id}
              className="bg-white rounded-xl p-4 border border-gray-200 hover:border-[#FF8C42] transition-colors"
              onClick={() => setSelectedTracker(tracker)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#FF8C42]/10 rounded-full flex items-center justify-center text-[#FF8C42]">
                    {getProgramIcon(tracker.programType)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{tracker.petName}</h3>
                    <p className="text-sm text-gray-500">{tracker.customerName}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tracker.status)}`}>
                  {tracker.status}
                </span>
              </div>

              <p className="text-sm font-medium text-gray-800 mb-2">{tracker.programName}</p>
              <p className="text-xs text-gray-500 mb-3">Phase: {tracker.currentPhase}</p>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{tracker.sessionsCompleted}/{tracker.totalSessions} sessions</span>
                  <span>{tracker.completionPercentage}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FF8C42] rounded-full transition-all"
                    style={{ width: `${tracker.completionPercentage}%` }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTracker(tracker);
                    setShowAddNoteModal(true);
                  }}
                  className="flex-1 py-2 bg-[#FF8C42] text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Note
                </button>
                <button
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Note Modal */}
      {showAddNoteModal && selectedTracker && (
        <AddNoteModal
          tracker={selectedTracker}
          onClose={() => setShowAddNoteModal(false)}
          onSubmit={addProgressNote}
        />
      )}
    </div>
  );
}

function AddNoteModal({
  tracker,
  onClose,
  onSubmit
}: {
  tracker: ProgressTracker;
  onClose: () => void;
  onSubmit: (note: { title: string; observations: string; rating: number }) => void;
}) {
  const [formData, setFormData] = useState({
    title: '',
    observations: '',
    rating: 3
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.title || !formData.observations) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    await onSubmit(formData);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white vendor-modal-sheet rounded-t-3xl max-h-[90vh] overflow-y-auto mx-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Progress Note</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#FF8C42]/10 rounded-xl p-3">
            <p className="text-sm text-gray-600">Adding note for</p>
            <p className="font-semibold text-gray-800">{tracker.petName} - Session #{tracker.sessionsCompleted + 1}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              placeholder="Session title..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
            <textarea
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] h-32"
              placeholder="Describe the session progress..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => setFormData({ ...formData, rating })}
                  className={`w-10 h-10 rounded-full ${
                    formData.rating >= rating ? 'bg-[#FF8C42] text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 bg-[#FF8C42] text-white rounded-xl font-semibold disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProgressTrackingDashboard;
