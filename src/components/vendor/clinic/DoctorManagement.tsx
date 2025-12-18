import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
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
  Camera
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
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

export function DoctorManagement({ clinicId, clinicData, onBack }: DoctorManagementProps) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<any>(null);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    checkMigrationAndFetchStaff();
  }, [clinicId]);

  const checkMigrationAndFetchStaff = async () => {
    try {
      setLoading(true);
      
      // First, check if migration is needed
      const migrationCheck = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${clinicId}/check-migration-status`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (migrationCheck.ok) {
        const migrationData = await migrationCheck.json();
        setMigrationStatus(migrationData);
        
        // Auto-migrate if needed
        if (migrationData.needsMigration && migrationData.oldDoctorCount > 0) {
          console.log('🔄 Auto-migrating old doctors...');
          await migrateOldDoctors();
        }
      }
      
      // Then fetch staff
      await fetchStaff();
      
    } catch (error) {
      console.error('[MIGRATION CHECK] Error:', error);
      // Continue with normal fetch even if migration check fails
      await fetchStaff();
    } finally {
      setLoading(false);
    }
  };

  const migrateOldDoctors = async () => {
    try {
      setMigrating(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${clinicId}/migrate-doctors`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Migration successful:', result);
        toast.success(`Migrated ${result.results.migrated} doctors to new system`);
        return true;
      } else {
        console.error('❌ Migration failed');
        return false;
      }
    } catch (error) {
      console.error('[MIGRATION] Error:', error);
      return false;
    } finally {
      setMigrating(false);
    }
  };

  const fetchStaff = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/vendor/${clinicId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStaff(data.staff || []);
      }
    } catch (error) {
      console.error('[STAFF MANAGEMENT] Error fetching staff:', error);
      toast.error('Failed to load staff members');
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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staffId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        toast.success('Staff member removed successfully');
        fetchStaff();
      } else {
        throw new Error('Failed to remove staff member');
      }
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

  const roleLabel = clinicData?.roleId === 'pet_clinic' ? 'Doctor' : 'Staff Member';
  const roleLabelPlural = clinicData?.roleId === 'pet_clinic' ? 'Doctors' : 'Staff';

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-[#FF8C42] text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <Button onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-xl text-white">{roleLabel} Management</h1>
            <p className="text-sm text-white/90">{clinicData.businessName}</p>
          </div>
        </div>

        <Button onClick={handleAddStaff}
          className="w-full bg-white text-[#FF8C42] rounded-xl py-3 font-semibold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add New {roleLabel}
        </Button>
      </div>

      {/* Staff List */}
      <div className="p-4 space-y-3">
        {staff.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <Stethoscope className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-gray-900 mb-2">No {roleLabelPlural} Yet</h3>
            <p className="text-gray-500 mb-4">
              Add {roleLabelPlural.toLowerCase()} to start accepting appointments
            </p>
            <Button onClick={handleAddStaff}
              className="bg-[#FF8C42] text-white px-6 py-2 rounded-lg hover:bg-[#FF7A29] transition-colors"
            >
              Add First {roleLabel}
            </Button>
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
                  <h3 className="text-gray-900 mb-1">
                    {clinicData?.roleId === 'pet_clinic' ? 'Dr. ' : ''}{staffMember.fullName}
                  </h3>
                  {staffMember.specializations && staffMember.specializations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {staffMember.specializations.map((spec, index) => (
                        <span key={index} className="px-2 py-0.5 bg-orange-100 text-[#FF8C42] text-xs rounded-full">
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      <span>{staffMember.experience} yrs</span>
                    </div>
                    {staffMember.rating > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        <span>{staffMember.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`px-2 py-1 rounded-full text-xs ${
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
                  <p className="text-xs text-blue-600">Qualifications</p>
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
                  <p className="text-lg text-blue-900">{staffMember.totalAppointments || 0}</p>
                  <p className="text-xs text-blue-700">Total</p>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <Clock className="w-4 h-4 mx-auto mb-1 text-green-600" />
                  <p className="text-lg text-green-900">{staffMember.completedAppointments || 0}</p>
                  <p className="text-xs text-green-700">Completed</p>
                </div>
                <div className="text-center p-2 bg-orange-50 rounded-lg">
                  <DollarSign className="w-4 h-4 mx-auto mb-1 text-[#FF8C42]" />
                  <p className="text-lg text-gray-900">₹{staffMember.consultationFee || 0}</p>
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
                <Button onClick={() => handleEditStaff(staffMember)}
                  className="flex-1 bg-white border border-[#FF8C42] text-[#FF8C42] rounded-lg py-2 flex items-center justify-center gap-2 hover:bg-orange-50 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </Button>
                <Button onClick={() => handleRemoveStaff(staffMember.id)}
                  className="flex-1 bg-white border border-red-500 text-red-500 rounded-lg py-2 flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </Button>
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
    specializations: staff?.specializations?.join(', ') || '',
    experience: staff?.experience?.toString() || '',
    degree: staff?.degree || '',
    bio: staff?.bio || '',
    consultationFee: staff?.consultationFee?.toString() || ''
  });
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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services/${clinicId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // ✅ FIXED: Parse new response format from updated endpoint
        let servicesList: any[] = [];
        
        // New format: data.allServices (flat array of all enabled services)
        if (data.allServices && Array.isArray(data.allServices)) {
          servicesList = data.allServices;
        }
        // Alternative: data.services (grouped by style)
        else if (data.services && typeof data.services === 'object') {
          ['at_home', 'at_center', 'tele'].forEach(style => {
            if (data.services[style] && data.services[style].services) {
              servicesList.push(...data.services[style].services);
            }
          });
        }
        // Legacy fallback
        else if (data.legacyServices && Array.isArray(data.legacyServices)) {
          servicesList = data.legacyServices;
        }
        else if (Array.isArray(data.services)) {
          servicesList = data.services;
        }
        
        console.log('✅ [DOCTOR-MGMT] Parsed vendor services:', servicesList.length, servicesList);
        setVendorServices(servicesList);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoadingServices(false);
    }
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
      if (staff?.photo) return staff.photo; // Keep existing photo
      throw new Error('Photo is required');
    }

    const formData = new FormData();
    formData.append('vendorId', clinicId);
    formData.append('staff_photo', photoFile);

    const uploadResponse = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/storage/upload-multiple`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: formData
      }
    );

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload photo');
    }

    const uploadResult = await uploadResponse.json();
    if (uploadResult.uploads && uploadResult.uploads[0]?.success) {
      return uploadResult.uploads[0].url;
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

    if (!formData.specializations) {
      toast.error('At least one specialization is required');
      return;
    }

    if (!formData.degree) {
      toast.error('Degree/qualifications are required');
      return;
    }

    if (!staff && !photoFile) {
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

      // Upload photo first
      const photoUrl = await uploadPhoto();

      const endpoint = staff
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staff.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/create`;

      const method = staff ? 'PUT' : 'POST';

      const payload: any = {
        fullName: formData.fullName,
        email: formData.email || `${formData.phone}@warmpawz.com`,
        phone: formData.phone,
        specializations: formData.specializations.split(',').map(s => s.trim()).filter(s => s),
        experience: parseInt(formData.experience) || 0,
        degree: formData.degree,
        bio: formData.bio,
        consultationFee: parseInt(formData.consultationFee) || 0,
        photo: photoUrl,
        role: 'doctor',
        roleType: clinicData?.roleId === 'pet_clinic' ? 'clinic_doctor' : 'vet',
        vendorId: clinicId,
        services: selectedServices
      };

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        const staffId = staff?.id || result.staffId;
        
        // ✅ CRITICAL FIX: Now expand service IDs into full service objects with isActive flags
        if (selectedServices.length > 0 && staffId) {
          console.log(`🔧 [FIX] Expanding ${selectedServices.length} service IDs into full objects for staff ${staffId}`);
          
          const servicesResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staffId}/services`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ serviceIds: selectedServices })
            }
          );
          
          if (!servicesResponse.ok) {
            console.error('❌ Failed to expand services, but staff was created');
          } else {
            console.log('✅ Services expanded successfully with isActive=true flags');
          }
        }
        
        toast.success(staff ? 'Staff updated successfully' : 'Staff added successfully. They can now login with their phone number.');
        onSuccess();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save staff');
      }
    } catch (error: any) {
      console.error('[SAVE STAFF] Error:', error);
      toast.error(error.message || `Failed to ${staff ? 'update' : 'add'} staff member`);
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabel = clinicData?.roleId === 'pet_clinic' ? 'Doctor' : 'Staff Member';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white rounded-t-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl text-gray-900">
              {staff ? `Edit ${roleLabel}` : `Add New ${roleLabel}`}
            </h2>
            <Button onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              ✕
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Photo Upload - MANDATORY */}
          <div>
            <label className="block text-sm text-gray-700 mb-2">
              Photo <span className="text-red-500">*</span>
            </label>
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
                    {photoPreview ? 'Change Photo' : 'Upload Photo'}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Max 5MB. JPG, PNG or WEBP
                </p>
              </div>
            </div>
          </div>

          {/* Full Name - MANDATORY */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
              placeholder="Dr. John Smith"
              required
            />
          </div>

          {/* Phone - MANDATORY */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <span className="px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
                +91
              </span>
              <input
                type="tel"
                maxLength={10}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                placeholder="9876543210"
                required
                disabled={!!staff} // Can't change phone after creation
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This will be used for login. {staff && 'Cannot be changed after creation.'}
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
              placeholder="doctor@example.com"
            />
          </div>

          {/* Specializations - MANDATORY */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Specializations <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.specializations}
              onChange={(e) => setFormData({ ...formData, specializations: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
              placeholder="Surgery, Cardiology, Dermatology"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Separate multiple specializations with commas
            </p>
          </div>

          {/* Degree - MANDATORY */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Degree / Qualifications <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.degree}
              onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
              placeholder="BVSc, MVSc"
              required
            />
          </div>

          {/* Experience */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Experience (years)
            </label>
            <input
              type="number"
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
              placeholder="5"
              min="0"
            />
          </div>

          {/* Consultation Fee */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
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
            <label className="block text-sm text-gray-700 mb-1">
              About
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
              placeholder="Brief introduction..."
              rows={4}
            />
          </div>

          {/* Service Assignment */}
          <div>
            <label className="block text-sm text-gray-700 mb-2">
              Assign Services
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Select which services this {roleLabel.toLowerCase()} can perform
            </p>
            {loadingServices ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FF8C42]"></div>
              </div>
            ) : vendorServices.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600">No services available yet</p>
                <p className="text-xs text-gray-500 mt-1">Add services from Service Management first</p>
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
                      <p className="text-sm text-gray-900">{service.name}</p>
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

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 py-3 bg-[#FF8C42] text-white rounded-lg hover:bg-[#FF7A29] transition-colors disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : staff ? 'Update' : 'Add Staff'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}