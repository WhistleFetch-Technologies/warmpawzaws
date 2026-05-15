"use client";

import { useState } from 'react';
import { X, Stethoscope, Pill, FileText, AlertCircle, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface AddVetSummaryModalProps {
  appointmentId: string;
  petName: string;
  vendorId: string;
  staffId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Prescription {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export function AddVetSummaryModal({ appointmentId, petName, vendorId, staffId: staffIdProp, onClose, onSuccess }: AddVetSummaryModalProps) {
  const [saving, setSaving] = useState(false);
  const resolvedVendorId = vendorId || (typeof window !== 'undefined' ? localStorage.getItem('vendorId') || '' : '');
  const resolvedStaffId = (staffIdProp || (typeof window !== 'undefined' ? localStorage.getItem('staffId') || localStorage.getItem('staff_id') || '' : ''))?.trim() || undefined;
  const [summary, setSummary] = useState({
    diagnosis: '',
    symptoms: '',
    notes: '',
    weight: '',
    temperature: '',
    followUpDays: '',
    prescriptions: [] as Prescription[],
  });
  const [newPrescription, setNewPrescription] = useState<Prescription>({
    medication: '',
    dosage: '',
    frequency: '',
    duration: '',
  });

  const addPrescription = () => {
    if (!newPrescription.medication) {
      toast.error('Please enter medication name');
      return;
    }
    setSummary({
      ...summary,
      prescriptions: [...summary.prescriptions, newPrescription],
    });
    setNewPrescription({ medication: '', dosage: '', frequency: '', duration: '' });
  };

  const removePrescription = (index: number) => {
    setSummary({
      ...summary,
      prescriptions: summary.prescriptions.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (saveAsDraft = false) => {
    if (!summary.diagnosis) {
      toast.error('Please enter diagnosis');
      return;
    }
    if (!resolvedVendorId.trim()) {
      toast.error('Vendor session missing. Please refresh or log in again.');
      return;
    }

    // ✅ FIX: Automatically include current medication entry if it has a name
    // This allows doctors to type medication and submit without clicking "+ Add Medication"
    let allPrescriptions = [...summary.prescriptions];
    if (newPrescription.medication && newPrescription.medication.trim()) {
      allPrescriptions.push(newPrescription);
    }

    // ✅ FIX: Validate that at least one medication with a name is provided
    const validPrescriptions = allPrescriptions.filter(p => p.medication && p.medication.trim());
    if (validPrescriptions.length === 0) {
      toast.error('Please add at least one medication with a name');
      return;
    }

    try {
      setSaving(true);
      const status = saveAsDraft ? 'draft' : 'published';
      await apiClient.post(`/prescriptions`, {
        bookingId: appointmentId,
        vendorId: resolvedVendorId.trim(),
        staffId: resolvedStaffId,
        diagnosis: summary.diagnosis,
        notes: summary.notes,
        medications: validPrescriptions.map(p => ({
          name: p.medication,
          dosage: p.dosage,
          frequency: p.frequency,
          duration: p.duration,
        })),
        vitals: {
          weight: summary.weight,
          temperature: summary.temperature,
        },
        symptoms: summary.symptoms,
        followUpDays: summary.followUpDays ? parseInt(summary.followUpDays) : null,
        status,
      });
      toast.success(saveAsDraft ? 'Saved as draft. You can publish later from History.' : 'Consultation summary published! Shared in chat.');
      onSuccess();
    } catch (error) {
      toast.error('Failed to save summary');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-bottom)))] overflow-hidden flex flex-col shadow-xl min-h-0">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-gray-200 flex items-start justify-between gap-3 bg-gradient-to-r from-blue-50 to-green-50 shrink-0">
          <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="p-2 bg-blue-100 rounded-lg shrink-0">
              <Stethoscope className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Consultation Summary</h3>
              <p className="text-sm text-gray-600 truncate">{petName}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 touch-manipulation" aria-label="Close">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto overscroll-y-contain p-3 sm:p-4 space-y-4 min-h-0">
          {/* Vitals — stack on very narrow screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                placeholder="e.g., 12.5"
                value={summary.weight}
                onChange={(e) => setSummary({ ...summary, weight: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="temperature">Temperature (°F)</Label>
              <Input
                id="temperature"
                type="number"
                step="0.1"
                placeholder="e.g., 101.5"
                value={summary.temperature}
                onChange={(e) => setSummary({ ...summary, temperature: e.target.value })}
              />
            </div>
          </div>

          {/* Symptoms */}
          <div>
            <Label htmlFor="symptoms">Symptoms</Label>
            <textarea
              id="symptoms"
              placeholder="Describe the symptoms observed..."
              value={summary.symptoms}
              onChange={(e) => setSummary({ ...summary, symptoms: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg min-h-[80px] text-sm"
            />
          </div>

          {/* Diagnosis */}
          <div>
            <Label htmlFor="diagnosis">Diagnosis *</Label>
            <textarea
              id="diagnosis"
              placeholder="Enter your diagnosis..."
              value={summary.diagnosis}
              onChange={(e) => setSummary({ ...summary, diagnosis: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg min-h-[80px] text-sm"
            />
          </div>

          {/* Prescriptions */}
          <div>
            <Label className="flex items-center gap-2">
              <Pill className="w-4 h-4" />
              Prescriptions
            </Label>
            
            {summary.prescriptions.length > 0 && (
              <div className="mt-2 space-y-2">
                {summary.prescriptions.map((rx, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{rx.medication}</p>
                      <p className="text-xs text-gray-500">{rx.dosage} • {rx.frequency} • {rx.duration}</p>
                    </div>
                    <button
                      onClick={() => removePrescription(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 p-3 border border-dashed border-gray-300 rounded-lg space-y-2 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Medication name"
                  value={newPrescription.medication}
                  onChange={(e) => setNewPrescription({ ...newPrescription, medication: e.target.value })}
                  className="text-sm min-w-0 w-full"
                />
                <Input
                  placeholder="Dosage (e.g., 10mg)"
                  value={newPrescription.dosage}
                  onChange={(e) => setNewPrescription({ ...newPrescription, dosage: e.target.value })}
                  className="text-sm min-w-0 w-full"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Frequency (e.g., twice daily)"
                  value={newPrescription.frequency}
                  onChange={(e) => setNewPrescription({ ...newPrescription, frequency: e.target.value })}
                  className="text-sm min-w-0 w-full"
                />
                <Input
                  placeholder="Duration (e.g., 7 days)"
                  value={newPrescription.duration}
                  onChange={(e) => setNewPrescription({ ...newPrescription, duration: e.target.value })}
                  className="text-sm min-w-0 w-full"
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addPrescription}>
                + Add Medication
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Additional Notes</Label>
            <textarea
              id="notes"
              placeholder="Any additional notes or recommendations..."
              value={summary.notes}
              onChange={(e) => setSummary({ ...summary, notes: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg min-h-[60px] text-sm"
            />
          </div>

          {/* Follow-up */}
          <div>
            <Label htmlFor="followUp">Follow-up After (days)</Label>
            <Input
              id="followUp"
              type="number"
              placeholder="e.g., 7"
              value={summary.followUpDays}
              onChange={(e) => setSummary({ ...summary, followUpDays: e.target.value })}
            />
          </div>
        </div>

        {/* Footer — stack on mobile so buttons are not clipped */}
        <div className="p-3 sm:p-4 border-t border-gray-200 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" onClick={onClose} className="w-full sm:flex-1 sm:min-w-0 min-h-[44px]">
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="w-full sm:flex-1 sm:min-w-0 min-h-[44px]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2 shrink-0" /> : <FileText className="w-4 h-4 mr-2 shrink-0" />}
            <span className="truncate">Save as Draft</span>
          </Button>
          <Button
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="w-full sm:flex-1 sm:min-w-0 min-h-[44px] bg-blue-600 hover:bg-blue-700"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2 shrink-0" /> : <Save className="w-4 h-4 mr-2 shrink-0" />}
            Publish
          </Button>
        </div>
      </div>
    </div>
  );
}
