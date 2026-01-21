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
  onClose: () => void;
  onSuccess: () => void;
}

interface Prescription {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export function AddVetSummaryModal({ appointmentId, petName, vendorId, onClose, onSuccess }: AddVetSummaryModalProps) {
  const [saving, setSaving] = useState(false);
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

  const handleSubmit = async () => {
    if (!summary.diagnosis) {
      toast.error('Please enter diagnosis');
      return;
    }

    try {
      setSaving(true);
      await apiClient.post(`/prescriptions`, {
        bookingId: appointmentId,
        vendorId,
        diagnosis: summary.diagnosis,
        notes: summary.notes,
        medications: summary.prescriptions.map(p => ({
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
      });
      toast.success('Consultation summary saved!');
      onSuccess();
    } catch (error) {
      toast.error('Failed to save summary');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-green-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Stethoscope className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Consultation Summary</h3>
              <p className="text-sm text-gray-600">{petName}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Vitals */}
          <div className="grid grid-cols-2 gap-3">
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

            <div className="mt-2 p-3 border border-dashed border-gray-300 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Medication name"
                  value={newPrescription.medication}
                  onChange={(e) => setNewPrescription({ ...newPrescription, medication: e.target.value })}
                  className="text-sm"
                />
                <Input
                  placeholder="Dosage (e.g., 10mg)"
                  value={newPrescription.dosage}
                  onChange={(e) => setNewPrescription({ ...newPrescription, dosage: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Frequency (e.g., twice daily)"
                  value={newPrescription.frequency}
                  onChange={(e) => setNewPrescription({ ...newPrescription, frequency: e.target.value })}
                  className="text-sm"
                />
                <Input
                  placeholder="Duration (e.g., 7 days)"
                  value={newPrescription.duration}
                  onChange={(e) => setNewPrescription({ ...newPrescription, duration: e.target.value })}
                  className="text-sm"
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

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Summary
          </Button>
        </div>
      </div>
    </div>
  );
}
