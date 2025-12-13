import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { X, Check, AlertCircle, Mail, Phone, MapPin, FileText, Calendar, User, Building, CreditCard, Eye, ArrowLeft, Download, RefreshCw, Clock, Briefcase } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface AdminVendorApplicationReviewProps {
  onBack: () => void;
}

interface Application {
  id: string;
  vendorId: string;
  fullName: string;
  businessName: string;
  vendorType: string;
  serviceStyle: string;
  email: string;
  phone: string;
  location: any;
  address: string;
  documents: any[];
  status: string;
  submittedAt: string;
  additionalInfo: any;
}

export function AdminVendorApplicationReview({ onBack }: AdminVendorApplicationReviewProps) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showClarificationModal, setShowClarificationModal] = useState(false);

  useEffect(() => {
    loadPendingApplications();
  }, []);

  const loadPendingApplications = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor/applications/pending`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications || []);
      }
    } catch (error) {
      console.error('Error loading applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedApp) return;

    setActionLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor/application/${selectedApp.id}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            reviewerName: 'Admin',
            notes: reviewNotes
          })
        }
      );

      if (response.ok) {
        toast.success('Application approved! Vendor notified via SMS and email.');
        setShowApproveModal(false);
        setSelectedApp(null);
        setReviewNotes('');
        await loadPendingApplications();
      } else {
        toast.error('Failed to approve application');
      }
    } catch (error) {
      console.error('Error approving application:', error);
      toast.error('Error approving application');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor/application/${selectedApp.id}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            reviewerName: 'Admin',
            reason: rejectionReason,
            allowResubmit: true
          })
        }
      );

      if (response.ok) {
        toast.success('Application rejected. Vendor notified via SMS and email.');
        setShowRejectModal(false);
        setSelectedApp(null);
        setRejectionReason('');
        await loadPendingApplications();
      } else {
        toast.error('Failed to reject application');
      }
    } catch (error) {
      console.error('Error rejecting application:', error);
      toast.error('Error rejecting application');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestClarification = async () => {
    if (!selectedApp || !reviewNotes.trim()) {
      toast.error('Please provide clarification notes');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor/application/${selectedApp.id}/request-clarification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            reviewerName: 'Admin',
            notes: reviewNotes
          })
        }
      );

      if (response.ok) {
        toast.success('Clarification requested. Vendor notified via SMS and email.');
        setShowClarificationModal(false);
        setSelectedApp(null);
        setReviewNotes('');
        await loadPendingApplications();
      } else {
        toast.error('Failed to request clarification');
      }
    } catch (error) {
      console.error('Error requesting clarification:', error);
      toast.error('Error requesting clarification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadDocument = async (doc: any, index: number) => {
    try {
      if (!doc.url) {
        toast.error('Document URL not available');
        return;
      }

      toast.info('Downloading document...');
      
      // Fetch the document
      const response = await fetch(doc.url);
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }

      // Convert to blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name || doc.fileName || `document_${index + 1}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Document downloaded successfully');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  const getTimeSince = (dateString: string) => {
    const now = new Date();
    const submitted = new Date(dateString);
    const diffMs = now.getTime() - submitted.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  // Application Detail View
  if (selectedApp) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedApp(null)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h2 className="font-semibold text-gray-900">Application Review</h2>
              <p className="text-sm text-gray-500">ID: {selectedApp.id}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={loadPendingApplications}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Left Column - Personal Info */}
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-[#FF8C42]" />
                  Personal Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">Full Name</label>
                    <p className="font-medium text-gray-900">{selectedApp.fullName}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Business Name</label>
                    <p className="font-medium text-gray-900">{selectedApp.businessName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Email</label>
                    <p className="font-medium text-gray-900 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {selectedApp.email}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Phone</label>
                    <p className="font-medium text-gray-900 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      {selectedApp.phone}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5 text-[#FF8C42]" />
                  Business Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">Vendor Type</label>
                    <p className="font-medium text-gray-900 capitalize">{selectedApp.vendorType?.replace(/-/g, ' ')}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Service Style</label>
                    <p className="font-medium text-gray-900">
                      {selectedApp.serviceStyle === 'at_home' && '🏠 At Home'}
                      {selectedApp.serviceStyle === 'at_center' && '🏢 At Center'}
                      {selectedApp.serviceStyle === 'both' && '🌐 Both'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Submitted</label>
                    <p className="font-medium text-gray-900 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {getTimeSince(selectedApp.submittedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Location & Documents */}
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#FF8C42]" />
                  Location
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">Address</label>
                    <p className="font-medium text-gray-900">{selectedApp.address}</p>
                  </div>
                  {selectedApp.location && (
                    <div>
                      <label className="text-xs text-gray-500">Coordinates</label>
                      <p className="text-sm text-gray-600">
                        Lat: {selectedApp.location.lat?.toFixed(6)}, Lng: {selectedApp.location.lng?.toFixed(6)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#FF8C42]" />
                  Documents ({selectedApp.documents?.length || 0})
                </h3>
                <div className="space-y-2">
                  {selectedApp.documents && selectedApp.documents.length > 0 ? (
                    selectedApp.documents.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{doc.name || doc.fileName || `Document ${index + 1}`}</p>
                            <p className="text-xs text-gray-500">{doc.category || doc.type || 'Document'}</p>
                          </div>
                        </div>
                        {doc.url ? (
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => window.open(doc.url, '_blank')}
                              title="View Document"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleDownloadDocument(doc, index)}
                              title="Download Document"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" disabled title="Document URL not available">
                            <Eye className="w-4 h-4 text-gray-300" />
                          </Button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No documents uploaded</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <Button
              onClick={() => setShowApproveModal(true)}
              className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              <Check className="w-5 h-5 mr-2" />
              Approve Application
            </Button>
            <Button
              onClick={() => setShowClarificationModal(true)}
              variant="outline"
              className="flex-1 h-12 border-2 border-[#FF8C42] text-[#FF8C42] font-semibold"
            >
              <AlertCircle className="w-5 h-5 mr-2" />
              Request Clarification
            </Button>
            <Button
              onClick={() => setShowRejectModal(true)}
              variant="outline"
              className="flex-1 h-12 border-2 border-red-500 text-red-600 font-semibold hover:bg-red-50"
            >
              <X className="w-5 h-5 mr-2" />
              Reject Application
            </Button>
          </div>
        </div>

        {/* Approve Modal */}
        {showApproveModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Approve Application</h3>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to approve this application? The vendor will be notified via SMS and email.
              </p>
              <div className="mb-4">
                <label className="text-sm text-gray-700 mb-2 block">Review Notes (Optional)</label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add any internal notes about this approval..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowApproveModal(false)}
                  className="flex-1"
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApprove}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Approving...' : 'Approve'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Reject Application</h3>
              <p className="text-sm text-gray-600 mb-4">
                Please provide a clear reason for rejection. This will be sent to the vendor via SMS and email.
              </p>
              <div className="mb-4">
                <label className="text-sm text-gray-700 mb-2 block">Rejection Reason *</label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g., Incomplete documentation, Invalid credentials, etc."
                  className="min-h-[120px]"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1"
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReject}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  disabled={actionLoading || !rejectionReason.trim()}
                >
                  {actionLoading ? 'Rejecting...' : 'Reject'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Clarification Modal */}
        {showClarificationModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Request Clarification</h3>
              <p className="text-sm text-gray-600 mb-4">
                Specify what additional information you need from the vendor. They will be notified via SMS and email.
              </p>
              <div className="mb-4">
                <label className="text-sm text-gray-700 mb-2 block">Clarification Notes *</label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="e.g., Please provide updated insurance certificate, Verify business registration number, etc."
                  className="min-h-[120px]"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowClarificationModal(false)}
                  className="flex-1"
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRequestClarification}
                  className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
                  disabled={actionLoading || !reviewNotes.trim()}
                >
                  {actionLoading ? 'Sending...' : 'Send Request'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Applications List View
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div>
          <h2 className="font-semibold text-gray-900">Pending Vendor Applications</h2>
          <p className="text-sm text-gray-500">{applications.length} applications awaiting review</p>
        </div>
        <div className="flex gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={loadPendingApplications}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Applications List */}
      <div className="p-6">
        {applications.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">No pending applications</p>
            <p className="text-sm text-gray-500">All applications have been reviewed</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <div
                key={app.id}
                className="border border-gray-200 rounded-lg p-5 hover:border-[#FF8C42] transition-all cursor-pointer"
                onClick={() => setSelectedApp(app)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{app.fullName}</h3>
                      {app.businessName && (
                        <span className="text-sm text-gray-500">• {app.businessName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        {app.vendorType?.replace(/-/g, ' ')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {getTimeSince(app.submittedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-orange-100 text-[#FF8C42] text-xs font-semibold rounded-full">
                      Pending Review
                    </span>
                    <Button size="sm" variant="outline">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">
                    <Mail className="w-4 h-4 inline mr-1" />
                    {app.email}
                  </span>
                  <span className="text-gray-500">
                    <Phone className="w-4 h-4 inline mr-1" />
                    {app.phone}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}