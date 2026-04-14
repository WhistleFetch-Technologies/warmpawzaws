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

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Camera, Save, User, Mail, Phone, MapPin, FileText, Clock, Award, Briefcase, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PhotoUpload } from '@/components/shared/PhotoUpload';
import { EnhancedAddressAutocomplete, AddressComponents } from '@/components/shared/EnhancedAddressAutocomplete';
import { AdvancedAvailabilityManager } from '../AdvancedAvailabilityManager';
import { SpecializationSelector } from '../SpecializationSelector';
import { ProfessionalProfile, ProfessionalProfileManagerProps } from './constants/interface';
import { parseSpecializations } from './constants/helpers';
import { hasVendorRole } from '@/lib/vendor-utils';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { VendorRoleConfigurationSummary } from './VendorRoleConfigurationSummary';

// ✅ REMOVED: Hardcoded specializations - now using SpecializationSelector which fetches role-specific specializations from database
// This ensures specializations are always up-to-date and role-specific based on admin configuration



// ✅ FIX: Move parseSpecializations outside component to avoid "Cannot access before initialization" error
// This function is used in useState initializer, so it must be defined before the component


export function ProfessionalProfileManager({ vendorId, profile: initialProfile, onBack }: ProfessionalProfileManagerProps) {

  //---------------------HOOKS-----------------//
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [hasAvailability, setHasAvailability] = useState(false);
  const vendorRoleId = initialProfile?.roleId || initialProfile?.role_id || initialProfile?.role?.id || null;
  const vendorRoleName = initialProfile?.roleName || initialProfile?.role_name || initialProfile?.role?.display_name || 'Service Provider';
  const [roleId, setRoleId] = useState<string | null>(vendorRoleId);
  const [profile, setProfile] = useState<ProfessionalProfile>({
    id: vendorId,
    owner_name: initialProfile?.owner_name || initialProfile?.ownerName || '',
    phone: initialProfile?.phone || '',
    email: initialProfile?.email || '',
    address: initialProfile?.address || '',
    city: initialProfile?.city || '',
    state: initialProfile?.state || '',
    pincode: (initialProfile?.pincode && initialProfile?.pincode !== '000000') ? initialProfile.pincode : '',
    latitude: initialProfile?.latitude ?? undefined,
    longitude: initialProfile?.longitude ?? undefined,
    description: initialProfile?.description || '',
    photo_url: initialProfile?.profile_photo_url || initialProfile?.logo_url || initialProfile?.photo_url || '',
    qualifications: initialProfile?.qualifications || '',
    specializations: parseSpecializations(initialProfile?.specializations),
    experience_years: initialProfile?.experience_years ?? initialProfile?.experienceYears ?? 0,
    service_area: initialProfile?.service_area || initialProfile?.serviceArea || '',
    operating_hours: initialProfile?.operating_hours || initialProfile?.operatingHours || '',
    availability: initialProfile?.availability || initialProfile?.availabilitySchedule || undefined,
    role_name: vendorRoleName,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [rolePayload, setRolePayload] = useState<Record<string, unknown> | null>(
    initialProfile ? (initialProfile as Record<string, unknown>) : null
  );

  const isPetInsuranceProfile = hasVendorRole(
    {
      roleId: roleId || initialProfile?.roleId || initialProfile?.role_id,
      roleName: profile.role_name || vendorRoleName,
    },
    ['pet_insurance', 'insurance']
  );

  useEffect(() => {
    loadProfile();
  }, [vendorId]);

  // Check if availability is configured
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const response: any = await apiClient.get(`/vendor/${vendorId}/availability`).catch(() => null);
        if (response && response.availability && response.availability.slots) {
          const slots = response.availability.slots || [];
          // Check if there's at least one enabled slot
          const hasEnabledSlots = slots.some((slot: any) =>
            (slot.is_enabled ?? slot.isEnabled ?? true) &&
            slot.service_styles &&
            slot.service_styles.length > 0
          );
          setHasAvailability(hasEnabledSlots);
        } else {
          setHasAvailability(false);
        }
      } catch (err) {
        console.warn('Could not check availability:', err);
        setHasAvailability(false);
      }
    };

    if (vendorId) {
      checkAvailability();
    }
  }, [vendorId]);



  //---------------------FUNCTIONS-----------------//
  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{
        success?: boolean;
        vendor?: any;
      }>(`/vendor/${vendorId}/profile`);

      if (response.success && response.vendor) {
        // ✅ FIX: Get roleId from multiple possible locations (priority order)
        const loadedRoleId = response.vendor.roleId ||
          response.vendor.role_id ||
          response.vendor.role?.id ||
          null; // ✅ No fallback to 'default'

        if (!loadedRoleId) {
          console.error('[PROFILE] No roleId found for vendor:', vendorId);
          toast.error('Vendor role not found. Please contact support.');
          setLoading(false);
          return;
        }

        setRoleId(loadedRoleId);
        setRolePayload(response.vendor as Record<string, unknown>);

        setProfile({
          id: vendorId,
          owner_name: response.vendor.owner_name || response.vendor.ownerName || '',
          phone: response.vendor.phone || '',
          email: response.vendor.email || '',
          address: response.vendor.address || '',
          city: response.vendor.city || '',
          state: response.vendor.state || '',
          pincode: (response.vendor.pincode && response.vendor.pincode !== '000000') ? response.vendor.pincode : '',
          latitude: response.vendor.latitude ?? undefined,
          longitude: response.vendor.longitude ?? undefined,
          description: response.vendor.description || '',
          photo_url: response.vendor.profile_photo_url || response.vendor.photo_url || response.vendor.logo_url || '',
          qualifications: response.vendor.qualifications || '',
          specializations: parseSpecializations(response.vendor.specializations),
          experience_years: response.vendor.experience_years ?? response.vendor.experienceYears ?? 0, // ✅ Use nullish coalescing to preserve 0
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

  // Photo upload is now handled by PhotoUpload component
  // Validate form before saving
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!profile.owner_name.trim()) errors.owner_name = 'Full name is required';
    if (!profile.email.trim()) errors.email = 'Email is required';
    if (!profile.photo_url) errors.photo_url = 'Profile photo is recommended for better visibility to customers';
    if (!profile.qualifications?.trim()) errors.qualifications = 'Qualifications help customers trust your expertise';
    if (!isPetInsuranceProfile && profile.specializations.length === 0) {
      errors.specializations = 'Select at least one specialization';
    }
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
          latitude: profile.latitude,
          longitude: profile.longitude,
          description: profile.description,
          qualifications: profile.qualifications,
          specializations: JSON.stringify(isPetInsuranceProfile ? [] : profile.specializations),
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

  // ✅ FIX: Calculate profile completion percentage - updated to check ALL actual fields in the form
  const calculateCompletion = () => {
    let filled = 0;
    // ✅ Updated to match ALL fields that can be filled in the Professional Profile form
    // Fields in the form: photo_url, owner_name, phone, email, qualifications, specializations (optional for pet insurance),
    //                     experience_years, address, city, state, pincode, service_area, description
    let total = isPetInsuranceProfile ? 12 : 13;

    // ✅ FIX: Check each field with proper validation
    // 1. Profile Photo
    if (profile.photo_url && profile.photo_url.trim() && profile.photo_url !== 'null') filled++;

    // 2. Owner Name
    if (profile.owner_name && profile.owner_name.trim()) filled++;

    // 3. Phone
    if (profile.phone && profile.phone.trim()) filled++;

    // 4. Email
    if (profile.email && profile.email.trim()) filled++;

    // 5. Qualifications
    if (profile.qualifications && profile.qualifications.trim()) filled++;

    // 6. Specializations (must have at least 1, except pet insurance)
    if (
      !isPetInsuranceProfile &&
      profile.specializations &&
      Array.isArray(profile.specializations) &&
      profile.specializations.length > 0
    ) {
      filled++;
    }

    // 7. Experience Years (can be 0, so check if defined)
    if (profile.experience_years !== null && profile.experience_years !== undefined) filled++;

    // 8. Address
    if (profile.address && profile.address.trim()) filled++;

    // 9. City
    if (profile.city && profile.city.trim()) filled++;

    // 10. State
    if (profile.state && profile.state.trim()) filled++;

    // 11. Pincode (must be valid 6-digit, not placeholder)
    const pincode = profile.pincode && profile.pincode.trim();
    if (pincode && pincode !== '000000' && pincode !== '0000000' && pincode !== '00000000' && /^\d{6}$/.test(pincode)) filled++;

    // 12. Service Area (optional but counts if filled)
    if (profile.service_area && profile.service_area.trim()) filled++;

    // 13. Description (optional but counts if filled)
    if (profile.description && profile.description.trim()) filled++;

    // ✅ FIX: Calculate percentage - ensure it reaches 100% when all fields are filled
    const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;

    // ✅ DEBUG: Log completion details for troubleshooting
    console.log(`[ProfileCompletion] ========== COMPLETION CALCULATION ==========`);
    console.log(`[ProfileCompletion] Filled: ${filled}/${total}, Percentage: ${percentage}%`);
    console.log(`[ProfileCompletion] Field Details:`);
    console.log(`  photo_url: ${!!profile.photo_url && profile.photo_url.trim() && profile.photo_url !== 'null' ? '✅' : '❌'} (value: ${profile.photo_url ? 'present' : 'missing'})`);
    console.log(`  owner_name: ${!!profile.owner_name && profile.owner_name.trim() ? '✅' : '❌'} (value: '${profile.owner_name || ''}')`);
    console.log(`  phone: ${!!profile.phone && profile.phone.trim() ? '✅' : '❌'} (value: '${profile.phone || ''}')`);
    console.log(`  email: ${!!profile.email && profile.email.trim() ? '✅' : '❌'} (value: '${profile.email || ''}')`);
    console.log(`  qualifications: ${!!profile.qualifications && profile.qualifications.trim() ? '✅' : '❌'} (value: '${(profile.qualifications || '').substring(0, 30)}...')`);
    console.log(`  specializations: ${profile.specializations && Array.isArray(profile.specializations) && profile.specializations.length > 0 ? '✅' : '❌'} (count: ${profile.specializations?.length || 0})`);
    console.log(`  experience_years: ${profile.experience_years !== null && profile.experience_years !== undefined ? '✅' : '❌'} (value: ${profile.experience_years})`);
    console.log(`  address: ${!!profile.address && profile.address.trim() ? '✅' : '❌'} (value: '${(profile.address || '').substring(0, 30)}...')`);
    console.log(`  city: ${!!profile.city && profile.city.trim() ? '✅' : '❌'} (value: '${profile.city || ''}')`);
    console.log(`  state: ${!!profile.state && profile.state.trim() ? '✅' : '❌'} (value: '${profile.state || ''}')`);
    console.log(`  pincode: ${pincode && pincode !== '000000' && pincode !== '0000000' && pincode !== '00000000' && /^\d{6}$/.test(pincode) ? '✅' : '❌'} (value: '${profile.pincode || ''}')`);
    console.log(`  service_area: ${!!profile.service_area && profile.service_area.trim() ? '✅' : '❌'} (value: '${profile.service_area || ''}')`);
    console.log(`  description: ${!!profile.description && profile.description.trim() ? '✅' : '❌'} (value: '${(profile.description || '').substring(0, 30)}...')`);
    console.log(`[ProfileCompletion] ===========================================`);

    if (filled === total) {
      return 100;
    }

    return Math.min(percentage, 100); // Ensure it never exceeds 100%
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="vendor-app-column bg-white py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  const completionPercentage = calculateCompletion();

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="Professional Profile"
          subtitle={`${vendorRoleName} • Solo Provider`}
          onBack={onBack || (() => router.back())}
          actions={
            hasChanges
              ? [
                  <Button
                    key="save"
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    size="sm"
                    className="h-9 bg-orange-500 px-3 text-xs text-white hover:bg-orange-600"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </Button>,
                ]
              : []
          }
        />

        {/* Main Content */}
        <div className="p-4">
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

          <VendorRoleConfigurationSummary vendor={rolePayload} />

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
                    `/vendor/${vendorId}/profile/photo`,
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
                  value={profile.experience_years ?? 0}
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

              {/* Specializations — not used for pet insurance */}
              {!isPetInsuranceProfile && (
                <div>
                  <Label className="mb-3 block">
                    Specializations * <span className="text-xs text-gray-500">(Select at least one)</span>
                  </Label>
                  {!roleId ? (
                    <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                      <p className="text-red-600 text-sm">
                        ⚠️ Vendor role not found. Cannot load specializations. Please contact support.
                      </p>
                    </div>
                  ) : (
                    <SpecializationSelector
                      roleId={roleId}
                      selected={profile.specializations}
                      onChange={(specIds) => {
                        setProfile(prev => ({ ...prev, specializations: specIds }));
                        setHasChanges(true);
                        if (specIds.length > 0) {
                          setFormErrors(prev => ({ ...prev, specializations: '' }));
                        }
                      }}
                      isSoloProvider={true}
                    />
                  )}
                  {formErrors.specializations && (
                    <p className="text-red-500 text-xs mt-2">{formErrors.specializations}</p>
                  )}
                </div>
              )}

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
                <EnhancedAddressAutocomplete
                  value={profile.address || ''}
                  onChange={(address: string, components?: AddressComponents) => {
                    // Update address + city, state, pincode, and coordinates from Places
                    setProfile(prev => ({
                      ...prev,
                      address,
                      ...(components?.city !== undefined && { city: components.city ?? prev.city ?? '' }),
                      ...(components?.state !== undefined && { state: components.state ?? prev.state ?? '' }),
                      ...(components?.pincode !== undefined && { pincode: components.pincode ?? prev.pincode ?? '' }),
                      // Extract latitude and longitude from coordinates
                      ...(components?.coordinates?.lat != null && { latitude: components.coordinates.lat }),
                      ...(components?.coordinates?.lng != null && { longitude: components.coordinates.lng }),
                      // Support direct lat/lng for backward compatibility
                      ...(components?.lat != null && !components?.coordinates?.lat && { latitude: components.lat }),
                      ...(components?.lng != null && !components?.coordinates?.lng && { longitude: components.lng }),
                    }));
                    setHasChanges(true);
                  }}
                  placeholder="Search address, landmark, city..."
                  className={`mt-1 ${formErrors.address ? 'border-red-300' : ''}`}
                  required
                  types={['geocode']}
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

          {/* Availability - Advanced Scheduling only (multiple slots, service styles) */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <AdvancedAvailabilityManager
              vendorId={vendorId}
              vendorData={{ ...initialProfile, vendorType: 'solo', id: vendorId, isSoloProvider: true }}
              onBack={onBack ?? (() => { })}
            />
          </div>

          {/* Save Button (if changes) */}
          {hasChanges && (
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 p-3 safe-area-bottom">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 min-h-[48px]"
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
                  className="flex-1 min-h-[48px] bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white"
                >
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
