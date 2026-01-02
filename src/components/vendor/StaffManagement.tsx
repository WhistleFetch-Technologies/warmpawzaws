import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Save, X, User, Phone, Mail, MapPin, Calendar, Clock, UserCheck, Upload, CheckCircle, Check, Camera, Award, Star, DollarSign, Settings, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
// ✅ FIX: Removed Supabase imports - using API Gateway now
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { StaffScheduleManagement } from './StaffScheduleManagement'; // ✅ NEW: Staff schedule management

interface StaffManagementProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
  onNavigateToServices?: () => void; // ✅ NEW: Navigate to service management
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
  assignedServices: string[]; // ✅ NEW: Services assigned to this staff member
  specializationDetails?: any[]; // ✅ NEW: Detailed specialization information
}

interface Service {
  serviceId: string;
  name: string;
  category: string;
  price: number;
  duration: number;
  serviceStyle?: string; // ✅ NEW: at_home, at_center, tele
}

export function StaffManagement({ vendorId, vendorData, onBack, onNavigateToServices }: StaffManagementProps) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [selectedStaffForServices, setSelectedStaffForServices] = useState<Staff | null>(null);
  const [showScheduleManagement, setShowScheduleManagement] = useState<Staff | null>(null); // ✅ NEW: Schedule management

  useEffect(() => {
    fetchData();
  }, [vendorId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // ✅ FIX: Use API Gateway URL instead of Supabase
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      
      // Fetch staff
      try {
        const staffData = await apiCallJson<any>(
          `${API_GATEWAY_URL}/make-server-3dd53475/vendor/staff/${vendorId}`
        );
        
        // ✅ FIX: Handle standardized response format
        // Response format: { success: true, staff: [...], total: ... }
        const staffList = staffData.staff || staffData.data?.staff || [];
        // ✅ FIX: Filter out null values AND invalid IDs (staffsvc_ are service records, not staff)
        setStaff(staffList
          .filter((s: any) => s !== null && s !== undefined && s.id && !s.id.startsWith('staffsvc_'))
        );
      } catch (staffError) {
        console.error('Failed to load staff:', staffError);
        setStaff([]);
      }

      // Fetch vendor services - using the vendor-service-management endpoint for consistent structure
      try {
        const servicesData = await apiCallJson<any>(
          `${API_GATEWAY_URL}/make-server-3dd53475/vendor/${vendorId}/services`
        );

        console.log('[STAFF MANAGEMENT] Services API response:', servicesData);
        
        // ✅ FIXED: Extract services from NEW vendor_services system
        const allServices: Service[] = [];
        
        // First, try to get from the new 'services' object (grouped by style)
        if (servicesData.success && servicesData.services) {
          ['at_home', 'at_center', 'tele'].forEach(style => {
            if (servicesData.services[style] && servicesData.services[style].services) {
              const styleServices = servicesData.services[style].services
                .filter((s: any) => s.isEnabled) // Only enabled services
                .map((s: any) => ({
                  serviceId: s.serviceId,
                  name: s.serviceName,
                  category: s.categoryName || 'General',
                  price: s.customPrice || s.price || s.vendorPrice || 0,
                  duration: s.customDuration || s.duration || 30,
                  serviceStyle: style // PRESERVE STYLE!
                }));
              allServices.push(...styleServices);
            }
          });
        }
        
        // Also check allServices flat array (alternative format)
        if (servicesData.allServices && Array.isArray(servicesData.allServices)) {
          const flatServices = servicesData.allServices
            .filter((s: any) => s.isEnabled)
            .map((s: any) => ({
              serviceId: s.serviceId,
              name: s.serviceName,
              category: s.categoryName || 'General',
              price: s.customPrice || s.price || s.vendorPrice || 0,
              duration: s.customDuration || s.duration || 30,
              serviceStyle: s.serviceStyle || 'at_center'
            }));
          
          // Merge and deduplicate
          flatServices.forEach((fs: Service) => {
            if (!allServices.find(s => s.serviceId === fs.serviceId)) {
              allServices.push(fs);
            }
          });
        }
        
        // Fallback to legacy services if available
        if (allServices.length === 0 && servicesData.legacyServices && Array.isArray(servicesData.legacyServices)) {
          const legacyMapped = servicesData.legacyServices.map((s: any) => ({
            serviceId: s.id,
            name: s.serviceName || s.name,
            category: s.category || 'General',
            price: s.price || 0,
            duration: s.duration || 30,
            serviceStyle: s.serviceStyle || s.type || 'at_center'
          }));
          allServices.push(...legacyMapped);
        }
        
        console.log('[STAFF MANAGEMENT] Processed services:', allServices.length, allServices);
        setServices(allServices);
      } catch (serviceError) {
        console.error('Failed to load services:', serviceError);
        setServices([]);
      }
    } catch (error: any) {
      console.error('[STAFF MANAGEMENT] Error fetching data:', error);
      const errorMessage = error?.message || 'Failed to load data. Please try again.';
      toast.error(errorMessage);
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

  const handleManageServices = (staffMember: Staff) => {
    setSelectedStaffForServices(staffMember);
    setShowServiceModal(true);
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to remove this staff member? They will no longer be able to login.')) {
      return;
    }

    try {
      // ✅ FIX: Use API Gateway URL instead of Supabase
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      
      const deleteData = await apiCallJson<any>(
        `${API_GATEWAY_URL}/make-server-3dd53475/staff/${staffId}`,
        {
          method: 'DELETE'
        }
      );

      if (deleteData.success) {
        toast.success('Staff member removed successfully');
        await fetchData(); // ✅ Ensure data reloads
      } else {
        throw new Error(deleteData.error || deleteData.message || 'Failed to remove staff member');
      }
    } catch (error: any) {
      console.error('[REMOVE STAFF] Error:', error);
      const errorMessage = error?.message || 'Failed to remove staff member. Please try again.';
      toast.error(errorMessage);
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

  const staffLabel = vendorData?.roleId === 'pet_clinic' ? 'Doctor' : 
                     vendorData?.roleId === 'pet_grooming' ? 'Groomer' :
                     vendorData?.roleId === 'pet_trainer' ? 'Trainer' : 'Staff Member';
  const staffLabelPlural = vendorData?.roleId === 'pet_clinic' ? 'Doctors' : 
                          vendorData?.roleId === 'pet_grooming' ? 'Groomers' :
                          vendorData?.roleId === 'pet_trainer' ? 'Trainers' : 'Staff';

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-[#FF8C42] text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl text-white">{staffLabel} Management</h1>
            <p className="text-sm text-white/90">{vendorData.businessName}</p>
          </div>
        </div>

        <button
          onClick={handleAddStaff}
          className="w-full bg-white text-[#FF8C42] rounded-xl py-3 font-semibold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add New {staffLabel}
        </button>
      </div>

      {/* Staff List */}
      <div className="p-4 space-y-3">
        {staff.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-gray-900 mb-2">No {staffLabelPlural} Yet</h3>
            <p className="text-gray-500 mb-4">
              Add {staffLabelPlural.toLowerCase()} to start accepting appointments
            </p>
            <button
              onClick={handleAddStaff}
              className="bg-[#FF8C42] text-white px-6 py-2 rounded-lg hover:bg-[#FF7A29] transition-colors"
            >
              Add First {staffLabel}
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
                  <h3 className="text-gray-900 mb-1">
                    {vendorData?.roleId === 'pet_clinic' ? 'Dr. ' : ''}{staffMember.fullName}
                  </h3>
                  {staffMember.specializationDetails && staffMember.specializationDetails.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {staffMember.specializationDetails.map((spec: any, index: number) => (
                        <span key={index} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-[#FF8C42] text-xs rounded-full">
                          <span>{spec.icon}</span>
                          <span>{spec.displayName}</span>
                        </span>
                      ))}
                    </div>
                  ) : staffMember.specializations && staffMember.specializations.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {staffMember.specializations.map((spec, index) => (
                        <span key={index} className="px-2 py-0.5 bg-orange-100 text-[#FF8C42] text-xs rounded-full">
                          {spec}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  
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

              {/* Assigned Services */}
              {staffMember.assignedServices && staffMember.assignedServices.length > 0 && (
                <div className="bg-green-50 rounded-lg p-2 mb-3">
                  <p className="text-xs text-green-600">Assigned Services ({staffMember.assignedServices.length})</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {staffMember.assignedServices.slice(0, 3).map((serviceId, index) => {
                      const service = services.find(s => s.serviceId === serviceId);
                      return service ? (
                        <span key={index} className="text-xs bg-green-200 text-green-900 px-2 py-0.5 rounded-full">
                          {service.name}
                        </span>
                      ) : null;
                    })}
                    {staffMember.assignedServices.length > 3 && (
                      <span className="text-xs text-green-700">+{staffMember.assignedServices.length - 3} more</span>
                    )}
                  </div>
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
                  <Clock className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                  <p className="text-lg text-blue-900">{staffMember.totalAppointments || 0}</p>
                  <p className="text-xs text-blue-700">Total</p>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <Check className="w-4 h-4 mx-auto mb-1 text-green-600" />
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
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  onClick={() => handleManageServices(staffMember)}
                  className="bg-white border border-blue-500 text-blue-500 rounded-lg py-2 flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors text-sm"
                >
                  Services ({staffMember.assignedServices?.length || 0})
                </button>
                <button
                  onClick={() => setShowScheduleManagement(staffMember)}
                  className="bg-white border border-purple-500 text-purple-500 rounded-lg py-2 flex items-center justify-center gap-2 hover:bg-purple-50 transition-colors text-sm"
                >
                  <Calendar className="w-4 h-4" />
                  Schedule
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditStaff(staffMember)}
                  className="flex-1 bg-white border border-[#FF8C42] text-[#FF8C42] rounded-lg py-2 flex items-center justify-center gap-2 hover:bg-orange-50 transition-colors text-sm"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleRemoveStaff(staffMember.id)}
                  className="bg-white border border-red-500 text-red-500 rounded-lg py-2 px-3 flex items-center justify-center hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Staff Modal */}
      {showAddModal && (
        <StaffFormModal
          vendorId={vendorId}
          vendorData={vendorData}
          staff={editingStaff}
          onClose={() => {
            setShowAddModal(false);
            setEditingStaff(null);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            setEditingStaff(null);
            fetchData();
          }}
        />
      )}

      {/* Service Assignment Modal */}
      {showServiceModal && selectedStaffForServices && (
        <ServiceAssignmentModal
          vendorId={vendorId}
          staff={selectedStaffForServices}
          availableServices={services}
          onClose={() => {
            setShowServiceModal(false);
            setSelectedStaffForServices(null);
          }}
          onSuccess={() => {
            setShowServiceModal(false);
            setSelectedStaffForServices(null);
            fetchData();
          }}
          onNavigateToServices={onNavigateToServices} // ✅ NEW: Pass navigation handler
        />
      )}

      {/* Schedule Management Modal */}
      {showScheduleManagement && (
        <StaffScheduleManagement
          staffId={showScheduleManagement.id}
          staffName={showScheduleManagement.fullName}
          vendorId={vendorId}
          onClose={() => {
            setShowScheduleManagement(null);
          }}
        />
      )}
    </div>
  );
}

// Staff Form Modal Component
interface StaffFormModalProps {
  vendorId: string;
  vendorData: any;
  staff: Staff | null;
  onClose: () => void;
  onSuccess: () => void;
}

function StaffFormModal({ vendorId, vendorData, staff, onClose, onSuccess }: StaffFormModalProps) {
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
  
  // ✅ NEW: Load available specializations from backend
  const [availableSpecializations, setAvailableSpecializations] = useState<any[]>([]);
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>(
    staff?.specializations || []
  );
  const [loadingSpecializations, setLoadingSpecializations] = useState(true);
  
  // ✅ NEW: Load specializations when component mounts
  useEffect(() => {
    loadSpecializations();
  }, [vendorData?.roleId]);
  
  const loadSpecializations = async () => {
    try {
      setLoadingSpecializations(true);
      const roleId = vendorData?.roleId?.replace('role_', '') || vendorData?.roleId;
      
      console.log('[STAFF FORM] Loading problem grid specializations for roleId:', roleId);
      console.log('[STAFF FORM] VendorData:', vendorData);
      
      // ✅ NEW: Use problem-grid-specializations endpoint (same labels as customer app)
      // ✅ FIX: Use API Gateway URL instead of Supabase
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      
      const specData = await apiCallJson<any>(
        `${API_GATEWAY_URL}/make-server-3dd53475/vendor/problem-grid-specializations/${roleId}`
      );
      
      console.log('[STAFF FORM] Problem grid specializations data:', specData);
      setAvailableSpecializations(specData.specializations || []);
    } catch (error) {
      console.error('[STAFF FORM] Error loading specializations:', error);
      toast.error('Error loading specializations');
    } finally {
      setLoadingSpecializations(false);
    }
  };
  
  const toggleSpecialization = (specId: string) => {
    setSelectedSpecializations(prev => {
      if (prev.includes(specId)) {
        return prev.filter(id => id !== specId);
      } else {
        return [...prev, specId];
      }
    });
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

  // Helper function to upload staff photo
  const uploadStaffPhoto = async (photoFile: File): Promise<string> => {
    if (!photoFile) {
      throw new Error('No photo file provided');
    }

    const formData = new FormData();
    formData.append('vendorId', vendorId);
    formData.append('staff_photo', photoFile);

    // ✅ FIX: Use API Gateway URL instead of Supabase
    const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
    if (!API_GATEWAY_URL) {
      throw new Error('API Gateway URL not configured');
    }
    
    const { apiCallJson } = await import('@warmpawz/api-client/http');
    
    // Use media upload endpoint for S3
    const uploadResult = await apiCallJson<any>(
      `${API_GATEWAY_URL}/make-server-3dd53475/media/upload-batch`,
      {
        method: 'POST',
        body: formData
        // Note: Don't set Content-Type header - browser handles it for FormData
      }
    );

    console.log('[STAFF FORM] Photo upload result:', uploadResult);
    
    if (uploadResult.success && uploadResult.uploads && uploadResult.uploads[0]?.url) {
      return uploadResult.uploads[0].url;
    } else {
      const errorMsg = uploadResult.error || uploadResult.uploads?.[0]?.error || 'Upload failed without specific error';
      console.error('[STAFF FORM] Photo upload result indicates failure:', uploadResult);
      throw new Error(`Photo upload failed: ${errorMsg}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.fullName || !formData.phone) {
      toast.error('Name and phone are required');
      return;
    }

    // ✅ UPDATED: Validate selectedSpecializations array instead of formData.specializations text
    if (selectedSpecializations.length === 0) {
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
      
      console.log('[STAFF FORM] ===== STARTING STAFF SAVE =====');
      console.log('[STAFF FORM] Form Data:', formData);
      console.log('[STAFF FORM] Selected Specializations:', selectedSpecializations);
      console.log('[STAFF FORM] Vendor ID:', vendorId);
      console.log('[STAFF FORM] Vendor Data:', vendorData);

      // Upload photo
      console.log('[STAFF FORM] Uploading photo...');
      const photoUrl = photoFile ? await uploadStaffPhoto(photoFile) : null;
      console.log('[STAFF FORM] Photo uploaded:', photoUrl);

      // Determine role based on vendor type
      const role = vendorData?.roleId === 'pet_clinic' ? 'doctor' :
                   vendorData?.roleId === 'pet_grooming' ? 'groomer' :
                   vendorData?.roleId === 'pet_trainer' ? 'trainer' : 'staff';

      console.log('[STAFF FORM] Determined role:', role);

      // Prepare staff data
      const staffData = {
        fullName: formData.fullName,
        email: formData.email || `${formData.phone}@warmpawz.com`,
        phone: formData.phone,
        specializations: selectedSpecializations,
        experience: parseInt(formData.experience) || 0,
        degree: formData.degree,
        bio: formData.bio,
        consultationFee: parseFloat(formData.consultationFee) || 0,
        photo: photoUrl,
        vendorId: vendorId,
        role: role, // 'doctor', 'groomer', 'trainer'
        roleType: vendorData?.roleId || 'staff' // 'pet_clinic', 'pet_grooming', 'pet_trainer'
      };

      console.log('[STAFF FORM] Prepared staff data:', JSON.stringify(staffData, null, 2));

      // ✅ FIX: Use API Gateway URL instead of Supabase
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      
      const endpoint = staff 
        ? `${API_GATEWAY_URL}/make-server-3dd53475/staff/${staff.id}`
        : `${API_GATEWAY_URL}/make-server-3dd53475/staff/create`;
      
      const method = staff ? 'PUT' : 'POST';

      console.log(`[STAFF FORM] Making ${method} request to:`, endpoint);

      const result = await apiCallJson<any>(
        endpoint,
        {
          method,
          body: JSON.stringify(staffData)
        }
      );

      console.log('[STAFF FORM] Success response:', result);
      
      if (result.success) {
        toast.success(staff ? 'Staff updated successfully' : 'Staff added successfully');
        onSuccess();
      } else {
        throw new Error(result.error || result.message || 'Failed to save staff');
      }
    } catch (error: any) {
      console.error('[STAFF FORM] ===== ERROR SAVING STAFF =====');
      console.error('[STAFF FORM] Error:', error);
      console.error('[STAFF FORM] Error message:', error.message);
      console.error('[STAFF FORM] Error stack:', error.stack);
      toast.error(error.message || 'Failed to save staff. Please try again.');
    } finally {
      setSubmitting(false);
      console.log('[STAFF FORM] ===== STAFF SAVE COMPLETE =====');
    }
  };

  const staffLabel = vendorData?.roleId === 'pet_clinic' ? 'Doctor' : 
                     vendorData?.roleId === 'pet_grooming' ? 'Groomer' :
                     vendorData?.roleId === 'pet_trainer' ? 'Trainer' : 'Staff Member';

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{staff ? 'Edit' : 'Add New'} {staffLabel}</DialogTitle>
          <DialogDescription>
            Fill in the details below. All fields with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photo *
            </label>
            <div className="flex items-center gap-4">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-[#FF8C42]" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <label className="flex-1 cursor-pointer">
                <div className="px-4 py-2 bg-[#FF8C42] text-white rounded-lg text-center hover:bg-[#FF7A29] transition-colors">
                  <Upload className="w-4 h-4 inline-block mr-2" />
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
            <p className="text-xs text-gray-500 mt-1">Max size: 5MB. Required for new staff.</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              placeholder="Enter full name"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number * (Login Credential)
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              placeholder="10-digit mobile number"
              required
              disabled={!!staff}
            />
            {!staff && <p className="text-xs text-gray-500 mt-1">This will be their login number</p>}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              placeholder="email@example.com"
            />
          </div>

          {/* ✅ UPDATED: Specializations - Multi-Select from Backend */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Specializations *
            </label>
            <p className="text-xs text-gray-600 mb-2">
              Select areas of expertise. Staff will appear in customer searches for these problems.
            </p>
            
            {loadingSpecializations ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Loading specializations...</p>
              </div>
            ) : availableSpecializations.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  No specializations available for this vendor type.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg p-2">
                {availableSpecializations.map((spec) => {
                  const isSelected = selectedSpecializations.includes(spec.id);
                  return (
                    <div
                      key={spec.id}
                      onClick={() => toggleSpecialization(spec.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#FF8C42] bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'border-[#FF8C42] bg-[#FF8C42]'
                            : 'border-gray-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{spec.name}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{spec.description}</p>
                          
                          {/* Show which customer problems this helps with */}
                          {spec.helpsWithProblems && spec.helpsWithProblems.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {spec.helpsWithProblems.map((problem: any) => (
                                <span
                                  key={problem.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                                >
                                  <span>{problem.icon}</span>
                                  <span>{problem.name}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {selectedSpecializations.length === 0 && !loadingSpecializations && (
              <p className="text-xs text-red-600 mt-1">
                Please select at least one specialization
              </p>
            )}
            
            {selectedSpecializations.length > 0 && (
              <p className="text-xs text-green-600 mt-1">
                ✓ {selectedSpecializations.length} specialization{selectedSpecializations.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Degree */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Degree/Qualifications *
            </label>
            <input
              type="text"
              value={formData.degree}
              onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              placeholder="Years of experience"
              min="0"
            />
          </div>

          {/* Consultation Fee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Consultation/Service Fee (₹)
            </label>
            <input
              type="number"
              value={formData.consultationFee}
              onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              placeholder="Fee amount"
              min="0"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              About/Bio (Optional)
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              placeholder="Brief description..."
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-[#FF8C42] text-white rounded-lg hover:bg-[#FF7A29] transition-colors disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : staff ? 'Update' : 'Add'} {staffLabel}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Service Assignment Modal Component
interface ServiceAssignmentModalProps {
  vendorId: string;
  staff: Staff;
  availableServices: Service[];
  onClose: () => void;
  onSuccess: () => void;
  onNavigateToServices?: () => void; // ✅ NEW: Navigate to service management
}

function ServiceAssignmentModal({ vendorId, staff, availableServices, onClose, onSuccess, onNavigateToServices }: ServiceAssignmentModalProps) {
  const [selectedServices, setSelectedServices] = useState<string[]>(staff.assignedServices || []);
  const [submitting, setSubmitting] = useState(false);

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      // ✅ FIX: Use API Gateway URL instead of Supabase
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      
      const serviceData = await apiCallJson<any>(
        `${API_GATEWAY_URL}/make-server-3dd53475/staff/${staff.id}/services`,
        {
          method: 'PUT',
          body: JSON.stringify({ serviceIds: selectedServices })
        }
      );

      if (serviceData.success) {
        toast.success('Services updated successfully');
        onSuccess();
      } else {
        throw new Error(serviceData.error || serviceData.message || 'Failed to update services');
      }
    } catch (error) {
      console.error('[SERVICE ASSIGNMENT] Error:', error);
      toast.error('Failed to update services. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ NEW: Group services by style
  const servicesByStyle = {
    at_center: availableServices.filter(s => s.serviceStyle === 'at_center'),
    at_home: availableServices.filter(s => s.serviceStyle === 'at_home'),
    tele: availableServices.filter(s => s.serviceStyle === 'tele')
  };

  // ✅ NEW: Style labels and descriptions
  const styleConfig = {
    at_center: {
      label: 'At Center',
      icon: '🏥',
      description: 'Services provided at your facility',
      badgeColor: 'bg-blue-100 text-blue-700'
    },
    at_home: {
      label: 'At Home',
      icon: '🏠',
      description: 'Services provided at customer\'s location',
      badgeColor: 'bg-green-100 text-green-700'
    },
    tele: {
      label: 'Teleconsultation',
      icon: '📞',
      description: 'Online/phone consultations',
      badgeColor: 'bg-purple-100 text-purple-700'
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[450px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Services to {staff.fullName}</DialogTitle>
          <DialogDescription>
            Select which services this staff member can provide. Services are grouped by service style.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {availableServices.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <Settings className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-700 mb-1">No services available</p>
              <p className="text-sm text-gray-500 mb-4">
                Add services to your clinic/centre first, then assign them to staff.
              </p>
              {onNavigateToServices && (
                <button
                  onClick={onNavigateToServices}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF8C42] text-white rounded-lg hover:bg-[#FF7A29] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Services
                </button>
              )}
            </div>
          ) : (
            <>
              {/* ✅ NEW: Services grouped by style */}
              {(Object.entries(servicesByStyle) as [keyof typeof servicesByStyle, Service[]][]).map(([style, services]) => {
                if (services.length === 0) return null;
                
                const config = styleConfig[style];
                
                return (
                  <div key={style} className="space-y-2">
                    {/* Style Header */}
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-gray-200">
                      <span className="text-2xl">{config.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{config.label}</h3>
                        <p className="text-xs text-gray-500">{config.description}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${config.badgeColor}`}>
                        {services.length} {services.length === 1 ? 'service' : 'services'}
                      </span>
                    </div>

                    {/* Services List */}
                    <div className="space-y-2">
                      {services.map((service) => {
                        const isSelected = selectedServices.includes(service.serviceId);
                        return (
                          <div
                            key={service.serviceId}
                            onClick={() => toggleService(service.serviceId)}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-[#FF8C42] bg-orange-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900 text-sm">{service.name}</h4>
                                <p className="text-xs text-gray-600">{service.category}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs text-gray-500">₹{service.price}</span>
                                  <span className="text-xs text-gray-500">{service.duration} min</span>
                                </div>
                              </div>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected
                                  ? 'border-[#FF8C42] bg-[#FF8C42]'
                                  : 'border-gray-300'
                              }`}>
                                {isSelected && <Check className="w-4 h-4 text-white" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-[#FF8C42] text-white rounded-lg hover:bg-[#FF7A29] transition-colors disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : `Save (${selectedServices.length} selected)`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}