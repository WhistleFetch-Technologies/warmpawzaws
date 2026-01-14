'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  ArrowLeft, Plus, Search, Filter, Bell, Eye, Activity, Heart, 
  Thermometer, AlertCircle, CheckCircle, Clock, User
} from 'lucide-react';
import { toast } from 'sonner';

interface PatientMonitor {
  id: string;
  petName: string;
  petType: string;
  customerName: string;
  admissionDate: string;
  status: 'active' | 'stable' | 'critical' | 'discharged';
  priority: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  assignedVet: string;
  diagnosis: string[];
}

interface VendorPatientMonitoringProps {
  vendorId: string;
  onBack?: () => void;
}

export function VendorPatientMonitoring({ vendorId, onBack }: VendorPatientMonitoringProps) {
  const [patients, setPatients] = useState<PatientMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPatients();
  }, [vendorId]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/patient-monitors`);

      if (response.success) {
        setPatients(response.monitors || []);
      } else {
        // Mock data
        setPatients([
          {
            id: '1',
            petName: 'Max',
            petType: 'Dog',
            customerName: 'Rahul Sharma',
            admissionDate: new Date().toISOString(),
            status: 'stable',
            priority: 'medium',
            location: 'Ward A - Bed 3',
            assignedVet: 'Dr. Patel',
            diagnosis: ['Post-surgery recovery']
          },
          {
            id: '2',
            petName: 'Whiskers',
            petType: 'Cat',
            customerName: 'Priya Singh',
            admissionDate: new Date().toISOString(),
            status: 'critical',
            priority: 'critical',
            location: 'ICU - Bed 1',
            assignedVet: 'Dr. Kumar',
            diagnosis: ['Kidney infection', 'Dehydration']
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'stable': return 'bg-green-100 text-green-800 border-green-200';
      case 'active': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'discharged': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'high': return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'medium': return <Clock className="w-5 h-5 text-yellow-500" />;
      default: return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
  };

  const filteredPatients = patients.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (searchQuery && !p.petName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold">Patient Monitoring</h1>
            <p className="text-sm text-white/80">{patients.length} admitted patients</p>
          </div>
          <button className="p-2 bg-white/20 rounded-full relative">
            <Bell className="w-6 h-6" />
            {patients.filter(p => p.status === 'critical').length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full text-xs text-red-800 flex items-center justify-center">
                {patients.filter(p => p.status === 'critical').length}
              </span>
            )}
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white text-gray-800"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 p-4">
        {[
          { label: 'Total', value: patients.length, color: 'bg-blue-100 text-blue-600' },
          { label: 'Critical', value: patients.filter(p => p.status === 'critical').length, color: 'bg-red-100 text-red-600' },
          { label: 'Stable', value: patients.filter(p => p.status === 'stable').length, color: 'bg-green-100 text-green-600' },
          { label: 'Active', value: patients.filter(p => p.status === 'active').length, color: 'bg-yellow-100 text-yellow-600' }
        ].map((stat) => (
          <div key={stat.label} className={`${stat.color} rounded-xl p-2 text-center`}>
            <p className="text-lg font-bold">{stat.value}</p>
            <p className="text-xs">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 px-4 overflow-x-auto">
        {['all', 'critical', 'stable', 'active'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-full text-sm ${
              filterStatus === status
                ? 'bg-red-500 text-white'
                : 'bg-white text-gray-600 border'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Patient List */}
      <div className="p-4 space-y-4">
        {filteredPatients.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <Activity className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-800">No Patients</h3>
            <p className="text-gray-500">No admitted patients at the moment</p>
          </div>
        ) : (
          filteredPatients.map((patient) => (
            <div
              key={patient.id}
              className={`bg-white rounded-xl p-4 border-2 ${getStatusColor(patient.status)}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {getPriorityIcon(patient.priority)}
                  <div>
                    <h3 className="font-semibold text-gray-800">{patient.petName}</h3>
                    <p className="text-sm text-gray-500">{patient.petType} • {patient.customerName}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(patient.status)}`}>
                  {patient.status}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span>{patient.assignedVet}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Activity className="w-4 h-4" />
                  <span>{patient.location}</span>
                </div>
              </div>

              {patient.diagnosis.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {patient.diagnosis.map((d, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                      {d}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                  <Heart className="w-4 h-4" /> Record Vitals
                </button>
                <button className="px-4 py-2 border border-gray-200 rounded-lg">
                  <Eye className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default VendorPatientMonitoring;
