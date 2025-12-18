import { useState } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Clock,
  ArrowLeft,
  Calendar
} from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface VendorConsultationScreenProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
}

export function VendorConsultationScreen({ vendorId, vendorData, onBack }: VendorConsultationScreenProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [petName, setPetName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [consultationDate, setConsultationDate] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [consultationNotes, setConsultationNotes] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  
  // New medication form
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [newMedication, setNewMedication] = useState({
    name: '',
    dosage: '',
    duration: '',
    instructions: ''
  });
  const [isPublishing, setIsPublishing] = useState(false);

  const handleAddMedication = () => {
    if (newMedication.name && newMedication.dosage) {
      const medication: Medication = {
        id: Date.now().toString(),
        name: newMedication.name,
        dosage: newMedication.dosage,
        duration: newMedication.duration,
        instructions: newMedication.instructions
      };
      setMedications([...medications, medication]);
      setNewMedication({ name: '', dosage: '', duration: '', instructions: '' });
      setShowMedicationForm(false);
    }
  };

  const handlePublishPrescription = async () => {
    if (!petName || !ownerName || medications.length === 0) {
      alert('Please fill in pet details and add at least one medication');
      return;
    }

    setIsPublishing(true);
    try {
      const prescriptionData = {
        vendorId,
        petName,
        ownerName,
        consultationDate: consultationDate || new Date().toISOString(),
        medications,
        consultationNotes,
        nextFollowUpDate,
        createdAt: new Date().toISOString()
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/consultation/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(prescriptionData),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to publish prescription');
      }

      const result = await response.json();
      console.log('✅ Prescription published:', result);
      
      alert('Prescription published to pharmacy successfully!');
      
      // Reset form
      setPetName('');
      setOwnerName('');
      setConsultationDate('');
      setMedications([]);
      setConsultationNotes('');
      setNextFollowUpDate('');
      
    } catch (error) {
      console.error('Error publishing prescription:', error);
      alert('Failed to publish prescription. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen pb-20">
        {/* Header */}
        <div className="p-4 bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-gray-900">{vendorData?.businessName || vendorData?.fullName || 'Consultation'}</h1>
              <p className="text-xs text-gray-500">{vendorData?.address || 'India'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-gray-400" />
              <Filter className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button 
              onClick={() => setShowHistory(false)}
              className="flex-1 flex items-center justify-center gap-2 h-10 border-2 border-[#FF8C42] rounded-xl bg-white"
            >
              <Plus className="w-4 h-4 text-[#FF8C42]" />
              <span className="text-sm font-medium text-[#FF8C42]">Create New</span>
            </button>
            <button 
              onClick={() => setShowHistory(true)}
              className="flex items-center justify-center gap-2 px-4 h-10 border border-gray-300 rounded-xl bg-white"
            >
              <Clock className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-600">History</span>
            </button>
          </div>
        </div>

        {!showHistory ? (
          <div className="p-4 space-y-6">
            {/* Basic Pet Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg">📋</span>
                </div>
                <h2 className="font-semibold text-gray-900">Basic Pet Information</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Pet Name<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    placeholder="Buddy"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Owner Name<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Nitika Singh"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Consultation Date<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={consultationDate}
                    onChange={(e) => setConsultationDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                  />
                </div>
              </div>
            </div>

            {/* Added Medications List */}
            {medications.length > 0 && (
              <div className="space-y-2">
                {medications.map((med, index) => (
                  <div key={med.id} className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{med.name}</h3>
                      <button
                        onClick={() => setMedications(medications.filter(m => m.id !== med.id))}
                        className="text-red-500 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Dosage: {med.dosage} | Duration: {med.duration}</div>
                      <div>Instructions: {med.instructions}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Medication Section */}
            {!showMedicationForm ? (
              <button
                onClick={() => setShowMedicationForm(true)}
                className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-[#FF8C42] hover:bg-orange-50 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Plus className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">Add Medication</span>
              </button>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-lg">💊</span>
                  </div>
                  <h2 className="font-semibold text-gray-900">Add Medication</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">Medicine Name</label>
                    <input
                      type="text"
                      value={newMedication.name}
                      onChange={(e) => setNewMedication({ ...newMedication, name: e.target.value })}
                      placeholder="Select medicine"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1.5">Dosage</label>
                      <input
                        type="text"
                        value={newMedication.dosage}
                        onChange={(e) => setNewMedication({ ...newMedication, dosage: e.target.value })}
                        placeholder="50mg"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1.5">Duration</label>
                      <input
                        type="text"
                        value={newMedication.duration}
                        onChange={(e) => setNewMedication({ ...newMedication, duration: e.target.value })}
                        placeholder="7 days"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">Instructions</label>
                    <textarea
                      value={newMedication.instructions}
                      onChange={(e) => setNewMedication({ ...newMedication, instructions: e.target.value })}
                      placeholder="Take 2 daily with food"
                      rows={2}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddMedication}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11"
                    >
                      Add Medication
                    </Button>
                    <Button
                      onClick={() => setShowMedicationForm(false)}
                      variant="outline"
                      className="px-4 rounded-xl h-11"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Consultation Notes */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg">📝</span>
                </div>
                <h2 className="font-semibold text-gray-900">Consultation Notes</h2>
              </div>
              <textarea
                value={consultationNotes}
                onChange={(e) => setConsultationNotes(e.target.value)}
                placeholder="Add consultation notes, symptoms observed, treatment plan..."
                rows={4}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
              />
            </div>

            {/* Next Follow-up Date */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-gray-600" />
                <h2 className="font-semibold text-gray-900">Next Follow-up Date</h2>
              </div>
              <input
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                placeholder="Buddy"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
              />
            </div>

            {/* Publish Button */}
            <Button
              onClick={handlePublishPrescription}
              disabled={isPublishing || !petName || !ownerName || medications.length === 0}
              className="w-full bg-orange-400 hover:bg-orange-500 text-white rounded-xl h-12 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isPublishing ? 'Publishing...' : 'Publish Prescription to Pharmacy'}
            </Button>
          </div>
        ) : (
          <div className="p-4">
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900 mb-1">No Consultation History</h3>
              <p className="text-sm text-gray-500">Your past consultations will appear here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}