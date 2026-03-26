'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Save, Clock, Building2, MapPin, Image as ImageIcon, Calendar, Sparkles, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getAmenitiesForVendorType } from '@/lib/master-amenities';
import { isSoloVendor, isCenterRole, getVendorRoleName, hasVendorRole } from '@/lib/vendor-utils';
import { SpecializationSelector } from '../SpecializationSelector';
import { EnhancedAddressAutocomplete, AddressComponents } from '@/components/shared/EnhancedAddressAutocomplete';
import { AdvancedAvailabilityManager } from '../AdvancedAvailabilityManager';
import { CenterProfile, DAYS, ProfileManagerProps } from './constants/interface';

// ✅ RENAMED: CenterProfileManager -> ProfileManager (generic naming)
// Export both names for backward compatibility

// ✅ Main export with generic name
export function ProfileManager({ vendorId, vendorData, onBack }: ProfileManagerProps) {
  // ✅ FIX: Show Amenities and Specialty tabs for center roles even when vendorData says solo.
  // Use centralized isSoloVendor and override with isCenterRole so center profiles always get the tabs.
  // ⚠️ Do NOT use roleId state here - it is declared later; use vendorData only to avoid "Cannot access before initialization".
  const soloByData = isSoloVendor(vendorData);
  const roleNameOrId = vendorData?.roleName || vendorData?.roleId || getVendorRoleName(vendorData) || '';
  const isCenterRoleType = isCenterRole(roleNameOrId);
  const isPetInsuranceVendor = hasVendorRole(vendorData, ['pet_insurance', 'insurance']);
  const showAmenitiesAndSpecialtyTabs = !isPetInsuranceVendor && (!soloByData || isCenterRoleType);

  // ✅ FIX: If tabs are hidden and user had amenities/specialty selected, redirect to basic
  const [activeTab, setActiveTab] = useState<'basic' | 'availability' | 'amenities' | 'specialization'>('basic');

  useEffect(() => {
    if (!showAmenitiesAndSpecialtyTabs && (activeTab === 'amenities' || activeTab === 'specialization')) {
      setActiveTab('basic');
    }
  }, [showAmenitiesAndSpecialtyTabs, activeTab]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // ✅ FIX: Track roleId separately with fallback loading
  // IMPORTANT: Prefer roleName over roleId (roleId is UUID, roleName is actual name like 'veterinary_clinic')
  // ⚠️ CRITICAL: DO NOT use vendorType as fallback - it's 'business'/'solo'/'center' which are NOT role names
  const [roleId, setRoleId] = useState<string | undefined>(
    vendorData?.roleName || vendorData?.roleId
  );
  
  const [profile, setProfile] = useState<CenterProfile>({
    centerName: vendorData?.businessName || '',
    description: '',
    address: vendorData?.address || '',
    city: vendorData?.city || '',
    state: vendorData?.state || '',
    pincode: (vendorData?.pincode && vendorData?.pincode !== '000000') ? vendorData.pincode : '',
    latitude: vendorData?.latitude ?? undefined,
    longitude: vendorData?.longitude ?? undefined,
    operatingHours: DAYS.reduce((acc, day) => ({
      ...acc,
      [day]: { isOpen: true, open: '09:00', close: '18:00' }
    }), {}),
    amenities: [],
    customAmenities: [],
    specializations: [],
    photos: [],
    emergencyServices: {
      ambulance: false,
      ambulanceAvailable247: false,
      consultationAvailable247: false,
      diagnosticsAvailable247: false
    }
  });

  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [customAmenityInput, setCustomAmenityInput] = useState('');
  const [availableForInstantTele, setAvailableForInstantTele] = useState<boolean>(false);

  // Using apiClient instead of API_BASE - use local roleId state
  const availableAmenities = getAmenitiesForVendorType(roleId);
  const MAX_PHOTOS = 10;

  // ✅ FIX: Update roleId when vendorData changes - prefer roleName over roleId
  // ⚠️ CRITICAL: DO NOT use vendorType as fallback - it's 'business'/'solo'/'center' which are NOT role names
  useEffect(() => {
    if (!roleId) {
      const newRoleId = vendorData?.roleName || vendorData?.roleId;
      if (newRoleId) {
        console.log('[CENTER-PROFILE] Setting roleId from vendorData:', newRoleId);
        setRoleId(newRoleId);
      }
    }
  }, [vendorData?.roleName, vendorData?.roleId]);

  useEffect(() => {
    loadCenterProfile();
  }, [vendorId]);

  const loadCenterProfile = async () => {
    try {
      setLoading(true);
      
      // ✅ FIX: If roleId is not available, fetch it from vendor profile
      // IMPORTANT: Use roleName (the actual role name like 'veterinary_clinic') not roleId (which is a UUID)
      let fetchedRoleId: string | undefined = undefined;
      let vendorProfileData: any = null;
      if (!roleId) {
        try {
          console.log('[CENTER-PROFILE] roleId not available, fetching from profile...');
          vendorProfileData = await apiClient.get('/vendor/profile') as any;
          const profileData = vendorProfileData;
          
          // ✅ FIX: Prefer roleName over roleId (roleId is UUID, roleName is actual name like 'veterinary_clinic')
          // ⚠️ CRITICAL: DO NOT use vendorType/vendor_type - they are 'business'/'solo'/'center' NOT role names
          if (profileData?.vendor?.roleName) {
            console.log('[CENTER-PROFILE] Got roleName from profile:', profileData.vendor.roleName);
            fetchedRoleId = profileData.vendor.roleName;
            setRoleId(fetchedRoleId);
          } else if (profileData?.vendor?.roleId) {
            // Use roleId (UUID) - backend will look it up and map to correct role
            console.log('[CENTER-PROFILE] Using roleId (UUID):', profileData.vendor.roleId);
            fetchedRoleId = profileData.vendor.roleId;
            setRoleId(fetchedRoleId);
          } else if (profileData?.vendor?.role_id) {
            // Alternative field name
            console.log('[CENTER-PROFILE] Using role_id (UUID):', profileData.vendor.role_id);
            fetchedRoleId = profileData.vendor.role_id;
            setRoleId(fetchedRoleId);
          } else {
            console.warn('[CENTER-PROFILE] No roleName or roleId found in profile');
          }
        } catch (e) {
          console.warn('[CENTER-PROFILE] Failed to fetch vendor profile for roleId:', e);
        }
      } else {
        // If roleId is already available, still fetch vendor profile for availableForInstantTele
        try {
          vendorProfileData = await apiClient.get('/vendor/profile') as any;
        } catch (e) {
          console.warn('[CENTER-PROFILE] Failed to fetch vendor profile:', e);
        }
      }

      // ✅ Load availableForInstantTele and coordinates from vendor profile
      if (vendorProfileData?.vendor) {
        const instantTeleValue = vendorProfileData.vendor.availableForInstantTele ?? 
                                 vendorProfileData.vendor.available_for_instant_tele ?? 
                                 false;
        setAvailableForInstantTele(instantTeleValue);
        console.log('[CENTER-PROFILE] Loaded availableForInstantTele:', instantTeleValue);
        
        // Load latitude/longitude from vendor profile if available
        if (vendorProfileData.vendor.latitude != null || vendorProfileData.vendor.longitude != null) {
          setProfile(prev => ({
            ...prev,
            latitude: vendorProfileData.vendor.latitude ?? prev.latitude,
            longitude: vendorProfileData.vendor.longitude ?? prev.longitude,
          }));
        }
      }
      
      // ✅ FIX: Load facility data using correct endpoint
      const facilityData = await apiClient.get(`/vendor/${vendorId}/facility`) as any;
      
      console.log(`[CENTER-PROFILE] Facility data response:`, {
        success: facilityData?.success,
        hasFacility: !!facilityData?.facility,
        photosCount: facilityData?.facility?.photos?.length || 0,
        rawPhotos: facilityData?.facility?.photos
      });

      if (facilityData && facilityData.success && facilityData.facility) {
        const loadedPhotos = facilityData.facility.photos || [];
        console.log(`[CENTER-PROFILE] Loaded ${loadedPhotos.length} photos from facility data:`, loadedPhotos);
        
        setProfile(prev => ({
          ...prev,
          centerName: facilityData.facility.centerName || prev.centerName,
          description: facilityData.facility.description || prev.description || '',
          address: facilityData.facility.address || prev.address,
          city: facilityData.facility.city || prev.city,
          state: facilityData.facility.state || prev.state,
          pincode: (facilityData.facility.pincode && facilityData.facility.pincode !== '000000') ? facilityData.facility.pincode : ((prev.pincode && prev.pincode !== '000000') ? prev.pincode : ''),
          latitude: facilityData.vendor?.latitude ?? prev.latitude,
          longitude: facilityData.vendor?.longitude ?? prev.longitude,
          amenities: facilityData.facility.amenities || [],
          customAmenities: facilityData.facility.customAmenities || [],
          photos: loadedPhotos,
          specializations: facilityData.facility.specializations || [],
          operatingHours: facilityData.facility.operatingHours || prev.operatingHours
        }));
        
        // ✅ FIX: Try to get roleId from facility data if still not available
        if (!roleId && facilityData.facility.roleId) {
          console.log('[CENTER-PROFILE] Got roleId from facility data:', facilityData.facility.roleId);
          setRoleId(facilityData.facility.roleId);
        }
        if (!roleId && facilityData.vendor?.roleId) {
          console.log('[CENTER-PROFILE] Got roleId from facility vendor:', facilityData.vendor.roleId);
          setRoleId(facilityData.vendor.roleId);
        }
        if (!roleId && facilityData.vendor?.role_id) {
          console.log('[CENTER-PROFILE] Got role_id from facility vendor:', facilityData.vendor.role_id);
          setRoleId(facilityData.vendor.role_id);
        }
      }

      // ✅ FIX: Load operating hours from facility data (already loaded above)
      // Extract operatingHours from facility data if available
      if (facilityData && facilityData.facility && facilityData.facility.operatingHours) {
        const opsHours = facilityData.facility.operatingHours;
        // If operatingHours is already in the correct format, use it
        if (typeof opsHours === 'object' && !Array.isArray(opsHours)) {
          setProfile(prev => ({
            ...prev,
            operatingHours: opsHours
          }));
        }
      }

      // Also try loading from availability endpoint as fallback
      try {
        const availabilityData = await apiClient.get(`/vendor/${vendorId}/availability`) as any;
        if (availabilityData && availabilityData.availability) {
          setProfile(prev => ({
            ...prev,
            operatingHours: availabilityData.availability.operatingHours || prev.operatingHours,
            emergencyServices: availabilityData.availability.emergencyServices || prev.emergencyServices
          }));
        }
      } catch (error) {
        console.warn('Failed to load center availability (non-critical):', error);
        // Non-critical - operating hours may be in facility data
      }
    } catch (error) {
      console.error('Error loading center profile:', error);
      toast.error('Failed to load center profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // ✅ FIX: Add validation
    if (!profile.centerName.trim()) {
      toast.error('Center name is required');
      return;
    }
    if (!profile.address.trim()) {
      toast.error('Address is required');
      return;
    }

    try {
      setSaving(true);
      console.log('💾 Saving center profile for vendor:', vendorId);
      
      // 1. Upload new photos if any
      let uploadedPhotoUrls: string[] = [];
      if (newPhotos.length > 0) {
        setUploading(true);
        try {
          const formData = new FormData();
          newPhotos.forEach(photo => formData.append('photos', photo));

          // Upload photos using apiClient
          const uploadData = await apiClient.post(`/vendor/facility/${vendorId}/upload-photos`, formData) as any;
          if (uploadData && uploadData.success) {
            uploadedPhotoUrls = uploadData.photoUrls || [];
            console.log('✅ Photos uploaded:', uploadedPhotoUrls.length);
          } else {
            console.warn('⚠️ Photo upload returned no success, continuing without photos');
          }
        } catch (photoError) {
          console.error('⚠️ Photo upload failed, continuing without photos:', photoError);
          // Continue without photos - not critical
        } finally {
          setUploading(false);
        }
      }

      const allPhotos = [...profile.photos, ...uploadedPhotoUrls];

      // 2. Save facility data - ✅ FIX: Include centerName, operatingHours (both text and JSON), and better error handling
      const facilityData = {
        centerName: profile.centerName.trim(),
        description: profile.description.trim(),
        address: profile.address.trim(),
        city: profile.city.trim(),
        state: profile.state.trim(),
        pincode: profile.pincode.trim(),
        operatingHours: profile.operatingHours, // ✅ FIX: Save as JSON object for availability checks
        operatingHoursText: generateOperatingHoursText(profile.operatingHours), // Keep text version for display
        amenities: profile.amenities,
        customAmenities: profile.customAmenities,
        photos: allPhotos,
        specializations: profile.specializations,
        emergencyServices: profile.emergencyServices // ✅ FIX: Include emergency services in facility data
      };

      console.log('📤 Saving facility data:', facilityData);
      const facilityRes = await apiClient.put(`/vendor/facility/${vendorId}`, facilityData) as any;
      
      if (facilityRes && facilityRes.error) {
        throw new Error(facilityRes.error || 'Failed to save facility data');
      }
      console.log('✅ Facility data saved with operating hours');

      // 3. Save center availability (detailed timings) - ✅ FIX: Use correct endpoint name
      // This is redundant now since we save operating hours in facility data, but keep for backwards compatibility
      try {
        const availabilityRes = await apiClient.put(`/vendor/${vendorId}/availability`, {
          operatingHours: profile.operatingHours,
          emergencyServices: profile.emergencyServices
        }) as any;

        if (availabilityRes && availabilityRes.error) {
          console.warn('⚠️ Availability save (redundant) failed:', availabilityRes.error);
          // Non-critical, continue - we already saved in facility data
        } else {
          console.log('✅ Availability settings saved (redundant)');
        }
      } catch (availError) {
        console.warn('⚠️ Availability save (redundant) failed - continuing:', availError);
        // Continue - we already saved in facility data above
      }

      // 4. Save address coordinates, business name, and availableForInstantTele to vendor profile
      try {
        const vendorProfileUpdate: any = {
          availableForInstantTele: availableForInstantTele,
          businessName: profile.centerName.trim() // ✅ FIX: Update business_name when centerName changes
        };
        
        // Include latitude/longitude if they exist in profile state
        if (profile.latitude != null) {
          vendorProfileUpdate.latitude = profile.latitude;
        }
        if (profile.longitude != null) {
          vendorProfileUpdate.longitude = profile.longitude;
        }
        
        const vendorProfileRes = await apiClient.put(`/vendor/${vendorId}/profile`, vendorProfileUpdate) as any;

        if (vendorProfileRes && vendorProfileRes.error) {
          console.warn('⚠️ Failed to save vendor profile updates:', vendorProfileRes.error);
          // Non-critical, but log it
        } else {
          console.log('✅ Vendor profile updated:', { 
            businessName: profile.centerName.trim(),
            availableForInstantTele, 
            hasLatitude: profile.latitude != null,
            hasLongitude: profile.longitude != null
          });
        }
      } catch (vendorProfileError) {
        console.warn('⚠️ Failed to save vendor profile updates - continuing:', vendorProfileError);
        // Continue - not critical for facility save
      }

      toast.success('✅ Center profile saved successfully!');
      setNewPhotos([]);
      
      // Reload profile to get updated data
      await loadCenterProfile();
    } catch (error: any) {
      console.error('❌ Error saving center profile:', error);
      const errorMessage = error.message || error.error || 'Failed to save center profile. Please check all required fields.';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const generateOperatingHoursText = (hours: any): string => {
    const openDays = DAYS.filter(day => hours[day]?.isOpen);
    if (openDays.length === 0) return 'Closed';
    
    const firstDay = hours[openDays[0]];
    const allSame = openDays.every(day => 
      hours[day].open === firstDay.open && hours[day].close === firstDay.close
    );

    if (allSame && openDays.length === 7) {
      return `Open Daily: ${firstDay.open} - ${firstDay.close}`;
    } else if (allSame && openDays.length === 6 && !hours.sunday?.isOpen) {
      return `Mon-Sat: ${firstDay.open} - ${firstDay.close}`;
    } else {
      return openDays.map(day => {
        const h = hours[day];
        return `${day.charAt(0).toUpperCase() + day.slice(1,3)}: ${h.open}-${h.close}`;
      }).join(', ');
    }
  };

  const toggleAmenity = (amenityId: string) => {
    setProfile(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenityId)
        ? prev.amenities.filter(a => a !== amenityId)
        : [...prev.amenities, amenityId]
    }));
  };

  const addCustomAmenity = () => {
    if (customAmenityInput.trim()) {
      setProfile(prev => ({
        ...prev,
        customAmenities: [...prev.customAmenities, customAmenityInput.trim()]
      }));
      setCustomAmenityInput('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`);
        return false;
      }
      return true;
    });

    const totalPhotos = newPhotos.length + profile.photos.length + validFiles.length;
    if (totalPhotos > MAX_PHOTOS) {
      toast.error(`Maximum ${MAX_PHOTOS} photos allowed`);
      return;
    }

    setNewPhotos(prev => [...prev, ...validFiles]);
  };

  const removeExistingPhoto = (index: number) => {
    setProfile(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const removeNewPhoto = (index: number) => {
    setNewPhotos(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-full max-w-[430px] mx-auto bg-white py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading center profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header - Mobile optimized */}
        <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF7A2E] text-white sticky top-0 z-10">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-1.5 hover:bg-white/20 rounded-lg -ml-1">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-lg truncate">Profile & Availability</h1>
                <p className="text-xs text-white/80 truncate">{profile.centerName}</p>
              </div>
              <Button
                onClick={handleSave}
                disabled={saving || uploading}
                size="sm"
                className="bg-white text-[#FF8C42] hover:bg-white/90 text-xs"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation - Mobile scrollable */}
        <div className="bg-white border-b overflow-x-auto">
          <div className="flex min-w-max px-2">
            {[
              { id: 'basic', label: 'Basic', icon: Building2 },
              { id: 'availability', label: 'Availability', icon: Clock },
              // ✅ FIX: Show Amenities and Specialty for center roles; hide only for non-center solo
              ...(showAmenitiesAndSpecialtyTabs ? [
                { id: 'amenities', label: 'Amenities', icon: Sparkles },
                { id: 'specialization', label: 'Specialty', icon: Check }
              ] : [])
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium text-xs transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-[#FF8C42] text-[#FF8C42]'
                      : 'border-transparent text-gray-500'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4">
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-bold text-gray-900 mb-4">Basic Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Center Name
                  </label>
                  <Input
                    value={profile.centerName}
                    onChange={(e) => setProfile(prev => ({ ...prev, centerName: e.target.value }))}
                    placeholder="Enter center name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <Textarea
                    value={profile.description}
                    onChange={(e) => setProfile(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your center, services, and expertise"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <EnhancedAddressAutocomplete
                    value={profile.address || ''}
                    onChange={(address: string, components?: AddressComponents) => {
                      // Update address + city, state, pincode, and coordinates from Places
                      setProfile(prev => ({
                        ...prev,
                        address,
                        ...(components?.city != null && { city: components.city }),
                        ...(components?.state != null && { state: components.state }),
                        ...(components?.pincode != null && { pincode: components.pincode }),
                        // Extract latitude and longitude from coordinates
                        ...(components?.coordinates?.lat != null && { latitude: components.coordinates.lat }),
                        ...(components?.coordinates?.lng != null && { longitude: components.coordinates.lng }),
                        // Support direct lat/lng for backward compatibility
                        ...(components?.lat != null && !components?.coordinates?.lat && { latitude: components.lat }),
                        ...(components?.lng != null && !components?.coordinates?.lng && { longitude: components.lng }),
                      }));
                    }}
                    placeholder="Search address, landmark, city..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <Input
                      value={profile.city}
                      onChange={(e) => setProfile(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <Input
                      value={profile.state}
                      onChange={(e) => setProfile(prev => ({ ...prev, state: e.target.value }))}
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PIN Code</label>
                    <Input
                      value={profile.pincode}
                      onChange={(e) => setProfile(prev => ({ ...prev, pincode: e.target.value }))}
                      placeholder="PIN"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Photos */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-bold text-gray-900 mb-4">Center Photos</h2>
              
              {profile.photos.length === 0 && newPhotos.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm mb-4">
                  No photos uploaded yet. Upload photos to showcase your center.
                </div>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                {profile.photos.map((photo, idx) => (
                  <div key={idx} className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                    <img 
                      src={photo} 
                      alt={`Photo ${idx + 1}`} 
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={async (e) => {
                        const target = e.target as HTMLImageElement;
                        const originalSrc = photo;
                        
                        console.error(`[CENTER-PHOTOS] Image failed to load for photo ${idx + 1}:`, {
                          src: originalSrc?.substring(0, 100),
                          error: e,
                          naturalWidth: target.naturalWidth,
                          naturalHeight: target.naturalHeight,
                          complete: target.complete
                        });
                        
                        // Check if this is a retry (to avoid infinite loops)
                        const retryCount = parseInt(target.getAttribute('data-retry-count') || '0');
                        if (retryCount >= 2) {
                          console.warn(`[CENTER-PHOTOS] Max retries reached for photo ${idx + 1}, showing error`);
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.photo-error-message')) {
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'photo-error-message w-full h-full flex items-center justify-center text-xs text-gray-400';
                            errorDiv.textContent = 'Failed to load';
                            parent.appendChild(errorDiv);
                          }
                          return;
                        }
                        
                        // Try to refresh the presigned URL by reloading facility data
                        try {
                          console.log(`[CENTER-PHOTOS] Attempting to refresh presigned URL for photo ${idx + 1} (retry ${retryCount + 1})`);
                          const facilityData = await apiClient.get(`/vendor/${vendorId}/facility`) as any;
                          
                          if (facilityData && facilityData.success && facilityData.facility && facilityData.facility.photos) {
                            const refreshedPhotos = facilityData.facility.photos;
                            if (refreshedPhotos[idx] && refreshedPhotos[idx] !== originalSrc) {
                              console.log(`[CENTER-PHOTOS] Got fresh URL for photo ${idx + 1}, retrying...`);
                              // Update the photo in state
                              setProfile(prev => {
                                const updatedPhotos = [...prev.photos];
                                updatedPhotos[idx] = refreshedPhotos[idx];
                                return { ...prev, photos: updatedPhotos };
                              });
                              // Retry with new URL
                              target.setAttribute('data-retry-count', String(retryCount + 1));
                              target.src = refreshedPhotos[idx];
                              return;
                            } else if (refreshedPhotos[idx] === originalSrc) {
                              console.warn(`[CENTER-PHOTOS] Refreshed URL is same as original for photo ${idx + 1}`);
                            }
                          }
                        } catch (refreshError) {
                          console.error(`[CENTER-PHOTOS] Failed to refresh presigned URL for photo ${idx + 1}:`, refreshError);
                        }
                        
                        // If refresh failed or no new URL, show error message
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.photo-error-message')) {
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'photo-error-message w-full h-full flex items-center justify-center text-xs text-gray-400';
                          errorDiv.textContent = 'Failed to load';
                          parent.appendChild(errorDiv);
                        }
                      }}
                      onLoad={(e) => {
                        // Remove any error messages on successful load
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) {
                          const errorMsg = parent.querySelector('.photo-error-message');
                          if (errorMsg) {
                            errorMsg.remove();
                          }
                        }
                      }}
                    />
                    <button
                      onClick={() => removeExistingPhoto(idx)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 z-10"
                    >
                      ×
                    </button>
                  </div>
                ))}
                
                {newPhotos.map((photo, idx) => (
                  <div key={`new-${idx}`} className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                    <img src={URL.createObjectURL(photo)} alt={`New ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeNewPhoto(idx)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                    <Badge className="absolute bottom-2 left-2 bg-blue-500">New</Badge>
                  </div>
                ))}
              </div>

              {(profile.photos.length + newPhotos.length) < MAX_PHOTOS && (
                <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg hover:bg-gray-50 cursor-pointer">
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Add Photos ({profile.photos.length + newPhotos.length}/{MAX_PHOTOS})</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Instant Tele Availability Toggle */}
            <div className="bg-white rounded-2xl border shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-gray-900">Instant Tele Consultation</h2>
                  <p className="text-sm text-gray-500">Enable instant tele consultation availability</p>
                </div>
              </div>
              <div className={`p-4 rounded-xl border-2 transition-all ${availableForInstantTele ? 'border-blue-200 bg-blue-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <button 
                    type="button" 
                    onClick={() => setAvailableForInstantTele(!availableForInstantTele)} 
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      availableForInstantTele 
                        ? 'bg-blue-500 border-blue-500' 
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    {availableForInstantTele && <Check className="w-4 h-4 text-white" />}
                  </button>
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">Available for Instant Tele</span>
                    <p className="text-xs text-gray-500">
                      {availableForInstantTele 
                        ? 'Customers can book instant tele consultations with you' 
                        : 'Instant tele consultations are disabled'}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Emergency Services - for vet centers */}
            {(vendorData?.roleId?.includes('vet') || vendorData?.roleId?.includes('clinic')) && (
              <div className="bg-white rounded-2xl border shadow-sm p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">Emergency Services</h2>
                    <p className="text-sm text-gray-500">Configure 24/7 availability options</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border-2 transition-all ${profile.emergencyServices.ambulance ? 'border-red-200 bg-red-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <button type="button" onClick={() => setProfile(prev => ({ ...prev, emergencyServices: { ...prev.emergencyServices, ambulance: !prev.emergencyServices.ambulance } }))} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${profile.emergencyServices.ambulance ? 'bg-red-500 border-red-500' : 'bg-white border-gray-300'}`}>{profile.emergencyServices.ambulance && <Check className="w-4 h-4 text-white" />}</button>
                      <div className="flex-1"><span className="font-medium text-gray-900">Ambulance Service</span><p className="text-xs text-gray-500">Provide pet ambulance pickup</p></div>
                    </label>
                    {profile.emergencyServices.ambulance && (
                      <div className="mt-3 ml-9 p-3 bg-red-100/50 rounded-lg">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={profile.emergencyServices.ambulanceAvailable247} onChange={(e) => setProfile(prev => ({ ...prev, emergencyServices: { ...prev.emergencyServices, ambulanceAvailable247: e.target.checked } }))} className="w-4 h-4 rounded border-red-300 text-red-500" />
                          <span className="text-sm font-medium text-red-800">Available 24/7</span>
                        </label>
                      </div>
                    )}
                  </div>
                  <div className={`p-4 rounded-xl border-2 transition-all ${profile.emergencyServices.consultationAvailable247 ? 'border-orange-200 bg-orange-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <button type="button" onClick={() => setProfile(prev => ({ ...prev, emergencyServices: { ...prev.emergencyServices, consultationAvailable247: !prev.emergencyServices.consultationAvailable247 } }))} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${profile.emergencyServices.consultationAvailable247 ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'}`}>{profile.emergencyServices.consultationAvailable247 && <Check className="w-4 h-4 text-white" />}</button>
                      <div className="flex-1"><span className="font-medium text-gray-900">24/7 Emergency Consultation</span><p className="text-xs text-gray-500">Accept emergency consultations anytime</p></div>
                    </label>
                  </div>
                  <div className={`p-4 rounded-xl border-2 transition-all ${profile.emergencyServices.diagnosticsAvailable247 ? 'border-purple-200 bg-purple-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <button type="button" onClick={() => setProfile(prev => ({ ...prev, emergencyServices: { ...prev.emergencyServices, diagnosticsAvailable247: !prev.emergencyServices.diagnosticsAvailable247 } }))} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${profile.emergencyServices.diagnosticsAvailable247 ? 'bg-purple-500 border-purple-500' : 'bg-white border-gray-300'}`}>{profile.emergencyServices.diagnosticsAvailable247 && <Check className="w-4 h-4 text-white" />}</button>
                      <div className="flex-1"><span className="font-medium text-gray-900">24/7 Diagnostics</span><p className="text-xs text-gray-500">Lab and diagnostic tests available round the clock</p></div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Availability Tab - Advanced Scheduling only (multiple slots, service styles) */}
        {activeTab === 'availability' && (
          <AdvancedAvailabilityManager
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setActiveTab('basic')}
          />
        )}

        {/* Amenities Tab - Shown for center roles and non-solo vendors */}
        {showAmenitiesAndSpecialtyTabs && activeTab === 'amenities' && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-bold text-gray-900 mb-4">Amenities & Facilities</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {availableAmenities.map(amenity => (
                <label
                  key={amenity.id}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    profile.amenities.includes(amenity.id)
                      ? 'border-[#FF8C42] bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={profile.amenities.includes(amenity.id)}
                    onChange={() => toggleAmenity(amenity.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{amenity.name}</span>
                </label>
              ))}
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-3">Custom Amenities</h3>
              <div className="flex gap-2 mb-3">
                <Input
                  value={customAmenityInput}
                  onChange={(e) => setCustomAmenityInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCustomAmenity()}
                  placeholder="Add custom amenity"
                />
                <Button onClick={addCustomAmenity}>Add</Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {profile.customAmenities.map((amenity, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-2">
                    {amenity}
                    <button
                      onClick={() => setProfile(prev => ({
                        ...prev,
                        customAmenities: prev.customAmenities.filter((_, i) => i !== idx)
                      }))}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Specialization Tab - Shown for center roles and non-solo vendors */}
        {showAmenitiesAndSpecialtyTabs && activeTab === 'specialization' && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-bold text-gray-900 mb-4">Center Specializations</h2>
            <p className="text-sm text-gray-600 mb-6">
              Select the health problems and conditions your center specializes in treating
            </p>
            
            <SpecializationSelector
              selected={profile.specializations}
              onChange={(specs) => setProfile(prev => ({ ...prev, specializations: specs }))}
              roleId={roleId}
            />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

// ✅ Backward compatibility alias - will be deprecated in future
export const CenterProfileManager = ProfileManager;