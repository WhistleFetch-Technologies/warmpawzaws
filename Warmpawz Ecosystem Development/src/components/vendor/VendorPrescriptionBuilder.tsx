import { useState } from 'react';
import { X, Plus, Trash2, Upload, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface VendorPrescriptionBuilderProps {
  bookingId: string;
  vendorId: string;
  vendorType: string;
  petName: string;
  customerName: string;
  serviceName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface Product {
  name: string;
  quantity: string;
  notes: string;
}

interface Test {
  testName: string;
  reason: string;
  priority: 'urgent' | 'recommended' | 'optional';
}

export function VendorPrescriptionBuilder({
  bookingId,
  vendorId,
  vendorType,
  petName,
  customerName,
  serviceName,
  onClose,
  onSuccess
}: VendorPrescriptionBuilderProps) {
  const isVet = vendorType === 'vet';
  
  // Form state
  const [diagnosis, setDiagnosis] = useState('');
  const [observations, setObservations] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [productsUsed, setProductsUsed] = useState<Product[]>([]);
  const [testsRecommended, setTestsRecommended] = useState<Test[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [followUpReason, setFollowUpReason] = useState('');
  
  // Vitals (for vets)
  const [weight, setWeight] = useState('');
  const [temperature, setTemperature] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  
  const [loading, setLoading] = useState(false);

  const addMedication = () => {
    setMedications([...medications, {
      name: '',
      dosage: '',
      frequency: '',
      duration: '',
      instructions: ''
    }]);
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const updated = [...medications];
    updated[index][field] = value;
    setMedications(updated);
  };

  const addProduct = () => {
    setProductsUsed([...productsUsed, { name: '', quantity: '', notes: '' }]);
  };

  const removeProduct = (index: number) => {
    setProductsUsed(productsUsed.filter((_, i) => i !== index));
  };

  const updateProduct = (index: number, field: keyof Product, value: string) => {
    const updated = [...productsUsed];
    updated[index][field] = value;
    setProductsUsed(updated);
  };

  const addTest = () => {
    setTestsRecommended([...testsRecommended, {
      testName: '',
      reason: '',
      priority: 'recommended'
    }]);
  };

  const removeTest = (index: number) => {
    setTestsRecommended(testsRecommended.filter((_, i) => i !== index));
  };

  const updateTest = (index: number, field: keyof Test, value: string) => {
    const updated = [...testsRecommended];
    updated[index][field] = value as any;
    setTestsRecommended(updated);
  };

  const handleSubmit = async () => {
    // Validation
    if (isVet && !diagnosis && !observations) {
      alert('Please provide diagnosis or observations');
      return;
    }
    if (!isVet && !observations) {
      alert('Please provide service observations');
      return;
    }

    try {
      setLoading(true);

      const prescriptionData: any = {
        bookingId,
        vendorId,
        generalNotes,
        recommendations,
        nextFollowUpDate: nextFollowUpDate || undefined,
        followUpReason: followUpReason || undefined
      };

      if (isVet) {
        prescriptionData.diagnosis = diagnosis;
        prescriptionData.medications = medications.filter(m => m.name);
        prescriptionData.testsRecommended = testsRecommended.filter(t => t.testName);
        prescriptionData.vitals = {
          weight: weight ? parseFloat(weight) : undefined,
          temperature: temperature ? parseFloat(temperature) : undefined,
          heartRate: heartRate ? parseInt(heartRate) : undefined,
          respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
          bloodPressure: bloodPressure || undefined
        };
      } else {
        prescriptionData.observations = observations;
        prescriptionData.productsUsed = productsUsed.filter(p => p.name);
      }

      const response = await fetch(
        `${getApiBaseUrl()}/prescription/create`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(prescriptionData)
        }
      );

      if (response.ok) {
        alert(`${isVet ? 'Prescription' : 'Service notes'} saved successfully!`);
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        alert(`Failed to save: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving prescription:', error);
      alert('Failed to save prescription/service notes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div 
        className="bg-white w-full max-w-[430px] rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-[32px] z-10">
          <div>
            <h2 className="font-bold text-gray-800">
              {isVet ? 'Add Prescription' : 'Add Service Notes'}
            </h2>
            <p className="text-sm text-gray-600">{petName} - {customerName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6 pb-24">
          {/* Info Banner */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-orange-900 font-semibold">
                {isVet ? 'Prescription is mandatory after service completion' : 'Service notes are required'}
              </p>
              <p className="text-xs text-orange-700 mt-1">
                This will be visible to the pet owner and saved in their medical records
              </p>
            </div>
          </div>

          {/* Vitals (Vets only) */}
          {isVet && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">Vitals</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                    placeholder="0.0"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Temp (°F)</label>
                  <input
                    type="number"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                    placeholder="98.6"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                    placeholder="80"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Resp. Rate (/min)</label>
                  <input
                    type="number"
                    value={respiratoryRate}
                    onChange={(e) => setRespiratoryRate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                    placeholder="20"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Blood Pressure</label>
                <input
                  type="text"
                  value={bloodPressure}
                  onChange={(e) => setBloodPressure(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                  placeholder="120/80"
                />
              </div>
            </div>
          )}

          {/* Diagnosis (Vets) or Observations (Others) */}
          <div>
            <label className="block font-semibold text-gray-800 mb-2">
              {isVet ? 'Diagnosis *' : 'Observations *'}
            </label>
            <textarea
              value={isVet ? diagnosis : observations}
              onChange={(e) => isVet ? setDiagnosis(e.target.value) : setObservations(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#FF8C42] transition-colors resize-none"
              placeholder={isVet ? "Pet's condition and diagnosis..." : "What services were performed? Any observations..."}
            />
          </div>

          {/* Medications (Vets only) */}
          {isVet && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Medications</h3>
                <button
                  onClick={addMedication}
                  className="text-[#FF8C42] flex items-center gap-1 text-sm hover:text-[#FF7A2F]"
                >
                  <Plus className="w-4 h-4" />
                  Add Medication
                </button>
              </div>
              
              {medications.map((med, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Medication {idx + 1}</span>
                    <button
                      onClick={() => removeMedication(idx)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <input
                    type="text"
                    value={med.name}
                    onChange={(e) => updateMedication(idx, 'name', e.target.value)}
                    placeholder="Medicine name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                  />
                  
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={med.dosage}
                      onChange={(e) => updateMedication(idx, 'dosage', e.target.value)}
                      placeholder="Dosage"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                    />
                    <input
                      type="text"
                      value={med.frequency}
                      onChange={(e) => updateMedication(idx, 'frequency', e.target.value)}
                      placeholder="Frequency"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                    />
                  </div>
                  
                  <input
                    type="text"
                    value={med.duration}
                    onChange={(e) => updateMedication(idx, 'duration', e.target.value)}
                    placeholder="Duration (e.g., 7 days)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                  />
                  
                  <textarea
                    value={med.instructions}
                    onChange={(e) => updateMedication(idx, 'instructions', e.target.value)}
                    placeholder="Special instructions"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42] resize-none"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Products Used (Non-vets) */}
          {!isVet && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Products Used</h3>
                <button
                  onClick={addProduct}
                  className="text-[#FF8C42] flex items-center gap-1 text-sm hover:text-[#FF7A2F]"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              </div>
              
              {productsUsed.map((product, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Product {idx + 1}</span>
                    <button
                      onClick={() => removeProduct(idx)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <input
                    type="text"
                    value={product.name}
                    onChange={(e) => updateProduct(idx, 'name', e.target.value)}
                    placeholder="Product name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                  />
                  
                  <input
                    type="text"
                    value={product.quantity}
                    onChange={(e) => updateProduct(idx, 'quantity', e.target.value)}
                    placeholder="Quantity"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                  />
                  
                  <input
                    type="text"
                    value={product.notes}
                    onChange={(e) => updateProduct(idx, 'notes', e.target.value)}
                    placeholder="Notes"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Tests Recommended (Vets only) */}
          {isVet && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Tests Recommended</h3>
                <button
                  onClick={addTest}
                  className="text-[#FF8C42] flex items-center gap-1 text-sm hover:text-[#FF7A2F]"
                >
                  <Plus className="w-4 h-4" />
                  Add Test
                </button>
              </div>
              
              {testsRecommended.map((test, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Test {idx + 1}</span>
                    <button
                      onClick={() => removeTest(idx)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <input
                    type="text"
                    value={test.testName}
                    onChange={(e) => updateTest(idx, 'testName', e.target.value)}
                    placeholder="Test name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                  />
                  
                  <input
                    type="text"
                    value={test.reason}
                    onChange={(e) => updateTest(idx, 'reason', e.target.value)}
                    placeholder="Reason for test"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                  />
                  
                  <select
                    value={test.priority}
                    onChange={(e) => updateTest(idx, 'priority', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF8C42]"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="recommended">Recommended</option>
                    <option value="optional">Optional</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* General Notes */}
          <div>
            <label className="block font-semibold text-gray-800 mb-2">General Notes</label>
            <textarea
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#FF8C42] transition-colors resize-none"
              placeholder="Additional notes or observations..."
            />
          </div>

          {/* Recommendations */}
          <div>
            <label className="block font-semibold text-gray-800 mb-2">Recommendations</label>
            <textarea
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#FF8C42] transition-colors resize-none"
              placeholder="Care recommendations for the pet owner..."
            />
          </div>

          {/* Follow-up Date */}
          <div>
            <label className="block font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#FF8C42]" />
              Next Follow-up (Optional)
            </label>
            <input
              type="date"
              value={nextFollowUpDate}
              onChange={(e) => setNextFollowUpDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#FF8C42] transition-colors mb-3"
            />
            <input
              type="text"
              value={followUpReason}
              onChange={(e) => setFollowUpReason(e.target.value)}
              placeholder="Reason for follow-up"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#FF8C42] transition-colors"
            />
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={loading || (isVet ? !diagnosis : !observations)}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7A2F] text-white py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : `Save ${isVet ? 'Prescription' : 'Service Notes'}`}
          </Button>
        </div>

        {/* Home Indicator */}
        <div className="sticky bottom-0 bg-white px-6 py-4 flex justify-center">
          <div className="w-32 h-1 bg-gray-300 rounded-full"></div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}