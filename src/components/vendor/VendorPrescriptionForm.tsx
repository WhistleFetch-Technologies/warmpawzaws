import { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertCircle, Save, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface VendorPrescriptionFormProps {
  bookingId: string;
  booking: any;
  vendorPhone: string;
  existingPrescriptionId?: string; // ✅ ENHANCEMENT: Optional prescription ID for editing
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

interface ProductUsed {
  name: string;
  quantity: string;
  notes: string;
}

interface TestRecommended {
  testName: string;
  reason: string;
  priority: 'urgent' | 'recommended' | 'optional';
}

export function VendorPrescriptionForm({
  bookingId,
  booking,
  vendorPhone,
  existingPrescriptionId,
  onClose,
  onSuccess
}: VendorPrescriptionFormProps) {
  const isVet = booking.vendorType === 'vet' || booking.serviceType === 'vet';
  const isEditMode = !!existingPrescriptionId;
  
  // Medical Details
  const [diagnosis, setDiagnosis] = useState('');
  const [observations, setObservations] = useState('');
  
  // Vitals (for vets)
  const [weight, setWeight] = useState('');
  const [temperature, setTemperature] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [vitalNotes, setVitalNotes] = useState('');
  
  // Medications
  const [medications, setMedications] = useState<Medication[]>([]);
  
  // Products Used (grooming, boarding, etc.)
  const [productsUsed, setProductsUsed] = useState<ProductUsed[]>([]);
  
  // Tests Recommended
  const [testsRecommended, setTestsRecommended] = useState<TestRecommended[]>([]);
  
  // General Notes & Recommendations
  const [generalNotes, setGeneralNotes] = useState('');
  const [recommendations, setRecommendations] = useState('');
  
  // Follow-up
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [followUpReason, setFollowUpReason] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ✅ ENHANCEMENT: Load existing prescription data for editing
  useEffect(() => {
    // Load if we have prescription ID or if we should check for existing prescription
    if (existingPrescriptionId || isEditMode) {
      loadExistingPrescription();
    }
  }, [existingPrescriptionId, bookingId]);

  const loadExistingPrescription = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch prescription by booking ID (standard endpoint)
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/prescription/booking/${bookingId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        // No prescription found - this is OK for new prescriptions
        console.log('ℹ️ [PRESCRIPTION] No existing prescription found - will create new');
        setLoading(false);
        return;
      }

      const result = await response.json();
      
      if (result.success && result.prescription) {
        const prescription = result.prescription;
        
        // Pre-populate form fields
        setDiagnosis(prescription.diagnosis || '');
        setObservations(prescription.observations || '');
        setGeneralNotes(prescription.generalNotes || prescription.notes || '');
        setRecommendations(prescription.recommendations || '');
        setNextFollowUpDate(prescription.nextFollowUpDate || prescription.followUpDate || '');
        setFollowUpReason(prescription.followUpReason || '');

        // Medications
        if (prescription.medications && Array.isArray(prescription.medications)) {
          setMedications(prescription.medications);
        }

        // Products Used
        if (prescription.productsUsed && Array.isArray(prescription.productsUsed)) {
          setProductsUsed(prescription.productsUsed);
        }

        // Tests Recommended
        if (prescription.testsRecommended && Array.isArray(prescription.testsRecommended)) {
          setTestsRecommended(prescription.testsRecommended);
        }

        // Vitals
        if (prescription.vitals) {
          setWeight(prescription.vitals.weight?.toString() || '');
          setTemperature(prescription.vitals.temperature?.toString() || '');
          setHeartRate(prescription.vitals.heartRate?.toString() || '');
          setRespiratoryRate(prescription.vitals.respiratoryRate?.toString() || '');
          setBloodPressure(prescription.vitals.bloodPressure || '');
          setVitalNotes(prescription.vitals.notes || '');
        }

        console.log('✅ [PRESCRIPTION] Loaded existing prescription data:', prescription.id);
      }
    } catch (err: any) {
      console.error('❌ [PRESCRIPTION] Error loading prescription:', err);
      const errorMessage = err?.message || 'Failed to load prescription data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  const addProduct = () => {
    setProductsUsed([...productsUsed, {
      name: '',
      quantity: '',
      notes: ''
    }]);
  };

  const removeProduct = (index: number) => {
    setProductsUsed(productsUsed.filter((_, i) => i !== index));
  };

  const updateProduct = (index: number, field: keyof ProductUsed, value: string) => {
    const updated = [...productsUsed];
    updated[index] = { ...updated[index], [field]: value };
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

  const updateTest = (index: number, field: keyof TestRecommended, value: string) => {
    const updated = [...testsRecommended];
    updated[index] = { ...updated[index], [field]: value };
    setTestsRecommended(updated);
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError('');

      // Validate at least some information is provided
      const hasContent = diagnosis || observations || generalNotes || recommendations ||
                         medications.length > 0 || productsUsed.length > 0 || testsRecommended.length > 0;

      if (!hasContent) {
        setError('Please provide at least some notes or prescription details');
        setSaving(false);
        return;
      }

      const vitals = (weight || temperature || heartRate || respiratoryRate || bloodPressure || vitalNotes) ? {
        weight: weight ? parseFloat(weight) : undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
        heartRate: heartRate ? parseInt(heartRate) : undefined,
        respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
        bloodPressure: bloodPressure || undefined,
        notes: vitalNotes || undefined
      } : null;

      const prescriptionData = {
        bookingId,
        vendorPhone,
        diagnosis,
        observations,
        medications: medications.filter(m => m.name), // Only include medications with names
        productsUsed: productsUsed.filter(p => p.name),
        testsRecommended: testsRecommended.filter(t => t.testName),
        generalNotes,
        recommendations,
        nextFollowUpDate: nextFollowUpDate || null,
        followUpReason,
        vitals,
        attachments: []
      };

      console.log('📝 [VENDOR-PRESCRIPTION] Submitting:', prescriptionData);

      // ✅ ENHANCEMENT: Use PUT for updates, POST for creates
      // First, check if prescription exists by trying to fetch it
      let prescriptionIdToUpdate = existingPrescriptionId;
      
      // If we don't have prescription ID but are in edit mode, try to fetch it
      if (!prescriptionIdToUpdate && isEditMode) {
        try {
          const checkResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/prescription/booking/${bookingId}`,
            {
              headers: { 'Authorization': `Bearer ${publicAnonKey}` }
            }
          );
          if (checkResponse.ok) {
            const checkResult = await checkResponse.json();
            if (checkResult.success && checkResult.prescription?.id) {
              prescriptionIdToUpdate = checkResult.prescription.id;
            }
          }
        } catch (err) {
          console.log('⚠️ [PRESCRIPTION] Could not fetch prescription ID, will create new');
        }
      }
      
      const isUpdate = !!prescriptionIdToUpdate;
      const endpoint = isUpdate
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/prescription/update/${prescriptionIdToUpdate}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/prescription/create`;
      
      const method = isUpdate ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(prescriptionData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const { toast } = await import('sonner@2.0.3');
        if (isUpdate) {
          console.log('✅ [VENDOR-PRESCRIPTION] Updated:', existingPrescriptionId);
          toast.success('Prescription updated successfully');
        } else {
          console.log('✅ [VENDOR-PRESCRIPTION] Created:', result.prescriptionId);
          toast.success('Prescription saved successfully');
        }
        onSuccess();
      } else {
        console.error('❌ [VENDOR-PRESCRIPTION] Error:', result.error);
        const errorMessage = result.error || result.message || `Failed to ${isUpdate ? 'update' : 'save'} prescription`;
        setError(errorMessage);
        setSaving(false);
      }
    } catch (err: any) {
      console.error('❌ [VENDOR-PRESCRIPTION] Exception:', err);
      const errorMessage = err?.message || 'Network error. Please check your connection and try again.';
      setError(errorMessage);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center overflow-hidden">
      <div 
        className="bg-white w-full max-w-[430px] rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-[32px] z-10">
          <h2 className="font-bold text-gray-800">
            {isEditMode 
              ? (isVet ? 'Edit Prescription' : 'Edit Service Notes')
              : (isVet ? 'Add Prescription' : 'Add Service Notes')
            }
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6 pb-32">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              <span className="ml-3 text-gray-600">Loading prescription...</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Content (hidden while loading) */}
          {!loading && (
            <>

          {/* Booking Info */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-2xl">
                🐾
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">{booking.petName}</h3>
                <p className="text-sm text-gray-600">{booking.petBreed} • {booking.serviceName}</p>
              </div>
            </div>
          </div>

          {/* Vitals Section (for vets) */}
          {isVet && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-gray-800">Vitals</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="12.5"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Temp (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="101.5"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="120"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Resp. Rate (/min)</label>
                  <input
                    type="number"
                    value={respiratoryRate}
                    onChange={(e) => setRespiratoryRate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="30"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">Blood Pressure</label>
                <input
                  type="text"
                  value={bloodPressure}
                  onChange={(e) => setBloodPressure(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="120/80"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Vital Notes</label>
                <textarea
                  value={vitalNotes}
                  onChange={(e) => setVitalNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Any observations about vitals..."
                />
              </div>
            </div>
          )}

          {/* Diagnosis (for vets) */}
          {isVet && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-gray-800">Diagnosis</h3>
              <textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Enter diagnosis..."
              />
            </div>
          )}

          {/* Observations */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-gray-800">Observations</h3>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="What did you observe during the service?"
            />
          </div>

          {/* Medications Section */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Medications</h3>
              <button
                onClick={addMedication}
                className="flex items-center gap-1 px-3 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {medications.map((med, idx) => (
              <div key={idx} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-800">Medicine {idx + 1}</h4>
                  <button
                    onClick={() => removeMedication(idx)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Medicine Name *</label>
                  <input
                    type="text"
                    value={med.name}
                    onChange={(e) => updateMedication(idx, 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., Amoxicillin"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Dosage</label>
                    <input
                      type="text"
                      value={med.dosage}
                      onChange={(e) => updateMedication(idx, 'dosage', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="e.g., 500mg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Frequency</label>
                    <input
                      type="text"
                      value={med.frequency}
                      onChange={(e) => updateMedication(idx, 'frequency', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="e.g., 2x daily"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Duration</label>
                  <input
                    type="text"
                    value={med.duration}
                    onChange={(e) => updateMedication(idx, 'duration', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., 7 days"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Instructions</label>
                  <textarea
                    value={med.instructions}
                    onChange={(e) => updateMedication(idx, 'instructions', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., Take with food"
                  />
                </div>
              </div>
            ))}

            {medications.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-4">
                No medications added. Click "Add" to add medications.
              </p>
            )}
          </div>

          {/* Products Used Section */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Products Used</h3>
              <button
                onClick={addProduct}
                className="flex items-center gap-1 px-3 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {productsUsed.map((prod, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-800">Product {idx + 1}</h4>
                  <button
                    onClick={() => removeProduct(idx)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={prod.name}
                    onChange={(e) => updateProduct(idx, 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., Shampoo X"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Quantity</label>
                  <input
                    type="text"
                    value={prod.quantity}
                    onChange={(e) => updateProduct(idx, 'quantity', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., 200ml"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Notes</label>
                  <textarea
                    value={prod.notes}
                    onChange={(e) => updateProduct(idx, 'notes', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Any notes about this product..."
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Tests Recommended (for vets) */}
          {isVet && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800">Tests Recommended</h3>
                <button
                  onClick={addTest}
                  className="flex items-center gap-1 px-3 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              {testsRecommended.map((test, idx) => (
                <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-800">Test {idx + 1}</h4>
                    <button
                      onClick={() => removeTest(idx)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Test Name *</label>
                    <input
                      type="text"
                      value={test.testName}
                      onChange={(e) => updateTest(idx, 'testName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="e.g., Blood Test"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Reason</label>
                    <textarea
                      value={test.reason}
                      onChange={(e) => updateTest(idx, 'reason', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Why is this test recommended?"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Priority</label>
                    <select
                      value={test.priority}
                      onChange={(e) => updateTest(idx, 'priority', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="optional">Optional</option>
                      <option value="recommended">Recommended</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* General Notes */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-gray-800">General Notes</h3>
            <textarea
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Any additional notes about the service..."
            />
          </div>

          {/* Recommendations */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-gray-800">Recommendations</h3>
            <textarea
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="What do you recommend the pet owner should do?"
            />
          </div>

          {/* Follow-up */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-500" />
              Follow-up Appointment
            </h3>
            
            <div>
              <label className="block text-sm text-gray-600 mb-1">Next Follow-up Date</label>
              <input
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {nextFollowUpDate && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">Follow-up Reason</label>
                <textarea
                  value={followUpReason}
                  onChange={(e) => setFollowUpReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Why is a follow-up needed?"
                />
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* Fixed Bottom Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 space-y-3">
          <Button
            onClick={handleSubmit}
            disabled={saving || loading}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {isEditMode ? 'Updating...' : 'Saving...'}
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {isEditMode ? 'Update' : 'Save'} {isVet ? 'Prescription' : 'Service Notes'}
              </>
            )}
          </Button>
          
          {/* Home Indicator */}
          <div className="flex justify-center">
            <div className="w-32 h-1 bg-gray-300 rounded-full"></div>
          </div>
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
