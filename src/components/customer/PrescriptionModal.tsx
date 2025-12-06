import { X, Download, Share2, Pill, FileText, Calendar, AlertCircle, ShoppingCart } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { shareContent } from '../../utils/shareUtils';
import { toast } from 'sonner';

interface PrescriptionModalProps {
  bookingId: string;
  prescription?: Prescription | null;
  onClose: () => void;
  onReorderMedicine?: (medications: any[]) => void;
}

interface Prescription {
  id: string;
  bookingId: string;
  petId: string;
  petName: string;
  vendorId: string;
  vendorName: string;
  vendorType: string;
  serviceType: string;
  serviceName: string;
  diagnosis?: string;
  observations?: string;
  medications?: {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }[];
  productsUsed?: {
    name: string;
    quantity: string;
    notes: string;
  }[];
  testsRecommended?: {
    testName: string;
    reason: string;
    priority: 'urgent' | 'recommended' | 'optional';
  }[];
  generalNotes: string;
  recommendations: string;
  nextFollowUpDate?: string;
  followUpReason?: string;
  attachments?: {
    id: string;
    type: 'image' | 'document' | 'video';
    url: string;
    name: string;
    uploadedAt: string;
  }[];
  vitals?: {
    weight?: number;
    temperature?: number;
    heartRate?: number;
    respiratoryRate?: number;
    bloodPressure?: string;
    notes?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export function PrescriptionModal({ bookingId, prescription, onClose, onReorderMedicine }: PrescriptionModalProps) {
  const [localPrescription, setLocalPrescription] = useState<Prescription | null>(prescription || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!prescription) {
      loadPrescription();
    } else {
      setLoading(false);
    }
  }, [bookingId, prescription]);

  const loadPrescription = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/prescription/booking/${bookingId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        setLocalPrescription(result.prescription);
      }
    } catch (error) {
      console.error('Error loading prescription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    // Create a simple text version of the prescription
    if (!localPrescription) return;

    let content = `PRESCRIPTION / SERVICE NOTES\n`;
    content += `\n${'='.repeat(50)}\n\n`;
    content += `Pet: ${localPrescription.petName}\n`;
    content += `Service Provider: ${localPrescription.vendorName}\n`;
    content += `Service: ${localPrescription.serviceName}\n`;
    content += `Date: ${new Date(localPrescription.createdAt).toLocaleDateString()}\n`;
    content += `\n${'='.repeat(50)}\n\n`;

    if (localPrescription.diagnosis) {
      content += `DIAGNOSIS:\n${localPrescription.diagnosis}\n\n`;
    }

    if (localPrescription.observations) {
      content += `OBSERVATIONS:\n${localPrescription.observations}\n\n`;
    }

    if (localPrescription.vitals) {
      content += `VITALS:\n`;
      if (localPrescription.vitals.weight) content += `  Weight: ${localPrescription.vitals.weight} kg\n`;
      if (localPrescription.vitals.temperature) content += `  Temperature: ${localPrescription.vitals.temperature}°F\n`;
      if (localPrescription.vitals.heartRate) content += `  Heart Rate: ${localPrescription.vitals.heartRate} bpm\n`;
      if (localPrescription.vitals.respiratoryRate) content += `  Respiratory Rate: ${localPrescription.vitals.respiratoryRate} /min\n`;
      if (localPrescription.vitals.bloodPressure) content += `  Blood Pressure: ${localPrescription.vitals.bloodPressure}\n`;
      content += '\n';
    }

    if (localPrescription.medications && localPrescription.medications.length > 0) {
      content += `MEDICATIONS:\n`;
      localPrescription.medications.forEach((med, idx) => {
        content += `${idx + 1}. ${med.name}\n`;
        content += `   Dosage: ${med.dosage}\n`;
        content += `   Frequency: ${med.frequency}\n`;
        content += `   Duration: ${med.duration}\n`;
        if (med.instructions) content += `   Instructions: ${med.instructions}\n`;
        content += '\n';
      });
    }

    if (localPrescription.productsUsed && localPrescription.productsUsed.length > 0) {
      content += `PRODUCTS USED:\n`;
      localPrescription.productsUsed.forEach((prod, idx) => {
        content += `${idx + 1}. ${prod.name} (Qty: ${prod.quantity})\n`;
        if (prod.notes) content += `   Notes: ${prod.notes}\n`;
        content += '\n';
      });
    }

    if (localPrescription.testsRecommended && localPrescription.testsRecommended.length > 0) {
      content += `TESTS RECOMMENDED:\n`;
      localPrescription.testsRecommended.forEach((test, idx) => {
        content += `${idx + 1}. ${test.testName} (${test.priority.toUpperCase()})\n`;
        content += `   Reason: ${test.reason}\n\n`;
      });
    }

    if (localPrescription.generalNotes) {
      content += `NOTES:\n${localPrescription.generalNotes}\n\n`;
    }

    if (localPrescription.recommendations) {
      content += `RECOMMENDATIONS:\n${localPrescription.recommendations}\n\n`;
    }

    if (localPrescription.nextFollowUpDate) {
      content += `NEXT FOLLOW-UP:\n`;
      content += `Date: ${new Date(localPrescription.nextFollowUpDate).toLocaleDateString()}\n`;
      if (localPrescription.followUpReason) content += `Reason: ${localPrescription.followUpReason}\n`;
    }

    // Create and download file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prescription_${localPrescription.petName}_${new Date(localPrescription.createdAt).toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    if (!localPrescription) return;

    const shareText = `Prescription for ${localPrescription.petName}\nService: ${localPrescription.serviceName}\nProvider: ${localPrescription.vendorName}\nDate: ${new Date(localPrescription.createdAt).toLocaleDateString()}`;

    await shareContent({
      title: 'Pet Prescription',
      text: shareText
    });
  };

  const isVet = localPrescription?.vendorType === 'vet' || localPrescription?.serviceType === 'vet';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div 
        className="bg-white w-full max-w-[430px] rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-[32px] z-10">
          <h2 className="font-bold text-gray-800">
            {isVet ? 'Prescription' : 'Service Notes'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        ) : !localPrescription ? (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-semibold mb-2">No {isVet ? 'Prescription' : 'Service Notes'} Available</p>
            <p className="text-sm text-gray-500">The service provider hasn't added notes yet</p>
          </div>
        ) : (
          <div className="p-6 space-y-6 pb-24">
            {/* Quick Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 bg-[#FF8C42] text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#FF7A2F] transition-colors"
              >
                <Download className="w-5 h-5" />
                Download
              </button>
              <button
                onClick={handleShare}
                className="flex-1 bg-white border-2 border-[#FF8C42] text-[#FF8C42] py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-orange-50 transition-colors"
              >
                <Share2 className="w-5 h-5" />
                Share
              </button>
            </div>

            {/* Reorder Medicine Button (if medications exist) */}
            {localPrescription.medications && localPrescription.medications.length > 0 && onReorderMedicine && (
              <button
                onClick={() => onReorderMedicine(localPrescription.medications || [])}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 rounded-xl flex items-center justify-center gap-2 hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg"
              >
                <ShoppingCart className="w-5 h-5" />
                Reorder Medicine Online
              </button>
            )}

            {/* Service Info */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-[#FF8C42] rounded-full flex items-center justify-center">
                  {isVet ? <span className="text-2xl">⚕️</span> : <span className="text-2xl">📋</span>}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">{localPrescription.vendorName}</h3>
                  <p className="text-sm text-gray-600">{localPrescription.serviceName}</p>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <p>Pet: <span className="font-semibold text-gray-800">{localPrescription.petName}</span></p>
                <p>Date: <span className="font-semibold text-gray-800">
                  {new Date(localPrescription.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span></p>
              </div>
            </div>

            {/* Vitals (for vets) */}
            {localPrescription.vitals && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800">Vitals</h3>
                <div className="grid grid-cols-2 gap-3">
                  {localPrescription.vitals.weight && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-600 mb-1">Weight</p>
                      <p className="font-semibold text-gray-800">{localPrescription.vitals.weight} kg</p>
                    </div>
                  )}
                  {localPrescription.vitals.temperature && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-600 mb-1">Temperature</p>
                      <p className="font-semibold text-gray-800">{localPrescription.vitals.temperature}°F</p>
                    </div>
                  )}
                  {localPrescription.vitals.heartRate && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-600 mb-1">Heart Rate</p>
                      <p className="font-semibold text-gray-800">{localPrescription.vitals.heartRate} bpm</p>
                    </div>
                  )}
                  {localPrescription.vitals.respiratoryRate && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-600 mb-1">Respiratory Rate</p>
                      <p className="font-semibold text-gray-800">{localPrescription.vitals.respiratoryRate} /min</p>
                    </div>
                  )}
                </div>
                {localPrescription.vitals.bloodPressure && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-600 mb-1">Blood Pressure</p>
                    <p className="font-semibold text-gray-800">{localPrescription.vitals.bloodPressure}</p>
                  </div>
                )}
              </div>
            )}

            {/* Diagnosis */}
            {localPrescription.diagnosis && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[#FF8C42]" />
                  Diagnosis
                </h3>
                <p className="text-gray-700">{localPrescription.diagnosis}</p>
              </div>
            )}

            {/* Observations */}
            {localPrescription.observations && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800">Observations</h3>
                <p className="text-gray-700">{localPrescription.observations}</p>
              </div>
            )}

            {/* Medications */}
            {localPrescription.medications && localPrescription.medications.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-[#FF8C42]" />
                  Medications
                </h3>
                {localPrescription.medications.map((med, idx) => (
                  <div key={idx} className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-800 mb-2">{idx + 1}. {med.name}</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-600">Dosage:</span> <span className="font-medium text-gray-800">{med.dosage}</span></p>
                      <p><span className="text-gray-600">Frequency:</span> <span className="font-medium text-gray-800">{med.frequency}</span></p>
                      <p><span className="text-gray-600">Duration:</span> <span className="font-medium text-gray-800">{med.duration}</span></p>
                      {med.instructions && (
                        <p className="text-gray-700 mt-2 italic">{med.instructions}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Products Used */}
            {localPrescription.productsUsed && localPrescription.productsUsed.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800">Products Used</h3>
                {localPrescription.productsUsed.map((prod, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-3">
                    <h4 className="font-semibold text-gray-800">{idx + 1}. {prod.name}</h4>
                    <p className="text-sm text-gray-600">Quantity: {prod.quantity}</p>
                    {prod.notes && <p className="text-sm text-gray-700 mt-1">{prod.notes}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Tests Recommended */}
            {localPrescription.testsRecommended && localPrescription.testsRecommended.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800">Tests Recommended</h3>
                {localPrescription.testsRecommended.map((test, idx) => (
                  <div key={idx} className={`rounded-xl p-3 border-2 ${
                    test.priority === 'urgent' ? 'bg-red-50 border-red-300' :
                    test.priority === 'recommended' ? 'bg-yellow-50 border-yellow-300' :
                    'bg-blue-50 border-blue-300'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-gray-800">{test.testName}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        test.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                        test.priority === 'recommended' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {test.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{test.reason}</p>
                  </div>
                ))}
              </div>
            )}

            {/* General Notes */}
            {localPrescription.generalNotes && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800">Notes</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{localPrescription.generalNotes}</p>
              </div>
            )}

            {/* Recommendations */}
            {localPrescription.recommendations && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800">Recommendations</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{localPrescription.recommendations}</p>
              </div>
            )}

            {/* Follow-up */}
            {localPrescription.nextFollowUpDate && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-2xl p-5">
                <h3 className="font-bold text-purple-900 flex items-center gap-2 mb-3">
                  <Calendar className="w-5 h-5" />
                  Next Follow-up
                </h3>
                <p className="text-purple-800 font-semibold">
                  {new Date(localPrescription.nextFollowUpDate).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
                {localPrescription.followUpReason && (
                  <p className="text-sm text-purple-700 mt-2">{localPrescription.followUpReason}</p>
                )}
              </div>
            )}

            {/* Attachments */}
            {localPrescription.attachments && localPrescription.attachments.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800">Attachments</h3>
                <div className="grid grid-cols-2 gap-3">
                  {localPrescription.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gray-50 border border-gray-200 rounded-xl p-3 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {attachment.type === 'image' ? '🖼️' : 
                         attachment.type === 'video' ? '🎥' : '📄'}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{attachment.name}</p>
                          <p className="text-xs text-gray-600">{attachment.type}</p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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