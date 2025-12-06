import { useState, useEffect } from 'react';
import { Check, X, Eye, RefreshCw, Plus, Phone } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { CustomDropdown } from './CustomDropdown';
import { PendingApplicationsDebug } from './PendingApplicationsDebug';

interface PendingVendor {
  id: string;
  vendorName: string;
  vendorId: string;
  location: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  experience: string;
  progress: number;
  applied: string;
}

interface QualityAlert {
  id: string;
  vendorName: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  timestamp: string;
}

export function PendingApplicationsTab() {
  const [vendors, setVendors] = useState<PendingVendor[]>([]);
  const [qualityAlerts, setQualityAlerts] = useState<QualityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [alertFilter, setAlertFilter] = useState('all');

  useEffect(() => {
    loadPendingApplications();
    loadQualityAlerts();
  }, []);

  const loadPendingApplications = async () => {
    try {
      setLoading(true);
      
      console.log('🔄 Loading pending applications...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/applications/active`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Pending applications response:', data);
        console.log(`📊 Total vendors returned: ${data.vendors?.length || 0}`);
        
        if (data.vendors && data.vendors.length > 0) {
          console.log('📋 First vendor:', data.vendors[0]);
        } else {
          console.warn('⚠️ No vendors in response!');
        }
        
        setVendors(data.vendors || []);
      } else {
        console.error('❌ Failed to load pending applications:', response.status);
        const error = await response.text();
        console.error('Error details:', error);
      }
    } catch (error) {
      console.error('Error loading pending applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQualityAlerts = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/quality/alerts`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setQualityAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Error loading quality alerts:', error);
    }
  };

  const handleApprove = async (vendorId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/applications/${vendorId}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            adminId: 'admin_1',
            adminName: 'Admin',
            notes: 'Approved from pending applications'
          })
        }
      );
      
      if (response.ok) {
        loadPendingApplications();
      }
    } catch (error) {
      console.error('Error approving vendor:', error);
    }
  };

  const handleReject = async (vendorId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/applications/${vendorId}/reject`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            adminId: 'admin_1',
            adminName: 'Admin',
            reason: 'Incomplete documentation'
          })
        }
      );
      
      if (response.ok) {
        loadPendingApplications();
      }
    } catch (error) {
      console.error('Error rejecting vendor:', error);
    }
  };

  const handleView = (vendorId: string) => {
    console.log('View vendor:', vendorId);
    // Open vendor details modal
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-orange-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityDotColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-orange-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getCategoryBadgeStyle = (category: string) => {
    const styles: any = {
      'vet': 'bg-blue-50 text-blue-700 border-blue-200',
      'groomer': 'bg-purple-50 text-purple-700 border-purple-200',
      'walker': 'bg-pink-50 text-pink-700 border-pink-200',
      'boarding': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'training': 'bg-orange-50 text-orange-700 border-orange-200'
    };
    return styles[category.toLowerCase()] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-orange-600';
      case 'low': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const filteredVendors = vendors.filter(vendor => {
    if (categoryFilter !== 'all' && vendor.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
    if (priorityFilter !== 'all' && vendor.priority !== priorityFilter) return false;
    return true;
  });

  const filteredAlerts = alertFilter === 'all' ? qualityAlerts : qualityAlerts.filter(alert => alert.severity === alertFilter);

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1">
        <div className="mb-6">
          <h3 className="text-gray-900 mb-1">New Vendor Applications</h3>
          <p className="text-sm text-gray-600">Review and approve new vendor applications</p>
        </div>

        {/* DEBUG PANEL - Remove this after testing */}
        <div className="mb-6">
          <PendingApplicationsDebug />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <CustomDropdown
            options={[
              { value: 'all', label: 'All Categories' },
              { value: 'vet', label: 'Healthcare Providers' },
              { value: 'groomer', label: 'Grooming & Day-care' },
              { value: 'walker', label: 'Walkers & Sitters' },
              { value: 'boarding', label: 'Boarding & Adoption' },
              { value: 'training', label: 'Sunset Services' }
            ]}
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder="All Categories"
          />
          <CustomDropdown
            options={[
              { value: 'all', label: 'Priority' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' }
            ]}
            value={priorityFilter}
            onChange={setPriorityFilter}
            placeholder="Priority"
          />
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 rounded-lg text-xs text-gray-500 mb-3">
          <div className="col-span-4">Vendor Details</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2">Progress</div>
          <div className="col-span-3">Actions</div>
        </div>

        {/* Vendors List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <div className="text-sm">Loading applications...</div>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-sm">No pending applications found</div>
            </div>
          ) : (
            filteredVendors.map((vendor) => (
              <div key={vendor.id} className="grid grid-cols-12 gap-4 px-6 py-4 bg-white border border-gray-200 rounded-xl items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${getPriorityColor(vendor.priority)}`}></div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-900">{vendor.vendorName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {vendor.priority.charAt(0).toUpperCase() + vendor.priority.slice(1)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        📍 {vendor.location} | {vendor.experience}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="col-span-2">
                  <span className={`inline-block px-3 py-1 text-xs rounded-full border ${getCategoryBadgeStyle(vendor.category)}`}>
                    {vendor.category}
                  </span>
                </div>
                
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">{vendor.progress}%</span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gray-900 rounded-full transition-all" 
                        style={{ width: `${vendor.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                <div className="col-span-4 flex items-center justify-end gap-2">
                  <button 
                    onClick={() => handleApprove(vendor.vendorId)}
                    className="p-2 hover:bg-green-50 rounded-lg transition-colors"
                    title="Approve"
                  >
                    <Check className="w-4 h-4 text-green-600" />
                  </button>
                  <button 
                    onClick={() => handleReject(vendor.vendorId)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Reject"
                  >
                    <X className="w-4 h-4 text-red-600" />
                  </button>
                  <button 
                    onClick={() => handleView(vendor.vendorId)}
                    className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4 text-blue-600" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quality Alerts Sidebar */}
      <div className="w-80 flex-shrink-0">
        <div className="bg-white border border-gray-200 rounded-xl p-5 sticky top-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-900">Quality Alerts</h3>
            <CustomDropdown
              options={[
                { value: 'all', label: 'All Alerts' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' }
              ]}
              value={alertFilter}
              onChange={setAlertFilter}
              placeholder="All Alerts"
            />
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No quality alerts
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div key={alert.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-2 mb-2">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                      alert.severity === 'high' ? 'bg-red-500' : 
                      alert.severity === 'medium' ? 'bg-orange-500' : 
                      'bg-yellow-500'
                    }`}></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-gray-900 truncate">{alert.vendorName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          alert.severity === 'high' ? 'bg-red-50 text-red-700' :
                          alert.severity === 'medium' ? 'bg-orange-50 text-orange-700' :
                          'bg-yellow-50 text-yellow-700'
                        }`}>
                          {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{alert.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button className="p-1.5 hover:bg-blue-50 rounded transition-colors">
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                    </button>
                    <button className="p-1.5 hover:bg-green-50 rounded transition-colors">
                      <Phone className="w-3.5 h-3.5 text-green-600" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}