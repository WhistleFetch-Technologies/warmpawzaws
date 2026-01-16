'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Staff {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  experience_years: number;
  is_active: boolean;
  mobile_verified?: boolean;
  mobile_verified_at?: string;
  photo?: string;
  qualifications?: string;
  specializations: string[];
  services: { id: string; name: string; service_style?: string }[];
}

interface VendorService {
  id: string;
  service_name: string;
  category: string;
  service_style: string;
  price: number;
}

interface StaffAvailability {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  serviceStyles: string[];
}

// Common specializations by role type
const SPECIALIZATIONS_BY_ROLE: Record<string, string[]> = {
  'Veterinarian': ['General Practice', 'Surgery', 'Dentistry', 'Dermatology', 'Orthopedics', 'Cardiology', 'Oncology', 'Emergency Care', 'Exotic Animals'],
  'Groomer': ['Bath & Brush', 'Full Grooming', 'Hand Stripping', 'Creative Grooming', 'Cat Grooming', 'Puppy Grooming', 'De-matting', 'Show Grooming'],
  'Trainer': ['Obedience Training', 'Puppy Training', 'Behavior Modification', 'Agility', 'Protection Training', 'Therapy Dog Training', 'Trick Training'],
  'Walker': ['Dog Walking', 'Group Walks', 'Puppy Walks', 'Senior Dog Care', 'Reactive Dog Handling'],
  'default': ['General Care', 'Customer Service', 'Pet Handling', 'First Aid'],
};

export default function StaffManagementPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showServiceAssignment, setShowServiceAssignment] = useState<string | null>(null);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState<string | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState<Staff | null>(null);
  const [vendorData, setVendorData] = useState<any>(null);
  const [vendorServices, setVendorServices] = useState<VendorService[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [staffAvailability, setStaffAvailability] = useState<StaffAvailability[]>([]);
  const [selectedServiceStyles, setSelectedServiceStyles] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [verificationOtp, setVerificationOtp] = useState('');
  const [verifyingMobile, setVerifyingMobile] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  const [newStaff, setNewStaff] = useState<{
    name: string;
    phone: string;
    email: string;
    role: string;
    experience_years: number;
    photo: string;
    qualifications: string;
    specializations: string[];
    is_active: boolean;
  }>({
    name: '',
    phone: '',
    email: '',
    role: '',
    experience_years: 0,
    photo: '',
    qualifications: '',
    specializations: [],
    is_active: true,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SERVICE_STYLES = [
    { id: 'at_center', label: 'At Center', icon: '🏥' },
    { id: 'at_home', label: 'At Home', icon: '🏠' },
    { id: 'tele', label: 'Tele/Video', icon: '📱' },
  ];

  const ROLE_OPTIONS = [
    'Veterinarian',
    'Groomer', 
    'Trainer',
    'Walker',
    'Receptionist',
    'Assistant',
    'Nurse',
    'Technician',
  ];

  useEffect(() => {
    const loadVendorData = async () => {
      try {
        const vendorId = localStorage.getItem('vendorId');
        if (vendorId) {
          const response = await apiClient.get<any>(`/vendor/${vendorId}/profile`);
          setVendorData(response.vendor || response);
          
          const servicesResponse = await apiClient.get<any>(`/vendor/${vendorId}/services`);
          const allServices = servicesResponse.allServices || servicesResponse.services || [];
          setVendorServices(allServices);
        }
      } catch (err) {
        console.error('Error loading vendor data:', err);
      }
    };
    loadVendorData();
  }, []);

  const vendorRoleId = vendorData?.roleId || vendorData?.role_id;
  const isHealthcare = ['veterinarian', 'veterinary_clinic', 'vet_clinic'].includes(vendorRoleId?.toLowerCase() || '');

  useEffect(() => {
    const vendorId = localStorage.getItem('vendorId');
    if (!vendorId) {
      router.push('/onboarding');
      return;
    }
    loadStaff();
  }, [router]);

  const loadStaff = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (vendorId) {
        const response = await apiClient.get<{ staff: Staff[] }>(`/vendor/${vendorId}/staff`);
        setStaff(response.staff || []);
      }
    } catch (err) {
      console.error('Error loading staff:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!newStaff.name.trim()) errors.name = 'Name is required';
    if (!newStaff.phone.trim()) errors.phone = 'Phone number is required';
    if (newStaff.phone && !/^\d{10}$/.test(newStaff.phone.replace(/\D/g, ''))) {
      errors.phone = 'Please enter a valid 10-digit phone number';
    }
    if (!newStaff.role) errors.role = 'Role is required';
    if (!newStaff.photo) errors.photo = 'Photo is mandatory for all staff members';
    if (!newStaff.qualifications.trim()) errors.qualifications = 'Qualifications are mandatory';
    if (newStaff.specializations.length === 0) errors.specializations = 'At least one specialization is required';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be less than 5MB');
      return;
    }

    try {
      // Convert to base64 for now (in production, use S3 upload)
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewStaff({ ...newStaff, photo: reader.result as string });
        setFormErrors({ ...formErrors, photo: '' });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('Failed to upload photo');
    }
  };

  const toggleSpecialization = (spec: string) => {
    const current = newStaff.specializations;
    const updated = current.includes(spec)
      ? current.filter(s => s !== spec)
      : [...current, spec];
    setNewStaff({ ...newStaff, specializations: updated });
    if (updated.length > 0) {
      setFormErrors({ ...formErrors, specializations: '' });
    }
  };

  const handleAddStaff = async () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const vendorId = localStorage.getItem('vendorId');
      
      // Use correct API endpoint: POST /vendor/:vendorId/staff
      const response = await apiClient.post<any>(`/vendor/${vendorId}/staff`, {
        name: newStaff.name,
        phone: newStaff.phone.replace(/\D/g, ''), // Clean phone number
        email: newStaff.email || undefined,
        role: newStaff.role,
        experienceYears: newStaff.experience_years,
        photo: newStaff.photo,
        qualifications: newStaff.qualifications,
        specializations: newStaff.specializations,
        isActive: newStaff.is_active,
      });

      toast.success('Staff member added! OTP sent to their mobile for verification.');
      setShowAddForm(false);
      setNewStaff({
        name: '',
        phone: '',
        email: '',
        role: '',
        experience_years: 0,
        photo: '',
        qualifications: '',
        specializations: [],
        is_active: true,
      });
      setFormErrors({});
      loadStaff();
    } catch (err: any) {
      console.error('Error adding staff:', err);
      toast.error(err.message || 'Failed to add staff member');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStaffStatus = async (staffId: string, isActive: boolean) => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      await apiClient.put(`/vendor/${vendorId}/staff/${staffId}`, { isActive: !isActive });
      toast.success(isActive ? 'Staff deactivated' : 'Staff activated');
      loadStaff();
    } catch (err) {
      console.error('Error updating staff:', err);
      toast.error('Failed to update staff status');
    }
  };

  const openServiceAssignment = (staffMember: Staff) => {
    setShowServiceAssignment(staffMember.id);
    setSelectedServices(staffMember.services?.map(s => s.id) || []);
  };

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const saveServiceAssignments = async () => {
    if (!showServiceAssignment) return;
    
    try {
      const vendorId = localStorage.getItem('vendorId');
      await apiClient.post(`/vendor/${vendorId}/staff/${showServiceAssignment}/assign-services`, {
        serviceIds: selectedServices,
      });
      toast.success('Services assigned successfully');
      setShowServiceAssignment(null);
      setSelectedServices([]);
      loadStaff();
    } catch (err) {
      console.error('Error saving service assignments:', err);
      toast.error('Failed to assign services');
    }
  };

  const openAvailabilityModal = async (staffMember: Staff) => {
    setShowAvailabilityModal(staffMember.id);
    try {
      const vendorId = localStorage.getItem('vendorId');
      const response = await apiClient.get<any>(`/vendor/${vendorId}/staff/${staffMember.id}/availability`);
      setStaffAvailability(response.availability || []);
      setSelectedServiceStyles(response.serviceStyles || ['at_center', 'at_home', 'tele']);
    } catch (err) {
      console.error('Error loading availability:', err);
      setStaffAvailability([1, 2, 3, 4, 5, 6].map(day => ({
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '18:00',
        serviceStyles: ['at_center', 'at_home', 'tele'],
      })));
      setSelectedServiceStyles(['at_center', 'at_home', 'tele']);
    }
  };

  const toggleServiceStyle = (styleId: string) => {
    setSelectedServiceStyles(prev => 
      prev.includes(styleId) 
        ? prev.filter(s => s !== styleId)
        : [...prev, styleId]
    );
  };

  const saveAvailability = async () => {
    if (!showAvailabilityModal) return;
    
    try {
      const vendorId = localStorage.getItem('vendorId');
      await apiClient.put(`/vendor/${vendorId}/staff/${showAvailabilityModal}/availability`, {
        availability: staffAvailability,
        serviceStyles: selectedServiceStyles,
      });
      setShowAvailabilityModal(null);
      toast.success('Availability saved successfully!');
    } catch (err) {
      console.error('Error saving availability:', err);
      toast.error('Failed to save availability');
    }
  };

  // ========== VERIFICATION FLOW ==========
  const openVerifyModal = async (staffMember: Staff) => {
    setShowVerifyModal(staffMember);
    setVerificationOtp('');
    
    // Resend OTP when opening modal
    try {
      setResendingOtp(true);
      const response = await apiClient.post<any>(`/staff/${staffMember.id}/resend-verification-otp`, {});
      if (response.debug_otp) {
        toast.info(`UAT Mode: OTP is ${response.debug_otp}`);
      }
      toast.success('OTP sent to staff mobile number');
    } catch (err: any) {
      console.error('Error sending OTP:', err);
      toast.error(err.message || 'Failed to send OTP');
    } finally {
      setResendingOtp(false);
    }
  };

  const handleVerifyMobile = async () => {
    if (!showVerifyModal || !verificationOtp) {
      toast.error('Please enter the OTP');
      return;
    }

    if (verificationOtp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setVerifyingMobile(true);
    try {
      await apiClient.post(`/staff/${showVerifyModal.id}/verify-mobile`, {
        otp: verificationOtp,
      });
      toast.success('Mobile verified! Staff can now go live on the platform.');
      setShowVerifyModal(null);
      setVerificationOtp('');
      loadStaff();
    } catch (err: any) {
      console.error('Error verifying mobile:', err);
      toast.error(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setVerifyingMobile(false);
    }
  };

  const handleResendOtp = async () => {
    if (!showVerifyModal) return;

    setResendingOtp(true);
    try {
      const response = await apiClient.post<any>(`/staff/${showVerifyModal.id}/resend-verification-otp`, {});
      if (response.debug_otp) {
        toast.info(`UAT Mode: OTP is ${response.debug_otp}`);
      }
      toast.success('OTP resent successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend OTP');
    } finally {
      setResendingOtp(false);
    }
  };

  const getAvailableSpecializations = () => {
    const role = newStaff.role;
    return SPECIALIZATIONS_BY_ROLE[role] || SPECIALIZATIONS_BY_ROLE['default'];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Staff Management</h1>
            <p className="text-gray-500 mt-1">Manage your team members and their assignments</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← Back
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            >
              + Add Staff
            </button>
          </div>
        </div>

        {/* Info Banner about verification */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <h3 className="font-semibold text-blue-900">Staff Verification Required</h3>
              <p className="text-sm text-blue-700 mt-1">
                Staff members must verify their mobile number before they can go live on the platform. 
                Unverified staff won't appear in customer searches for home/tele services.
              </p>
            </div>
          </div>
        </div>

        {staff.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <div className="text-6xl mb-4">👥</div>
            <p className="text-gray-500">No staff members yet</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              Add Your First Staff Member
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((member) => (
              <div key={member.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {/* Staff Photo */}
                    {member.photo ? (
                      <img 
                        src={member.photo} 
                        alt={member.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-orange-200"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-xl font-semibold text-orange-600">
                        {member.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-800">{member.name}</h3>
                      <p className="text-sm text-gray-500">{member.role}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {/* Verification Status Badge */}
                    {member.mobile_verified ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1">
                        <span>✓</span> Verified
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 flex items-center gap-1">
                        <span>⚠</span> Unverified
                      </span>
                    )}
                    {/* Active Status */}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      member.is_active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone</span>
                    <span className="font-medium">{member.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Experience</span>
                    <span className="font-medium">{member.experience_years || 0} years</span>
                  </div>
                  {member.specializations && member.specializations.length > 0 && (
                    <div>
                      <span className="text-gray-500">Specializations</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {member.specializations.slice(0, 3).map((spec, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-xs">
                            {spec}
                          </span>
                        ))}
                        {member.specializations.length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            +{member.specializations.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {member.services && member.services.length > 0 && (
                    <div>
                      <span className="text-gray-500">Assigned Services ({member.services.length})</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {member.services.slice(0, 3).map((svc, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                            {svc.name}
                          </span>
                        ))}
                        {member.services.length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            +{member.services.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                  {/* Verify Mobile Button - Only for unverified staff */}
                  {!member.mobile_verified && (
                    <button
                      onClick={() => openVerifyModal(member)}
                      className="flex-1 p-2 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-200 min-w-[100px] flex items-center justify-center gap-1"
                    >
                      <span>📱</span> Verify Mobile
                    </button>
                  )}
                  <button
                    onClick={() => openServiceAssignment(member)}
                    className="flex-1 p-2 bg-blue-100 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-200 min-w-[100px]"
                  >
                    Assign Services
                  </button>
                  <button
                    onClick={() => openAvailabilityModal(member)}
                    className="flex-1 p-2 bg-purple-100 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-200 min-w-[100px]"
                  >
                    Set Availability
                  </button>
                  <button
                    onClick={() => toggleStaffStatus(member.id, member.is_active)}
                    className={`flex-1 p-2 rounded-lg text-sm font-medium min-w-[100px] ${
                      member.is_active
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    {member.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========== ADD STAFF MODAL ========== */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">Add New Staff Member</h2>
              <p className="text-sm text-gray-500 mb-6">
                All fields marked with * are mandatory. Staff must verify their mobile before going live.
              </p>
              
              <div className="space-y-4">
                {/* Photo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Photo * <span className="text-xs text-gray-500">(Required for platform listing)</span>
                  </label>
                  <div className="flex items-center gap-4">
                    {newStaff.photo ? (
                      <img 
                        src={newStaff.photo} 
                        alt="Staff photo" 
                        className="w-20 h-20 rounded-full object-cover border-2 border-orange-200"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                        <span className="text-3xl">👤</span>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={photoInputRef}
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="px-4 py-2 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50"
                    >
                      {newStaff.photo ? 'Change Photo' : 'Upload Photo'}
                    </button>
                  </div>
                  {formErrors.photo && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.photo}</p>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={newStaff.name}
                    onChange={(e) => {
                      setNewStaff({ ...newStaff, name: e.target.value });
                      if (e.target.value) setFormErrors({ ...formErrors, name: '' });
                    }}
                    className={`w-full p-3 border rounded-lg ${formErrors.name ? 'border-red-300' : 'border-gray-300'}`}
                  />
                  {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Number * <span className="text-xs text-gray-500">(Used for login & verification)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={newStaff.phone}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setNewStaff({ ...newStaff, phone: cleaned });
                      if (cleaned.length === 10) setFormErrors({ ...formErrors, phone: '' });
                    }}
                    className={`w-full p-3 border rounded-lg ${formErrors.phone ? 'border-red-300' : 'border-gray-300'}`}
                  />
                  {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    value={newStaff.role}
                    onChange={(e) => {
                      setNewStaff({ ...newStaff, role: e.target.value, specializations: [] });
                      if (e.target.value) setFormErrors({ ...formErrors, role: '' });
                    }}
                    className={`w-full p-3 border rounded-lg ${formErrors.role ? 'border-red-300' : 'border-gray-300'}`}
                  >
                    <option value="">Select a role</option>
                    {ROLE_OPTIONS.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  {formErrors.role && <p className="text-red-500 text-xs mt-1">{formErrors.role}</p>}
                </div>

                {/* Experience */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    placeholder="0"
                    value={newStaff.experience_years || ''}
                    onChange={(e) => setNewStaff({ ...newStaff, experience_years: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Qualifications */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Qualifications * <span className="text-xs text-gray-500">(Degrees, certifications)</span>
                  </label>
                  <textarea
                    placeholder="e.g., BVSc, MVSc, Certified Pet Groomer..."
                    value={newStaff.qualifications}
                    onChange={(e) => {
                      setNewStaff({ ...newStaff, qualifications: e.target.value });
                      if (e.target.value) setFormErrors({ ...formErrors, qualifications: '' });
                    }}
                    rows={2}
                    className={`w-full p-3 border rounded-lg ${formErrors.qualifications ? 'border-red-300' : 'border-gray-300'}`}
                  />
                  {formErrors.qualifications && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.qualifications}</p>
                  )}
                </div>

                {/* Specializations */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specializations * <span className="text-xs text-gray-500">(Select at least one)</span>
                  </label>
                  {newStaff.role ? (
                    <div className="flex flex-wrap gap-2">
                      {getAvailableSpecializations().map(spec => (
                        <button
                          key={spec}
                          type="button"
                          onClick={() => toggleSpecialization(spec)}
                          className={`px-3 py-1.5 rounded-full text-sm transition ${
                            newStaff.specializations.includes(spec)
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {spec}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">Please select a role first</p>
                  )}
                  {formErrors.specializations && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.specializations}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setFormErrors({});
                  }}
                  className="flex-1 p-3 border rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStaff}
                  disabled={submitting}
                  className="flex-1 p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Adding...' : 'Add Staff'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== VERIFY MOBILE MODAL ========== */}
        {showVerifyModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-2">Verify Staff Mobile</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter the 6-digit OTP sent to <strong>{showVerifyModal.phone}</strong>
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  📱 OTP has been sent to {showVerifyModal.name}'s mobile number
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Enter OTP</label>
                <input
                  type="text"
                  value={verificationOtp}
                  onChange={(e) => setVerificationOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="______"
                  maxLength={6}
                  className="w-full p-4 text-2xl text-center tracking-widest font-mono border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowVerifyModal(null);
                    setVerificationOtp('');
                  }}
                  className="flex-1 p-3 border rounded-lg hover:bg-gray-50"
                  disabled={verifyingMobile}
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyMobile}
                  disabled={verifyingMobile || verificationOtp.length !== 6}
                  className="flex-1 p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifyingMobile ? 'Verifying...' : 'Verify'}
                </button>
              </div>

              <button
                onClick={handleResendOtp}
                disabled={resendingOtp}
                className="w-full mt-4 p-2 text-sm text-gray-600 hover:text-gray-800"
              >
                {resendingOtp ? 'Sending...' : "Didn't receive OTP? Resend"}
              </button>
            </div>
          </div>
        )}

        {/* ========== SERVICE ASSIGNMENT MODAL ========== */}
        {showServiceAssignment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">Assign Services to Staff</h2>
              <p className="text-sm text-gray-500 mb-4">
                Select which services this staff member can perform
              </p>
              
              {vendorServices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No services available to assign.</p>
                  <p className="text-sm mt-2">Add services first in Service Management.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {vendorServices.map((service) => (
                    <label
                      key={service.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        selectedServices.includes(service.id)
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(service.id)}
                        onChange={() => toggleServiceSelection(service.id)}
                        className="w-4 h-4 text-orange-500 rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{service.service_name}</p>
                        <p className="text-xs text-gray-500">
                          {service.category} • {service.service_style?.replace('_', ' ')} • ₹{service.price}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowServiceAssignment(null);
                    setSelectedServices([]);
                  }}
                  className="flex-1 p-3 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveServiceAssignments}
                  className="flex-1 p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Save ({selectedServices.length} selected)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== AVAILABILITY MODAL ========== */}
        {showAvailabilityModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">📅 Set Staff Availability</h2>
              
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Available for Service Types:</h3>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => toggleServiceStyle(style.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                        selectedServiceStyles.includes(style.id)
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <span>{style.icon}</span>
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Weekly Schedule:</h3>
                <div className="space-y-3">
                  {DAYS_OF_WEEK.map((day, index) => {
                    const dayAvail = staffAvailability.find(a => a.dayOfWeek === index);
                    const isEnabled = !!dayAvail;
                    
                    return (
                      <div key={day} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setStaffAvailability([...staffAvailability, {
                                dayOfWeek: index,
                                startTime: '09:00',
                                endTime: '18:00',
                                serviceStyles: selectedServiceStyles,
                              }]);
                            } else {
                              setStaffAvailability(staffAvailability.filter(a => a.dayOfWeek !== index));
                            }
                          }}
                          className="w-4 h-4 text-orange-500 rounded"
                        />
                        <span className="w-24 font-medium text-gray-700">{day}</span>
                        {isEnabled && (
                          <>
                            <input
                              type="time"
                              value={dayAvail?.startTime || '09:00'}
                              onChange={(e) => {
                                setStaffAvailability(staffAvailability.map(a => 
                                  a.dayOfWeek === index ? { ...a, startTime: e.target.value } : a
                                ));
                              }}
                              className="p-2 border rounded text-sm"
                            />
                            <span className="text-gray-400">to</span>
                            <input
                              type="time"
                              value={dayAvail?.endTime || '18:00'}
                              onChange={(e) => {
                                setStaffAvailability(staffAvailability.map(a => 
                                  a.dayOfWeek === index ? { ...a, endTime: e.target.value } : a
                                ));
                              }}
                              className="p-2 border rounded text-sm"
                            />
                          </>
                        )}
                        {!isEnabled && (
                          <span className="text-gray-400 text-sm">Not Available</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAvailabilityModal(null);
                    setStaffAvailability([]);
                    setSelectedServiceStyles([]);
                  }}
                  className="flex-1 p-3 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAvailability}
                  className="flex-1 p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Save Availability
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
