'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { Users, Plus, Phone, Mail, Star, Trash2, Edit2, Camera, Loader2, X, UserCheck, UserX, Award, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

interface Staff {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  experience_years?: number;
  is_active: boolean;
  services?: any[];
  photo_url?: string;
  photo?: string;
  qualifications?: string;
  specializations?: string[];
}

interface VendorStaffPageProps {
  vendorId: string;
  onBack?: () => void;
}

const STAFF_ROLES = [
  'Staff',
  'Veterinarian',
  'Groomer',
  'Trainer',
  'Walker',
  'Receptionist',
  'Manager',
  'Nurse',
  'Assistant',
  'Specialist',
  'Technician',
];

const COMMON_SPECIALIZATIONS = [
  'General Practice',
  'Surgery',
  'Dentistry',
  'Dermatology',
  'Cardiology',
  'Orthopedics',
  'Emergency Care',
  'Grooming - Basic',
  'Grooming - Full Service',
  'Grooming - Show Cuts',
  'Training - Obedience',
  'Training - Agility',
  'Training - Behavioral',
  'Pet Nutrition',
  'Vaccination',
  'Diagnostics',
  'Rehabilitation',
];

export function VendorStaffPage({ vendorId, onBack }: VendorStaffPageProps) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  useEffect(() => {
    loadStaff();
  }, [vendorId]);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/staff`);
      if (response.success) {
        setStaff(response.staff || []);
      }
    } catch (err) {
      console.error('Error loading staff:', err);
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStaff = async (staffId: string, isActive: boolean) => {
    try {
      await apiClient.put(`/vendor/${vendorId}/staff/${staffId}`, {
        isActive: !isActive,
      });
      toast.success(isActive ? 'Staff deactivated' : 'Staff activated');
      loadStaff();
    } catch (err) {
      console.error('Error toggling staff:', err);
      toast.error('Failed to update staff status');
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    try {
      await apiClient.delete(`/vendor/${vendorId}/staff/${staffId}`);
      toast.success('Staff member removed');
      loadStaff();
    } catch (err) {
      console.error('Error deleting staff:', err);
      toast.error('Failed to remove staff');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42] mx-auto mb-4" />
          <p className="text-gray-600">Loading staff...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <button 
                  onClick={onBack}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ←
                </button>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900">Staff Management</h1>
                <p className="text-sm text-gray-500">{staff.length} team members</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF8C42] text-white rounded-xl font-medium hover:bg-[#FF7A2E] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Staff
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {staff.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-purple-100 rounded-full flex items-center justify-center">
              <Users className="w-10 h-10 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No staff members yet</h2>
            <p className="text-gray-500 mb-6">Add your team members to manage bookings</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF8C42] text-white rounded-xl font-medium hover:bg-[#FF7A2E] transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Staff Member
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {member.photo_url || member.photo ? (
                      <img 
                        src={member.photo_url || member.photo} 
                        alt={member.name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-gray-100"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">{member.name}</h3>
                      <p className="text-sm text-gray-500">{member.role}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    member.is_active 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {member.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{member.phone}</span>
                  </div>
                  {member.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  )}
                  {member.experience_years && member.experience_years > 0 && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Star className="w-4 h-4 text-gray-400" />
                      <span>{member.experience_years} years experience</span>
                    </div>
                  )}
                  {member.qualifications && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Award className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{member.qualifications}</span>
                    </div>
                  )}
                </div>

                {member.specializations && member.specializations.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-400 mb-2">Specializations:</p>
                    <div className="flex flex-wrap gap-1">
                      {member.specializations.slice(0, 3).map((s: string, idx: number) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded-lg">
                          {s}
                        </span>
                      ))}
                      {member.specializations.length > 3 && (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-lg">
                          +{member.specializations.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {member.services && member.services.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-400 mb-2">Services:</p>
                    <div className="flex flex-wrap gap-1">
                      {member.services.slice(0, 3).map((s: any, idx: number) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-orange-50 text-orange-600 rounded-lg">
                          {s.service_name || s.name}
                        </span>
                      ))}
                      {member.services.length > 3 && (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-lg">
                          +{member.services.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleToggleStaff(member.id, member.is_active)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 text-sm rounded-lg font-medium transition-colors ${
                      member.is_active 
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    {member.is_active ? (
                      <><UserX className="w-4 h-4" /> Deactivate</>
                    ) : (
                      <><UserCheck className="w-4 h-4" /> Activate</>
                    )}
                  </button>
                  <button
                    onClick={() => setEditingStaff(member)}
                    className="flex items-center justify-center gap-1 py-2 px-3 text-sm bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 font-medium transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteStaff(member.id)}
                    className="flex items-center justify-center py-2 px-3 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed Back Button */}
      {onBack && (
        <div className="fixed bottom-6 left-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-xl font-medium shadow-lg hover:bg-gray-700 transition-colors"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingStaff) && (
        <StaffModal
          vendorId={vendorId}
          staff={editingStaff}
          onClose={() => {
            setShowAddModal(false);
            setEditingStaff(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingStaff(null);
            loadStaff();
          }}
        />
      )}
    </div>
  );
}

function StaffModal({
  vendorId,
  staff,
  onClose,
  onSave,
}: {
  vendorId: string;
  staff: Staff | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: staff?.name || '',
    phone: staff?.phone || '',
    email: staff?.email || '',
    role: staff?.role || 'Staff',
    experience_years: staff?.experience_years || 0,
    qualifications: staff?.qualifications || '',
    specializations: staff?.specializations || [] as string[],
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(staff?.photo_url || staff?.photo || null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // ✅ ENHANCED: Photo upload with progress tracking
  const uploadPhotoToS3 = async (file: File): Promise<string | null> => {
    try {
      const { uploadStaffPhotoWithProgress } = await import('@/lib/photo-upload-enhanced');
      
      const result = await uploadStaffPhotoWithProgress(file, vendorId, {
        onProgress: (progress) => {
          setUploadProgress(progress);
        },
        verifyUpload: true,
        maxRetries: 3,
      });

      if (result.success && result.publicUrl) {
        return result.publicUrl;
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Photo upload error:', error);
      toast.error(error.message || 'Failed to upload photo. Please try again.');
      return null;
    }
  };

  const handleSpecializationToggle = (spec: string) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter(s => s !== spec)
        : [...prev.specializations, spec],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      toast.error('Please enter staff name');
      return;
    }
    if (!formData.phone.trim()) {
      toast.error('Please enter phone number');
      return;
    }
    
    // ✅ FIX: Extract phone digits and validate length
    const phoneDigits = formData.phone.trim().replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Phone number must be at least 10 digits');
      return;
    }
    
    // For new staff, photo is required
    if (!staff && !photoFile && !photoPreview) {
      toast.error('Please upload a photo for the staff member');
      return;
    }

    // Qualifications required
    if (!formData.qualifications.trim()) {
      toast.error('Please enter qualifications');
      return;
    }

    // At least one specialization required
    if (formData.specializations.length === 0) {
      toast.error('Please select at least one specialization');
      return;
    }

    setSaving(true);
    try {
      let photoUrl = staff?.photo_url || staff?.photo || '';
      
      // Upload photo if new one selected
      if (photoFile) {
        setUploading(true);
        const uploadedUrl = await uploadPhotoToS3(photoFile);
        setUploading(false);
        
        if (uploadedUrl) {
          photoUrl = uploadedUrl;
        } else if (!staff) {
          // For new staff, photo upload is mandatory
          toast.error('Failed to upload photo. Please try again.');
          setSaving(false);
          return;
        }
      }

      // ✅ FIX: Trim name and normalize phone (extract digits only) before sending to backend
      const staffData = {
        name: formData.name.trim(),
        phone: phoneDigits, // Send only digits for consistency
        email: formData.email?.trim() || undefined,
        role: formData.role,
        experienceYears: formData.experience_years,
        qualifications: formData.qualifications?.trim() || undefined,
        specializations: formData.specializations,
        photo: photoUrl,
      };

      if (staff) {
        await apiClient.put(`/vendor/${vendorId}/staff/${staff.id}`, staffData);
        toast.success('Staff updated successfully');
      } else {
        await apiClient.post(`/vendor/${vendorId}/staff`, staffData);
        toast.success('Staff added successfully');
      }
      onSave();
    } catch (err: any) {
      console.error('Error saving staff:', err);
      // ✅ FIX: Handle both error.message and error.error formats from backend
      const errorMessage = err.error || err.message || 'Failed to save staff member';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">
            {staff ? 'Edit Staff' : 'Add Staff Member'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Photo Upload */}
          <div className="flex flex-col items-center">
            <div 
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`relative w-28 h-28 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center transition-colors overflow-hidden ${
                uploading ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer hover:border-[#FF8C42]'
              }`}
            >
              {photoPreview ? (
                <>
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin mb-1" />
                      <span className="text-white text-xs">{uploadProgress}%</span>
                    </div>
                  )}
                  {!uploading && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                  )}
                </>
              ) : (
                <>
                  {uploading ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="w-8 h-8 text-[#FF8C42] animate-spin mb-1" />
                      <span className="text-xs text-gray-600">{uploadProgress}%</span>
                    </div>
                  ) : (
                    <Camera className="w-10 h-10 text-gray-400" />
                  )}
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              disabled={uploading}
              className="hidden"
            />
            <div className="mt-2 text-center">
              <p className="text-xs text-gray-500">
                {uploading ? 'Uploading...' : (staff ? 'Click to change photo' : 'Upload staff photo *')}
              </p>
              {uploading && (
                <div className="mt-2 w-48 bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-[#FF8C42] h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] outline-none"
                placeholder="Enter staff name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  // ✅ FIX: Allow any input but store as-is (backend will extract digits)
                  setFormData({ ...formData, phone: e.target.value });
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] outline-none"
                placeholder="Enter 10-digit phone number"
                required
              />
              {formData.phone && formData.phone.replace(/\D/g, '').length < 10 && (
                <p className="text-xs text-red-500 mt-1">Phone number must be at least 10 digits</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] outline-none"
                placeholder="Email (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] outline-none bg-white"
              >
                {STAFF_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Experience (years)</label>
              <input
                type="number"
                value={formData.experience_years}
                onChange={(e) => setFormData({ ...formData, experience_years: Number(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] outline-none"
                min="0"
                max="50"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Award className="w-4 h-4 inline mr-1" />
              Qualifications *
            </label>
            <textarea
              value={formData.qualifications}
              onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] outline-none resize-none"
              placeholder="e.g., BVSc, MVSc, Certified Pet Groomer"
              rows={2}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Briefcase className="w-4 h-4 inline mr-1" />
              Specializations * <span className="text-gray-400 font-normal">(select at least one)</span>
            </label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-xl">
              {COMMON_SPECIALIZATIONS.map(spec => (
                <button
                  key={spec}
                  type="button"
                  onClick={() => handleSpecializationToggle(spec)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    formData.specializations.includes(spec)
                      ? 'bg-[#FF8C42] text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-[#FF8C42]'
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>
            {formData.specializations.length > 0 && (
              <p className="text-xs text-green-600 mt-1">
                ✓ {formData.specializations.length} selected
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-[#FF8C42] text-white rounded-xl font-semibold hover:bg-[#FF7A2E] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {uploading ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                staff ? 'Update Staff' : 'Add Staff'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
