/**
 * Vendor Patient Monitoring Dashboard - Enterprise Grade
 * Real-time patient monitoring for veterinary clinics
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, Activity, Heart, Thermometer, Wind, Droplets, Brain, Plus, Search, Filter, Bell, Eye, FileText, TrendingUp, TrendingDown, Minus, CheckCircle, XCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface VendorPatientMonitoringProps {
  vendorId: string;
}

interface PatientMonitor {
  id: string;
  petName: string;
  petType: string;
  petBreed: string;
  petAge: number;
  customerName: string;
  customerPhone: string;
  admissionDate: string;
  status: 'active' | 'stable' | 'critical' | 'discharged';
  priority: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  bedNumber?: string;
  assignedVet: string;
  diagnosis: string[];
  alerts: Alert[];
}

interface Alert {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  acknowledgedBy?: string;
}

interface VitalSignsRecord {
  id: string;
  timestamp: string;
  recordedBy: string;
  temperature: number;
  heartRate: number;
  respiratoryRate: number;
  bloodPressure?: { systolic: number; diastolic: number };
  oxygenSaturation?: number;
  painScore?: number;
  consciousness?: string;
  abnormalFlags: Array<{
    field: string;
    value: number | string;
    normalRange: string;
    severity: 'mild' | 'moderate' | 'severe';
  }>;
}

interface DashboardStats {
  monitors: {
    total: number;
    critical: number;
    highPriority: number;
    isolated: number;
  };
  alerts: {
    total: number;
    critical: number;
    warning: number;
  };
}

export function VendorPatientMonitoring({ vendorId }: VendorPatientMonitoringProps) {
  const [monitors, setMonitors] = useState<PatientMonitor[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedMonitor, setSelectedMonitor] = useState<PatientMonitor | null>(null);
  const [vitals, setVitals] = useState<VitalSignsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'list' | 'detail' | 'admit'>('dashboard');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Admit patient form state
  const [admitForm, setAdmitForm] = useState({
    petName: '',
    petType: 'dog',
    petBreed: '',
    petAge: 0,
    customerName: '',
    customerPhone: '',
    location: 'Ward A',
    bedNumber: '',
    assignedVet: '',
    priority: 'medium',
    diagnosis: '',
    symptoms: '',
    allergies: '',
    notes: ''
  });

  // Vital signs form state
  const [vitalForm, setVitalForm] = useState({
    temperature: '',
    heartRate: '',
    respiratoryRate: '',
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    oxygenSaturation: '',
    painScore: '',
    consciousness: 'alert',
    notes: '',
    recordedBy: 'Staff'
  });

  useEffect(() => {
    if (view === 'dashboard') {
      fetchDashboard();
    } else if (view === 'list') {
      fetchMonitors();
    }
  }, [vendorId, view, filterStatus]);

  useEffect(() => {
    if (selectedMonitor) {
      fetchVitals(selectedMonitor.id);
    }
  }, [selectedMonitor]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/patient-monitoring/${vendorId}/dashboard`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      const data = await response.json();
      // ✅ FIX: Handle standardized response format
      // Response format: { success: true, stats: {...}, criticalPatients: [...], total: ... }
      if (data.success) {
        setStats(data.stats || data.data?.stats);
        setMonitors(data.criticalPatients || data.data?.criticalPatients || []);
      } else {
        const errorData = data.error || data.message || 'Unknown error';
        console.error('Failed to fetch dashboard:', errorData);
        // Don't show error toast on initial load - just log
      }
    } catch (error: any) {
      console.error('Error fetching dashboard:', error);
      // Don't show error toast on initial load - just log
    } finally {
      setLoading(false);
    }
  };

  const fetchMonitors = async () => {
    try {
      setLoading(true);
      const url = filterStatus === 'all' 
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/patient-monitoring/${vendorId}/monitors`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/patient-monitoring/${vendorId}/monitors?status=${filterStatus}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const data = await response.json();
      // ✅ FIX: Handle standardized response format
      // Response format: { success: true, monitors: [...], stats: {...}, total: ... }
      if (data.success) {
        setMonitors(data.monitors || data.data?.monitors || []);
        setStats(data.stats || data.data?.stats);
      } else {
        const errorData = data.error || data.message || 'Unknown error';
        console.error('Failed to fetch monitors:', errorData);
        // Don't show error toast on initial load - just log
      }
    } catch (error: any) {
      console.error('Error fetching monitors:', error);
      // Don't show error toast on initial load - just log
    } finally {
      setLoading(false);
    }
  };

  const fetchVitals = async (monitorId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/patient-monitoring/${vendorId}/monitors/${monitorId}/vitals?hours=24`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      const data = await response.json();
      // ✅ FIX: Handle standardized response format
      // Response format: { success: true, vitals: [...], total: ... }
      if (data.success) {
        setVitals(data.vitals || data.data?.vitals || []);
      } else {
        const errorData = data.error || data.message || 'Unknown error';
        console.error('Failed to fetch vitals:', errorData);
        // Don't show error toast - it's not critical
      }
    } catch (error: any) {
      console.error('Error fetching vitals:', error);
      // Don't show error toast - it's not critical
    }
  };

  const admitPatient = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/patient-monitoring/${vendorId}/monitors`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            petName: admitForm.petName,
            petType: admitForm.petType,
            petBreed: admitForm.petBreed,
            petAge: parseInt(admitForm.petAge.toString()),
            customerName: admitForm.customerName,
            customerPhone: admitForm.customerPhone,
            location: admitForm.location,
            bedNumber: admitForm.bedNumber,
            assignedVet: admitForm.assignedVet,
            priority: admitForm.priority,
            diagnosis: admitForm.diagnosis.split(',').map(d => d.trim()),
            symptoms: admitForm.symptoms.split(',').map(s => s.trim()),
            allergies: admitForm.allergies.split(',').map(a => a.trim()),
            notes: admitForm.notes
          })
        }
      );
      const data = await response.json();
      if (data.success) {
        toast.success('Patient admitted successfully');
        setView('list');
        await fetchMonitors(); // ✅ Ensure monitors reload
        // Reset form
        setAdmitForm({
          petName: '', petType: 'dog', petBreed: '', petAge: 0,
          customerName: '', customerPhone: '', location: 'Ward A',
          bedNumber: '', assignedVet: '', priority: 'medium',
          diagnosis: '', symptoms: '', allergies: '', notes: ''
        });
      } else {
        const errorData = data.error || data.message || 'Failed to admit patient';
        toast.error(errorData);
      }
    } catch (error: any) {
      console.error('Error admitting patient:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  const recordVitals = async () => {
    if (!selectedMonitor) return;
    
    try {
      const body: any = {
        temperature: parseFloat(vitalForm.temperature),
        heartRate: parseFloat(vitalForm.heartRate),
        respiratoryRate: parseFloat(vitalForm.respiratoryRate),
        recordedBy: vitalForm.recordedBy,
        consciousness: vitalForm.consciousness,
        notes: vitalForm.notes
      };

      if (vitalForm.bloodPressureSystolic && vitalForm.bloodPressureDiastolic) {
        body.bloodPressure = {
          systolic: parseFloat(vitalForm.bloodPressureSystolic),
          diastolic: parseFloat(vitalForm.bloodPressureDiastolic)
        };
      }
      if (vitalForm.oxygenSaturation) body.oxygenSaturation = parseFloat(vitalForm.oxygenSaturation);
      if (vitalForm.painScore) body.painScore = parseFloat(vitalForm.painScore);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/patient-monitoring/${vendorId}/monitors/${selectedMonitor.id}/vitals`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }
      );
      const data = await response.json();
      if (data.success) {
        toast.success(data.message || 'Vitals recorded successfully');
        await fetchVitals(selectedMonitor.id); // ✅ Ensure vitals reload
        // Reset form
        setVitalForm({
          temperature: '', heartRate: '', respiratoryRate: '',
          bloodPressureSystolic: '', bloodPressureDiastolic: '',
          oxygenSaturation: '', painScore: '', consciousness: 'alert',
          notes: '', recordedBy: 'Staff'
        });
      } else {
        const errorData = data.error || data.message || 'Failed to record vitals';
        toast.error(errorData);
      }
    } catch (error: any) {
      console.error('Error recording vitals:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  const acknowledgeAlert = async (alertIndex: number) => {
    if (!selectedMonitor) return;
    // In a real implementation, this would call the API to acknowledge the alert
    alert('Alert acknowledged');
  };

  // ✅ LIFECYCLE FIX: Add delete monitor handler
  const handleDeleteMonitor = async (monitorId: string, petName: string) => {
    if (!confirm(`Are you sure you want to delete the monitoring record for "${petName}"? This action cannot be undone and will delete all associated vital signs records.`)) {
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/patient-monitoring/${vendorId}/monitors/${monitorId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success(`Monitoring record for "${petName}" deleted successfully`);
          if (view === 'list') {
            await fetchMonitors(); // ✅ Ensure monitors reload
          } else {
            setView('list');
            setSelectedMonitor(null);
            await fetchMonitors(); // ✅ Ensure monitors reload
          }
        } else {
          const errorMessage = data.error || data.message || 'Failed to delete monitor';
          toast.error(errorMessage);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || 'Failed to delete monitor';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error deleting monitor:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  // ✅ LIFECYCLE FIX: Add update monitor status handler
  const updateMonitorStatus = async (monitorId: string, status: 'active' | 'stable' | 'critical' | 'discharged') => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/patient-monitoring/${vendorId}/monitors/${monitorId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status })
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('Monitor status updated successfully');
          if (selectedMonitor && selectedMonitor.id === monitorId) {
            setSelectedMonitor({ ...selectedMonitor, status });
          }
          await fetchMonitors(); // ✅ Ensure monitors reload
        } else {
          const errorMessage = data.error || data.message || 'Failed to update monitor status';
          toast.error(errorMessage);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || 'Failed to update monitor status';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error updating monitor status:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'active': return 'text-blue-600 bg-blue-50';
      case 'stable': return 'text-green-600 bg-green-50';
      case 'discharged': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const filteredMonitors = monitors.filter(m => 
    m.petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && view === 'dashboard') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading patient monitoring dashboard...</p>
        </div>
      </div>
    );
  }

  // Dashboard View
  if (view === 'dashboard') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl text-gray-900">Patient Monitoring</h2>
            <p className="text-gray-600 mt-1">Real-time monitoring and vital signs tracking</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setView('list')}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              View All Patients
            </button>
            <button
              onClick={() => setView('admit')}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Admit Patient
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Active Patients</p>
                  <p className="text-3xl mt-2">{stats.monitors.total}</p>
                </div>
                <Activity className="w-10 h-10 text-blue-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Critical Patients</p>
                  <p className="text-3xl mt-2 text-red-600">{stats.monitors.critical}</p>
                </div>
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Active Alerts</p>
                  <p className="text-3xl mt-2 text-orange-600">{stats.alerts.total}</p>
                </div>
                <Bell className="w-10 h-10 text-orange-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Isolated</p>
                  <p className="text-3xl mt-2">{stats.monitors.isolated}</p>
                </div>
                <XCircle className="w-10 h-10 text-purple-500" />
              </div>
            </div>
          </div>
        )}

        {/* Critical Patients */}
        {monitors.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg">Critical Patients</h3>
              <p className="text-sm text-gray-600 mt-1">Patients requiring immediate attention</p>
            </div>
            <div className="divide-y divide-gray-200">
              {monitors.map(monitor => (
                <div 
                  key={monitor.id}
                  className="p-6 hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedMonitor(monitor);
                    setView('detail');
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg">{monitor.petName}</h4>
                        <span className={`px-3 py-1 rounded-full text-xs border ${getPriorityColor(monitor.priority)}`}>
                          {monitor.priority.toUpperCase()}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(monitor.status)}`}>
                          {monitor.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <span>{monitor.petType} • {monitor.petBreed}</span>
                        <span>Owner: {monitor.customerName}</span>
                        <span>Location: {monitor.location} {monitor.bedNumber && `- Bed ${monitor.bedNumber}`}</span>
                        <span>Vet: {monitor.assignedVet}</span>
                      </div>
                      {monitor.diagnosis.length > 0 && (
                        <div className="mt-2">
                          <span className="text-sm text-gray-600">Diagnosis: </span>
                          <span className="text-sm">{monitor.diagnosis.join(', ')}</span>
                        </div>
                      )}
                    </div>
                    {monitor.alerts.filter(a => !a.acknowledgedBy).length > 0 && (
                      <div className="ml-4">
                        <div className="flex items-center gap-2 text-red-600">
                          <Bell className="w-5 h-5" />
                          <span className="text-sm">{monitor.alerts.filter(a => !a.acknowledgedBy).length} alerts</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {monitors.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg text-gray-900 mb-2">No Critical Patients</h3>
            <p className="text-gray-600">All patients are stable</p>
          </div>
        )}
      </div>
    );
  }

  // List View
  if (view === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setView('dashboard')}
            className="text-orange-600 hover:text-orange-700 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <button
            onClick={() => setView('admit')}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Admit Patient
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by pet or owner name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="critical">Critical</option>
            <option value="active">Active</option>
            <option value="stable">Stable</option>
          </select>
        </div>

        {/* Patient List */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs text-gray-600">Patient</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600">Owner</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600">Location</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600">Priority</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600">Status</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600">Alerts</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredMonitors.map(monitor => (
                  <tr key={monitor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p>{monitor.petName}</p>
                        <p className="text-sm text-gray-600">{monitor.petType} • {monitor.petBreed}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p>{monitor.customerName}</p>
                        <p className="text-sm text-gray-600">{monitor.customerPhone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p>{monitor.location}</p>
                      {monitor.bedNumber && <p className="text-sm text-gray-600">Bed {monitor.bedNumber}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs border ${getPriorityColor(monitor.priority)}`}>
                        {monitor.priority.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(monitor.status)}`}>
                        {monitor.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {monitor.alerts.filter(a => !a.acknowledgedBy).length > 0 ? (
                        <span className="text-red-600 flex items-center gap-1">
                          <Bell className="w-4 h-4" />
                          {monitor.alerts.filter(a => !a.acknowledgedBy).length}
                        </span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedMonitor(monitor);
                            setView('detail');
                          }}
                          className="text-orange-600 hover:text-orange-700 flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        {/* ✅ LIFECYCLE FIX: Add delete button */}
                        <button
                          onClick={() => handleDeleteMonitor(monitor.id, monitor.petName)}
                          className="text-red-600 hover:text-red-700 flex items-center gap-1"
                          title="Delete monitor"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Detail View
  if (view === 'detail' && selectedMonitor) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setView('list');
              setSelectedMonitor(null);
            }}
            className="text-orange-600 hover:text-orange-700 flex items-center gap-2"
          >
            ← Back to List
          </button>
        </div>

        {/* Patient Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl">{selectedMonitor.petName}</h2>
              <p className="text-gray-600 mt-1">{selectedMonitor.petType} • {selectedMonitor.petBreed} • {selectedMonitor.petAge} years old</p>
            </div>
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-xs border ${getPriorityColor(selectedMonitor.priority)}`}>
                {selectedMonitor.priority.toUpperCase()}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(selectedMonitor.status)}`}>
                {selectedMonitor.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-sm text-gray-600 mb-2">Owner Information</h4>
              <p>{selectedMonitor.customerName}</p>
              <p className="text-sm text-gray-600">{selectedMonitor.customerPhone}</p>
            </div>
            <div>
              <h4 className="text-sm text-gray-600 mb-2">Location</h4>
              <p>{selectedMonitor.location}</p>
              {selectedMonitor.bedNumber && <p className="text-sm text-gray-600">Bed {selectedMonitor.bedNumber}</p>}
            </div>
            <div>
              <h4 className="text-sm text-gray-600 mb-2">Assigned Vet</h4>
              <p>{selectedMonitor.assignedVet}</p>
            </div>
          </div>

          {selectedMonitor.diagnosis.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm text-gray-600 mb-2">Diagnosis</h4>
              <div className="flex flex-wrap gap-2">
                {selectedMonitor.diagnosis.map((d, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active Alerts */}
        {selectedMonitor.alerts.filter(a => !a.acknowledgedBy).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg text-red-900 mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Active Alerts ({selectedMonitor.alerts.filter(a => !a.acknowledgedBy).length})
            </h3>
            <div className="space-y-3">
              {selectedMonitor.alerts
                .filter(a => !a.acknowledgedBy)
                .map((alert, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs ${
                          alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                          alert.severity === 'warning' ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(alert.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{alert.message}</p>
                    </div>
                    <button
                      onClick={() => acknowledgeAlert(index)}
                      className="ml-4 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                    >
                      Acknowledge
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Record Vitals Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg mb-4">Record Vital Signs</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-2">
                <Thermometer className="w-4 h-4 inline mr-1" />
                Temperature (°C) *
              </label>
              <input
                type="number"
                step="0.1"
                value={vitalForm.temperature}
                onChange={(e) => setVitalForm({...vitalForm, temperature: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="38.5"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">
                <Heart className="w-4 h-4 inline mr-1" />
                Heart Rate (bpm) *
              </label>
              <input
                type="number"
                value={vitalForm.heartRate}
                onChange={(e) => setVitalForm({...vitalForm, heartRate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="80"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">
                <Wind className="w-4 h-4 inline mr-1" />
                Respiratory Rate *
              </label>
              <input
                type="number"
                value={vitalForm.respiratoryRate}
                onChange={(e) => setVitalForm({...vitalForm, respiratoryRate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="20"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">BP Systolic</label>
              <input
                type="number"
                value={vitalForm.bloodPressureSystolic}
                onChange={(e) => setVitalForm({...vitalForm, bloodPressureSystolic: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="120"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">BP Diastolic</label>
              <input
                type="number"
                value={vitalForm.bloodPressureDiastolic}
                onChange={(e) => setVitalForm({...vitalForm, bloodPressureDiastolic: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="80"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">O2 Saturation (%)</label>
              <input
                type="number"
                value={vitalForm.oxygenSaturation}
                onChange={(e) => setVitalForm({...vitalForm, oxygenSaturation: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="98"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">Pain Score (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={vitalForm.painScore}
                onChange={(e) => setVitalForm({...vitalForm, painScore: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="5"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">
                <Brain className="w-4 h-4 inline mr-1" />
                Consciousness
              </label>
              <select
                value={vitalForm.consciousness}
                onChange={(e) => setVitalForm({...vitalForm, consciousness: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="alert">Alert</option>
                <option value="depressed">Depressed</option>
                <option value="stuporous">Stuporous</option>
                <option value="comatose">Comatose</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">Recorded By</label>
              <input
                type="text"
                value={vitalForm.recordedBy}
                onChange={(e) => setVitalForm({...vitalForm, recordedBy: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Staff name"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm text-gray-600 mb-2">Notes</label>
            <textarea
              value={vitalForm.notes}
              onChange={(e) => setVitalForm({...vitalForm, notes: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="Any additional observations..."
            />
          </div>
          <button
            onClick={recordVitals}
            disabled={!vitalForm.temperature || !vitalForm.heartRate || !vitalForm.respiratoryRate}
            className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Record Vitals
          </button>
        </div>

        {/* Vitals History */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg mb-4">Vital Signs History (Last 24 Hours)</h3>
          {vitals.length > 0 ? (
            <div className="space-y-4">
              {vitals.map(vital => (
                <div key={vital.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-600">
                      {new Date(vital.timestamp).toLocaleString()} • Recorded by {vital.recordedBy}
                    </p>
                    {vital.abnormalFlags.length > 0 && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                        {vital.abnormalFlags.length} Abnormalities
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Temperature</p>
                      <p className="text-lg">{vital.temperature}°C</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Heart Rate</p>
                      <p className="text-lg">{vital.heartRate} bpm</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Respiratory</p>
                      <p className="text-lg">{vital.respiratoryRate}/min</p>
                    </div>
                    {vital.oxygenSaturation && (
                      <div>
                        <p className="text-xs text-gray-600">SpO2</p>
                        <p className="text-lg">{vital.oxygenSaturation}%</p>
                      </div>
                    )}
                  </div>
                  {vital.abnormalFlags.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm text-red-700 mb-2">Abnormalities:</p>
                      <div className="space-y-1">
                        {vital.abnormalFlags.map((flag, i) => (
                          <p key={i} className="text-sm text-red-600">
                            • {flag.field}: {flag.value} (normal: {flag.normalRange}) - {flag.severity}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">No vital signs recorded yet</p>
          )}
        </div>
      </div>
    );
  }

  // Admit Patient View
  if (view === 'admit') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setView('dashboard')}
            className="text-orange-600 hover:text-orange-700 flex items-center gap-2"
          >
            ← Back
          </button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-2xl mb-6">Admit New Patient</h2>
          
          <div className="space-y-6">
            {/* Pet Information */}
            <div>
              <h3 className="text-lg mb-4">Pet Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Pet Name *</label>
                  <input
                    type="text"
                    value={admitForm.petName}
                    onChange={(e) => setAdmitForm({...admitForm, petName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Max"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Pet Type *</label>
                  <select
                    value={admitForm.petType}
                    onChange={(e) => setAdmitForm({...admitForm, petType: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="dog">Dog</option>
                    <option value="cat">Cat</option>
                    <option value="bird">Bird</option>
                    <option value="rabbit">Rabbit</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Breed *</label>
                  <input
                    type="text"
                    value={admitForm.petBreed}
                    onChange={(e) => setAdmitForm({...admitForm, petBreed: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Golden Retriever"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Age (years) *</label>
                  <input
                    type="number"
                    value={admitForm.petAge}
                    onChange={(e) => setAdmitForm({...admitForm, petAge: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="5"
                  />
                </div>
              </div>
            </div>

            {/* Owner Information */}
            <div>
              <h3 className="text-lg mb-4">Owner Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Owner Name *</label>
                  <input
                    type="text"
                    value={admitForm.customerName}
                    onChange={(e) => setAdmitForm({...admitForm, customerName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Phone *</label>
                  <input
                    type="tel"
                    value={admitForm.customerPhone}
                    onChange={(e) => setAdmitForm({...admitForm, customerPhone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
            </div>

            {/* Medical Information */}
            <div>
              <h3 className="text-lg mb-4">Medical Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Location *</label>
                  <input
                    type="text"
                    value={admitForm.location}
                    onChange={(e) => setAdmitForm({...admitForm, location: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Ward A"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Bed Number</label>
                  <input
                    type="text"
                    value={admitForm.bedNumber}
                    onChange={(e) => setAdmitForm({...admitForm, bedNumber: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="B12"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Assigned Vet *</label>
                  <input
                    type="text"
                    value={admitForm.assignedVet}
                    onChange={(e) => setAdmitForm({...admitForm, assignedVet: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Dr. Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Priority *</label>
                  <select
                    value={admitForm.priority}
                    onChange={(e) => setAdmitForm({...admitForm, priority: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-2">Diagnosis (comma-separated)</label>
                  <input
                    type="text"
                    value={admitForm.diagnosis}
                    onChange={(e) => setAdmitForm({...admitForm, diagnosis: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Fever, Dehydration"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-2">Symptoms (comma-separated)</label>
                  <input
                    type="text"
                    value={admitForm.symptoms}
                    onChange={(e) => setAdmitForm({...admitForm, symptoms: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Lethargy, Loss of appetite"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-2">Allergies (comma-separated)</label>
                  <input
                    type="text"
                    value={admitForm.allergies}
                    onChange={(e) => setAdmitForm({...admitForm, allergies: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Penicillin, Pollen"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-2">Notes</label>
                  <textarea
                    value={admitForm.notes}
                    onChange={(e) => setAdmitForm({...admitForm, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
            </div>

            <button
              onClick={admitPatient}
              disabled={!admitForm.petName || !admitForm.customerName || !admitForm.assignedVet}
              className="w-full py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Admit Patient
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
