import { useState } from 'react';
import { X, Pill, Save, AlertCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface VendorPrescriptionModalProps {
  bookingId: string;
  petName: string;
  customerName: string;
  vendorId: string;
  vendorName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function VendorPrescriptionModal({
  bookingId,
  petName,
  customerName,
  vendorId,
  vendorName,
  onClose,
  onSuccess
}: VendorPrescriptionModalProps) {
  const [formData, setFormData] = useState({
    diagnosis: '',
    medications: '',
    dosage: '',
    frequency: 'Once Daily',
    duration: '7 days',
    notes: '',
    followUpDate: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.medications.trim()) {
      setError('Please enter medications');
      return;
    }
    
    try {
      setSaving(true);
      setError('');
      
      console.log('📋 Saving prescription...', {
        bookingId,
        vendorId,
        medications: formData.medications
      });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/prescription/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bookingId,
            vendorId,
            vendorName,
            diagnosis: formData.diagnosis,
            medications: formData.medications,
            dosage: formData.dosage,
            frequency: formData.frequency,
            duration: formData.duration,
            notes: formData.notes,
            followUpDate: formData.followUpDate || null
          })
        }
      );
      
      console.log('📋 Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Prescription saved successfully:', data);
        onSuccess();
      } else {
        const data = await response.json();
        console.error('❌ Failed to save prescription:', data);
        setError(data.error || 'Failed to save prescription');
      }
    } catch (err) {
      console.error('❌ Error saving prescription:', err);
      setError('Error saving prescription. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-[430px] rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-4 flex items-center justify-between rounded-t-[32px]">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Pill className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white">Add Prescription</h2>
              <p className="text-xs text-white/80">{petName} - {customerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Diagnosis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Diagnosis / Condition
            </label>
            <textarea
              value={formData.diagnosis}
              onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
              placeholder="e.g., Respiratory infection, skin allergy, etc."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>

          {/* Medications */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Medications <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.medications}
              onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
              placeholder="e.g., Amoxicillin, Cephalexin, etc."
              rows={2}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>

          {/* Dosage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dosage
            </label>
            <input
              type="text"
              value={formData.dosage}
              onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
              placeholder="e.g., 250mg, 1 tablet, 5ml"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Frequency
            </label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            >
              <option>Once Daily</option>
              <option>Twice Daily</option>
              <option>Three Times Daily</option>
              <option>Every 6 Hours</option>
              <option>Every 8 Hours</option>
              <option>Every 12 Hours</option>
              <option>As Needed</option>
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration
            </label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            >
              <option>3 days</option>
              <option>5 days</option>
              <option>7 days</option>
              <option>10 days</option>
              <option>14 days</option>
              <option>1 month</option>
              <option>Ongoing</option>
            </select>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Instructions
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g., Take with food, avoid dairy, monitor for side effects, etc."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>

          {/* Follow-up Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recommended Follow-up Date (Optional)
            </label>
            <input
              type="date"
              value={formData.followUpDate}
              onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>
        </form>

        {/* Actions */}
        <div className="bg-white border-t border-gray-200 p-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !formData.medications.trim()}
            className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-xl font-medium flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Prescription
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}