'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  Search, 
  Filter, 
  Calendar,
  Clock,
  User,
  Phone,
  Video,
  MessageSquare,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';

interface Consultation {
  id: string;
  patientName: string;
  petName: string;
  petType: string;
  scheduledTime: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  type: 'in_person' | 'video' | 'phone';
  notes?: string;
  customerPhone: string;
}

interface VendorConsultationScreenProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
  onStartConsultation?: (consultationId: string) => void;
}

export function VendorConsultationScreen({ vendorId, onBack, onStartConsultation }: VendorConsultationScreenProps) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadConsultations();
  }, [vendorId]);

  const loadConsultations = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/consultations`);
      
      if (response.success && response.consultations) {
        setConsultations(response.consultations);
      } else {
        // Use mock data if API fails
        setConsultations([
          {
            id: '1',
            patientName: 'Rahul Sharma',
            petName: 'Bruno',
            petType: 'Dog',
            scheduledTime: new Date().toISOString(),
            status: 'scheduled',
            type: 'video',
            customerPhone: '9876543210'
          },
          {
            id: '2', 
            patientName: 'Priya Patel',
            petName: 'Whiskers',
            petType: 'Cat',
            scheduledTime: new Date(Date.now() + 3600000).toISOString(),
            status: 'scheduled',
            type: 'in_person',
            customerPhone: '9876543211'
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading consultations:', error);
      // Use mock data on error
      setConsultations([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-5 h-5 text-[#FF8C42]" />;
      case 'phone': return <Phone className="w-5 h-5 text-green-600" />;
      default: return <User className="w-5 h-5 text-blue-600" />;
    }
  };

  const filteredConsultations = consultations.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (searchQuery && !c.patientName.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !c.petName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading consultations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-[#FF8C42] text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold">Consultations</h1>
            <p className="text-sm text-white/80">{consultations.length} appointments</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by patient or pet name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white text-gray-800 placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-4 overflow-x-auto">
        {['all', 'scheduled', 'in_progress', 'completed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
              filterStatus === status
                ? 'bg-[#FF8C42] text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {status === 'all' ? 'All' : status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Consultation List */}
      <div className="p-4 space-y-3">
        {filteredConsultations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Consultations</h3>
            <p className="text-gray-500">No consultations match your search criteria</p>
          </div>
        ) : (
          filteredConsultations.map((consultation) => (
            <div
              key={consultation.id}
              className="bg-white rounded-xl p-4 border border-gray-200 hover:border-[#FF8C42] transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {getTypeIcon(consultation.type)}
                  <div>
                    <h3 className="font-semibold text-gray-800">{consultation.patientName}</h3>
                    <p className="text-sm text-gray-500">{consultation.petName} ({consultation.petType})</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(consultation.status)}`}>
                  {consultation.status.replace('_', ' ')}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(consultation.scheduledTime).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{new Date(consultation.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {consultation.status === 'scheduled' && (
                <button
                  onClick={() => onStartConsultation?.(consultation.id)}
                  className="w-full bg-[#FF8C42] text-white py-2 rounded-lg font-medium hover:bg-[#FF7A29] transition-colors flex items-center justify-center gap-2"
                >
                  {consultation.type === 'video' ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                  Start {consultation.type === 'video' ? 'Video Call' : consultation.type === 'phone' ? 'Phone Call' : 'Consultation'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
