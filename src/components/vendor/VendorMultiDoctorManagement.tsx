/**
 * VENDOR MULTI-DOCTOR MANAGEMENT
 * 
 * Manages multiple doctors in a clinic with:
 * - Doctor profiles and specializations
 * - Assignment to bookings
 * - Schedule management
 * - Performance tracking
 * - Specialization-based routing
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Clock, 
  Award, 
  Star,
  Stethoscope,
  Users,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Upload,
  Camera
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';
import { authenticatedFetch } from '../../utils/session-manager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';

interface VendorMultiDoctorManagementProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
}

interface Doctor {
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
  assignedServices: string[];
  specializationDetails?: {
    name: string;
    yearsOfExperience: number;
    certifications: string[];
  }[];
}

interface Booking {
  id: string;
  bookingId: string;
  customerName: string;
  petName: string;
  serviceName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  problemCategory?: string;
  symptoms?: string[];
}

const SPECIALIZATIONS = [
  'General Practice',
  'Surgery',
  'Dermatology',
  'Cardiology',
  'Orthopedics',
  'Neurology',
  'Oncology',
  'Emergency Care',
  'Behavioral Medicine',
  'Exotic Animals',
  'Avian Medicine',
  'Reptile Medicine'
];

export function VendorMultiDoctorManagement({ 
  vendorId, 
  vendorData, 
  onBack 
}: VendorMultiDoctorManagementProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [activeTab, setActiveTab] = useState<'doctors' | 'assignments' | 'performance'>('doctors');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    specializations: [] as string[],
    experience: '',
    degree: '',
    bio: '',
    consultationFee: '',
    photo: '',
    isActive: true
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [vendorId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch doctors (staff with role 'doctor')
      const doctorsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/vendor/${vendorId}?role=doctor`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (doctorsResponse.ok) {
        const data = await doctorsResponse.json();
        const doctorsList = data.staff || data.data?.staff || [];
        setDoctors(doctorsList.filter((d: any) => d.role === 'doctor' || d.roleType === 'doctor'));
      }

      // Fetch pending bookings for assignment
      if (activeTab === 'assignments') {
        await fetchPendingBookings();
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingBookings = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/bookings?status=confirmed&needsAssignment=true`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings || data.data?.bookings || []);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
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
      if (editingDoctor?.photo) return editingDoctor.photo;
      throw new Error('Photo is required');
    }

    const formData = new FormData();
    formData.append('vendorId', vendorId);
    formData.append('staff_photo', photoFile);

    const uploadResponse = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/media/upload-vendor-photo`,
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
    return uploadResult.url || uploadResult.data?.url || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.phone) {
      toast.error('Name and phone are required');
      return;
    }

    if (formData.specializations.length === 0) {
      toast.error('At least one specialization is required');
      return;
    }

    try {
      let photoUrl = editingDoctor?.photo || '';
      
      if (photoFile) {
        photoUrl = await uploadPhoto();
      }

      const doctorData = {
        vendorId,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        specializations: formData.specializations,
        experience: parseInt(formData.experience) || 0,
        degree: formData.degree,
        bio: formData.bio,
        consultationFee: parseFloat(formData.consultationFee) || 0,
        photo: photoUrl,
        isActive: formData.isActive,
        role: 'doctor',
        roleType: 'doctor'
      };

      const url = editingDoctor
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${editingDoctor.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/vendor/${vendorId}`;

      const response = await authenticatedFetch(url, {
        method: editingDoctor ? 'PUT' : 'POST',
        body: JSON.stringify(doctorData)
      });

      if (response.ok) {
        toast.success(editingDoctor ? 'Doctor updated successfully' : 'Doctor added successfully');
        setShowAddModal(false);
        setEditingDoctor(null);
        resetForm();
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save doctor');
      }
    } catch (error: any) {
      console.error('Error saving doctor:', error);
      toast.error(error.message || 'Failed to save doctor');
    }
  };

  const handleDelete = async (doctorId: string) => {
    if (!confirm('Are you sure you want to delete this doctor?')) return;

    try {
      const response = await authenticatedFetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${doctorId}`,
        {
          method: 'DELETE'
        }
      );

      if (response.ok) {
        toast.success('Doctor deleted successfully');
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete doctor');
      }
    } catch (error: any) {
      console.error('Error deleting doctor:', error);
      toast.error('Failed to delete doctor');
    }
  };

  const handleAssignDoctor = async (bookingId: string, doctorId: string) => {
    try {
      const response = await authenticatedFetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/bookings/${bookingId}/assign-doctor`,
        {
          method: 'POST',
          body: JSON.stringify({ doctorId, vendorId })
        }
      );

      if (response.ok) {
        toast.success('Doctor assigned successfully');
        setShowAssignmentModal(false);
        fetchPendingBookings();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to assign doctor');
      }
    } catch (error: any) {
      console.error('Error assigning doctor:', error);
      toast.error('Failed to assign doctor');
    }
  };

  const getRecommendedDoctor = (booking: Booking): Doctor | null => {
    if (!booking.problemCategory && !booking.symptoms) return null;

    // Find doctor with matching specialization
    const matchingDoctors = doctors.filter(doctor => {
      if (!doctor.isActive) return false;
      
      // Check if doctor's specialization matches problem category
      const problemLower = booking.problemCategory?.toLowerCase() || '';
      return doctor.specializations.some(spec => 
        spec.toLowerCase().includes(problemLower) ||
        problemLower.includes(spec.toLowerCase())
      );
    });

    // Return doctor with best rating and availability
    return matchingDoctors.sort((a, b) => {
      if (a.rating !== b.rating) return b.rating - a.rating;
      return b.completedAppointments - a.completedAppointments;
    })[0] || null;
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      specializations: [],
      experience: '',
      degree: '',
      bio: '',
      consultationFee: '',
      photo: '',
      isActive: true
    });
    setPhotoFile(null);
    setPhotoPreview('');
  };

  const handleEdit = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setFormData({
      fullName: doctor.fullName,
      email: doctor.email,
      phone: doctor.phone,
      specializations: doctor.specializations,
      experience: doctor.experience.toString(),
      degree: doctor.degree,
      bio: doctor.bio,
      consultationFee: doctor.consultationFee.toString(),
      photo: doctor.photo,
      isActive: doctor.isActive
    });
    setPhotoPreview(doctor.photo);
    setShowAddModal(true);
  };

  useEffect(() => {
    if (activeTab === 'assignments') {
      fetchPendingBookings();
    }
  }, [activeTab]);

  if (loading && doctors.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading doctors...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Multi-Doctor Management</h1>
            <p className="text-xs text-gray-500">{doctors.length} doctor(s)</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {['doctors', 'assignments', 'performance'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'doctors' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Doctors</h2>
              <Button
                onClick={() => {
                  resetForm();
                  setEditingDoctor(null);
                  setShowAddModal(true);
                }}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Doctor
              </Button>
            </div>

            {doctors.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No doctors added yet</p>
                <Button
                  onClick={() => {
                    resetForm();
                    setShowAddModal(true);
                  }}
                  variant="outline"
                >
                  Add First Doctor
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {doctors.map(doctor => (
                  <div key={doctor.id} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                        {doctor.photo ? (
                          <img src={doctor.photo} alt={doctor.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">{doctor.fullName}</h3>
                            <p className="text-sm text-gray-500">{doctor.degree}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                              <span className="text-sm font-medium">{doctor.rating.toFixed(1)}</span>
                              <span className="text-xs text-gray-500">({doctor.reviewCount} reviews)</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(doctor)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(doctor.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="flex flex-wrap gap-1 mb-2">
                            {doctor.specializations.map(spec => (
                              <Badge key={spec} variant="outline" className="text-xs">
                                {spec}
                              </Badge>
                            ))}
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                            <div>
                              <p className="text-gray-500">Experience</p>
                              <p className="font-medium">{doctor.experience} years</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Appointments</p>
                              <p className="font-medium">{doctor.completedAppointments}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Fee</p>
                              <p className="font-medium">₹{doctor.consultationFee}</p>
                            </div>
                          </div>

                          {doctor.bio && (
                            <p className="text-sm text-gray-600 mt-2">{doctor.bio}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Pending Assignments</h2>
            
            {bookings.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
                <p className="text-gray-500">No pending assignments</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map(booking => {
                  const recommended = getRecommendedDoctor(booking);
                  
                  return (
                    <div key={booking.id} className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{booking.customerName}</h3>
                            {recommended && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                Recommended: {recommended.fullName}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{booking.petName} - {booking.serviceName}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(booking.scheduledDate).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {booking.scheduledTime}
                            </span>
                          </div>
                          {booking.problemCategory && (
                            <Badge variant="outline" className="mt-2 text-xs">
                              {booking.problemCategory}
                            </Badge>
                          )}
                        </div>
                        
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setShowAssignmentModal(true);
                          }}
                          className="bg-orange-500 hover:bg-orange-600"
                        >
                          Assign Doctor
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Doctor Performance</h2>
            
            <div className="grid gap-4">
              {doctors.map(doctor => (
                <div key={doctor.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                        {doctor.photo ? (
                          <img src={doctor.photo} alt={doctor.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold">{doctor.fullName}</h3>
                        <p className="text-sm text-gray-500">{doctor.degree}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="font-semibold">{doctor.rating.toFixed(1)}</span>
                      </div>
                      <p className="text-xs text-gray-500">{doctor.reviewCount} reviews</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{doctor.totalAppointments}</p>
                      <p className="text-xs text-gray-600">Total</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{doctor.completedAppointments}</p>
                      <p className="text-xs text-gray-600">Completed</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">₹{doctor.totalEarnings.toLocaleString()}</p>
                      <p className="text-xs text-gray-600">Earnings</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Doctor Modal */}
      {showAddModal && (
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingDoctor ? 'Edit Doctor' : 'Add Doctor'}</DialogTitle>
              <DialogDescription>
                Add a new doctor to your clinic. Doctors can be assigned to bookings based on their specializations.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Photo Upload */}
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Full Name *</label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Phone *</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Specializations *</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {SPECIALIZATIONS.map(spec => (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => {
                        const updated = formData.specializations.includes(spec)
                          ? formData.specializations.filter(s => s !== spec)
                          : [...formData.specializations, spec];
                        setFormData({ ...formData, specializations: updated });
                      }}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        formData.specializations.includes(spec)
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-orange-300'
                      }`}
                    >
                      {spec}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Experience (years)</label>
                  <Input
                    type="number"
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Consultation Fee (₹)</label>
                  <Input
                    type="number"
                    value={formData.consultationFee}
                    onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Degree/Qualifications</label>
                <Input
                  value={formData.degree}
                  onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                  placeholder="e.g., BVSc, MVSc, PhD"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Bio</label>
                <Textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  placeholder="Brief bio about the doctor..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="isActive" className="text-sm">Active (available for assignments)</label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingDoctor(null);
                    resetForm();
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600">
                  <Save className="w-4 h-4 mr-2" />
                  {editingDoctor ? 'Update' : 'Add'} Doctor
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Assignment Modal */}
      {showAssignmentModal && selectedBooking && (
        <Dialog open={showAssignmentModal} onOpenChange={setShowAssignmentModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Doctor</DialogTitle>
              <DialogDescription>
                Assign a doctor to {selectedBooking.customerName}'s booking for {selectedBooking.petName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {doctors.filter(d => d.isActive).map(doctor => {
                const isRecommended = getRecommendedDoctor(selectedBooking)?.id === doctor.id;
                
                return (
                  <button
                    key={doctor.id}
                    onClick={() => handleAssignDoctor(selectedBooking.id, doctor.id)}
                    className={`w-full p-4 rounded-lg border text-left transition-colors ${
                      isRecommended
                        ? 'border-green-300 bg-green-50 hover:bg-green-100'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                          {doctor.photo ? (
                            <img src={doctor.photo} alt={doctor.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{doctor.fullName}</h3>
                            {isRecommended && (
                              <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                                Recommended
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{doctor.degree}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            <span className="text-xs">{doctor.rating.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">₹{doctor.consultationFee}</p>
                        <p className="text-xs text-gray-500">{doctor.specializations[0]}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

