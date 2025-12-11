/**
 * ========================================
 * ROLE MIGRATION PANEL
 * ========================================
 * 
 * Admin UI to clean and consolidate vendor roles.
 * 
 * WORKFLOW:
 * 1. Analyze vendors (Ready to Migrate vs To Delete)
 * 2. Delete vendors without roleId or not approved
 * 3. Consolidate remaining vendors to canonical roles
 */

import { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Database, Play, Eye, Trash2, Filter } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface MigrationStatus {
  total: number;
  byRole: Record<string, number>;
  needsMigration: number;
  canonical: number;
  invalid: number;
}

interface MigrationResult {
  success: boolean;
  dryRun: boolean;
  statistics: {
    total: number;
    migrated: number;
    alreadyCorrect: number;
    byRole: Record<string, number>;
  };
  updates: Array<{
    vendorId: string;
    oldRoleId: string;
    newRoleId: string;
    businessName: string;
    phone: string;
  }>;
  message: string;
}

interface CleanupAnalysis {
  total: number;
  readyToMigrate: number;
  toDelete: number;
  roleDistribution: Record<string, number>;
  roleDetails: Record<string, any[]>;
  deletionReasons: Record<string, number>;
  deletionSamples: Array<{
    id: string;
    phone: string;
    businessName: string;
    roleId: string;
    status: string;
    reason: string;
  }>;
  migrationSamples: Array<{
    id: string;
    businessName: string;
    roleId: string;
    status: string;
    phone: string;
    city: string;
    state: string;
  }>;
  readyToMigrateList: Array<{
    id: string;
    phone: string;
    businessName: string;
    roleId: string;
    status: string;
    email: string;
    city: string;
    state: string;
  }>;
  toDeleteList: Array<{
    id: string;
    phone: string;
    businessName: string;
    roleId: string;
    status: string;
    reason: string;
  }>;
}

interface CleanupResult {
  success: boolean;
  dryRun: boolean;
  statistics: {
    total: number;
    deleted: number;
    kept: number;
    byReason: Record<string, number>;
    relatedDeleted: {
      centers: number;
      staff: number;
      services: number;
      bookings: number;
    };
  };
  deletionList: Array<{
    id: string;
    phone: string;
    businessName: string;
    roleId: string;
    status: string;
    reason: string;
  }>;
  keptList: Array<{
    id: string;
    businessName: string;
    roleId: string;
    status: string;
  }>;
  message: string;
}

export function RoleMigrationPanel() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [cleanupAnalysis, setCleanupAnalysis] = useState<CleanupAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // NEW: Complete vendor list state
  const [allVendors, setAllVendors] = useState<any[]>([]);
  const [vendorStats, setVendorStats] = useState<any>(null);
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [showCompleteList, setShowCompleteList] = useState(false);
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  const loadStatus = async () => {
    try {
      setIsAnalyzing(true);
      const response = await fetch(`${API_BASE}/admin/migration-status`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data.status);
      } else {
        const errorText = await response.text();
        console.error('Failed to load migration status:', response.status, errorText);
        toast.error(`Failed to load migration status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading status:', error);
      toast.error(`Error loading status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runMigration = async (dryRun: boolean) => {
    try {
      setIsDeleting(true);
      const response = await fetch(`${API_BASE}/admin/migrate-vet-roles?dryRun=${dryRun}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data: MigrationResult = await response.json();
        
        console.log('\n🔍 MIGRATION RESPONSE:', data);
        console.log('\n📊 Statistics:', data.statistics);
        console.log('\n📋 Updates:', data.updates);
        
        // Show detailed debug info
        if ((data as any).debugInfo) {
          console.log('\n🐛 Debug Info:', (data as any).debugInfo);
        }
        if ((data as any).roleDistribution) {
          console.log('\n📊 Role Distribution Found:', (data as any).roleDistribution);
        }
        
        // NEW: Show RAW role count from server
        if ((data as any).rawRoleCount) {
          console.log('\n📊 RAW ROLE COUNT:', (data as any).rawRoleCount);
          
          // Show in UI-friendly format
          const rolesList = Object.entries((data as any).rawRoleCount)
            .map(([role, count]) => `${role}: ${count}`)
            .join(', ');
          console.log('\n✅ ROLES TO MIGRATE:', rolesList);
        }
        
        // Show total vs approved
        if ((data as any).statistics?.totalInDB && (data as any).statistics?.approvedWithRoleId) {
          const total = (data as any).statistics.totalInDB;
          const approved = (data as any).statistics.approvedWithRoleId;
          console.log(`\n📊 DATABASE TOTALS: ${total} total vendors, ${approved} approved with roleIds`);
          console.log(`   🗑️  ${total - approved} vendors excluded (not approved or no roleId)`);
        }
        
        if (dryRun) {
          if (data.statistics.migrated === 0) {
            toast.warning(`No vendors need migration. All ${(data as any).statistics?.approvedWithRoleId || 0} approved vendors already have canonical roles.`);
          } else {
            toast.success(`Found ${data.statistics.migrated} vendors to migrate! Click "Migrate Now" to execute.`, {
              duration: 5000
            });
          }
        } else {
          if (data.statistics.migrated === 0) {
            toast.warning(`No vendors were migrated.`);
          } else {
            toast.success(`✅ Migration complete! Migrated ${data.statistics.migrated} vendors`);
          }
          setTimeout(() => loadStatus(), 1000);
        }
      } else {
        const error = await response.json();
        console.error('❌ Migration error:', error);
        toast.error(error.error || 'Migration failed');
      }
    } catch (error) {
      console.error('Error running migration:', error);
      toast.error('Migration failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const analyzeCleanup = async () => {
    try {
      setIsAnalyzing(true);
      console.log('\n🔍 [CLIENT] Calling analyze-vendor-cleanup endpoint...');
      
      const response = await fetch(`${API_BASE}/admin/analyze-vendor-cleanup`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('\n📊 [CLIENT] ANALYZE RESPONSE:', data);
        console.log('\n📋 [CLIENT] Role Distribution:', data.analysis?.roleDistribution);
        console.log('\n📋 [CLIENT] Ready to Migrate:', data.analysis?.readyToMigrate);
        console.log('\n📋 [CLIENT] To Delete:', data.analysis?.toDelete);
        
        // Log the full ready to migrate list
        if (data.analysis?.readyToMigrateList) {
          console.log('\n✅ [CLIENT] READY TO MIGRATE LIST:');
          data.analysis.readyToMigrateList.forEach((v: any, idx: number) => {
            console.log(`   ${idx + 1}. ${v.businessName} (${v.phone}) - roleId: "${v.roleId}"`);
          });
        }
        
        setCleanupAnalysis(data.analysis);
        toast.success('Analysis complete');
      } else {
        const errorText = await response.text();
        console.error('Failed to analyze:', response.status, errorText);
        toast.error(`Failed to analyze: ${response.status}`);
      }
    } catch (error) {
      console.error('Error analyzing:', error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runCleanup = async (dryRun: boolean) => {
    try {
      setIsDeleting(true);
      const response = await fetch(`${API_BASE}/admin/cleanup-vendors?dryRun=${dryRun}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data: CleanupResult = await response.json();
        
        if (dryRun) {
          toast.success(`Dry run complete: ${data.statistics.deleted} vendors will be deleted`);
        } else {
          toast.success(`Cleanup complete! Deleted ${data.statistics.deleted} vendors`);
          setTimeout(() => {
            loadStatus();
            analyzeCleanup();
            if (showCompleteList) {
              loadAllVendors();
            }
          }, 1000);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Cleanup failed');
      }
    } catch (error) {
      console.error('Error running cleanup:', error);
      toast.error('Cleanup failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const runStaffMigration = async () => {
    try {
      setIsAnalyzing(true);
      toast.loading('Creating staff records and indexes for existing vendors...');
      
      const response = await fetch(`${API_BASE}/admin/migrate/create-staff-and-indexes`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        toast.dismiss();
        toast.success(
          `✅ Migration Complete!\n` +
          `Staff Created: ${data.results.staffCreated}\n` +
          `Staff Already Existed: ${data.results.staffAlreadyExists}\n` +
          `Indexes Created: ${data.results.indexesCreated}\n` +
          `Errors: ${data.results.errors.length}`,
          { duration: 8000 }
        );
        
        console.log('📊 Migration Results:', data.results);
        
        if (data.results.errors.length > 0) {
          console.error('❌ Migration Errors:', data.results.errors);
        }
        
        // Reload status after migration
        setTimeout(() => loadStatus(), 1000);
      } else {
        const error = await response.json();
        toast.dismiss();
        toast.error(`Migration failed: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error running staff migration:', error);
      toast.dismiss();
      toast.error('Migration failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadAllVendors = async () => {
    try {
      setIsLoadingVendors(true);
      const response = await fetch(`${API_BASE}/admin/all-vendors-raw`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAllVendors(data.vendors);
        setVendorStats(data.statistics);
        setShowCompleteList(true);
        toast.success(`Loaded ${data.vendors.length} vendors`);
      } else {
        const errorText = await response.text();
        console.error('Failed to load vendors:', response.status, errorText);
        toast.error('Failed to load vendors');
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
      toast.error('Error loading vendors');
    } finally {
      setIsLoadingVendors(false);
    }
  };

  const toggleVendorSelection = (vendorId: string) => {
    const newSelection = new Set(selectedVendors);
    if (newSelection.has(vendorId)) {
      newSelection.delete(vendorId);
    } else {
      newSelection.add(vendorId);
    }
    setSelectedVendors(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedVendors.size === filteredVendors.length) {
      setSelectedVendors(new Set());
    } else {
      setSelectedVendors(new Set(filteredVendors.map(v => v.id)));
    }
  };

  const deleteSelectedVendors = async () => {
    if (selectedVendors.size === 0) {
      toast.error('No vendors selected');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedVendors.size} vendors? This cannot be undone.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await fetch(`${API_BASE}/admin/delete-selected-vendors`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vendorIds: Array.from(selectedVendors) })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Delete response:', data);
        toast.success(`${data.message}\n\nRemaining vendors: ${data.remainingVendors || 'Unknown'}`);
        setSelectedVendors(new Set());
        
        // Reload all data
        setTimeout(() => {
          loadAllVendors();
          loadStatus();
          analyzeCleanup();
        }, 500);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Deletion failed');
      }
    } catch (error) {
      console.error('Error deleting vendors:', error);
      toast.error('Deletion failed');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter vendors
  const filteredVendors = allVendors.filter(v => {
    const matchesRole = filterRole === 'all' || v.roleId === filterRole;
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus || v.approvalStatus === filterStatus;
    return matchesRole && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">🔄 Vendor Database Cleanup & Migration</h1>
              <p className="text-gray-600">
                Step 1: Delete invalid vendors | Step 2: Consolidate roles to canonical format
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={analyzeCleanup}
                disabled={isAnalyzing}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Filter className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                Analyze Database
              </button>
              <button
                onClick={loadAllVendors}
                disabled={isLoadingVendors}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Database className={`w-4 h-4 ${isLoadingVendors ? 'animate-spin' : ''}`} />
                View All Vendors
              </button>
              <button
                onClick={loadStatus}
                disabled={isAnalyzing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                Check Status
              </button>
              <button
                onClick={runStaffMigration}
                disabled={isAnalyzing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                Create Staff & Indexes
              </button>
            </div>
          </div>
        </div>

        {/* Complete Vendor List with Checkboxes */}
        {showCompleteList && allVendors.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                📋 Complete Vendor List ({filteredVendors.length} of {allVendors.length})
              </h2>
              {selectedVendors.size > 0 && (
                <button
                  onClick={deleteSelectedVendors}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected ({selectedVendors.size})
                </button>
              )}
            </div>

            {/* Stats Summary */}
            {vendorStats && (
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">With Valid RoleId</p>
                  <p className="text-xl font-bold text-green-600">{vendorStats.withValidRole}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-gray-600">With Invalid RoleId</p>
                  <p className="text-xl font-bold text-red-600">{vendorStats.withInvalidRole}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-gray-600">Approved</p>
                  <p className="text-xl font-bold text-green-600">{vendorStats.approved}</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-xs text-gray-600">Not Approved</p>
                  <p className="text-xl font-bold text-orange-600">{vendorStats.notApproved}</p>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Role</label>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Roles</option>
                  {vendorStats && Object.keys(vendorStats.byRole).map(role => (
                    <option key={`role-filter-${role}`} value={role}>{role} ({vendorStats.byRole[role]})</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Statuses</option>
                  {vendorStats && Object.keys(vendorStats.byStatus).map(status => (
                    <option key={`status-filter-${status}`} value={status}>{status} ({vendorStats.byStatus[status]})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Select All Checkbox */}
            <div className="mb-2 p-2 bg-gray-50 rounded-lg flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedVendors.size === filteredVendors.length && filteredVendors.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">
                Select All ({filteredVendors.length})
              </span>
            </div>

            {/* Vendor Table */}
            <div className="max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left">Select</th>
                    <th className="px-2 py-2 text-left">Business Name</th>
                    <th className="px-2 py-2 text-left">Phone</th>
                    <th className="px-2 py-2 text-left">Email</th>
                    <th className="px-2 py-2 text-left">RoleId</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-left">City</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.map((vendor, index) => {
                    const isInvalid = vendor.roleId === 'UNDEFINED';
                    const isUnapproved = vendor.status !== 'approved' && vendor.approvalStatus !== 'approved';
                    const rowColor = isInvalid && isUnapproved ? 'bg-red-50' :
                                    isInvalid ? 'bg-orange-50' :
                                    isUnapproved ? 'bg-yellow-50' :
                                    'bg-white';
                    
                    // Use combined key to guarantee uniqueness (vendor.id might have duplicates)
                    const uniqueKey = `${vendor.id}-${index}`;
                    
                    return (
                      <tr key={uniqueKey} className={`${rowColor} border-b border-gray-200 hover:bg-gray-50`}>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selectedVendors.has(vendor.id)}
                            onChange={() => toggleVendorSelection(vendor.id)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="px-2 py-2 font-medium text-gray-900">{vendor.businessName}</td>
                        <td className="px-2 py-2 text-gray-600">{vendor.phone}</td>
                        <td className="px-2 py-2 text-gray-600 text-xs">{vendor.email}</td>
                        <td className="px-2 py-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            isInvalid ? 'bg-red-100 text-red-700 font-bold' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {vendor.roleId}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            vendor.status === 'approved' || vendor.approvalStatus === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {vendor.status || vendor.approvalStatus}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-gray-600 text-xs">{vendor.city}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-700 mb-2">Color Legend:</p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-50 border border-red-200 rounded" />
                  <span>No RoleId + Not Approved</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-50 border border-orange-200 rounded" />
                  <span>No RoleId Only</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-50 border border-yellow-200 rounded" />
                  <span>Not Approved Only</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white border border-gray-200 rounded" />
                  <span>Valid (Keep)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analysis Summary Cards */}
        {cleanupAnalysis && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Database className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-900">Total Vendors</h3>
                </div>
                <p className="text-3xl font-bold text-gray-600">{cleanupAnalysis.total}</p>
              </div>

              <div className="bg-white rounded-xl shadow p-6">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-gray-900">Ready to Migrate</h3>
                </div>
                <p className="text-3xl font-bold text-green-600">{cleanupAnalysis.readyToMigrate}</p>
                <p className="text-xs text-gray-500 mt-1">Has roleId + Approved</p>
              </div>

              <div className="bg-white rounded-xl shadow p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Trash2 className="w-5 h-5 text-red-600" />
                  <h3 className="font-semibold text-gray-900">To Delete</h3>
                </div>
                <p className="text-3xl font-bold text-red-600">{cleanupAnalysis.toDelete}</p>
                <p className="text-xs text-gray-500 mt-1">No roleId OR not approved</p>
              </div>
            </div>

            {/* Vendors with Correct RoleIDs */}
            {cleanupAnalysis.readyToMigrate > 0 && (
              <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl shadow-lg p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h2 className="text-lg font-bold text-gray-900">
                    ✅ Vendors with Correct RoleID ({cleanupAnalysis.readyToMigrate})
                  </h2>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  These vendors will be KEPT. They have valid roleId and approved status.
                </p>

                {/* Grouped by Role */}
                <div className="space-y-4">
                  {Object.entries(cleanupAnalysis.roleDetails).map(([role, vendors]) => (
                    <div key={role} className="bg-white rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <h3 className="font-bold text-gray-900">{role}</h3>
                          <span className="text-sm text-gray-500">({vendors.length} vendors)</span>
                        </div>
                        <button
                          onClick={() => {
                            const details = vendors.map(v => `${v.businessName} (${v.phone})`).join('\n');
                            console.log(`\n${role} Vendors:\n${details}`);
                            toast.success(`Logged ${vendors.length} ${role} vendors to console`);
                          }}
                          className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
                        >
                          Log to Console
                        </button>
                      </div>

                      {/* List of vendors */}
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {vendors.map((vendor: any, idx: number) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg text-sm border border-gray-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-gray-900">{vendor.businessName}</span>
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                {vendor.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-600">
                              <span>📞 {vendor.phone}</span>
                              {vendor.email && <span>✉️ {vendor.email}</span>}
                              {vendor.city && <span>📍 {vendor.city}, {vendor.state}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* STEP 1: Cleanup (Delete Invalid Vendors) */}
        {cleanupAnalysis && cleanupAnalysis.toDelete > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <span className="font-bold text-red-600">1</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900">Delete Invalid Vendors</h2>
            </div>

            {/* Deletion Reasons */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Deletion Breakdown:</h3>
              <div className="space-y-2">
                {Object.entries(cleanupAnalysis.deletionReasons).map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-gray-900">{reason}</span>
                    <span className="font-semibold text-red-600">{count} vendors</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Deletion Samples */}
            {cleanupAnalysis.deletionSamples.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Sample Vendors to Delete:</h3>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {cleanupAnalysis.deletionSamples.map((vendor, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{vendor.businessName}</span>
                        <span className="text-gray-500">{vendor.phone}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-gray-600">Role: <strong>{vendor.roleId}</strong></span>
                        <span className="text-gray-600">Status: <strong>{vendor.status}</strong></span>
                        <span className="text-red-600 font-medium">{vendor.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cleanup Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => runCleanup(true)}
                disabled={isDeleting}
                className="p-6 border-2 border-orange-200 rounded-xl hover:bg-orange-50 transition-colors disabled:opacity-50"
              >
                <Eye className="w-8 h-8 text-orange-600 mb-2" />
                <h3 className="font-bold text-gray-900 mb-1">Preview Deletion</h3>
                <p className="text-sm text-gray-600">See what will be deleted (no changes)</p>
              </button>

              <button
                onClick={() => runCleanup(false)}
                disabled={isDeleting}
                className="p-6 border-2 border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-8 h-8 text-red-600 mb-2" />
                <h3 className="font-bold text-gray-900 mb-1">⚠️ Execute Deletion</h3>
                <p className="text-sm text-gray-600">Permanently delete {cleanupAnalysis.toDelete} vendors</p>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Role Consolidation (After Cleanup) */}
        {cleanupAnalysis && cleanupAnalysis.readyToMigrate > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="font-bold text-blue-600">2</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900">Consolidate Roles (After Cleanup)</h2>
            </div>

            {/* Role Distribution for Migration */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Current Role Distribution:</h3>
              <div className="space-y-2">
                {Object.entries(cleanupAnalysis.roleDistribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([role, count]) => {
                    const needsMigration = ['veterinarian', 'vet_clinic', 'role_veterinarian', 'role_vet_clinic',
                      'groomer', 'grooming_center', 'role_groomer', 'role_grooming_center',
                      'trainer', 'training_center', 'role_trainer', 'role_training_center',
                      'walker', 'pet_walker', 'role_walker', 'role_dog_walker'].includes(role);
                    
                    return (
                      <div key={role} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${needsMigration ? 'bg-orange-500' : 'bg-green-500'}`} />
                          <span className="font-medium text-gray-900">{role}</span>
                          {needsMigration && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                              Needs Migration
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-gray-600">{count} vendors</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Migration Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => runMigration(true)}
                disabled={isDeleting}
                className="p-6 border-2 border-blue-200 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50"
              >
                <Eye className="w-8 h-8 text-blue-600 mb-2" />
                <h3 className="font-bold text-gray-900 mb-1">Preview Migration</h3>
                <p className="text-sm text-gray-600">See what roles will be consolidated</p>
              </button>

              <button
                onClick={() => runMigration(false)}
                disabled={isDeleting}
                className="p-6 border-2 border-green-200 rounded-xl hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                <Play className="w-8 h-8 text-green-600 mb-2" />
                <h3 className="font-bold text-gray-900 mb-1">Execute Migration</h3>
                <p className="text-sm text-gray-600">Consolidate to canonical roles</p>
              </button>
            </div>
          </div>
        )}

        {/* STANDALONE MIGRATION SECTION - Always visible when status shows vendors need migration */}
        {status && status.needsMigration > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Role Migration Required</h2>
            </div>

            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="font-semibold text-orange-900 mb-2">
                🔄 {status.needsMigration} vendors need role migration
              </p>
              <p className="text-sm text-orange-700">
                Old roles like "veterinarian", "groomer", "trainer" need to be consolidated to canonical roles:
              </p>
              <ul className="text-sm text-orange-700 mt-2 ml-4 space-y-1">
                <li>• veterinarian, vet_clinic → <strong>pet_clinic</strong></li>
                <li>• groomer, grooming_center → <strong>pet_groomer</strong></li>
                <li>• trainer, training_center → <strong>pet_trainer</strong></li>
                <li>• walker, pet_walker → <strong>dog_walker</strong></li>
              </ul>
            </div>

            {/* Current Role Breakdown */}
            {status.byRole && Object.keys(status.byRole).length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Current Roles in Database:</h3>
                <div className="space-y-2">
                  {Object.entries(status.byRole)
                    .sort(([, a], [, b]) => b - a)
                    .map(([role, count]) => {
                      const needsMigration = ['veterinarian', 'vet_clinic', 'role_veterinarian', 'role_vet_clinic',
                        'groomer', 'grooming_center', 'role_groomer', 'role_grooming_center',
                        'trainer', 'training_center', 'role_trainer', 'role_training_center',
                        'walker', 'pet_walker', 'role_walker', 'role_dog_walker'].includes(role);
                      const isCanonical = ['pet_clinic', 'pet_groomer', 'pet_trainer', 'dog_walker'].includes(role);
                      
                      return (
                        <div key={role} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${
                              needsMigration ? 'bg-orange-500' : 
                              isCanonical ? 'bg-green-500' : 
                              'bg-gray-400'
                            }`} />
                            <span className="font-medium text-gray-900">{role}</span>
                            {needsMigration && (
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-semibold">
                                ⚠️ NEEDS MIGRATION
                              </span>
                            )}
                            {isCanonical && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                ✓ Canonical
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-gray-600">{count} vendors</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Migration Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => runMigration(true)}
                disabled={isDeleting}
                className="p-6 border-2 border-blue-200 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50"
              >
                <Eye className="w-8 h-8 text-blue-600 mb-2" />
                <h3 className="font-bold text-gray-900 mb-1">Preview Migration</h3>
                <p className="text-sm text-gray-600">See what will change (dry run)</p>
              </button>

              <button
                onClick={() => runMigration(false)}
                disabled={isDeleting}
                className="p-6 border-2 border-green-200 rounded-xl hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                <Play className="w-8 h-8 text-green-600 mb-2" />
                <h3 className="font-bold text-gray-900 mb-1">🚀 Execute Migration</h3>
                <p className="text-sm text-gray-600">Update all vendor roles now</p>
              </button>
            </div>
          </div>
        )}

        {/* Current Status */}
        {status && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Current Database Status</h2>
            
            {/* Warning if invalid vendors found */}
            {status.invalid > 0 && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">
                    {status.invalid} vendors have invalid/undefined roles
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    Click "Analyze Database" to see details and delete these vendors before migration.
                  </p>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Vendors</p>
                <p className="text-2xl font-bold text-gray-900">{status.total}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-red-600 mb-1">Invalid</p>
                <p className="text-2xl font-bold text-red-600">{status.invalid}</p>
                <p className="text-xs text-red-500 mt-1">Need cleanup</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-600 mb-1">Needs Migration</p>
                <p className="text-2xl font-bold text-orange-600">{status.needsMigration}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600 mb-1">Already Correct</p>
                <p className="text-2xl font-bold text-green-600">{status.canonical}</p>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {Object.entries(status.byRole)
                .sort(([, a], [, b]) => b - a)
                .map(([role, count]) => {
                  const isInvalid = role === 'undefined' || !role;
                  const color = isInvalid ? 'bg-red-50 border border-red-200' : 'bg-gray-50';
                  
                  return (
                    <div key={role} className={`flex items-center justify-between p-3 rounded-lg ${color}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{role}</span>
                        {isInvalid && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                            INVALID - DELETE
                          </span>
                        )}
                      </div>
                      <span className={`font-semibold ${isInvalid ? 'text-red-600' : 'text-gray-600'}`}>
                        {count} vendors
                      </span>
                    </div>
                  );
                })}
            </div>

            {/* Cleanup Action Buttons */}
            {status.invalid > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-3">
                  Delete all {status.invalid} invalid vendors from the database:
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => runCleanup(true)}
                    disabled={isDeleting}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    {isDeleting ? 'Processing...' : 'Run Dry Run'}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`⚠️ This will PERMANENTLY DELETE ${status.invalid} invalid vendors and all their data.\n\nAre you sure?`)) {
                        runCleanup(false);
                      }
                    }}
                    disabled={isDeleting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isDeleting ? 'Deleting...' : 'Execute Cleanup'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h3 className="font-bold text-blue-900 mb-2">ℹ️ Migration Workflow</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• <strong>Step 1:</strong> Analyze & delete vendors without roleId or not approved</li>
            <li>• <strong>Step 2:</strong> Consolidate remaining vendors to canonical roles (pet_clinic, pet_groomer, etc.)</li>
            <li>• <strong>Safe:</strong> Dry run shows exactly what will change before you commit</li>
            <li>• <strong>Thorough:</strong> Also deletes related centers, staff, services, and bookings</li>
            <li>• <strong>Result:</strong> Clean database with only valid, approved vendors using canonical roles</li>
          </ul>
        </div>

        {/* Executing Indicator */}
        {isDeleting && (
          <div className="fixed bottom-6 right-6 bg-white shadow-2xl rounded-xl p-4 border-2 border-blue-500 flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="text-blue-900 font-medium">Processing...</span>
          </div>
        )}
      </div>
    </div>
  );
}