import { useState, useEffect } from 'react';
import { ArrowLeft, MessageCircle, Calendar, Clock, User, Phone, Search } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

interface CounselingSession {
  id: string;
  sessionType: 'individual' | 'group' | 'workshop';
  title: string;
  description: string;
  duration: number;
  price: number;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  status: 'available' | 'scheduled' | 'booked' | 'completed' | 'cancelled';
  maxParticipants?: number;
  currentParticipants?: number;
  topics?: string[];
}

interface CounselingBookingViewProps {
  vendorId: string;
  vendorName?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  onBack: () => void;
  onSuccess?: () => void;
}

export function CounselingBookingView({ 
  vendorId, 
  vendorName, 
  customerId, 
  customerName, 
  customerPhone, 
  onBack, 
  onSuccess 
}: CounselingBookingViewProps) {
  const [sessions, setSessions] = useState<CounselingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<CounselingSession | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingData, setBookingData] = useState({
    petId: '',
    petName: '',
    concerns: '',
    preferredDate: '',
    preferredTime: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadSessions();
  }, [vendorId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/customer/counseling/${vendorId}/sessions`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        const sessionsList = data.sessions || data.data?.sessions || [];
        setSessions(sessionsList);
        console.log('✅ Loaded counseling sessions:', sessionsList.length);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load sessions:', errorData);
        setSessions([]);
      }
    } catch (error: any) {
      console.error('Error loading sessions:', error);
      const errorMessage = error?.message || 'Failed to load counseling sessions';
      toast.error(errorMessage);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async () => {
    if (!selectedSession) return;

    if (!customerId || !customerName || !customerPhone) {
      toast.error('Customer information is required');
      return;
    }

    if (!bookingData.petName || !bookingData.concerns) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        `${API_BASE}/customer/counseling/${vendorId}/book`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId: selectedSession.id,
            customerId,
            customerName,
            customerPhone,
            petId: bookingData.petId,
            petName: bookingData.petName,
            concerns: bookingData.concerns,
            preferredDate: bookingData.preferredDate || selectedSession.scheduledDate,
            preferredTime: bookingData.preferredTime || selectedSession.startTime
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('Counseling session booked successfully!');
          setShowBookingForm(false);
          setSelectedSession(null);
          setBookingData({
            petId: '',
            petName: '',
            concerns: '',
            preferredDate: '',
            preferredTime: ''
          });
          await loadSessions(); // Reload to update availability
          if (onSuccess) onSuccess();
        } else {
          const errorMessage = data.error || data.message || 'Failed to book session';
          toast.error(errorMessage);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || 'Failed to book session';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error booking session:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSessions = sessions.filter(session =>
    !searchQuery ||
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (showBookingForm && selectedSession) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
        <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
          <div className="px-4 py-3 flex items-center gap-3">
            <button 
              onClick={() => {
                setShowBookingForm(false);
                setSelectedSession(null);
              }} 
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-semibold text-lg">Book Session</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Session Info */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <h2 className="font-semibold text-lg mb-2">{selectedSession.title}</h2>
            <p className="text-sm text-gray-600 mb-3">{selectedSession.description}</p>
            
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{selectedSession.duration} mins</span>
              </div>
              {selectedSession.price > 0 && (
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-blue-600">₹{selectedSession.price}</span>
                </div>
              )}
            </div>
          </div>

          {/* Booking Form */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-4">
            <div>
              <Label htmlFor="petName">Pet Name *</Label>
              <Input
                id="petName"
                value={bookingData.petName}
                onChange={(e) => setBookingData({ ...bookingData, petName: e.target.value })}
                placeholder="Enter pet name"
              />
            </div>

            <div>
              <Label htmlFor="concerns">Concerns / Topics to Discuss *</Label>
              <Textarea
                id="concerns"
                value={bookingData.concerns}
                onChange={(e) => setBookingData({ ...bookingData, concerns: e.target.value })}
                placeholder="Describe your concerns or topics you'd like to discuss..."
                rows={4}
              />
            </div>

            {!selectedSession.scheduledDate && (
              <>
                <div>
                  <Label htmlFor="preferredDate">Preferred Date</Label>
                  <Input
                    id="preferredDate"
                    type="date"
                    value={bookingData.preferredDate}
                    onChange={(e) => setBookingData({ ...bookingData, preferredDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <Label htmlFor="preferredTime">Preferred Time</Label>
                  <Input
                    id="preferredTime"
                    type="time"
                    value={bookingData.preferredTime}
                    onChange={(e) => setBookingData({ ...bookingData, preferredTime: e.target.value })}
                  />
                </div>
              </>
            )}

            <Button
              onClick={handleBook}
              disabled={submitting || !bookingData.petName || !bookingData.concerns}
              className="w-full bg-blue-500 hover:bg-blue-600"
              size="lg"
            >
              {submitting ? 'Booking...' : 'Book Session'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Counseling Sessions</h1>
            {vendorName && <p className="text-sm text-gray-600">{vendorName}</p>}
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="p-4 space-y-3">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No counseling sessions available</p>
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              className="bg-white rounded-xl p-4 border border-gray-200"
            >
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-lg">{session.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{session.description}</p>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{session.duration} mins</span>
                  </div>
                  {session.scheduledDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(session.scheduledDate)}</span>
                    </div>
                  )}
                  {session.price > 0 && (
                    <div className="font-semibold text-blue-600">
                      ₹{session.price}
                    </div>
                  )}
                </div>

                {session.topics && session.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {session.topics.map((topic, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}

                {session.maxParticipants && (
                  <div className="text-xs text-gray-500">
                    {session.currentParticipants || 0} / {session.maxParticipants} participants
                  </div>
                )}

                <Button
                  onClick={() => {
                    setSelectedSession(session);
                    setShowBookingForm(true);
                  }}
                  disabled={session.status !== 'available'}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {session.status === 'available' ? 'Book Session' : 'Not Available'}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

