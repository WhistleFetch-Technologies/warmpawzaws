'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft,
  Plus,
  User,
  Mail,
  Phone,
  Stethoscope,
  Award,
  Calendar,
  Edit,
  Trash2,
  Star,
  Clock,
  DollarSign,
  Upload,
  Camera,
  Check,
  X
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

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
  bio: string;
  consultationFee: number;
  photo: string;
  isActive: boolean;
  totalAppointments: number;
  completedAppointments: number;
  totalEarnings: number;
  rating: number;
  reviewCount: number;
  role: string;
  roleType: string;
  services: string[];
}

// ✅ Specialization options matching Figma design
const SPECIALIZATION_OPTIONS = [
  { id: 'eye_care', name: 'Eye Care', description: 'Eye problems, vision care, optical issues', icon: '👁️' },
  { id: 'heart_cardio', name: 'Heart & Cardiovascular', description: 'Heart conditions, cardiac care, circulation', icon: '❤️' },
  { id: 'neuro', name: 'Neurological Care', description: 'Nervous system, seizures, neurological issues', icon: '🧠' },
  { id: 'general', name: 'General Health', description: 'General health issues, consultation, diagnosis', icon: '🩺' },
  { id: 'skin_coat', name: 'Skin & Coat Care', description: 'Dermatology, skin conditions, coat health', icon: '🧴' },
  { id: 'dental', name: 'Dental Care', description: 'Dental cleaning, oral health, tooth issues', icon: '🦷' },
  { id: 'surgery', name: 'Surgery & Procedures', description: 'Surgical procedures, operations, aftercare', icon: '🔪' },
  { id: 'nutrition', name: 'Nutrition & Diet', description: 'Diet planning, nutrition counseling', icon: '🥗' },
  { id: 'emergency', name: 'Emergency Care', description: 'Emergency treatment, critical care', icon: '🚨' },
  { id: 'orthopedic', name: 'Orthopedic Care', description: 'Bone, joint, muscle issues', icon: '🦴' },
];

export function DoctorManagement({ clinicId, clinicData, onBack }: DoctorManagementProps) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  useEffect(() => {
    fetchStaff();
  }, [clinicId]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      
      const response = await apiClient.get<any>(`/staff/vendor/${clinicId}`);
      
      if (response.success !== false) {
        setStaff(response.staff || []);
      } else {
        setStaff([]);
      }
    } catch (error) {
      console.error('[STAFF MANAGEMENT] Error fetching staff:', error);
      toast.error('Failed to load staff members');
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = () => {
    setEditingStaff(null);
    setShowAddModal(true);
  };

  const handleEditStaff = (staffMember: Staff) => {
    setEditingStaff(staffMember);
    setShowAddModal(true);
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to remove this staff member? They will no longer be able to login.')) {
      return;
    }

    try {
      await apiClient.delete(`/staff/${staffId}`);
      toast.success('Staff member removed successfully');
      fetchStaff();
    } catch (error) {
      console.error('[REMOVE STAFF] Error:', error);
      toast.error('Failed to remove staff member. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading staff...</p>
        </div>
      </div>
    );
  }

  const roleLabel = clinicData?.roleId === 'pet_clinic' || clinicData?.roleId === 'veterinary_clinic' ? 'Doctor' : 'Staff Member';
  const roleLabelPlural = clinicData?.roleId === 'pet_clinic' || clinicData?.roleId === 'veterinary_clinic' ? 'Doctors' : 'Staff';

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-[#5D4037] text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-white">{roleLabel} Management</h1>
            <p className="text-sm text-white/90">{clinicData?.businessName || clinicData?.fullName}</p>
          </div>
        </div>

        <button
          onClick={handleAddStaff}
          className="w-full bg-white text-[#5D4037] rounded-xl py-3 font-semibold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add New {roleLabel}
        </button>
      </div>

      {/* Staff List */}
      <div className="p-4 space-y-3">
        {staff.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <Stethoscope className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="font-semibold text-gray-900 mb-2">No {roleLabelPlural} Yet</h3>
            <p className="text-gray-500 mb-4">
              Add {roleLabelPlural.toLowerCase()} to start accepting appointments
            </p>
            <button
              onClick={handleAddStaff}
              className="bg-[#FF8C42] text-white px-6 py-2 rounded-lg hover:bg-[#FF7A29] transition-colors"
            >
              Add First {roleLabel}
            </button>
          </div>
        ) : (
          staff.map((staffMember) => (
            <div key={staffMember.id} className="bg-white rounded-xl p-4 border border-gray-200">
              {/* Staff Header */}
              <div className="flex items-start gap-3 mb-3">
                {staffMember.photo ? (
                  <img
                    src={staffMember.photo}
                    alt={staffMember.fullName}
                    className="w-16 h-16 rounded-full object-cover border-2 border-[#FF8C42]"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[#FF8C42] flex items-center justify-center text-white">
                    <User className="w-8 h-8" />
                  </div>
                )}
                
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {(clinicData?.roleId === 'pet_clinic' || clinicData?.roleId === 'veterinary_clinic') ? 'Dr. ' : ''}{staffMember.fullName}
                  </h3>
                  {staffMember.specializations && staffMember.specializations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {staffMember.specializations.slice(0, 3).map((spec, index) => (
                        <span key={index} className="px-2 py-0.5 bg-orange-100 text-[#FF8C42] text-xs rounded-full">
                          {spec}
                        </span>
                      ))}
                      {staffMember.specializations.length > 3 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          +{staffMember.specializations.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      <span>{staffMember.experience || 0} yrs</span>
                    </div>
                    {staffMember.rating > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        <span>{staffMember.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  staffMember.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {staffMember.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>

              {/* Degree */}
              {staffMember.degree && (
                <div className="bg-blue-50 rounded-lg p-2 mb-3">
                  <p className="text-xs text-blue-600 font-medium">Qualifications</p>
                  <p className="text-sm text-blue-900">{staffMember.degree}</p>
                </div>
              )}

              {/* Contact Info */}
              <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{staffMember.email || 'No email'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{staffMember.phone}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                  <Calendar className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                  <p className="text-lg font-bold text-blue-900">{staffMember.totalAppointments || 0}</p>
                  <p className="text-xs text-blue-700">Total</p>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <Clock className="w-4 h-4 mx-auto mb-1 text-green-600" />
                  <p className="text-lg font-bold text-green-900">{staffMember.completedAppointments || 0}</p>
                  <p className="text-xs text-green-700">Completed</p>
                </div>
                <div className="text-center p-2 bg-orange-50 rounded-lg">
                  <DollarSign className="w-4 h-4 mx-auto mb-1 text-[#FF8C42]" />
                  <p className="text-lg font-bold text-gray-900">₹{staffMember.consultationFee || 0}</p>
                  <p className="text-xs text-gray-600">Fee</p>
                </div>
              </div>

              {/* About */}
              {staffMember.bio && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">About</p>
                  <p className="text-sm text-gray-700 line-clamp-2">{staffMember.bio}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditStaff(staffMember)}
                  className="flex-1 bg-white border border-[#FF8C42] text-[#FF8C42] rounded-lg py-2 flex items-center justify-center gap-2 hover:bg-orange-50 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleRemoveStaff(staffMember.id)}
                  className="flex-1 bg-white border border-red-500 text-red-500 rounded-lg py-2 flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Staff Modal */}
      {showAddModal && (
        <StaffFormModal
          clinicId={clinicId}
          clinicData={clinicData}
          staff={editingStaff}
          onClose={() => {
            setShowAddModal(false);
            setEditingStaff(null);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            setEditingStaff(null);
            fetchStaff();
          }}
        />
      )}
    </div>
  );
}

// Staff Form Modal Component
interface StaffFormModalProps {
  clinicId: string;
  clinicData: any;
  staff: Staff | null;
  onClose: () => void;
  onSuccess: () => void;
}

function StaffFormModal({ clinicId, clinicData, staff, onClose, onSuccess }: StaffFormModalProps) {
  const [formData, setFormData] = useState({
    fullName: staff?.fullName || '',
    email: staff?.email || '',
    phone: staff?.phone || '',
    experience: staff?.experience?.toString() || '',
    degree: staff?.degree || '',
    bio: staff?.bio || '',
    consultationFee: staff?.consultationFee?.toString() || ''
  });
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>(
    staff?.specializations || []
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(staff?.photo || '');
  const [submitting, setSubmitting] = useState(false);
  
  // Service assignment states
  const [vendorServices, setVendorServices] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>(staff?.services || []);
  const [loadingServices, setLoadingServices] = useState(false);

  // Fetch vendor services when modal opens
  useEffect(() => {
    fetchVendorServices();
  }, [clinicId]);

  const fetchVendorServices = async () => {
    try {
      setLoadingServices(true);
      const response = await apiClient.get<any>(`/vendor/services/${clinicId}`);
      
      let servicesList: any[] = [];
      
      if (response.allServices && Array.isArray(response.allServices)) {
        servicesList = response.allServices;
      } else if (response.services && typeof response.services === 'object') {
        ['at_home', 'at_center', 'tele'].forEach(style => {
          if (response.services[style] && response.services[style].services) {
            servicesList.push(...response.services[style].services);
          }
        });
      } else if (Array.isArray(response.services)) {
        servicesList = response.services;
      }
      
      setVendorServices(servicesList);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoadingServices(false);
    }
  };

  const toggleSpecialization = (specId: string) => {
    setSelectedSpecializations(prev => 
      prev.includes(specId) 
        ? prev.filter(id => id !== specId)
        : [...prev, specId]
    );
  };

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo must be less than 5MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (): Promise<string> => {
    if (!photoFile) {
      if (staff?.photo) return staff.photo;
      throw new Error('Photo is required');
    }

    const formDataUpload = new FormData();
    formDataUpload.append('vendorId', clinicId);
    formDataUpload.append('staff_photo', photoFile);

    // Use apiClient.post which handles FormData
    const uploadResponse = await apiClient.post<any>('/storage/upload-multiple', formDataUpload);

    if (uploadResponse.uploads && uploadResponse.uploads[0]?.success) {
      return uploadResponse.uploads[0].url;
    }

    throw new Error('Photo upload failed');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.fullName || !formData.phone) {
      toast.error('Name and phone are required');
      return;
    }

    if (selectedSpecializations.length === 0) {
      toast.error('Please select at least one specialization');
      return;
    }

    if (!formData.degree) {
      toast.error('Degree/qualifications are required');
      return;
    }

    if (!staff && !photoFile && !photoPreview) {
      toast.error('Photo is required for new staff members');
      return;
    }

    // Validate phone number
    if (formData.phone.length !== 10 || !/^\d+$/.test(formData.phone)) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setSubmitting(true);

      // Upload photo first if provided
      let photoUrl = staff?.photo || '';
      if (photoFile) {
        try {
          photoUrl = await uploadPhoto();
        } catch (err) {
          // Continue without photo if upload fails but photo already exists
          if (!staff?.photo) {
            toast.error('Photo upload failed');
            return;
          }
        }
      }

      // Map selected specialization IDs to names
      const specializationNames = selectedSpecializations.map(id => {
        const spec = SPECIALIZATION_OPTIONS.find(s => s.id === id);
        return spec?.name || id;
      });

      const payload: any = {
        fullName: formData.fullName,
        email: formData.email || `${formData.phone}@warmpawz.com`,
        phone: formData.phone,
        specializations: specializationNames,
        experience: parseInt(formData.experience) || 0,
        degree: formData.degree,
        bio: formData.bio,
        consultationFee: parseInt(formData.consultationFee) || 0,
        photo: photoUrl,
        role: 'doctor',
        roleType: (clinicData?.roleId === 'pet_clinic' || clinicData?.roleId === 'veterinary_clinic') ? 'clinic_doctor' : 'vet',
        vendorId: clinicId,
        services: selectedServices
      };

      let response: any;
      if (staff) {
        response = await apiClient.put(`/staff/${staff.id}`, payload);
      } else {
        response = await apiClient.post('/staff/create', payload);
      }

      if (response.success !== false) {
        const staffId = staff?.id || response.staffId;
        
        // Update services if needed
        if (selectedServices.length > 0 && staffId) {
          try {
            await apiClient.put(`/staff/${staffId}/services`, { serviceIds: selectedServices });
          } catch (err) {
            console.error('Failed to update services, but staff was saved');
          }
        }
        
        toast.success(staff ? 'Staff updated successfully' : 'Staff added successfully. They can now login with their phone number.');
        onSuccess();
      } else {
        throw new Error(response.error || 'Failed to save staff');
      }
    } catch (error: any) {
      console.error('[SAVE STAFF] Error:', error);
      toast.error(error.message || `Failed to ${staff ? 'update' : 'add'} staff member`);
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabel = (clinicData?.roleId === 'pet_clinic' || clinicData?.roleId === 'veterinary_clinic') ? 'Doctor' : 'Staff Member';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {staff ? `Edit ${roleLabel}` : `Add New ${roleLabel}`}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photo <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">Max size: 5MB. Required for new staff.</p>
            <div className="flex items-center gap-4">
              <div className="relative">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#FF8C42]"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="cursor-pointer">
                  <div className="px-4 py-2 bg-[#FF8C42] text-white rounded-lg hover:bg-[#FF7A29] transition-colors inline-flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Choose Photo
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
              placeholder="Enter full name"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number <span className="text-red-500">*</span> (Login Credential)
            </label>
            <input
              type="tel"
              maxLength={10}
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
              placeholder="10-digit mobile number"
              required
              disabled={!!staff}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email (Optional)
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
              placeholder="email@example.com"
            />
          </div>

          {/* Specializations - Checkbox Grid */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Specializations <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">Select areas of expertise. Staff will appear in customer searches for these problems.</p>
            
            <div className="space-y-2 border border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto">
              {SPECIALIZATION_OPTIONS.map((spec) => {
                const isSelected = selectedSpecializations.includes(spec.id);
                return (
                  <label
                    key={spec.id}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-orange-50 border-2 border-[#FF8C42]' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSpecialization(spec.id)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isSelected ? 'bg-[#FF8C42] border-[#FF8C42]' : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{spec.icon}</span>
                        <span className="font-medium text-gray-900">{spec.name}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{spec.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            
            {selectedSpecializations.length > 0 ? (
              <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                <Check className="w-4 h-4" />
                {selectedSpecializations.length} specialization{selectedSpecializations.length !== 1 ? 's' : ''} selected
              </p>
            ) : (
              <p className="text-sm text-red-500 mt-2">Please select at least one specialization</p>
            )}
          </div>

          {/* Degree */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Degree/Qualifications <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.degree}
              onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
              placeholder="e.g., BVSc, MVSc"
              required
            />
          </div>

          {/* Experience */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Experience (years)
            </label>
            <input
              type="number"
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
              placeholder="e.g., 10"
              min="0"
            />
          </div>

          {/* Consultation Fee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Consultation Fee (₹)
            </label>
            <input
              type="number"
              value={formData.consultationFee}
              onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
              placeholder="500"
              min="0"
            />
          </div>

          {/* About */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              About
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent resize-none"
              placeholder="Brief introduction..."
              rows={3}
            />
          </div>

          {/* Service Assignment */}
          {vendorServices.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign Services
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Select which services this {roleLabel.toLowerCase()} can perform
              </p>
              {loadingServices ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FF8C42]"></div>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {vendorServices.map(service => (
                    <label
                      key={service.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(service.id)}
                        onChange={() => toggleServiceSelection(service.id)}
                        className="w-4 h-4 text-[#FF8C42] border-gray-300 rounded focus:ring-[#FF8C42] cursor-pointer"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{service.name}</p>
                        {service.price && (
                          <p className="text-xs text-gray-500">₹{service.price}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {selectedServices.length > 0 && (
                <p className="text-xs text-[#FF8C42] mt-2">
                  {selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4 pb-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-[#FF8C42] text-white rounded-lg font-medium hover:bg-[#FF7A29] transition-colors disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : staff ? 'Update' : 'Add Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
