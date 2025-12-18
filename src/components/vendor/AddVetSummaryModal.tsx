import { useState } from 'react';
import { X, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface AddVetSummaryModalProps {
  appointmentId: string;
  petName: string;
  vendorId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddVetSummaryModal({ 
  appointmentId, 
  petName, 
  vendorId, 
  onClose, 
  onSuccess 
}: AddVetSummaryModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    summary: '',
    diagnosis: '',
    symptoms: [] as string[],
    treatmentPlan: '',
    followUpDate: '',
    followUpInstructions: '',
    vitalSigns: {
      temperature: '',
      heartRate: '',
      weight: ''
    }
  });

  const [symptomInput, setSymptomInput] = useState('');

  const handleAddSymptom = () => {
    if (symptomInput.trim() && !formData.symptoms.includes(symptomInput.trim())) {
      setFormData({
        ...formData,
        symptoms: [...formData.symptoms, symptomInput.trim()]
      });
      setSymptomInput('');
    }
  };

  const handleRemoveSymptom = (symptom: string) => {
    setFormData({
      ...formData,
      symptoms: formData.symptoms.filter(s => s !== symptom)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.summary.trim()) {
      setError('Consultation summary is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/appointments/${appointmentId}/vet-summary`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
            'X-User-Id': vendorId,
            'X-User-Role': 'vendor'
          },
          body: JSON.stringify({
            summary: formData.summary,
            diagnosis: formData.diagnosis,
            symptoms: formData.symptoms,
            treatmentPlan: formData.treatmentPlan,
            followUpDate: formData.followUpDate,
            followUpInstructions: formData.followUpInstructions,
            vitalSigns: {
              temperature: formData.vitalSigns.temperature ? parseFloat(formData.vitalSigns.temperature) : undefined,
              heartRate: formData.vitalSigns.heartRate ? parseInt(formData.vitalSigns.heartRate) : undefined,
              weight: formData.vitalSigns.weight ? parseFloat(formData.vitalSigns.weight) : undefined
            }
          })
        }
      );

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save vet summary');
      }
    } catch (err) {
      console.error('Error saving vet summary:', err);
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#FF8C42] white rounded-2xl shadow-2xl">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FF8C42] blue-100 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle>Add Consultation Summary</DialogTitle>
              <p className="text-sm text-gray-600 mt-1">
                Medical record for <span className="font-semibold">{petName}</span>
              </p>
            </div>
          </div>
        </DialogHeader>

        {success ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-[#FF8C42] green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="font-bold text-green-900 mb-2">Summary Saved Successfully</h3>
            <p className="text-sm text-gray-600">Medical record has been added to {petName}'s history</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            {/* Error Alert */}
            {error && (
              <div className="bg-[#FF8C42] red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Consultation Summary */}
            <div>
              <label className="block font-medium text-gray-900 mb-2">
                Consultation Summary <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                placeholder="Overall assessment and consultation notes..."
                required
              />
            </div>

            {/* Diagnosis */}
            <div>
              <label className="block font-medium text-gray-900 mb-2">
                Diagnosis
              </label>
              <input
                type="text"
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Primary diagnosis or condition"
              />
            </div>

            {/* Symptoms */}
            <div>
              <label className="block font-medium text-gray-900 mb-2">
                Symptoms Observed
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={symptomInput}
                  onChange={(e) => setSymptomInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSymptom();
                    }
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter symptom and press Enter"
                />
                <Button 
                  type="button" 
                  onClick={handleAddSymptom}
                  className="bg-blue-600 hover:bg-[#FF8C42] blue-700 text-white px-4"
                >
                  Add
                </Button>
              </div>
              {formData.symptoms.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.symptoms.map((symptom, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center gap-1 bg-[#FF8C42] blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                    >
                      {symptom}
                      <Button
                        type="button"
                        onClick={() => handleRemoveSymptom(symptom)}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Vital Signs */}
            <div>
              <label className="block font-medium text-gray-900 mb-2">
                Vital Signs
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Temperature (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.vitalSigns.temperature}
                    onChange={(e) => setFormData({
                      ...formData,
                      vitalSigns: { ...formData.vitalSigns, temperature: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="98.6"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={formData.vitalSigns.heartRate}
                    onChange={(e) => setFormData({
                      ...formData,
                      vitalSigns: { ...formData.vitalSigns, heartRate: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="80"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.vitalSigns.weight}
                    onChange={(e) => setFormData({
                      ...formData,
                      vitalSigns: { ...formData.vitalSigns, weight: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="5.2"
                  />
                </div>
              </div>
            </div>

            {/* Treatment Plan */}
            <div>
              <label className="block font-medium text-gray-900 mb-2">
                Treatment Plan
              </label>
              <textarea
                value={formData.treatmentPlan}
                onChange={(e) => setFormData({ ...formData, treatmentPlan: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Recommended treatment, medications, and care instructions..."
              />
            </div>

            {/* Follow-up */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-gray-900 mb-2">
                  Follow-up Date
                </label>
                <input
                  type="date"
                  value={formData.followUpDate}
                  onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block font-medium text-gray-900 mb-2">
                  Follow-up Instructions
                </label>
                <input
                  type="text"
                  value={formData.followUpInstructions}
                  onChange={(e) => setFormData({ ...formData, followUpInstructions: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Return if symptoms worsen..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                type="button" 
                onClick={onClose}
                variant="outline"
                disabled={submitting}
                className="px-6"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={submitting || !formData.summary.trim()}
                className="bg-blue-600 hover:bg-[#FF8C42] blue-700 text-white px-6"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Summary'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
