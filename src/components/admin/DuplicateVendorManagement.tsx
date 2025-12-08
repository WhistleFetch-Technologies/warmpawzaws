import { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, RefreshCw, Eye, CheckCircle, XCircle, Phone, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';

interface DuplicateGroup {
  phone?: string;
  email?: string;
  count: number;
  vendors: Array<{
    id: string;
    key: string;
    name: string;
    status: string;
    phone?: string;
    email?: string;
    createdAt: string;
    submittedAt?: string;
  }>;
}

interface DuplicateReport {
  byPhone: DuplicateGroup[];
  byEmail: DuplicateGroup[];
}

interface CleanupAction {
  action: string;
  vendorId: string;
  key: string;
  name: string;
  status: string;
  reason: string;
  phone?: string;
  email?: string;
  error?: string;
}

export function DuplicateVendorManagement() {
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateReport | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [selectedTab, setSelectedTab] = useState<'phone' | 'email'>('phone');
  const [cleanupPreview, setCleanupPreview] = useState<CleanupAction[] | null>(null);
  const [cleanupInProgress, setCleanupInProgress] = useState(false);

  useEffect(() => {
    loadDuplicates();
  }, []);

  const loadDuplicates = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/duplicates`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setDuplicates(data.duplicates);
        setSummary(data.summary);
        console.log('✅ Duplicates loaded:', data.summary);
      } else {
        const error = await response.text();
        console.error('Failed to load duplicates:', error);
        toast.error('Failed to load duplicate vendors');
      }
    } catch (error) {
      console.error('Error loading duplicates:', error);
      toast.error('Error loading duplicate vendors');
    } finally {
      setLoading(false);
    }
  };

  const previewCleanup = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/duplicates/cleanup`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            dryRun: true,
            keepStrategy: 'newest_approved'
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCleanupPreview(data.actions);
        toast.success(`Preview: ${data.summary.vendorsToDelete} duplicates would be deleted`);
      } else {
        const error = await response.text();
        console.error('Failed to preview cleanup:', error);
        toast.error('Failed to preview cleanup');
      }
    } catch (error) {
      console.error('Error previewing cleanup:', error);
      toast.error('Error previewing cleanup');
    } finally {
      setLoading(false);
    }
  };

  const executeCleanup = async () => {
    if (!confirm('⚠️ WARNING: This will permanently delete duplicate vendor records. This action cannot be undone. Are you sure?')) {
      return;
    }

    try {
      setCleanupInProgress(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/duplicates/cleanup`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            dryRun: false,
            keepStrategy: 'newest_approved'
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        setCleanupPreview(null);
        // Reload duplicates to show updated state
        await loadDuplicates();
      } else {
        const error = await response.text();
        console.error('Failed to execute cleanup:', error);
        toast.error('Failed to execute cleanup');
      }
    } catch (error) {
      console.error('Error executing cleanup:', error);
      toast.error('Error executing cleanup');
    } finally {
      setCleanupInProgress(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': 
      case 'pending_approval': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading && !duplicates) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
        <span className="ml-2">Loading duplicate analysis...</span>
      </div>
    );
  }

  const duplicateList = selectedTab === 'phone' ? duplicates?.byPhone || [] : duplicates?.byEmail || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Duplicate Vendor Management</h2>
          <p className="text-gray-600 mt-1">Identify and resolve duplicate vendor records</p>
        </div>
        <Button
          onClick={loadDuplicates}
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Phone Duplicates</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalPhoneDuplicates}</p>
                <p className="text-xs text-gray-500 mt-1">{summary.affectedVendorsByPhone} vendors affected</p>
              </div>
              <Phone className="w-8 h-8 text-orange-500" />
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Email Duplicates</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalEmailDuplicates}</p>
                <p className="text-xs text-gray-500 mt-1">{summary.affectedVendorsByEmail} vendors affected</p>
              </div>
              <Mail className="w-8 h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Conflicts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.totalPhoneDuplicates + summary.totalEmailDuplicates}
                </p>
                <p className="text-xs text-gray-500 mt-1">Unique duplicate groups</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Action Required</p>
                <p className="text-2xl font-bold text-gray-900">
                  {cleanupPreview?.length || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">Vendors to clean up</p>
              </div>
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Action Buttons */}
      {summary && (summary.totalPhoneDuplicates > 0 || summary.totalEmailDuplicates > 0) && (
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900">Duplicate Vendors Detected</h3>
              <p className="text-sm text-orange-700 mt-1">
                Found {summary.affectedVendorsByPhone} vendors with duplicate phone numbers and {summary.affectedVendorsByEmail} with duplicate emails.
                Click below to preview which duplicates will be removed.
              </p>
              <div className="flex gap-3 mt-3">
                <Button
                  onClick={previewCleanup}
                  disabled={loading}
                  variant="outline"
                  className="border-orange-300 text-orange-700 hover:bg-orange-100"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview Cleanup
                </Button>
                {cleanupPreview && cleanupPreview.length > 0 && (
                  <Button
                    onClick={executeCleanup}
                    disabled={cleanupInProgress}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {cleanupInProgress ? 'Cleaning...' : `Delete ${cleanupPreview.length} Duplicates`}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Cleanup Preview */}
      {cleanupPreview && cleanupPreview.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Cleanup Preview</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {cleanupPreview.map((action, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="font-medium text-gray-900">{action.name}</span>
                    <Badge className={getStatusColor(action.status)}>{action.status}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    ID: {action.vendorId} | {action.phone} | {action.email}
                  </p>
                  <p className="text-xs text-red-600 mt-1">{action.reason}</p>
                </div>
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setSelectedTab('phone')}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTab === 'phone'
              ? 'border-b-2 border-orange-500 text-orange-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Phone className="w-4 h-4 inline mr-2" />
          Phone Duplicates ({duplicates?.byPhone?.length || 0})
        </button>
        <button
          onClick={() => setSelectedTab('email')}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTab === 'email'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Mail className="w-4 h-4 inline mr-2" />
          Email Duplicates ({duplicates?.byEmail?.length || 0})
        </button>
      </div>

      {/* Duplicate Groups */}
      <div className="space-y-4">
        {duplicateList.length === 0 ? (
          <Card className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900">No Duplicates Found</h3>
            <p className="text-gray-600 mt-1">
              All vendor {selectedTab === 'phone' ? 'phone numbers' : 'email addresses'} are unique.
            </p>
          </Card>
        ) : (
          duplicateList.map((group, groupIndex) => (
            <Card key={groupIndex} className="p-4 border-l-4 border-red-500">
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {selectedTab === 'phone' ? (
                        <>
                          <Phone className="w-4 h-4 inline mr-2" />
                          Phone: {group.phone}
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 inline mr-2" />
                          Email: {group.email}
                        </>
                      )}
                    </h3>
                    <p className="text-sm text-red-600 mt-1">
                      {group.count} vendors share this {selectedTab === 'phone' ? 'phone number' : 'email address'}
                    </p>
                  </div>
                  <Badge className="bg-red-100 text-red-800">
                    {group.count} Duplicates
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                {group.vendors.map((vendor, vendorIndex) => (
                  <div
                    key={vendorIndex}
                    className={`p-3 rounded-lg border ${
                      vendor.status === 'approved'
                        ? 'bg-green-50 border-green-200'
                        : vendor.status === 'pending' || vendor.status === 'pending_approval'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{vendor.name}</span>
                          <Badge className={getStatusColor(vendor.status)}>
                            {vendor.status}
                          </Badge>
                          {vendor.status === 'approved' && (
                            <Badge className="bg-blue-100 text-blue-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              KEEP
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">ID:</span> {vendor.id}
                          </p>
                          {vendor.phone && (
                            <p className="text-sm text-gray-600">
                              <Phone className="w-3 h-3 inline mr-1" />
                              {vendor.phone}
                            </p>
                          )}
                          {vendor.email && (
                            <p className="text-sm text-gray-600">
                              <Mail className="w-3 h-3 inline mr-1" />
                              {vendor.email}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            Created: {formatDate(vendor.createdAt || vendor.submittedAt || '')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Resolution Strategy:</strong> The cleanup process will keep the{' '}
                  <strong>approved</strong> vendor (if any), or the <strong>newest</strong> vendor if none are approved.
                  All other duplicates will be marked for deletion.
                </p>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Help Section */}
      <Card className="p-4 bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-2">How Cleanup Works</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start">
            <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
            <span><strong>Preview First:</strong> Click "Preview Cleanup" to see which vendors will be deleted before making any changes.</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
            <span><strong>Smart Prioritization:</strong> Approved vendors are kept over pending ones. If multiple approved vendors exist, the newest one is kept.</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
            <span><strong>Safe Operation:</strong> The cleanup runs in preview mode by default. You must explicitly confirm to execute deletions.</span>
          </li>
          <li className="flex items-start">
            <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
            <span><strong>Automatic Prevention:</strong> New duplicate submissions are automatically blocked during vendor onboarding and approval.</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
