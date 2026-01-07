'use client';

import { useState, useEffect } from 'react';
import { X, FileText, Calendar, AlertCircle, Pill, Activity } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface PetMedicalHistoryModalProps {
  petId: string;
  petName: string;
  onClose: () => void;
}

interface Prescription {
  id: string;
  bookingId: string;
  vendorName: string;
  vendorType: string;
  serviceName: string;
  diagnosis?: string;
  observations?: string;
  medications?: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }>;
  productsUsed?: Array<{
    name: string;
    quantity: string;
    notes: string;
  }>;
  testsRecommended?: Array<{
    testName: string;
    reason: string;
    priority: string;
  }>;
  generalNotes: string;
  recommendations: string;
  vitals?: {
    weight?: number;
    temperature?: number;
    heartRate?: number;
    respiratoryRate?: number;
    bloodPressure?: string;
  };
  createdAt: string;
}

export function PetMedicalHistoryModal({ petId, petName, onClose }: PetMedicalHistoryModalProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  useEffect(() => {
    loadMedicalHistory();
  }, [petId]);

  const loadMedicalHistory = async () => {
    try {
      setLoading(true);
      const result = await apiClient.get<any>(`/prescription/pet/${petId}`);
      console.log('✅ [MEDICAL-HISTORY] Loaded:', result.prescriptions?.length || 0, 'records');
      setPrescriptions(result.prescriptions || []);
    } catch (error) {
      console.error('❌ [MEDICAL-HISTORY] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (selectedPrescription) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-white w-full max-w-[430px] rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-[32px] z-10">
            <button
              onClick={() => setSelectedPrescription(null)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <span>←</span>
              <span>Back to History</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="p-6 space-y-6 pb-24">
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-2xl">
                    {selectedPrescription.vendorType === 'vet' ? '⚕️' : '📋'}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">{selectedPrescription.vendorName}</h3>
                  <p className="text-sm text-gray-600">{selectedPrescription.serviceName}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Date: <span className="font-semibold text-gray-800">{formatDate(selectedPrescription.createdAt)}</span>
              </p>
            </div>

            {selectedPrescription.vitals && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-orange-500" />
                  Vitals
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {selectedPrescription.vitals.weight && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-600 mb-1">Weight</p>
                      <p className="font-semibold text-gray-800">{selectedPrescription.vitals.weight} kg</p>
                    </div>
                  )}
                  {selectedPrescription.vitals.temperature && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-600 mb-1">Temperature</p>
                      <p className="font-semibold text-gray-800">{selectedPrescription.vitals.temperature}°F</p>
                    </div>
                  )}
                  {selectedPrescription.vitals.heartRate && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-600 mb-1">Heart Rate</p>
                      <p className="font-semibold text-gray-800">{selectedPrescription.vitals.heartRate} bpm</p>
                    </div>
                  )}
                  {selectedPrescription.vitals.respiratoryRate && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-600 mb-1">Respiratory Rate</p>
                      <p className="font-semibold text-gray-800">{selectedPrescription.vitals.respiratoryRate} /min</p>
                    </div>
                  )}
                </div>
                {selectedPrescription.vitals.bloodPressure && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-600 mb-1">Blood Pressure</p>
                    <p className="font-semibold text-gray-800">{selectedPrescription.vitals.bloodPressure}</p>
                  </div>
                )}
              </div>
            )}

            {selectedPrescription.diagnosis && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  Diagnosis
                </h3>
                <p className="text-gray-700">{selectedPrescription.diagnosis}</p>
              </div>
            )}

            {selectedPrescription.observations && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800">Observations</h3>
                <p className="text-gray-700">{selectedPrescription.observations}</p>
              </div>
            )}

            {selectedPrescription.medications && selectedPrescription.medications.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-orange-500" />
                  Medications
                </h3>
                {selectedPrescription.medications.map((med, idx) => (
                  <div key={idx} className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-800 mb-2">{idx + 1}. {med.name}</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-600">Dosage:</span> <span className="font-medium text-gray-800">{med.dosage}</span></p>
                      <p><span className="text-gray-600">Frequency:</span> <span className="font-medium text-gray-800">{med.frequency}</span></p>
                      <p><span className="text-gray-600">Duration:</span> <span className="font-medium text-gray-800">{med.duration}</span></p>
                      {med.instructions && (
                        <p className="text-gray-700 mt-2 italic">{med.instructions}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedPrescription.productsUsed && selectedPrescription.productsUsed.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800">Products Used</h3>
                {selectedPrescription.productsUsed.map((prod, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-3">
                    <h4 className="font-semibold text-gray-800">{idx + 1}. {prod.name}</h4>
                    <p className="text-sm text-gray-600">Quantity: {prod.quantity}</p>
                    {prod.notes && <p className="text-sm text-gray-700 mt-1">{prod.notes}</p>}
                  </div>
                ))}
              </div>
            )}

            {selectedPrescription.testsRecommended && selectedPrescription.testsRecommended.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800">Tests Recommended</h3>
                {selectedPrescription.testsRecommended.map((test, idx) => (
                  <div key={idx} className={`rounded-xl p-3 border-2 ${
                    test.priority === 'urgent' ? 'bg-red-50 border-red-300' :
                    test.priority === 'recommended' ? 'bg-yellow-50 border-yellow-300' :
                    'bg-blue-50 border-blue-300'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-gray-800">{test.testName}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        test.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                        test.priority === 'recommended' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {test.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{test.reason}</p>
                  </div>
                ))}
              </div>
            )}

            {selectedPrescription.generalNotes && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800">Notes</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedPrescription.generalNotes}</p>
              </div>
            )}

            {selectedPrescription.recommendations && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800">Recommendations</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedPrescription.recommendations}</p>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 bg-white px-6 py-4 flex justify-center">
            <div className="w-32 h-1 bg-gray-300 rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-[430px] rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-[32px] z-10">
          <h2 className="font-bold text-gray-800">Medical History</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Loading medical history...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6 pb-24">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center text-2xl">
                  🐾
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-purple-900">{petName}</h3>
                  <p className="text-sm text-purple-700">
                    {prescriptions.length} medical record{prescriptions.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            {prescriptions.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-semibold mb-2">No Medical History</p>
                <p className="text-sm text-gray-500">
                  This pet has no previous medical records in our system
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {prescriptions.map((prescription) => (
                  <button
                    key={prescription.id}
                    onClick={() => setSelectedPrescription(prescription)}
                    className="w-full bg-white border-2 border-gray-200 hover:border-orange-300 rounded-2xl p-4 transition-all text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        {prescription.vendorType === 'vet' ? (
                          <span className="text-2xl">⚕️</span>
                        ) : prescription.vendorType === 'grooming' ? (
                          <span className="text-2xl">✂️</span>
                        ) : (
                          <span className="text-2xl">📋</span>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 mb-1">{prescription.serviceName}</h3>
                        <p className="text-sm text-gray-600 mb-2">{prescription.vendorName}</p>
                        
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {formatDate(prescription.createdAt)}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {prescription.diagnosis && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                              Diagnosis
                            </span>
                          )}
                          {prescription.medications && prescription.medications.length > 0 && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              {prescription.medications.length} Med{prescription.medications.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {prescription.testsRecommended && prescription.testsRecommended.length > 0 && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                              {prescription.testsRecommended.length} Test{prescription.testsRecommended.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {prescription.vitals && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                              Vitals
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-gray-400">
                        →
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="sticky bottom-0 bg-white px-6 py-4 flex justify-center">
          <div className="w-32 h-1 bg-gray-300 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}

