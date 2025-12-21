import { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, FileText, User, Calendar, Pill, Search, Filter } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface PrescriptionVerificationProps {
  vendorId: string;
  onClose: () => void;
}

interface PrescriptionRequest {
  id: string;
  prescriptionId: string;
  customerName: string;
  petName: string;
  doctorName: string;
  medications: any[];
  status: 'pending' | 'verified' | 'rejected' | 'requires_clarification';
  submittedAt: string;
  imageUrl?: string;
  notes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

export function VendorPrescriptionVerification({ vendorId, onClose }: PrescriptionVerificationProps) {
  const [prescriptions, setPrescriptions] = useState<PrescriptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionRequest | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('pending');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchPrescriptions();
  }, [vendorId, filter]);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/vendor/prescription-verification/${vendorId}?status=${filter === 'all' ? '' : filter}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      const data = await response.json();
      // ✅ FIX: Handle standardized response format
      // Response format: { success: true, prescriptions: [...], total: ... }
      if (data.success) {
        setPrescriptions(data.prescriptions || data.data?.prescriptions || []);
      } else {
        const errorData = data.error || data.message || 'Unknown error';
        console.error('Failed to fetch prescriptions:', errorData);
        toast.error(errorData);
      }
    } catch (error: any) {
      console.error('Error fetching prescriptions:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const verifyPrescription = async (prescriptionId: string, status: 'verified' | 'rejected', notes: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/vendor/prescription-verification/${vendorId}/verify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prescriptionId,
            status,
            notes,
            rejectionReason: status === 'rejected' ? rejectionReason : undefined
          })
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success(`Prescription ${status === 'verified' ? 'verified' : 'rejected'} successfully`);
        setShowVerifyModal(false);
        setSelectedPrescription(null);
        setVerificationNotes('');
        setRejectionReason('');
        await fetchPrescriptions(); // ✅ Ensure prescriptions reload
      } else {
        const errorData = data.error || data.message || 'Failed to verify prescription';
        toast.error(errorData);
      }
    } catch (error: any) {
      console.error('Error verifying prescription:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  const filteredPrescriptions = prescriptions.filter(p => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        p.customerName.toLowerCase().includes(query) ||
        p.petName.toLowerCase().includes(query) ||
        p.doctorName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const stats = {
    pending: prescriptions.filter(p => p.status === 'pending').length,
    verified: prescriptions.filter(p => p.status === 'verified').length,
    rejected: prescriptions.filter(p => p.status === 'rejected').length,
    total: prescriptions.length
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-7 h-7 text-blue-600" />
                Prescription Verification
              </h2>
              <p className="text-sm text-gray-600 mt-1">Verify and approve customer prescriptions</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-600">Total</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
              <div className="text-xs text-yellow-700">Pending</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
              <div className="text-2xl font-bold text-green-700">{stats.verified}</div>
              <div className="text-xs text-green-700">Verified</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
              <div className="text-2xl font-bold text-red-700">{stats.rejected}</div>
              <div className="text-xs text-red-700">Rejected</div>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-3 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer, pet, or doctor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Pending ({stats.pending})
            </button>
            <button
              onClick={() => setFilter('verified')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'verified' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Verified
            </button>
            <button
              onClick={() => setFilter('rejected')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === 'rejected' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Rejected
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-gray-600">Loading prescriptions...</p>
            </div>
          ) : filteredPrescriptions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No prescriptions found</p>
              <p className="text-sm text-gray-500 mt-1">
                {filter === 'pending' ? 'No pending prescriptions to verify' : 'Try changing your filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPrescriptions.map((prescription) => (
                <div
                  key={prescription.id}
                  className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        prescription.status === 'verified' ? 'bg-green-100' :
                        prescription.status === 'rejected' ? 'bg-red-100' :
                        prescription.status === 'requires_clarification' ? 'bg-yellow-100' :
                        'bg-blue-100'
                      }`}>
                        {prescription.status === 'verified' ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : prescription.status === 'rejected' ? (
                          <XCircle className="w-6 h-6 text-red-600" />
                        ) : prescription.status === 'requires_clarification' ? (
                          <AlertTriangle className="w-6 h-6 text-yellow-600" />
                        ) : (
                          <FileText className="w-6 h-6 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{prescription.customerName}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                          <User className="w-4 h-4" />
                          <span>Pet: {prescription.petName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(prescription.submittedAt).toLocaleDateString()}</span>
                        </div>
                        {prescription.doctorName && (
                          <div className="text-sm text-gray-600 mt-1">
                            Doctor: {prescription.doctorName}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      prescription.status === 'verified' ? 'bg-green-100 text-green-700' :
                      prescription.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      prescription.status === 'requires_clarification' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {prescription.status === 'requires_clarification' ? 'Needs Info' : prescription.status.charAt(0).toUpperCase() + prescription.status.slice(1)}
                    </div>
                  </div>

                  {/* Medications */}
                  {prescription.medications && prescription.medications.length > 0 && (
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Pill className="w-4 h-4" />
                        Medications ({prescription.medications.length})
                      </div>
                      <div className="space-y-2">
                        {prescription.medications.slice(0, 3).map((med: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-2 text-sm">
                            <div className="font-medium text-gray-900">{med.name}</div>
                            <div className="text-gray-600 text-xs">
                              {med.dosage} • {med.frequency} • {med.duration}
                            </div>
                          </div>
                        ))}
                        {prescription.medications.length > 3 && (
                          <div className="text-xs text-blue-600">
                            +{prescription.medications.length - 3} more medications
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {prescription.notes && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-700 mb-1">Notes:</div>
                      <div className="text-sm text-gray-600">{prescription.notes}</div>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {prescription.status === 'rejected' && prescription.rejectionReason && (
                    <div className="mb-3 p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="text-xs font-medium text-red-700 mb-1">Rejection Reason:</div>
                      <div className="text-sm text-red-600">{prescription.rejectionReason}</div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    {prescription.status === 'pending' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedPrescription(prescription);
                            setShowVerifyModal(true);
                          }}
                          className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Verify
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPrescription(prescription);
                            setShowVerifyModal(true);
                          }}
                          className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </>
                    )}
                    {prescription.imageUrl && (
                      <button
                        onClick={() => window.open(prescription.imageUrl, '_blank')}
                        className="flex-1 py-2 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors"
                      >
                        View Image
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Verification Modal */}
        {showVerifyModal && selectedPrescription && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Verify Prescription
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                For: {selectedPrescription.customerName} ({selectedPrescription.petName})
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verification Notes (Optional)
                </label>
                <textarea
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="Add any notes or comments..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason (if rejecting)
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g., Prescription expired, unclear dosage..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowVerifyModal(false);
                    setSelectedPrescription(null);
                    setVerificationNotes('');
                    setRejectionReason('');
                  }}
                  className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => verifyPrescription(selectedPrescription.prescriptionId, 'rejected', verificationNotes)}
                  className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => verifyPrescription(selectedPrescription.prescriptionId, 'verified', verificationNotes)}
                  className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
