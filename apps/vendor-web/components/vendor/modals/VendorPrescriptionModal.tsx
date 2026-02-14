"use client";

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Pill, FileText, Download, Share2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface VendorPrescriptionModalProps {
  bookingId: string;
  petId?: string;
  petName: string;
  petBreed?: string;
  petSpecies?: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  vendorId: string;
  vendorName: string;
  staffId?: string;
  serviceName?: string;
  bookingDate?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function VendorPrescriptionModal({
  bookingId,
  petId,
  petName,
  petBreed,
  petSpecies,
  customerId,
  customerName,
  customerPhone,
  vendorId,
  vendorName,
  staffId: staffIdProp,
  serviceName,
  bookingDate,
  onClose,
  onSuccess
}: VendorPrescriptionModalProps) {
  const [medications, setMedications] = useState<Medication[]>([
    { id: '1', name: '', dosage: '', frequency: '', duration: '', instructions: '' }
  ]);
  const [diagnosis, setDiagnosis] = useState('');
  const [generalInstructions, setGeneralInstructions] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saveMode, setSaveMode] = useState<'draft' | 'publish'>('publish');

  // ✅ FIX: Properly resolve vendorId with comprehensive fallback chain
  const resolvedVendorId = vendorId?.trim() || 
                          (typeof window !== 'undefined' ? localStorage.getItem('vendorId')?.trim() || '' : '');
  
  // ✅ FIX: Only resolve staffId if provided (staff context) - don't auto-resolve from localStorage for vendors
  // Staff should only be used when explicitly provided or when user is in staff context
  const isStaffContext = typeof window !== 'undefined' && 
                        (localStorage.getItem('staffId') || localStorage.getItem('staff_id') || staffIdProp);
  const resolvedStaffId = isStaffContext ? 
                          (staffIdProp?.trim() || 
                           (typeof window !== 'undefined' ? localStorage.getItem('staffId')?.trim() || localStorage.getItem('staff_id')?.trim() || '' : '')) : 
                          undefined;

  // Common medication suggestions
  const medicationSuggestions = [
    'Amoxicillin', 'Metronidazole', 'Cephalexin', 'Doxycycline', 
    'Prednisolone', 'Carprofen', 'Meloxicam', 'Gabapentin',
    'Apoquel', 'Simparica', 'Nexgard', 'Heartgard',
    'Probiotic', 'Multivitamin', 'Omega-3 Supplement'
  ];

  const frequencyOptions = [
    'Once daily (OD)',
    'Twice daily (BD)',
    'Three times daily (TDS)',
    'Four times daily (QDS)',
    'Every 8 hours',
    'Every 12 hours',
    'As needed (SOS)',
    'Before meals',
    'After meals',
    'At bedtime'
  ];

  const durationOptions = [
    '3 days', '5 days', '7 days', '10 days', '14 days', 
    '21 days', '1 month', '2 months', '3 months', 'Ongoing'
  ];

  const addMedication = () => {
    setMedications([
      ...medications,
      { id: Date.now().toString(), name: '', dosage: '', frequency: '', duration: '', instructions: '' }
    ]);
  };

  const removeMedication = (id: string) => {
    if (medications.length > 1) {
      setMedications(medications.filter(m => m.id !== id));
    }
  };

  const updateMedication = (id: string, field: keyof Medication, value: string) => {
    setMedications(medications.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  const handleSave = async (mode: 'draft' | 'publish' = 'publish') => {
    // ✅ FIX: Filter out empty medications - at least one medication with a name is required
    const validMedications = medications.filter(m => m.name && m.name.trim());
    if (validMedications.length === 0) {
      setError('Please add at least one medication with a name');
      return;
    }

    const vid = resolvedVendorId?.trim();
    if (!vid) {
      console.error('❌ [PRESCRIPTION] Vendor ID missing:', {
        vendorId,
        resolvedVendorId,
        localStorage: typeof window !== 'undefined' ? localStorage.getItem('vendorId') : 'N/A'
      });
      setError('Vendor ID is missing. Please refresh the page or contact support.');
      return;
    }
    
    console.log('✅ [PRESCRIPTION] Using vendor ID:', vid);
    if (resolvedStaffId) {
      console.log('✅ [PRESCRIPTION] Using staff ID:', resolvedStaffId);
    }

    setSaving(true);
    setSaveMode(mode);
    setError(null);

    try {
      const response = await apiClient.post('/prescriptions', {
        bookingId,
        customerId,
        petId,
        vendorId: vid,
        staffId: (resolvedStaffId && String(resolvedStaffId).trim()) || undefined,
        medications: validMedications.map(m => ({
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration,
          instructions: m.instructions,
        })),
        diagnosis,
        instructions: generalInstructions,
        followUpDate: followUpDate || null,
        followUpNotes: followUpNotes || null,
        createdBy: vid,
        createdByRole: 'vendor',
        status: mode === 'publish' ? 'published' : mode,
        // Additional context for history
        petName,
        petBreed,
        petSpecies,
        customerName,
        vendorName,
        serviceName,
        bookingDate,
      }) as any;

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setError(response.error || 'Failed to save prescription');
      }
    } catch (err: any) {
      console.error('Error saving prescription:', err);
      setError(err.message || 'Failed to save prescription');
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    const isDraft = saveMode === 'draft';
    return (
      <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-[380px] p-6 text-center mx-4 animate-in zoom-in-95 duration-200">
          <div className={`w-16 h-16 ${isDraft ? 'bg-amber-100' : 'bg-green-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            {isDraft ? (
              <FileText className="w-8 h-8 text-amber-600" />
            ) : (
              <CheckCircle className="w-8 h-8 text-green-600" />
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {isDraft ? 'Draft Saved!' : 'Prescription Published!'}
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {isDraft 
              ? 'Your prescription draft has been saved. You can edit it later before publishing.'
              : 'The prescription has been published and is now available to the customer.'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center">
      {/* Mobile-optimized container */}
      <div className="w-full max-w-[430px] h-full sm:h-auto sm:max-h-[90vh] bg-white sm:rounded-2xl flex flex-col overflow-hidden sm:mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Create Prescription</h3>
              <p className="text-xs text-white/80">{petName} • {customerName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-4 space-y-3 pb-6">
            {/* Patient Info Card - Compact */}
            <div className="bg-white rounded-xl p-3 shadow-sm">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Patient Details
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Pet:</span>
                  <span className="font-medium text-gray-900">{petName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Species:</span>
                  <span className="font-medium text-gray-900">{petSpecies || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Breed:</span>
                  <span className="font-medium text-gray-900">{petBreed || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Owner:</span>
                  <span className="font-medium text-gray-900 truncate max-w-[100px]">{customerName}</span>
                </div>
              </div>
            </div>

            {/* Diagnosis */}
            <div className="bg-white rounded-xl p-3 shadow-sm">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Diagnosis / Condition
              </label>
              <textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Enter diagnosis or condition observed..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={2}
              />
            </div>

            {/* Medications */}
            <div className="bg-white rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5" />
                  Medications
                </h4>
                <button
                  onClick={addMedication}
                  className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Add More
                </button>
              </div>

              <div className="space-y-3">
                {medications.map((med, index) => (
                  <div key={med.id} className="border border-gray-200 rounded-xl p-3 relative bg-gray-50">
                    {medications.length > 1 && (
                      <button
                        onClick={() => removeMedication(med.id)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-sm"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    
                    <div className="text-xs font-semibold text-purple-600 mb-2">
                      Medication {index + 1}
                    </div>

                    {/* Medicine Name with suggestions */}
                    <div className="mb-2">
                      <input
                        type="text"
                        value={med.name}
                        onChange={(e) => updateMedication(med.id, 'name', e.target.value)}
                        placeholder="Medicine name *"
                        list={`med-suggestions-${med.id}`}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                      />
                      <datalist id={`med-suggestions-${med.id}`}>
                        {medicationSuggestions.map(s => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>

                    {/* Dosage - Full width on mobile */}
                    <div className="mb-2">
                      <input
                        type="text"
                        value={med.dosage}
                        onChange={(e) => updateMedication(med.id, 'dosage', e.target.value)}
                        placeholder="Dosage (e.g., 250mg)"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                      />
                    </div>

                    {/* Frequency & Duration - Stacked on mobile */}
                    <div className="space-y-2">
                      <select
                        value={med.frequency}
                        onChange={(e) => updateMedication(med.id, 'frequency', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white appearance-none"
                      >
                        <option value="">Select Frequency</option>
                        {frequencyOptions.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>

                      <select
                        value={med.duration}
                        onChange={(e) => updateMedication(med.id, 'duration', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white appearance-none"
                      >
                        <option value="">Select Duration</option>
                        {durationOptions.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      
                      <input
                        type="text"
                        value={med.instructions}
                        onChange={(e) => updateMedication(med.id, 'instructions', e.target.value)}
                        placeholder="Special instructions (optional)"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* General Instructions */}
            <div className="bg-white rounded-xl p-3 shadow-sm">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                General Instructions
              </label>
              <textarea
                value={generalInstructions}
                onChange={(e) => setGeneralInstructions(e.target.value)}
                placeholder="Any additional care instructions, diet recommendations, etc..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>

            {/* Follow-up */}
            <div className="bg-white rounded-xl p-3 shadow-sm">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Follow-up (Optional)
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <input
                  type="text"
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Follow-up reason"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Fixed at bottom */}
        <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0 safe-area-bottom">
          <div className="space-y-3">
            {/* Main action buttons - Stacked on mobile */}
            <div className="flex gap-3">
              <button
                onClick={() => handleSave('draft')}
                disabled={saving}
                className="flex-1 py-3 px-3 border-2 border-purple-300 text-purple-700 rounded-xl font-semibold hover:bg-purple-50 active:bg-purple-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {saving && saveMode === 'draft' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Save Draft
              </button>
              <button
                onClick={() => handleSave('publish')}
                disabled={saving}
                className="flex-1 py-3 px-3 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-purple-200"
              >
                {saving && saveMode === 'publish' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Publish
              </button>
            </div>
            {/* Info text */}
            <p className="text-[11px] text-gray-500 text-center leading-tight">
              💡 Drafts can be edited. Published prescriptions are final and visible to customers.
            </p>
            {/* Cancel */}
            <button
              onClick={onClose}
              className="w-full py-2 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
