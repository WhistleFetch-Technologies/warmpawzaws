'use client';

/**
 * Staff Profile Page
 * 
 * Allows staff members to manage their professional profile
 * Similar to solo provider profile but for staff members
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Save, User, Mail, Phone, MapPin, FileText, Clock, Award, Briefcase, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PhotoUpload } from '@/components/shared/PhotoUpload';

// Specializations by role type (same as solo provider)
const SPECIALIZATIONS_BY_ROLE: Record<string, string[]> = {
  'veterinarian': ['General Practice', 'Surgery', 'Dentistry', 'Dermatology', 'Orthopedics', 'Cardiology', 'Oncology', 'Emergency Care', 'Exotic Animals', 'Internal Medicine', 'Neurology'],
  'veterinary_clinic': ['General Practice', 'Surgery', 'Dentistry', 'Dermatology', 'Orthopedics', 'Cardiology', 'Oncology', 'Emergency Care', 'Exotic Animals', 'Internal Medicine', 'Neurology'],
  'pet_clinic': ['General Practice', 'Surgery', 'Dentistry', 'Dermatology', 'Orthopedics', 'Cardiology', 'Oncology', 'Emergency Care', 'Exotic Animals'],
  'groomer': ['Bath & Brush', 'Full Grooming', 'Hand Stripping', 'Creative Grooming', 'Cat Grooming', 'Puppy Grooming', 'De-matting', 'Show Grooming', 'Breed-Specific Cuts', 'Spa Treatments'],
  'pet_groomer': ['Bath & Brush', 'Full Grooming', 'Hand Stripping', 'Creative Grooming', 'Cat Grooming', 'Puppy Grooming', 'De-matting', 'Show Grooming', 'Breed-Specific Cuts', 'Spa Treatments'],
  'trainer': ['Obedience Training', 'Puppy Training', 'Behavior Modification', 'Agility Training', 'Protection Training', 'Therapy Dog Training', 'Trick Training', 'Leash Training', 'Socialization'],
  'pet_trainer': ['Obedience Training', 'Puppy Training', 'Behavior Modification', 'Agility Training', 'Protection Training', 'Therapy Dog Training', 'Trick Training', 'Leash Training', 'Socialization'],
  'dog_trainer': ['Obedience Training', 'Puppy Training', 'Behavior Modification', 'Agility Training', 'Protection Training', 'Therapy Dog Training', 'Trick Training', 'Leash Training', 'Socialization'],
  'walker': ['Dog Walking', 'Group Walks', 'Puppy Walks', 'Senior Dog Care', 'Reactive Dog Handling', 'Adventure Walks', 'Fitness Walks'],
  'pet_walker': ['Dog Walking', 'Group Walks', 'Puppy Walks', 'Senior Dog Care', 'Reactive Dog Handling', 'Adventure Walks', 'Fitness Walks'],
  'dog_walker': ['Dog Walking', 'Group Walks', 'Puppy Walks', 'Senior Dog Care', 'Reactive Dog Handling', 'Adventure Walks', 'Fitness Walks'],
  'sitter': ['Day Care', 'Overnight Sitting', 'In-Home Sitting', 'Pet Boarding', 'Multiple Pet Care', 'Senior Pet Care', 'Puppy Care', 'Medical Care Support'],
  'pet_sitter': ['Day Care', 'Overnight Sitting', 'In-Home Sitting', 'Pet Boarding', 'Multiple Pet Care', 'Senior Pet Care', 'Puppy Care', 'Medical Care Support'],
  'behaviorist': ['Anxiety Treatment', 'Aggression Management', 'Fear Rehabilitation', 'Separation Anxiety', 'Compulsive Behaviors', 'Multi-Pet Households', 'Rescue Rehabilitation'],
  'pet_behaviorist': ['Anxiety Treatment', 'Aggression Management', 'Fear Rehabilitation', 'Separation Anxiety', 'Compulsive Behaviors', 'Multi-Pet Households', 'Rescue Rehabilitation'],
  'nutritionist': ['Weight Management', 'Dietary Planning', 'Allergy Management', 'Senior Nutrition', 'Puppy Nutrition', 'Raw Diet', 'Prescription Diets'],
  'pet_nutritionist': ['Weight Management', 'Dietary Planning', 'Allergy Management', 'Senior Nutrition', 'Puppy Nutrition', 'Raw Diet', 'Prescription Diets'],
  'photographer': ['Pet Portraits', 'Action Shots', 'Studio Photography', 'Outdoor Photography', 'Event Coverage', 'Breed Shows', 'Memorial Photos'],
  'pet_photographer': ['Pet Portraits', 'Action Shots', 'Studio Photography', 'Outdoor Photography', 'Event Coverage', 'Breed Shows', 'Memorial Photos'],
  'default': ['General Pet Care', 'Customer Service', 'Pet Handling', 'First Aid', 'Safety Protocols', 'Communication'],
};

interface StaffProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  description?: string;
  photo_url?: string;
  qualifications?: string;
  specializations: string[];
  experience_years?: number;
  service_area?: string;
  operating_hours?: string;
  role_name?: string;
}

export default function StaffProfilePage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const [profile, setProfile] = useState<StaffProfile>({
    id: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    description: '',
    photo_url: '',
    qualifications: '',
    specializations: [],
    experience_years: 0,
    service_area: '',
    operating_hours: '',
    role_name: '',
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Check if logged in
    if (typeof window !== 'undefined') {
      const staffSession = localStorage.getItem('staff_session');
      if (!staffSession) {
        router.push('/staff/login');
        return;
      }

      try {
        const staffData = JSON.parse(staffSession);
        setStaff(staffData);
        loadProfile(staffData.id);
      } catch (error) {
        console.error('Error parsing staff session:', error);
        router.push('/staff/login');
      }
    }
  }, [router]);

  // Parse specializations from string or array
  function parseSpecializations(specs: any): string[] {
    if (!specs) return [];
    if (Array.isArray(specs)) return specs;
    if (typeof specs === 'string') {
      try {
        const parsed = JSON.parse(specs);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return specs.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }
    return [];
  }

  // Get available specializations based on staff role
  const getAvailableSpecializations = () => {
    if (!staff) return SPECIALIZATIONS_BY_ROLE['default'];
    const roleKey = (staff.role || staff.role_name || 'default').toLowerCase().replace(/\s+/g, '_');
    return SPECIALIZATIONS_BY_ROLE[roleKey] || SPECIALIZATIONS_BY_ROLE['default'];
  };

  // Toggle specialization selection
  const toggleSpecialization = (spec: string) => {
    const current = profile.specializations;
    const updated = current.includes(spec)
      ? current.filter(s => s !== spec)
      : [...current, spec];
    setProfile(prev => ({ ...prev, specializations: updated }));
    setHasChanges(true);
    if (updated.length > 0) {
      setFormErrors(prev => ({ ...prev, specializations: '' }));
    }
  };

  const loadProfile = async (staffId: string) => {
    try {
      setLoading(true);
      const response = await apiClient.get<{
        success?: boolean;
        staff?: any;
      }>(`/staff/${staffId}/profile`);
      
      if (response.success && response.staff) {
        const staffData = response.staff;
        setProfile({
          id: staffId,
          name: staffData.name || staffData.first_name + ' ' + (staffData.last_name || '') || '',
          phone: staffData.phone || '',
          email: staffData.email || '',
          address: staffData.address || '',
          city: staffData.city || '',
          state: staffData.state || '',
          pincode: staffData.pincode || '',
          description: staffData.description || '',
          photo_url: staffData.photo_url || staffData.photo || '',
          qualifications: staffData.qualifications || '',
          specializations: parseSpecializations(staffData.specializations),
          experience_years: staffData.experience_years || 0,
          service_area: staffData.service_area || '',
          operating_hours: staffData.operating_hours || '',
          role_name: staffData.role || staffData.role_name || '',
        });
      } else {
        // Initialize with staff session data
        if (staff) {
          setProfile({
            id: staffId,
            name: staff.name || '',
            phone: staff.phone || '',
            email: staff.email || '',
            address: '',
            city: '',
            state: '',
            pincode: '',
            description: '',
            photo_url: staff.photo || '',
            qualifications: '',
            specializations: [],
            experience_years: 0,
            service_area: '',
            operating_hours: '',
            role_name: staff.role || '',
          });
        }
      }
    } catch (err: any) {
      console.error('Error loading staff profile:', err);
      // Initialize with staff session data if API fails
      if (staff) {
        setProfile({
          id: staffId,
          name: staff.name || '',
          phone: staff.phone || '',
          email: staff.email || '',
          address: '',
          city: '',
          state: '',
          pincode: '',
          description: '',
          photo_url: staff.photo || '',
          qualifications: '',
          specializations: [],
          experience_years: 0,
          service_area: '',
          operating_hours: '',
          role_name: staff.role || '',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof StaffProfile, value: string | number) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Validate form before saving
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!profile.name.trim()) errors.name = 'Full name is required';
    if (!profile.email.trim()) errors.email = 'Email is required';
    if (!profile.qualifications?.trim()) errors.qualifications = 'Qualifications help customers trust your expertise';
    if (profile.specializations.length === 0) errors.specializations = 'Select at least one specialization';
    
    setFormErrors(errors);
    
    const criticalErrors = ['name', 'email'].filter(f => errors[f]);
    return criticalErrors.length === 0;
  };

  const handleSave = async () => {
    if (!profile || !staff) return;
    
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setSaving(true);
    try {
      const response = await apiClient.put<{ success?: boolean; error?: string }>(
        `/staff/${staff.id}/profile`,
        {
          name: profile.name,
          email: profile.email,
          address: profile.address,
          city: profile.city,
          state: profile.state,
          pincode: profile.pincode,
          description: profile.description,
          qualifications: profile.qualifications,
          specializations: JSON.stringify(profile.specializations),
          experience_years: profile.experience_years,
          service_area: profile.service_area,
          operating_hours: profile.operating_hours,
        }
      ) as { success?: boolean; error?: string };
      if (response?.success) {
        toast.success('Profile updated successfully');
        setHasChanges(false);
        loadProfile(staff.id);
      } else {
        toast.error(response?.error || 'Failed to update profile');
      }
    } catch (err: any) {
      console.error('Error saving profile:', err);
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  // Calculate profile completion percentage
  const calculateCompletion = () => {
    let filled = 0;
    let total = 10;
    
    if (profile.photo_url) filled++;
    if (profile.name) filled++;
    if (profile.email) filled++;
    if (profile.qualifications) filled++;
    if (profile.specializations.length > 0) filled++;
    if (profile.experience_years && profile.experience_years > 0) filled++;
    if (profile.description) filled++;
    if (profile.address) filled++;
    if (profile.service_area) filled++;
    if (profile.operating_hours) filled++;
    
    return Math.round((filled / total) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const completionPercentage = calculateCompletion();
  const availableSpecializations = getAvailableSpecializations();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-blue-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/staff/dashboard')}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
              <p className="text-sm text-gray-500 mt-1">
                {profile.role_name || 'Staff Member'} • Professional Profile
              </p>
            </div>
            {hasChanges && (
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Profile Completion Banner */}
        <div className={`rounded-2xl p-4 mb-6 ${completionPercentage === 100 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-center gap-4">
            {completionPercentage === 100 ? (
              <CheckCircle className="w-8 h-8 text-green-500" />
            ) : (
              <AlertCircle className="w-8 h-8 text-amber-500" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-800">Profile Completion</span>
                <span className={`font-bold ${completionPercentage === 100 ? 'text-green-600' : 'text-amber-600'}`}>
                  {completionPercentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all ${completionPercentage === 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {completionPercentage === 100 
                  ? '✨ Great! Your profile is complete and ready to attract customers.' 
                  : 'Complete your profile to improve visibility and build trust with customers.'}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Photo Section - Using shared PhotoUpload component */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <PhotoUpload
            photoUrl={profile.photo_url}
            onUpload={async (file) => {
              try {
                setUploading(true);
                const formData = new FormData();
                formData.append('photo', file);

                const response = await apiClient.post<{ success?: boolean; photo_url?: string }>(
                  `/staff/${staff.id}/profile/photo`,
                  formData
                );
                
                if (response.success && response.photo_url) {
                  setProfile(prev => ({ ...prev, photo_url: response.photo_url }));
                  setHasChanges(true);
                  setFormErrors(prev => ({ ...prev, photo_url: '' }));
                  return { success: true, photo_url: response.photo_url };
                }
                throw new Error('Upload failed');
              } catch (err: any) {
                console.error('Error uploading photo:', err);
                throw err;
              } finally {
                setUploading(false);
              }
            }}
            size="lg"
            label="Profile Photo"
            required={false}
            maxSizeMB={5}
            disabled={uploading}
            className="mb-4"
          />
          {formErrors.photo_url && (
            <p className="text-amber-600 text-xs mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {formErrors.photo_url}
            </p>
          )}
        </div>

        {/* Personal Information */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Personal Information</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={profile.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`mt-1 ${formErrors.name ? 'border-red-300' : ''}`}
                placeholder="Enter your full name"
              />
              {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={profile.phone}
                disabled
                className="mt-1 bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">Phone number cannot be changed</p>
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`mt-1 ${formErrors.email ? 'border-red-300' : ''}`}
                placeholder="your.email@example.com"
              />
              {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
            </div>
            <div>
              <Label htmlFor="experience_years">Years of Experience</Label>
              <Input
                id="experience_years"
                type="number"
                value={profile.experience_years || 0}
                onChange={(e) => handleInputChange('experience_years', parseInt(e.target.value) || 0)}
                className="mt-1"
                min="0"
                max="50"
              />
            </div>
          </div>
        </div>

        {/* Professional Credentials */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Award className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Professional Credentials</h2>
          </div>
          <div className="space-y-6">
            {/* Role Display */}
            <div>
              <Label>Service Category</Label>
              <div className="mt-2">
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-sm px-3 py-1">
                  {profile.role_name || 'Staff Member'}
                </Badge>
              </div>
            </div>
            
            {/* Qualifications */}
            <div>
              <Label htmlFor="qualifications">Qualifications & Certifications *</Label>
              <Textarea
                id="qualifications"
                value={profile.qualifications || ''}
                onChange={(e) => handleInputChange('qualifications', e.target.value)}
                className={`mt-1 ${formErrors.qualifications ? 'border-amber-300' : ''}`}
                rows={3}
                placeholder="e.g., BVSc, MVSc, Certified Pet Groomer, CPDT-KA, etc."
              />
              {formErrors.qualifications && (
                <p className="text-amber-600 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {formErrors.qualifications}
                </p>
              )}
            </div>
            
            {/* Specializations - Multi-select chips */}
            <div>
              <Label className="mb-3 block">
                Specializations * <span className="text-xs text-gray-500">(Select at least one)</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {availableSpecializations.map(spec => (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => toggleSpecialization(spec)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      profile.specializations.includes(spec)
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {profile.specializations.includes(spec) && '✓ '}
                    {spec}
                  </button>
                ))}
              </div>
              {profile.specializations.length > 0 && (
                <p className="text-xs text-blue-600 mt-2">
                  {profile.specializations.length} specialization{profile.specializations.length > 1 ? 's' : ''} selected
                </p>
              )}
              {formErrors.specializations && (
                <p className="text-red-500 text-xs mt-2">{formErrors.specializations}</p>
              )}
            </div>
            
            {/* Professional Bio */}
            <div>
              <Label htmlFor="description">Professional Bio</Label>
              <Textarea
                id="description"
                value={profile.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="mt-1"
                rows={4}
                placeholder="Tell customers about yourself, your experience, approach to pet care, and what makes you unique..."
              />
              <p className="text-xs text-gray-500 mt-1">
                A compelling bio helps customers choose you over others
              </p>
            </div>
          </div>
        </div>

        {/* Service Area & Location */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <MapPin className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Service Area & Location</h2>
          </div>
          <div className="space-y-6">
            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={profile.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="mt-1"
                rows={2}
                placeholder="Your base location address"
              />
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={profile.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={profile.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  value={profile.pincode}
                  onChange={(e) => handleInputChange('pincode', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="service_area">Service Area Coverage</Label>
              <Input
                id="service_area"
                value={profile.service_area || ''}
                onChange={(e) => handleInputChange('service_area', e.target.value)}
                className="mt-1"
                placeholder="e.g., Within 10km radius, All of South Mumbai, etc."
              />
              <p className="text-xs text-gray-500 mt-1">
                Specify the areas where you provide home visit services
              </p>
            </div>
          </div>
        </div>

        {/* Operating Hours */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Availability</h2>
          </div>
          <div>
            <Label htmlFor="operating_hours">Working Hours</Label>
            <Input
              id="operating_hours"
              value={profile.operating_hours || ''}
              onChange={(e) => handleInputChange('operating_hours', e.target.value)}
              className="mt-1"
              placeholder="e.g., Mon-Sat: 9 AM - 6 PM, Sunday: By Appointment"
            />
            <p className="text-xs text-gray-500 mt-1">
              Let customers know when you're available for bookings
            </p>
          </div>
        </div>

        {/* Save Button (if changes) */}
        {hasChanges && (
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-blue-200 p-4 rounded-t-2xl">
            <div className="max-w-4xl mx-auto flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  loadProfile(staff.id);
                  setHasChanges(false);
                  setFormErrors({});
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
