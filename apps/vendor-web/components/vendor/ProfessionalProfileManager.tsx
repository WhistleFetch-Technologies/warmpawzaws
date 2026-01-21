'use client';

/**
 * Professional Profile Manager for Solo Vendors
 * 
 * This component manages the personal/professional profile for solo service providers.
 * It mirrors the staff creation form model with:
 * - Photo (encouraged/mandatory)
 * - Personal information
 * - Qualifications & certifications
 * - Multi-select specializations based on role
 * - Experience years
 * - Service area and availability
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Camera, Save, User, Mail, Phone, MapPin, FileText, Clock, Award, Briefcase, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Specializations by role type (same as staff creation)
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

interface ProfessionalProfile {
  id: string;
  owner_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  description?: string;
  photo_url?: string;
  qualifications?: string;
  specializations: string[]; // Changed to array for multi-select
  experience_years?: number;
  service_area?: string;
  operating_hours?: string;
  role_name?: string;
}

interface ProfessionalProfileManagerProps {
  vendorId: string;
  profile: any; // Initial profile data from parent
  onBack?: () => void;
}

export function ProfessionalProfileManager({ vendorId, profile: initialProfile, onBack }: ProfessionalProfileManagerProps) {
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Get vendor role for specialization options
  const vendorRoleId = initialProfile?.roleId || initialProfile?.role_id || 'default';
  const vendorRoleName = initialProfile?.roleName || initialProfile?.role_name || 'Service Provider';
  
  const [profile, setProfile] = useState<ProfessionalProfile>({
    id: vendorId,
    owner_name: initialProfile?.owner_name || initialProfile?.ownerName || '',
    phone: initialProfile?.phone || '',
    email: initialProfile?.email || '',
    address: initialProfile?.address || '',
    city: initialProfile?.city || '',
    state: initialProfile?.state || '',
    pincode: initialProfile?.pincode || '',
    description: initialProfile?.description || '',
    photo_url: initialProfile?.logo_url || initialProfile?.photo_url || '',
    qualifications: initialProfile?.qualifications || '',
    specializations: parseSpecializations(initialProfile?.specializations),
    experience_years: initialProfile?.experience_years || initialProfile?.experienceYears || 0,
    service_area: initialProfile?.service_area || initialProfile?.serviceArea || '',
    operating_hours: initialProfile?.operating_hours || initialProfile?.operatingHours || '',
    role_name: vendorRoleName,
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Parse specializations from string or array
  function parseSpecializations(specs: any): string[] {
    if (!specs) return [];
    if (Array.isArray(specs)) return specs;
    if (typeof specs === 'string') {
      // Try to parse as JSON array first
      try {
        const parsed = JSON.parse(specs);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Split by comma if not JSON
        return specs.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }
    return [];
  }

  // Get available specializations based on vendor role
  const getAvailableSpecializations = () => {
    const roleKey = vendorRoleId.toLowerCase().replace(/\s+/g, '_');
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

  useEffect(() => {
    loadProfile();
  }, [vendorId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{
        success?: boolean;
        vendor?: any;
      }>(`/vendor/${vendorId}/profile`);
      
      if (response.success && response.vendor) {
        setProfile({
          id: vendorId,
          owner_name: response.vendor.owner_name || response.vendor.ownerName || '',
          phone: response.vendor.phone || '',
          email: response.vendor.email || '',
          address: response.vendor.address || '',
          city: response.vendor.city || '',
          state: response.vendor.state || '',
          pincode: response.vendor.pincode || '',
          description: response.vendor.description || '',
          photo_url: response.vendor.photo_url || response.vendor.logo_url || '',
          qualifications: response.vendor.qualifications || '',
          specializations: parseSpecializations(response.vendor.specializations),
          experience_years: response.vendor.experience_years || response.vendor.experienceYears || 0,
          service_area: response.vendor.service_area || response.vendor.serviceArea || '',
          operating_hours: response.vendor.operating_hours || response.vendor.operatingHours || '',
          role_name: response.vendor.role_name || response.vendor.roleName || vendorRoleName,
        });
      }
    } catch (err: any) {
      console.error('Error loading professional profile:', err);
      toast.error(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ProfessionalProfile, value: string | number) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    // Clear error when user types
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !vendorId) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be less than 5MB');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('photo', file);

      const response = await apiClient.post<{ success?: boolean; photo_url?: string }>(
        `/vendor/${vendorId}/profile/photo`,
        formData
      );
      if (response.success && response.photo_url) {
        setProfile(prev => ({ ...prev, photo_url: response.photo_url }));
        toast.success('Photo uploaded successfully');
        setHasChanges(true);
        setFormErrors(prev => ({ ...prev, photo_url: '' }));
      }
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  // Validate form before saving
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!profile.owner_name.trim()) errors.owner_name = 'Full name is required';
    if (!profile.email.trim()) errors.email = 'Email is required';
    if (!profile.photo_url) errors.photo_url = 'Profile photo is recommended for better visibility to customers';
    if (!profile.qualifications?.trim()) errors.qualifications = 'Qualifications help customers trust your expertise';
    if (profile.specializations.length === 0) errors.specializations = 'Select at least one specialization';
    if (!profile.address.trim()) errors.address = 'Address is required';
    if (!profile.city.trim()) errors.city = 'City is required';
    
    setFormErrors(errors);
    
    // Only block on required fields (name, email, address, city)
    const criticalErrors = ['owner_name', 'email', 'address', 'city'].filter(f => errors[f]);
    return criticalErrors.length === 0;
  };

  const handleSave = async () => {
    if (!profile || !vendorId) return;
    
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setSaving(true);
    try {
      const response = await apiClient.put<{ success?: boolean; error?: string }>(
        `/vendor/${vendorId}/profile`,
        {
          owner_name: profile.owner_name,
          email: profile.email,
          address: profile.address,
          city: profile.city,
          state: profile.state,
          pincode: profile.pincode,
          description: profile.description,
          qualifications: profile.qualifications,
          specializations: JSON.stringify(profile.specializations), // Store as JSON array
          experience_years: profile.experience_years,
          service_area: profile.service_area,
          operating_hours: profile.operating_hours,
        }
      ) as { success?: boolean; error?: string };
      if (response?.success) {
        toast.success('Professional profile updated successfully');
        setHasChanges(false);
        loadProfile();
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
    if (profile.owner_name) filled++;
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
              onClick={onBack || (() => router.back())}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-800">Professional Profile</h1>
              <p className="text-sm text-gray-500 mt-1">
                {vendorRoleName} • Solo Service Provider
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

        {/* Profile Photo Section */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Camera className="w-5 h-5 text-blue-500" />
            <Label className="text-lg font-semibold">Profile Photo *</Label>
          </div>
          <div className="flex items-start gap-6">
            <div className="relative">
              <div className={`w-32 h-32 rounded-2xl flex items-center justify-center overflow-hidden border-2 ${
                formErrors.photo_url ? 'border-amber-400 bg-amber-50' : 'border-blue-200 bg-gradient-to-br from-blue-100 to-indigo-100'
              }`}>
                {profile.photo_url ? (
                  <img src={profile.photo_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-16 h-16 text-blue-400" />
                )}
              </div>
              <input
                type="file"
                ref={photoInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full cursor-pointer hover:bg-blue-600 transition disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-3">
                Upload a professional photo of yourself. This helps customers recognize and trust you.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : profile.photo_url ? 'Change Photo' : 'Upload Photo'}
              </Button>
              {formErrors.photo_url && (
                <p className="text-amber-600 text-xs mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {formErrors.photo_url}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Personal Information</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="owner_name">Full Name *</Label>
              <Input
                id="owner_name"
                value={profile.owner_name}
                onChange={(e) => handleInputChange('owner_name', e.target.value)}
                className={`mt-1 ${formErrors.owner_name ? 'border-red-300' : ''}`}
                placeholder="Enter your full name"
              />
              {formErrors.owner_name && <p className="text-red-500 text-xs mt-1">{formErrors.owner_name}</p>}
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
                  {vendorRoleName}
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
              <Label htmlFor="address">Address *</Label>
              <Textarea
                id="address"
                value={profile.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className={`mt-1 ${formErrors.address ? 'border-red-300' : ''}`}
                rows={2}
                placeholder="Your base location address"
              />
              {formErrors.address && <p className="text-red-500 text-xs mt-1">{formErrors.address}</p>}
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={profile.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className={`mt-1 ${formErrors.city ? 'border-red-300' : ''}`}
                />
                {formErrors.city && <p className="text-red-500 text-xs mt-1">{formErrors.city}</p>}
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
                  loadProfile();
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
