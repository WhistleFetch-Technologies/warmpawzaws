'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, User, Mail, Phone, Stethoscope, Award, Calendar, Edit, Trash2, Star } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface DoctorManagementProps {
  clinicId: string;
  clinicData: any;
  onBack: () => void;
}

interface Staff {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  specializations: string[];
  experience: number;
  degree: string;
  consultationFee: number;
  photo: string;
  isActive: boolean;
  totalAppointments: number;
  rating: number;
  role: string;
}

export function DoctorManagement({ clinicId, clinicData, onBack }: DoctorManagementProps) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadStaff();
  }, [clinicId]);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${clinicId}/staff?role=doctor`);
      if (response.success) {
        setStaff(response.staff || []);
      }
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b sticky top-0 z-10 p-4">
        <div className="flex items-center gap-0 mb-4">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="font-semibold text-gray-900">Doctor Management</h1>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full px-4 py-0 bg-primary text-white rounded-lg font-medium flex items-center justify-center gap-0"
        >
          <Plus className="w-5 h-5" />
          Add Doctor
        </button>
      </div>

      <div className="p-4 space-y-3">
        {staff.length === 0 ? (
          <div className="text-center py-0 bg-white rounded-lg border-2 border-gray-200">
            <Stethoscope className="w-12 h-12 text-gray-400 mx-auto mb-0" />
            <p className="text-gray-500">No doctors added yet</p>
          </div>
        ) : (
          staff.map(doctor => (
            <div key={doctor.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-0">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{doctor.fullName}</h3>
                  <p className="text-sm text-gray-600">{doctor.degree}</p>
                  <div className="flex items-center gap-4 mt-0">
                    <span className="text-sm font-medium text-primary">₹{doctor.consultationFee}</span>
                    <div className="flex items-center gap-0">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm">{doctor.rating}</span>
                    </div>
                  </div>
                  {doctor.specializations.length > 0 && (
                    <div className="flex flex-wrap gap-0 mt-0">
                      {doctor.specializations.map((spec, idx) => (
                        <span key={idx} className="px-0 py-0 bg-blue-100 text-blue-700 rounded text-xs">
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-0">
                  <button className="p-0 hover:bg-gray-100 rounded-lg">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button className="p-0 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{doctor.totalAppointments} appointments</span>
                <span className={doctor.isActive ? 'text-green-600' : 'text-gray-400'}>
                  {doctor.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-0">
            <h3 className="text-lg font-semibold mb-4">Add Doctor</h3>
            <p className="text-gray-600 mb-4">Doctor management form coming soon</p>
            <button
              onClick={() => setShowAddModal(false)}
              className="w-full px-4 py-0 bg-gray-100 text-gray-700 rounded-lg font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

