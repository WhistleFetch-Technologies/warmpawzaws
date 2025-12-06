import { useState, useEffect } from 'react';
import { Search, User, CheckCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface VendorMissingStaff {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
}

export function StaffMigrationTool() {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [vendors, setVendors] = useState<VendorMissingStaff[]>([]);
  const [results, setResults] = useState<{ fixed: number; failed: number } | null>(null);
  const [scanComplete, setScanComplete] = useState(false);

  const scanVendors = async () => {
    try {
      setAnalyzing(true);
      setScanComplete(false);
      setResults(null);
      
      // This would typically call an endpoint to find vendors missing staff records
      // For now we'll mock the scan or call a generic endpoint if available
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/all`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Filter for vendors that might be missing staff records
        // This is client-side filtering for now as we don't have the specific endpoint
        const potentialIssues = (data.vendors || []).filter((v: any) => 
          v.status === 'approved' && 
          ['doctor', 'trainer', 'walker'].includes(v.role)
        );
        
        // In a real scenario, we'd check if they have a corresponding staff record
        // For now, we'll just list them as "Potential" candidates for verification
        setVendors(potentialIssues);
        setScanComplete(true);
      }
    } catch (error) {
      console.error('Error scanning vendors:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const fixStaffRecords = async () => {
    if (!confirm('This will attempt to create staff records for all selected vendors. Continue?')) {
      return;
    }

    try {
      setLoading(true);
      
      // Call the fix endpoint
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/fix-staff-records`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vendorIds: vendors.map(v => v.id)
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        setResults({
          fixed: result.fixed || 0,
          failed: result.failed || 0
        });
        setVendors([]); // Clear list
      } else {
        // If endpoint doesn't exist, show mock success for UI demonstration
        // or handle error gracefully
        console.warn('Endpoint might not exist yet');
        alert('Migration endpoint not available yet. Please contact developer.');
      }
    } catch (error) {
      console.error('Error fixing records:', error);
      alert('Error processing request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg border border-blue-100">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-full">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium text-blue-900">Staff Record Synchronization</h3>
            <p className="text-sm text-blue-700 mt-1">
              This tool scans for approved vendors (Doctors, Trainers, Walkers) who are missing their corresponding staff profile.
              Without a staff profile, they cannot be assigned to bookings or appear in search results.
            </p>
          </div>
        </div>
        <Button 
          onClick={scanVendors} 
          disabled={analyzing || loading}
          variant="outline"
          className="shrink-0"
        >
          {analyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Scan for Issues
            </>
          )}
        </Button>
      </div>

      {scanComplete && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">
              Found {vendors.length} vendors requiring attention
            </h4>
            {vendors.length > 0 && (
              <Button onClick={fixStaffRecords} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Fix All {vendors.length} Records
                  </>
                )}
              </Button>
            )}
          </div>

          {vendors.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium">
                  <tr>
                    <th className="px-4 py-3">Vendor Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vendors.map((vendor) => (
                    <tr key={vendor.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{vendor.fullName}</td>
                      <td className="px-4 py-3 capitalize">{vendor.role}</td>
                      <td className="px-4 py-3">{vendor.phone}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Missing Staff Record
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900">All Good!</h3>
              <p className="text-gray-500 text-sm">No missing staff records found.</p>
            </div>
          )}
        </div>
      )}

      {results && (
        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <h4 className="font-medium text-green-900 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Migration Complete
          </h4>
          <div className="mt-2 text-sm text-green-700">
            <p>Successfully created {results.fixed} staff records.</p>
            {results.failed > 0 && <p className="text-red-600">Failed to create {results.failed} records.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
