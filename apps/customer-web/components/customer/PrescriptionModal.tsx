"use client";

import { useState, useEffect } from 'react';
import { X, FileText, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface PrescriptionModalProps {
  prescriptionId?: string;
  bookingId?: string;
  prescription?: any;
  onClose: () => void;
  readOnly?: boolean;
  onReorderMedicine?: (medications: any[]) => void;
}

interface Prescription {
  id: string;
  bookingId: string;
  diagnosis?: string;
  observations?: string;
  medications?: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }>;
  generalNotes?: string;
  recommendations?: string;
  createdAt: string;
}

export function PrescriptionModal({ prescriptionId, bookingId, prescription: propPrescription, onClose, readOnly = false, onReorderMedicine }: PrescriptionModalProps) {
  const [prescription, setPrescription] = useState<Prescription | null>(propPrescription || null);
  const [loading, setLoading] = useState(!propPrescription);

  useEffect(() => {
    if (propPrescription) {
      setPrescription(propPrescription);
      setLoading(false);
    } else if (prescriptionId || bookingId) {
      loadPrescription();
    }
  }, [prescriptionId, bookingId, propPrescription]);

  const loadPrescription = async () => {
    try {
      setLoading(true);
      // Placeholder - implement actual API call
      // const data = await apiClient.get(`/prescriptions/${prescriptionId || bookingId}`);
      // setPrescription(data);
    } catch (error) {
      console.error('Error loading prescription:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8">
          <p>Loading prescription...</p>
        </div>
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Prescription</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-500">No prescription found</p>
          <Button onClick={onClose} className="mt-4 w-full">Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Prescription</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {prescription.diagnosis && (
            <div>
              <h3 className="font-semibold mb-2">Diagnosis</h3>
              <p className="text-gray-700">{prescription.diagnosis}</p>
            </div>
          )}

          {prescription.observations && (
            <div>
              <h3 className="font-semibold mb-2">Observations</h3>
              <p className="text-gray-700">{prescription.observations}</p>
            </div>
          )}

          {prescription.medications && prescription.medications.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Medications</h3>
              <div className="space-y-3">
                {prescription.medications.map((med, idx) => (
                  <div key={idx} className="border rounded-lg p-3">
                    <p className="font-medium">{med.name}</p>
                    <p className="text-sm text-gray-600">Dosage: {med.dosage}</p>
                    <p className="text-sm text-gray-600">Frequency: {med.frequency}</p>
                    <p className="text-sm text-gray-600">Duration: {med.duration}</p>
                    {med.instructions && (
                      <p className="text-sm text-gray-600 mt-1">Instructions: {med.instructions}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {prescription.recommendations && (
            <div>
              <h3 className="font-semibold mb-2">Recommendations</h3>
              <p className="text-gray-700">{prescription.recommendations}</p>
            </div>
          )}

          {prescription.generalNotes && (
            <div>
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-gray-700">{prescription.generalNotes}</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {!readOnly && (
            <>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button variant="outline">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

