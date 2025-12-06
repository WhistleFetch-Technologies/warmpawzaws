import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Check, X, Eye, Download, AlertCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface DeactivationRequest {
  id: string;
  vendorId: string;
  businessName: string;
  reason: string;
  details?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestDate: string;
  approvedAt?: string;
  rejectedAt?: string;
  adminNote?: string;
}

export function DeactivationRequestsTab() {
  const [requests, setRequests] = useState<DeactivationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<DeactivationRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/deactivation-requests`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error loading deactivation requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: DeactivationRequest) => {
    const adminNote = prompt('Add a note about this approval (optional):');
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/deactivation/${request.id}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ adminNote: adminNote || '' })
        }
      );

      if (response.ok) {
        alert('✅ Deactivation request approved successfully!');
        loadRequests();
      } else {
        alert('❌ Failed to approve request. Please try again.');
      }
    } catch (error) {
      console.error('Error approving request:', error);
      alert('❌ Error approving request.');
    }
  };

  const handleReject = async (request: DeactivationRequest) => {
    const adminNote = prompt('Please provide a reason for rejection:');
    
    if (!adminNote) {
      alert('Rejection reason is required.');
      return;
    }
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/deactivation/${request.id}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ adminNote })
        }
      );

      if (response.ok) {
        alert('✅ Deactivation request rejected successfully!');
        loadRequests();
      } else {
        alert('❌ Failed to reject request. Please try again.');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('❌ Error rejecting request.');
    }
  };

  const handleViewDetails = (request: DeactivationRequest) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  const handleExportList = () => {
    const csv = [
      ['Request ID', 'Business Name', 'Vendor ID', 'Reason', 'Status', 'Request Date'],
      ...requests.map(r => [
        r.id,
        r.businessName,
        r.vendorId,
        r.reason,
        r.status,
        new Date(r.requestDate).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deactivation-requests-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading deactivation requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Export Button */}
      <div className="flex items-center justify-end">
        <Button onClick={handleExportList} variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Export List
        </Button>
      </div>

      {/* Requests Table */}
      {requests.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">No Deactivation Requests</h3>
          <p className="text-sm text-gray-600">There are currently no pending deactivation requests.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-500">
                  Request Details
                </th>
                <th className="px-6 py-3 text-left text-xs text-gray-500">
                  Vendor ID
                </th>
                <th className="px-6 py-3 text-left text-xs text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs text-gray-500">
                  Request Date
                </th>
                <th className="px-6 py-3 text-right text-xs text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">#{request.id}</div>
                      <div className="text-sm text-gray-900">{request.businessName}</div>
                      <div className="text-xs text-gray-500 mt-1">{request.reason}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      Vendor ID: #{request.vendorId}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${
                      request.status === 'pending' 
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : request.status === 'approved'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {new Date(request.requestDate).toLocaleDateString('en-GB', { 
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      }).split('/').join('-')}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(request)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReject(request)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleViewDetails(request)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Deactivation Request Details</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Request ID</Label>
                <p className="text-lg font-semibold text-gray-900">{selectedRequest.id}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-500">Business Name</Label>
                <p className="text-lg text-gray-900">{selectedRequest.businessName}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-500">Vendor ID</Label>
                <p className="text-gray-900">{selectedRequest.vendorId}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-500">Reason for Deactivation</Label>
                <p className="text-gray-900">{selectedRequest.reason}</p>
              </div>
              
              {selectedRequest.details && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Additional Details</Label>
                  <p className="text-gray-900">{selectedRequest.details}</p>
                </div>
              )}
              
              <div>
                <Label className="text-sm font-medium text-gray-500">Status</Label>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  selectedRequest.status === 'pending' 
                    ? 'bg-blue-100 text-blue-800'
                    : selectedRequest.status === 'approved'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                </span>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-500">Request Date</Label>
                <p className="text-gray-900">{new Date(selectedRequest.requestDate).toLocaleString()}</p>
              </div>
              
              {selectedRequest.adminNote && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <Label className="text-sm font-medium text-yellow-800">Admin Note</Label>
                  <p className="text-yellow-900 mt-1">{selectedRequest.adminNote}</p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                Close
              </Button>
              {selectedRequest.status === 'pending' && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setShowDetailModal(false);
                      handleReject(selectedRequest);
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleApprove(selectedRequest);
                    }}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}>{children}</label>;
}