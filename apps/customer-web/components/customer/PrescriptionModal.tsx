"use client";

import { useState, useEffect } from 'react';
import { X, FileText, Download, Share2, ShoppingCart, Pill, Clock, Calendar, User, CheckCircle, Loader2, ExternalLink, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { transformPrescriptionData } from './PrescriptionDocument';

// Dynamically import PrescriptionDocument for code splitting
const PrescriptionDocument = dynamic(() => import('./PrescriptionDocument'), {
  loading: () => <div className="flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" /></div>,
  ssr: false
});

interface PrescriptionModalProps {
  prescriptionId?: string;
  bookingId?: string;
  prescription?: any;
  onClose: () => void;
  readOnly?: boolean;
  customerPhone?: string;
  onReorderMedicine?: (medications: any[], prescriptionId?: string, bookingId?: string) => void;
}

interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

interface Prescription {
  id: string;
  booking_id?: string;
  bookingId?: string;
  customer_id?: string;
  pet_id?: string;
  vendor_id?: string;
  diagnosis?: string;
  observations?: string;
  medication_name?: string;
  medications?: Medication[];
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  generalNotes?: string;
  recommendations?: string;
  prescription_date?: string;
  created_at?: string;
  createdAt?: string;
  // Joined fields
  vendor_name?: string;
  pet_name?: string;
  booking_date?: string;
}

export function PrescriptionModal({ 
  prescriptionId, 
  bookingId, 
  prescription: propPrescription, 
  onClose, 
  readOnly = false, 
  customerPhone,
  onReorderMedicine 
}: PrescriptionModalProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [fullPrescriptionData, setFullPrescriptionData] = useState<any>(null);
  const [loading, setLoading] = useState(!propPrescription);
  const [sharing, setSharing] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [showFullDocument, setShowFullDocument] = useState(false);

  useEffect(() => {
    if (propPrescription) {
      // Single prescription passed as prop
      setPrescriptions(Array.isArray(propPrescription) ? propPrescription : [propPrescription]);
      setLoading(false);
    } else if (prescriptionId || bookingId) {
      loadPrescriptions();
    }
  }, [prescriptionId, bookingId, propPrescription]);

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      let response;
      
      if (bookingId) {
        // Load prescriptions for booking with full details
        response = await apiClient.get(`/prescriptions/booking/${bookingId}?includeDetails=true`) as any;
        setPrescriptions(response.prescriptions || []);
        
        // Store full data for document view
        if (response.prescriptions?.length > 0) {
          setFullPrescriptionData(response);
        }
      } else if (prescriptionId) {
        response = await apiClient.get(`/prescriptions/${prescriptionId}?includeDetails=true`) as any;
        setPrescriptions(response.prescription ? [response.prescription] : []);
        
        // Store full data for document view
        if (response.prescription) {
          setFullPrescriptionData(response);
        }
      }
    } catch (error) {
      console.error('Error loading prescription:', error);
      setPrescriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const shareText = prescriptions.map(p => {
        return `
Prescription for ${p.pet_name || 'Pet'}
Date: ${formatDate(p.prescription_date || p.created_at || '')}
Medicine: ${p.medication_name || 'N/A'}
Dosage: ${p.dosage || 'N/A'}
Frequency: ${p.frequency || 'N/A'}
Duration: ${p.duration || 'N/A'}
Instructions: ${p.instructions || 'N/A'}
        `.trim();
      }).join('\n\n---\n\n');

      if (navigator.share) {
        await navigator.share({
          title: 'Prescription',
          text: shareText,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        toast.success('Prescription copied to clipboard');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    } finally {
      setSharing(false);
    }
  };

  const handleOrderMedicine = async () => {
    setOrdering(true);
    try {
      const prescriptionIdToUse = prescriptionId || prescriptions[0]?.id;
      const medications = prescriptions.map((p: Prescription) => ({
        name: p.medication_name,
        dosage: p.dosage,
        frequency: p.frequency,
        duration: p.duration,
      }));

      // Prefer in-app flow via callback (My Bookings → pharmacy_order_flow with address selection)
      if (onReorderMedicine && prescriptionIdToUse) {
        onReorderMedicine(medications, prescriptionIdToUse, bookingId);
        onClose();
        return;
      }

      // Standalone page: include phone in URL so address flow works
      if (prescriptionIdToUse) {
        const phoneParam = customerPhone ? `?phone=${encodeURIComponent(customerPhone)}` : '';
        window.location.href = `/prescriptions/${prescriptionIdToUse}/order${phoneParam}`;
      } else {
        toast.error('Unable to order medicine. Please try again from your booking details.');
      }
    } catch (error) {
      console.error('Error ordering medicine:', error);
      toast.error('Failed to order medicines');
    } finally {
      setOrdering(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
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
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42] mb-4" />
          <p className="text-gray-600">Loading prescription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex flex-col sm:items-center sm:justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl mt-auto sm:mt-0 max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B1A] text-white p-5 sm:rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Prescription</h3>
                <p className="text-sm text-white/80">
                  {prescriptions.length} medication{prescriptions.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          {prescriptions.length === 0 ? (
            <div className="text-center py-12">
              <Pill className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Prescription</h3>
              <p className="text-gray-500 text-sm">
                The vet hasn't added a prescription for this visit yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Date & Clinic Info */}
              {prescriptions[0] && (
                <div className="bg-white rounded-xl p-4 flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Prescribed on</p>
                    <p className="font-medium">
                      {formatDate(prescriptions[0].prescription_date || prescriptions[0].created_at || '')}
                    </p>
                  </div>
                </div>
              )}

              {/* Medications List */}
              {prescriptions.map((prescription, index) => {
                // Extract medication details from either top-level fields or medications JSONB array
                const medications = prescription.medications;
                // Ensure medData is a single Medication object or null (not an array)
                const medData: Medication | null = Array.isArray(medications) && medications.length > 0 
                  ? medications[0] 
                  : null;
                
                // Get values from medications array first, fallback to top-level fields
                const dosage = prescription.dosage || medData?.dosage || '-';
                const frequency = prescription.frequency || medData?.frequency || '-';
                const duration = prescription.duration || medData?.duration || '-';
                const instructions = prescription.instructions || medData?.instructions || prescription.diagnosis;
                const medicationName = prescription.medication_name || medData?.name || 'Medication';
                
                return (
                  <div key={prescription.id || index} className="bg-white rounded-xl p-4 space-y-3 border-l-4 border-[#FF8C42]">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Pill className="w-5 h-5 text-[#FF8C42]" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-lg">
                          {medicationName}
                        </h4>
                        
                        {/* Dosage Info Grid */}
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          <div className="bg-blue-50 rounded-lg p-2 text-center">
                            <p className="text-xs text-blue-600 font-medium">Dosage</p>
                            <p className="text-sm text-gray-900 font-medium">
                              {dosage}
                            </p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-2 text-center">
                            <p className="text-xs text-green-600 font-medium">Frequency</p>
                            <p className="text-sm text-gray-900 font-medium">
                              {frequency}
                            </p>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-2 text-center">
                            <p className="text-xs text-purple-600 font-medium">Duration</p>
                            <p className="text-sm text-gray-900 font-medium">
                              {duration}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Instructions */}
                    {instructions && (
                      <div className="bg-amber-50 rounded-lg p-3 mt-3">
                        <p className="text-xs text-amber-700 font-medium mb-1">Instructions</p>
                        <p className="text-sm text-gray-700">{instructions}</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* General Notes */}
              {prescriptions[0]?.generalNotes && (
                <div className="bg-white rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Additional Notes</h4>
                  <p className="text-sm text-gray-600">{prescriptions[0].generalNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {prescriptions.length > 0 && (
          <div className="bg-white border-t border-gray-100 p-4 space-y-3">
            {/* View Full Prescription Button */}
            <button
              onClick={() => setShowFullDocument(true)}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              <Eye className="w-5 h-5" />
              View Full Prescription (A4)
            </button>

            {/* Order Medicine Button */}
            <button
              onClick={handleOrderMedicine}
              disabled={ordering}
              className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg"
            >
              {ordering ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ShoppingCart className="w-5 h-5" />
              )}
              Order Medicine from Pharmacy
            </button>

            {/* Secondary Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleShare}
                disabled={sharing}
                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {sharing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                Share
              </button>
              <button
                onClick={() => setShowFullDocument(true)}
                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Print/PDF
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full Prescription Document Modal */}
      {showFullDocument && prescriptions.length > 0 && (
        <PrescriptionDocument
          prescription={transformPrescriptionData({
            ...prescriptions[0],
            ...fullPrescriptionData,
            // Combine all medications from all prescriptions into one
            medications: prescriptions.flatMap(p => {
              if (p.medications && Array.isArray(p.medications)) {
                return p.medications;
              }
              if (p.medication_name) {
                return [{
                  name: p.medication_name,
                  dosage: p.dosage,
                  frequency: p.frequency,
                  duration: p.duration,
                  instructions: p.instructions
                }];
              }
              return [];
            })
          })}
          onClose={() => setShowFullDocument(false)}
          onOrderMedicine={handleOrderMedicine}
        />
      )}
    </div>
  );
}
