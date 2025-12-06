import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Calendar, Download, Eye } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface ReverificationVendor {
  id: string;
  businessName: string;
  vendorId: string;
  status: 'expired' | 'expiring' | 'valid';
  daysLeft: number;
  daysLeftText: string;
  requiredDocuments: string[];
  scheduledDate: string | null;
  licenseExpiry: string;
  category: string;
}

export function ReverificationTab() {
  const [vendors, setVendors] = useState<ReverificationVendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/reverification`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || []);
      }
    } catch (error) {
      console.error('Error loading reverification list:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async (vendor: ReverificationVendor) => {
    const scheduledDate = prompt('Enter scheduled date (YYYY-MM-DD):');
    if (!scheduledDate) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/reverification/${vendor.vendorId}/schedule`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ scheduledDate, notes: '' })
        }
      );

      if (response.ok) {
        alert('✅ Re-verification scheduled successfully!');
        loadVendors();
      }
    } catch (error) {
      console.error('Error scheduling re-verification:', error);
      alert('❌ Error scheduling re-verification');
    }
  };

  const handleExport = () => {
    const csv = [
      ['Vendor ID', 'Business Name', 'Status', 'Days Left', 'Required Documents', 'Scheduled Date'],
      ...vendors.map(v => [
        v.vendorId,
        v.businessName,
        v.status,
        v.daysLeftText,
        v.requiredDocuments.join('; '),
        v.scheduledDate || 'Not Scheduled'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reverification-list-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'expired': return 'text-red-600 bg-red-50 border-red-200';
      case 'expiring': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading re-verification list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">Re-verification Management</h2>
        </div>
        <Button 
          onClick={handleExport} 
          variant="outline" 
          size="sm"
          className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <Download className="w-4 h-4" />
          Export List
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3.5 text-left text-xs text-gray-500">
                Vendor Details
              </th>
              <th className="px-6 py-3.5 text-left text-xs text-gray-500">
                Status
              </th>
              <th className="px-6 py-3.5 text-left text-xs text-gray-500">
                Days left
              </th>
              <th className="px-6 py-3.5 text-left text-xs text-gray-500">
                Required documents
              </th>
              <th className="px-6 py-3.5 text-left text-xs text-gray-500">
                Scheduled Date
              </th>
              <th className="px-6 py-3.5 text-right text-xs text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {vendors.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No vendors requiring re-verification
                </td>
              </tr>
            ) : (
              vendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">#{vendor.vendorId}</div>
                      <div className="text-gray-900">{vendor.businessName}</div>
                      <div className="text-xs text-gray-500 mt-1">Vendor ID: #{vendor.vendorId}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs border ${getStatusColor(vendor.status)}`}>
                      {vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`text-sm ${vendor.status === 'expired' ? 'text-red-600' : 'text-gray-900'}`}>
                      {vendor.daysLeftText}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">
                      {vendor.requiredDocuments.join(', ')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {vendor.scheduledDate ? (
                      <div>
                        <div className="text-sm text-blue-600">
                          {new Date(vendor.scheduledDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-xs text-gray-500">Scheduled</div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Not Scheduled</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {!vendor.scheduledDate ? (
                        <button
                          onClick={() => handleSchedule(vendor)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                          <Calendar className="w-4 h-4" />
                          Schedule
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button 
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Edit Schedule"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
