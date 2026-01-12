import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface VendorConsultationNotesProps {
  appointmentData: {
    id: string; // bookingId
    petName: string;
    petType: string;
    customerName: string;
    reason: string;
  };
  onClose: () => void;
  onSave: (notes: string) => void;
}

export function VendorConsultationNotes({ 
  appointmentData, 
  onClose, 
  onSave 
}: VendorConsultationNotesProps) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/consultation/notes/${appointmentData.id}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.notes && data.notes.length > 0) {
          // Sort by date desc and take the latest one for now, or concatenate
          // For simplicity, we'll just take the last note's content if multiple exist
          // In a real app, you might want to show a history or append
          const sortedNotes = data.notes.sort((a: any, b: any) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setNotes(sortedNotes[0].content);
        }
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('Failed to load existing notes');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!notes.trim()) {
      toast.error('Please enter some notes');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/consultation/notes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            bookingId: appointmentData.id,
            notes: notes,
            authorId: 'current-vendor-id', // This should ideally come from auth context
            authorType: 'vendor'
          }),
        }
      );

      if (response.ok) {
        onSave(notes);
        onClose();
      } else {
        throw new Error('Failed to save notes');
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end justify-center">
      <div className="w-full max-w-[430px] bg-white rounded-t-3xl max-h-[80vh] overflow-hidden animate-slide-up flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="font-semibold text-gray-900">Consultation Notes</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Patient Info */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🐕</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {appointmentData.petName} - {appointmentData.petType}
              </h3>
              <p className="text-sm text-gray-600">Owner: {appointmentData.customerName}</p>
              <p className="text-xs text-gray-500">Reason: {appointmentData.reason}</p>
            </div>
          </div>
        </div>

        {/* Notes Area */}
        <div className="p-4 flex-1 overflow-y-auto">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Consultation Notes
          </label>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" />
            </div>
          ) : (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter your observations, diagnosis, and treatment recommendations..."
              className="w-full h-64 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42] resize-none"
            />
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 px-4 py-3 bg-[#FF8C42] text-white rounded-xl font-medium hover:bg-[#ff7a28] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Notes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
