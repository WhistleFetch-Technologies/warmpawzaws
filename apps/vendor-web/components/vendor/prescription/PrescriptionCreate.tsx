'use client';

/**
 * ============================================================================
 * PrescriptionCreate - Standalone Prescription Creation Component
 * ============================================================================
 * 
 * Use this component for:
 * - Creating prescriptions from a dedicated prescription management page
 * - When you need a full-page prescription creation experience
 * 
 * Use VendorPrescriptionModal instead for:
 * - Creating prescriptions from within an appointment context
 * - Modal-based prescription creation (preferred UX)
 * - When you have booking context (bookingId, petId, customerId)
 * 
 * @see VendorPrescriptionModal at apps/vendor-web/components/vendor/modals/VendorPrescriptionModal.tsx
 */

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Plus, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { CapabilityGate } from '../CapabilityGate';

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

interface PrescriptionCreateProps {
  vendorId: string;
  bookingId?: string;
  customerId?: string;
  petId?: string;
  onBack?: () => void;
  onSuccess?: () => void;
}

export function PrescriptionCreate({ 
  vendorId, 
  bookingId, 
  customerId, 
  petId,
  onBack,
  onSuccess 
}: PrescriptionCreateProps) {
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [medications, setMedications] = useState<Medication[]>([
    { name: '', dosage: '', frequency: '', duration: '' }
  ]);
  const [instructions, setInstructions] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  const addMedication = () => {
    setMedications([...medications, { name: '', dosage: '', frequency: '', duration: '' }]);
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bookingId || !customerId) {
      toast.error('Booking ID and Customer ID are required');
      return;
    }

    if (medications.some(m => !m.name || !m.dosage || !m.frequency)) {
      toast.error('Please fill in all medication details');
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.post<{ success?: boolean; prescription?: any; error?: string }>('/prescriptions', {
        bookingId,
        customerId,
        petId,
        vendorId,
        medications: medications.map(m => ({
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration,
          instructions: m.instructions || instructions,
        })),
        instructions,
        diagnosis,
        followUpDate: followUpDate || null,
      });

      if (response.success || response.prescription) {
        toast.success('Prescription created successfully');
        onSuccess?.();
        if (onBack) onBack();
      } else {
        throw new Error(response.error || 'Failed to create prescription');
      }
    } catch (error: any) {
      console.error('Error creating prescription:', error);
      toast.error(error.message || 'Failed to create prescription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CapabilityGate capability="prescription_create" showDisabledMessage>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
            {onBack && (
              <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <FileText className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold">Create Prescription</h1>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Diagnosis */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Diagnosis *
              </label>
              <textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                required
                placeholder="Enter diagnosis..."
              />
            </div>

            {/* Medications */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Medications</h2>
                <button
                  type="button"
                  onClick={addMedication}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Medication
                </button>
              </div>

              <div className="space-y-4">
                {medications.map((med, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium">Medication {index + 1}</h3>
                      {medications.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMedication(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Medication Name *
                        </label>
                        <input
                          type="text"
                          value={med.name}
                          onChange={(e) => updateMedication(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                          placeholder="e.g., Amoxicillin"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Dosage *
                        </label>
                        <input
                          type="text"
                          value={med.dosage}
                          onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                          placeholder="e.g., 250mg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Frequency *
                        </label>
                        <input
                          type="text"
                          value={med.frequency}
                          onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                          placeholder="e.g., Twice daily"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Duration
                        </label>
                        <input
                          type="text"
                          value={med.duration}
                          onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 7 days"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Instructions (optional)
                      </label>
                      <textarea
                        value={med.instructions || ''}
                        onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Special instructions for this medication..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* General Instructions */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                General Instructions
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Additional instructions for the pet owner..."
              />
            </div>

            {/* Follow-up Date */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Follow-up Date (optional)
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Prescription'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </CapabilityGate>
  );
}
