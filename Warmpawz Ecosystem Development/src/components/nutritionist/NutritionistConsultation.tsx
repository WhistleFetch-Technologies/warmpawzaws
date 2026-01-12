import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Video, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

/**
 * 🥗 NUTRITIONIST CONSULTATION COMPONENT
 * 
 * Phase 7B: Critical Services - Rule 8 Implementation
 * 
 * Features:
 * - Book nutritionist consultation
 * - View upcoming consultations
 * - Join video call
 * - View consultation notes & recommendations
 */

interface Consultation {
  consultationId: string;
  customerId: string;
  nutritionistId: string;
  petId: string;
  consultationType: 'initial' | 'follow_up' | 'emergency';
  scheduledAt: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  recommendations?: string;
  videoCallUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface NutritionistConsultationProps {
  customerId: string;
  petId?: string;
}

export default function NutritionistConsultation({ customerId, petId }: NutritionistConsultationProps) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    petId: petId || '',
    nutritionistId: '',
    consultationType: 'initial' as 'initial' | 'follow_up' | 'emergency',
    scheduledAt: '',
  });

  useEffect(() => {
    fetchConsultations();
  }, [customerId]);

  const fetchConsultations = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${customerId}/consultations`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setConsultations(data.data.consultations || []);
      }
    } catch (error) {
      console.error('Error fetching consultations:', error);
    } finally {
      setLoading(false);
    }
  };

  const bookConsultation = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/nutritionist/consultation/book`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            customerId,
            ...formData,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        alert('Consultation booked successfully!');
        setShowBookingForm(false);
        fetchConsultations();
        // Reset form
        setFormData({
          petId: petId || '',
          nutritionistId: '',
          consultationType: 'initial',
          scheduledAt: '',
        });
      } else {
        alert('Failed to book consultation: ' + data.error);
      }
    } catch (error) {
      console.error('Error booking consultation:', error);
      alert('Failed to book consultation');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'in_progress':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-gray-900 mb-2">Nutritionist Consultations</h1>
            <p className="text-gray-600">Book and manage your pet's nutritionist consultations</p>
          </div>
          <button
            onClick={() => setShowBookingForm(true)}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors"
          >
            Book Consultation
          </button>
        </div>

        {/* Booking Form Modal */}
        {showBookingForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-gray-900 mb-4">Book Nutritionist Consultation</h2>
              <form onSubmit={bookConsultation} className="space-y-4">
                <div>
                  <label className="block text-gray-700 mb-2">Pet ID</label>
                  <input
                    type="text"
                    value={formData.petId}
                    onChange={(e) => setFormData({ ...formData, petId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Nutritionist ID</label>
                  <input
                    type="text"
                    value={formData.nutritionistId}
                    onChange={(e) => setFormData({ ...formData, nutritionistId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Consultation Type</label>
                  <select
                    value={formData.consultationType}
                    onChange={(e) => setFormData({ ...formData, consultationType: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  >
                    <option value="initial">Initial Consultation</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Scheduled Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    Book Consultation
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBookingForm(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Consultations List */}
        {consultations.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-900 mb-2">No Consultations Yet</h3>
            <p className="text-gray-600 mb-6">Book your first nutritionist consultation to get started</p>
            <button
              onClick={() => setShowBookingForm(true)}
              className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors"
            >
              Book Now
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {consultations.map((consultation) => (
              <div
                key={consultation.consultationId}
                className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedConsultation(consultation)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {getStatusIcon(consultation.status)}
                      <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(consultation.status)}`}>
                        {consultation.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-gray-500 text-sm">
                        {consultation.consultationType.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-6 text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(consultation.scheduledAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{new Date(consultation.scheduledAt).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {consultation.notes && (
                      <div className="mt-4 bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-gray-600" />
                          <span className="text-gray-700">Notes</span>
                        </div>
                        <p className="text-gray-600 text-sm">{consultation.notes}</p>
                      </div>
                    )}

                    {consultation.recommendations && (
                      <div className="mt-3 bg-green-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-green-700">Recommendations</span>
                        </div>
                        <p className="text-green-600 text-sm">{consultation.recommendations}</p>
                      </div>
                    )}
                  </div>

                  {consultation.videoCallUrl && consultation.status === 'scheduled' && (
                    <a
                      href={consultation.videoCallUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Video className="w-4 h-4" />
                      Join Call
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Consultation Details Modal */}
        {selectedConsultation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-gray-900 mb-2">Consultation Details</h2>
                  <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(selectedConsultation.status)}`}>
                    {selectedConsultation.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedConsultation(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-600 mb-1">Consultation Type</label>
                  <p className="text-gray-900">{selectedConsultation.consultationType.replace('_', ' ')}</p>
                </div>

                <div>
                  <label className="block text-gray-600 mb-1">Scheduled At</label>
                  <p className="text-gray-900">
                    {new Date(selectedConsultation.scheduledAt).toLocaleString()}
                  </p>
                </div>

                {selectedConsultation.notes && (
                  <div>
                    <label className="block text-gray-600 mb-1">Notes</label>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-900">{selectedConsultation.notes}</p>
                    </div>
                  </div>
                )}

                {selectedConsultation.recommendations && (
                  <div>
                    <label className="block text-gray-600 mb-1">Recommendations</label>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-green-800">{selectedConsultation.recommendations}</p>
                    </div>
                  </div>
                )}

                {selectedConsultation.videoCallUrl && (
                  <div>
                    <a
                      href={selectedConsultation.videoCallUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Video className="w-5 h-5" />
                      Join Video Call
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
