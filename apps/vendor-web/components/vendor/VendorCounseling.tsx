'use client';

import { useState, useEffect } from 'react';
import { X, Heart, Calendar, Clock, User, Phone, Video, Plus, Search } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface CounselingProps {
  vendorId: string;
  onClose: () => void;
}

interface CounselingSession {
  id: string;
  customerName: string;
  customerPhone: string;
  sessionType: 'grief' | 'behavior' | 'adoption' | 'end_of_life' | 'general';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  mode: 'in_person' | 'phone' | 'video';
  petName?: string;
  petLossDate?: string;
  concerns: string;
  notes?: string;
  followUpRequired?: boolean;
  createdAt: string;
}

export function VendorCounseling({ vendorId, onClose }: CounselingProps) {
  const [sessions, setSessions] = useState<CounselingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<CounselingSession | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'completed'>('scheduled');

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    sessionType: 'grief' as CounselingSession['sessionType'],
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '10:00',
    duration: 60,
    mode: 'video' as CounselingSession['mode'],
    petName: '',
    petLossDate: '',
    concerns: '',
    notes: ''
  });

  useEffect(() => {
    fetchSessions();
  }, [vendorId, filter]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>(`/vendor/counseling/${vendorId}?status=${filter === 'all' ? '' : filter}`);
      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      alert('Failed to load counseling sessions');
    } finally {
      setLoading(false);
    }
  };

  const saveSession = async () => {
    try {
      const endpoint = `/vendor/counseling/${vendorId}${selectedSession ? `/${selectedSession.id}` : ''}`;
      const data = selectedSession
        ? await apiClient.put<any>(endpoint, formData)
        : await apiClient.post<any>(endpoint, formData);
      
      if (data.success) {
        alert(`Session ${selectedSession ? 'updated' : 'scheduled'} successfully`);
        setShowCreateModal(false);
        setSelectedSession(null);
        resetForm();
        fetchSessions();
      } else {
        alert(data.error || 'Failed to save session');
      }
    } catch (error) {
      console.error('Error saving session:', error);
      alert('Failed to save session');
    }
  };

  const updateSessionStatus = async (sessionId: string, status: string) => {
    try {
      const data = await apiClient.put<any>(`/vendor/counseling/${vendorId}/${sessionId}/status`, { status });
      if (data.success) {
        alert('Session status updated');
        fetchSessions();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      sessionType: 'grief',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '10:00',
      duration: 60,
      mode: 'video',
      petName: '',
      petLossDate: '',
      concerns: '',
      notes: ''
    });
  };

  const filteredSessions = sessions.filter(s => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        s.customerName.toLowerCase().includes(query) ||
        s.petName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const stats = {
    scheduled: sessions.filter(s => s.status === 'scheduled').length,
    completed: sessions.filter(s => s.status === 'completed').length,
    total: sessions.length
  };

  const getSessionTypeColor = (type: string) => {
    switch (type) {
      case 'grief': return 'bg-purple-100 text-purple-700';
      case 'behavior': return 'bg-blue-100 text-blue-700';
      case 'adoption': return 'bg-green-100 text-green-700';
      case 'end_of_life': return 'bg-pink-100 text-pink-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Heart className="w-7 h-7 text-purple-600" />
                Pet Counseling Services
              </h2>
              <p className="text-sm text-gray-600 mt-1">Grief support, behavior counseling & guidance</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-600">Total Sessions</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-200">
              <div className="text-2xl font-bold text-purple-700">{stats.scheduled}</div>
              <div className="text-xs text-purple-700">Scheduled</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
              <div className="text-2xl font-bold text-green-700">{stats.completed}</div>
              <div className="text-xs text-green-700">Completed</div>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-3 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer or pet name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Session
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'all' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('scheduled')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'scheduled' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Scheduled ({stats.scheduled})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'completed' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Completed
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-gray-600">Loading sessions...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No counseling sessions found</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                Schedule First Session
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-purple-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                        <Heart className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{session.customerName}</h3>
                        {session.petName && (
                          <div className="text-sm text-gray-600 mt-1">Pet: {session.petName}</div>
                        )}
                        <div className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${getSessionTypeColor(session.sessionType)}`}>
                          {session.sessionType.replace('_', ' ').toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      session.status === 'completed' ? 'bg-green-100 text-green-700' :
                      session.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      session.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {session.status.replace('_', ' ').toUpperCase()}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Date
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {new Date(session.scheduledDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Time
                      </div>
                      <div className="text-sm font-medium text-gray-900">{session.scheduledTime}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-600 mb-1">Mode</div>
                      <div className="text-sm font-medium text-gray-900 capitalize flex items-center gap-1">
                        {session.mode === 'video' && <Video className="w-3 h-3" />}
                        {session.mode === 'phone' && <Phone className="w-3 h-3" />}
                        {session.mode === 'in_person' && <User className="w-3 h-3" />}
                        {session.mode.replace('_', ' ')}
                      </div>
                    </div>
                  </div>

                  {session.concerns && (
                    <div className="bg-purple-50 rounded-lg p-3 mb-3">
                      <div className="text-xs font-medium text-purple-700 mb-1">Concerns:</div>
                      <div className="text-sm text-gray-700">{session.concerns}</div>
                    </div>
                  )}

                  {session.petLossDate && (
                    <div className="text-xs text-gray-500 mb-3">
                      Loss Date: {new Date(session.petLossDate).toLocaleDateString()}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {session.status === 'scheduled' && (
                      <>
                        <button
                          onClick={() => updateSessionStatus(session.id, 'in_progress')}
                          className="flex-1 py-2 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors"
                        >
                          Start Session
                        </button>
                        {session.mode === 'video' && (
                          <a
                            href={`https://meet.jit.si/warmpawz-counseling-${session.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <Video className="w-4 h-4" />
                            Join Video
                          </a>
                        )}
                        {session.mode === 'phone' && (
                          <a
                            href={`tel:${session.customerPhone}`}
                            className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <Phone className="w-4 h-4" />
                            Call
                          </a>
                        )}
                      </>
                    )}
                    {session.status === 'in_progress' && (
                      <button
                        onClick={() => updateSessionStatus(session.id, 'completed')}
                        className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Complete Session
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showCreateModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Schedule Counseling Session
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Session Type</label>
                  <select
                    value={formData.sessionType}
                    onChange={(e) => setFormData({ ...formData, sessionType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="grief">Grief Counseling</option>
                    <option value="behavior">Behavior Issues</option>
                    <option value="adoption">Adoption Support</option>
                    <option value="end_of_life">End of Life</option>
                    <option value="general">General Guidance</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={formData.scheduledDate}
                      onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                    <input
                      type="time"
                      value={formData.scheduledTime}
                      onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                  <select
                    value={formData.mode}
                    onChange={(e) => setFormData({ ...formData, mode: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="video">Video Call</option>
                    <option value="phone">Phone Call</option>
                    <option value="in_person">In Person</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pet Name (Optional)</label>
                  <input
                    type="text"
                    value={formData.petName}
                    onChange={(e) => setFormData({ ...formData, petName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Max"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Concerns/Notes</label>
                  <textarea
                    value={formData.concerns}
                    onChange={(e) => setFormData({ ...formData, concerns: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={3}
                    placeholder="What would you like to discuss?"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSession}
                  className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                >
                  Schedule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

