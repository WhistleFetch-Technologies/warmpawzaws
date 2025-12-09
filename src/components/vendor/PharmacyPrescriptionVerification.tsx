import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { 
  FileCheck, AlertTriangle, CheckCircle, XCircle, Clock, 
  Search, Filter, Eye, Download, Pill, Calendar, User,
  AlertCircle, Shield, FileText, Phone
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface Prescription {
  id: string;
  prescriptionNumber: string;
  customerName: string;
  customerPhone: string;
  doctorName: string;
  doctorLicense: string;
  prescriptionDate: string;
  expiryDate: string;
  medications: Medication[];
  prescriptionImage: string;
  status: 'pending_verification' | 'verified' | 'rejected' | 'dispensed';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  orderId?: string;
  totalAmount?: number;
  controlledSubstances: boolean;
  createdAt: string;
}

interface Medication {
  name: string;
  dosage: string;
  quantity: number;
  frequency: string;
  duration: string;
  isControlled: boolean;
  scheduleType?: 'H' | 'X'; // Schedule H, Schedule X
}

export function PharmacyPrescriptionVerification({ vendorId }: { vendorId: string }) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [filteredPrescriptions, setFilteredPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_verification' | 'verified' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [controlledFilter, setControlledFilter] = useState<'all' | 'controlled' | 'non-controlled'>('all');

  useEffect(() => {
    loadPrescriptions();
  }, [vendorId]);

  useEffect(() => {
    filterPrescriptions();
  }, [prescriptions, statusFilter, searchQuery, controlledFilter]);

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/prescriptions`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPrescriptions(data.prescriptions || []);
      }
    } catch (error) {
      console.error('Error loading prescriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPrescriptions = () => {
    let filtered = [...prescriptions];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Controlled substances filter
    if (controlledFilter === 'controlled') {
      filtered = filtered.filter(p => p.controlledSubstances);
    } else if (controlledFilter === 'non-controlled') {
      filtered = filtered.filter(p => !p.controlledSubstances);
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.prescriptionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.doctorName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredPrescriptions(filtered);
  };

  const verifyPrescription = async (prescriptionId: string, approved: boolean) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/prescriptions/${prescriptionId}/verify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            approved,
            notes: verificationNotes,
            rejectionReason: approved ? undefined : rejectionReason
          })
        }
      );

      if (response.ok) {
        await loadPrescriptions();
        setShowVerifyModal(false);
        setVerificationNotes('');
        setRejectionReason('');
        alert(approved ? '✅ Prescription verified successfully!' : '❌ Prescription rejected');
      }
    } catch (error) {
      console.error('Error verifying prescription:', error);
      alert('Failed to verify prescription');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_verification':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'verified':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'dispensed':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><CheckCircle className="w-3 h-3 mr-1" />Dispensed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = {
    total: prescriptions.length,
    pending: prescriptions.filter(p => p.status === 'pending_verification').length,
    verified: prescriptions.filter(p => p.status === 'verified').length,
    rejected: prescriptions.filter(p => p.status === 'rejected').length,
    controlled: prescriptions.filter(p => p.controlledSubstances).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading prescriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileCheck className="w-7 h-7 text-[#FF8C42]" />
            Prescription Verification
          </h2>
          <p className="text-gray-600 mt-1">Review and verify customer prescriptions</p>
        </div>
        <Button onClick={loadPrescriptions} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600 mt-1">Total</div>
        </Card>
        <Card className="p-4 border-yellow-200 bg-yellow-50">
          <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
          <div className="text-sm text-yellow-600 mt-1">Pending Review</div>
        </Card>
        <Card className="p-4 border-green-200 bg-green-50">
          <div className="text-2xl font-bold text-green-700">{stats.verified}</div>
          <div className="text-sm text-green-600 mt-1">Verified</div>
        </Card>
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="text-2xl font-bold text-red-700">{stats.rejected}</div>
          <div className="text-sm text-red-600 mt-1">Rejected</div>
        </Card>
        <Card className="p-4 border-orange-200 bg-orange-50">
          <div className="text-2xl font-bold text-orange-700">{stats.controlled}</div>
          <div className="text-sm text-orange-600 mt-1 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Controlled
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-gray-600 mb-2">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Rx number, customer, doctor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-2">Status</Label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending_verification">Pending Review</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-2">Type</Label>
            <select
              value={controlledFilter}
              onChange={(e) => setControlledFilter(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Prescriptions</option>
              <option value="controlled">Controlled Substances</option>
              <option value="non-controlled">Non-Controlled</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setControlledFilter('all');
              }}
              className="w-full"
            >
              <Filter className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Prescriptions List */}
      <div className="space-y-3">
        {filteredPrescriptions.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No prescriptions found</p>
            {(statusFilter !== 'all' || searchQuery || controlledFilter !== 'all') && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setControlledFilter('all');
                }}
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </Card>
        ) : (
          filteredPrescriptions.map((prescription) => (
            <Card key={prescription.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-lg font-semibold text-gray-900">
                      Rx #{prescription.prescriptionNumber}
                    </div>
                    {getStatusBadge(prescription.status)}
                    {prescription.controlledSubstances && (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        <Shield className="w-3 h-3 mr-1" />
                        Controlled
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                    <div>
                      <div className="text-gray-500 text-xs mb-1">Patient</div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{prescription.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 text-xs mt-1">
                        <Phone className="w-3 h-3" />
                        {prescription.customerPhone}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs mb-1">Prescriber</div>
                      <div className="font-medium">{prescription.doctorName}</div>
                      <div className="text-gray-600 text-xs">License: {prescription.doctorLicense}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs mb-1">Date</div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>{new Date(prescription.prescriptionDate).toLocaleDateString()}</span>
                      </div>
                      <div className="text-gray-600 text-xs mt-1">
                        Expires: {new Date(prescription.expiryDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-gray-500 text-xs mb-2">Medications ({prescription.medications.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {prescription.medications.slice(0, 3).map((med, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-gray-100 rounded px-2 py-1 text-xs">
                          <Pill className="w-3 h-3 text-gray-600" />
                          <span className="font-medium">{med.name}</span>
                          <span className="text-gray-600">- {med.dosage}</span>
                          {med.isControlled && (
                            <Shield className="w-3 h-3 text-orange-500" />
                          )}
                        </div>
                      ))}
                      {prescription.medications.length > 3 && (
                        <span className="text-xs text-gray-600 px-2 py-1">
                          +{prescription.medications.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {prescription.status === 'rejected' && prescription.rejectionReason && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        Rejection Reason
                      </div>
                      <div className="text-red-600">{prescription.rejectionReason}</div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPrescription(prescription);
                      setShowDetailModal(true);
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                  {prescription.status === 'pending_verification' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedPrescription(prescription);
                        setShowVerifyModal(true);
                      }}
                      className="bg-[#FF8C42] hover:bg-[#ff7a2e]"
                    >
                      <FileCheck className="w-4 h-4 mr-2" />
                      Verify
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Verification Modal */}
      <Dialog open={showVerifyModal} onOpenChange={setShowVerifyModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Verify Prescription - Rx #{selectedPrescription?.prescriptionNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Prescription Image */}
            {selectedPrescription?.prescriptionImage && (
              <div>
                <Label className="mb-2">Prescription Image</Label>
                <img 
                  src={selectedPrescription.prescriptionImage} 
                  alt="Prescription"
                  className="w-full border rounded-lg"
                />
              </div>
            )}

            {/* Verification Checklist */}
            <Card className="p-4 bg-yellow-50 border-yellow-200">
              <div className="font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                Verification Checklist
              </div>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" />
                  Doctor name and license number verified
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" />
                  Prescription date is valid
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" />
                  Medications and dosages are clear
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" />
                  Patient details match order
                </label>
                {selectedPrescription?.controlledSubstances && (
                  <label className="flex items-center gap-2 text-orange-700">
                    <input type="checkbox" />
                    <Shield className="w-4 h-4" />
                    Controlled substance regulations verified
                  </label>
                )}
              </div>
            </Card>

            <div>
              <Label>Verification Notes</Label>
              <Textarea
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="Add any notes about this prescription..."
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => verifyPrescription(selectedPrescription!.id, true)}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve & Verify
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const reason = prompt('Enter rejection reason:');
                  if (reason) {
                    setRejectionReason(reason);
                    verifyPrescription(selectedPrescription!.id, false);
                  }
                }}
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prescription Details - Rx #{selectedPrescription?.prescriptionNumber}</DialogTitle>
          </DialogHeader>
          {selectedPrescription && (
            <div className="space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                {getStatusBadge(selectedPrescription.status)}
                {selectedPrescription.controlledSubstances && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    <Shield className="w-4 h-4 mr-1" />
                    Contains Controlled Substances
                  </Badge>
                )}
              </div>

              {/* Patient & Doctor Info */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="text-sm text-gray-600 mb-2">Patient Information</div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-gray-500">Name</div>
                      <div className="font-medium">{selectedPrescription.customerName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Phone</div>
                      <div className="font-medium">{selectedPrescription.customerPhone}</div>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-gray-600 mb-2">Prescriber Information</div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-gray-500">Doctor</div>
                      <div className="font-medium">{selectedPrescription.doctorName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">License</div>
                      <div className="font-medium">{selectedPrescription.doctorLicense}</div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Dates */}
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Prescription Date</div>
                    <div className="font-medium">{new Date(selectedPrescription.prescriptionDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Expiry Date</div>
                    <div className="font-medium">{new Date(selectedPrescription.expiryDate).toLocaleDateString()}</div>
                  </div>
                </div>
              </Card>

              {/* Medications */}
              <div>
                <div className="text-sm font-semibold text-gray-900 mb-3">Prescribed Medications</div>
                <div className="space-y-3">
                  {selectedPrescription.medications.map((med, idx) => (
                    <Card key={idx} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Pill className="w-5 h-5 text-[#FF8C42]" />
                            <span className="font-semibold text-lg">{med.name}</span>
                            {med.isControlled && (
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                                <Shield className="w-3 h-3 mr-1" />
                                Schedule {med.scheduleType}
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-xs text-gray-500">Dosage</div>
                              <div className="font-medium">{med.dosage}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Quantity</div>
                              <div className="font-medium">{med.quantity} units</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Frequency</div>
                              <div className="font-medium">{med.frequency}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Duration</div>
                              <div className="font-medium">{med.duration}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Prescription Image */}
              {selectedPrescription.prescriptionImage && (
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-3">Prescription Document</div>
                  <img 
                    src={selectedPrescription.prescriptionImage} 
                    alt="Prescription"
                    className="w-full border rounded-lg"
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
