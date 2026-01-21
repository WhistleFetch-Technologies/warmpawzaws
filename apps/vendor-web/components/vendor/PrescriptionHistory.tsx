"use client";

import { useState, useEffect } from 'react';
import { Pill, Search, Calendar, User, Eye, Download, ChevronRight, Loader2, FileText } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Prescription {
  id: string;
  booking_id: string;
  customer_id: string;
  pet_id: string;
  vendor_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  prescription_date: string;
  created_at: string;
  // Joined fields
  booking_date?: string;
  booking_time?: string;
  customer_name?: string;
  customer_phone?: string;
  pet_name?: string;
  pet_breed?: string;
  pet_species?: string;
}

interface PrescriptionHistoryProps {
  vendorId: string;
  vendorName?: string;
  onViewDetails?: (prescription: Prescription) => void;
}

export function PrescriptionHistory({ vendorId, vendorName, onViewDetails }: PrescriptionHistoryProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  useEffect(() => {
    loadPrescriptions();
  }, [vendorId]);

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/prescriptions/vendor/${vendorId}`) as any;
      if (response.success) {
        setPrescriptions(response.prescriptions || []);
      }
    } catch (error) {
      console.error('Error loading prescriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPrescriptions = prescriptions.filter(p => {
    const search = searchTerm.toLowerCase();
    return (
      p.medication_name?.toLowerCase().includes(search) ||
      p.customer_name?.toLowerCase().includes(search) ||
      p.pet_name?.toLowerCase().includes(search)
    );
  });

  // Group prescriptions by date
  const groupedPrescriptions = filteredPrescriptions.reduce((groups: Record<string, Prescription[]>, prescription) => {
    const date = prescription.prescription_date || prescription.created_at?.split('T')[0] || 'Unknown';
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(prescription);
    return groups;
  }, {});

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Prescription Records</h1>
            <p className="text-sm text-white/80">{prescriptions.length} total prescriptions</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by medicine, patient, or pet..."
            className="w-full pl-10 pr-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
          />
        </div>
      </div>

      {/* Prescription List */}
      <div className="p-4">
        {filteredPrescriptions.length === 0 ? (
          <div className="text-center py-12">
            <Pill className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Prescriptions Found</h3>
            <p className="text-gray-500 text-sm">
              {searchTerm ? 'Try a different search term' : 'Prescriptions you create will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedPrescriptions).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-600">{formatDate(date)}</h3>
                  <span className="text-xs text-gray-400">({items.length})</span>
                </div>

                <div className="space-y-3">
                  {items.map((prescription) => (
                    <div
                      key={prescription.id}
                      onClick={() => setSelectedPrescription(prescription)}
                      className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 active:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Pill className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {prescription.medication_name || 'Prescription'}
                            </h4>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                              <User className="w-3 h-3" />
                              <span>{prescription.customer_name || 'Customer'}</span>
                              <span>•</span>
                              <span>🐾 {prescription.pet_name || 'Pet'}</span>
                            </div>
                            {prescription.dosage && (
                              <p className="text-xs text-gray-400 mt-1">
                                {prescription.dosage} • {prescription.frequency} • {prescription.duration}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prescription Detail Modal */}
      {selectedPrescription && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 sm:rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold">Prescription Details</h3>
                    <p className="text-sm text-white/80">
                      {formatDate(selectedPrescription.prescription_date || selectedPrescription.created_at)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPrescription(null)}
                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {/* Patient Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Patient Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Pet Name:</span>
                    <span className="ml-2 font-medium">{selectedPrescription.pet_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Species:</span>
                    <span className="ml-2 font-medium">{selectedPrescription.pet_species || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Owner:</span>
                    <span className="ml-2 font-medium">{selectedPrescription.customer_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Phone:</span>
                    <span className="ml-2 font-medium">{selectedPrescription.customer_phone || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Medication Details */}
              <div className="bg-purple-50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
                  <Pill className="w-4 h-4" />
                  Medication
                </h4>
                <p className="font-semibold text-gray-900 mb-3">
                  {selectedPrescription.medication_name}
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-xs text-gray-500">Dosage</p>
                    <p className="text-sm font-medium">{selectedPrescription.dosage || '-'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-xs text-gray-500">Frequency</p>
                    <p className="text-sm font-medium">{selectedPrescription.frequency || '-'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-xs text-gray-500">Duration</p>
                    <p className="text-sm font-medium">{selectedPrescription.duration || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              {selectedPrescription.instructions && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-blue-700 mb-2">Instructions</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedPrescription.instructions}
                  </p>
                </div>
              )}

              {/* Booking Reference */}
              {selectedPrescription.booking_id && (
                <div className="text-center text-xs text-gray-400">
                  Booking ID: {selectedPrescription.booking_id.slice(0, 8)}...
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => setSelectedPrescription(null)}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
