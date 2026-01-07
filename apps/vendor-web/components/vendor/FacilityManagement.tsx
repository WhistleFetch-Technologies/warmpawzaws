'use client';

import { useState, useEffect } from 'react';
import { 
  Building2, Upload, X, Check, MapPin, Clock, Save, ArrowLeft, Plus, Image as ImageIcon, Trash2
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface FacilityManagementProps {
  vendorId: string;
  vendorData: any;
  onBack?: () => void;
}

interface FacilityData {
  description: string;
  address: string;
  operatingHours: string;
  amenities: string[];
  customAmenities: string[];
  photos: string[];
  specializations?: string[];
  location?: { lat: number; lng: number };
  city?: string;
  state?: string;
  pincode?: string;
}

export function FacilityManagement({ vendorId, vendorData, onBack }: FacilityManagementProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [facility, setFacility] = useState<FacilityData>({
    description: '',
    address: vendorData?.address || '',
    operatingHours: 'Mon-Fri: 9AM-6PM',
    amenities: [],
    customAmenities: [],
    photos: []
  });
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [customAmenityInput, setCustomAmenityInput] = useState('');
  const MAX_PHOTOS = 10;

  useEffect(() => {
    loadFacilityData();
  }, [vendorId]);

  const loadFacilityData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/facility`);
      if (response.success && response.facility) {
        setFacility({
          description: response.facility.description || '',
          address: response.facility.address || '',
          operatingHours: response.facility.operatingHours || 'Mon-Fri: 9AM-6PM',
          amenities: response.facility.amenities || [],
          customAmenities: response.facility.customAmenities || [],
          photos: response.facility.photos || [],
          specializations: response.facility.specializations || []
        });
      }
    } catch (error) {
      console.error('Error loading facility data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.put(`/vendor/${vendorId}/facility`, facility);
      alert('✅ Facility details saved successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to save facility details');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    if (facility.photos.length + newPhotos.length + files.length > MAX_PHOTOS) {
      alert(`Maximum ${MAX_PHOTOS} photos allowed`);
      return;
    }

    try {
      setUploading(true);
      const fileArray = Array.from(files);
      setNewPhotos(prev => [...prev, ...fileArray]);
    } catch (error) {
      console.error('Error uploading photos:', error);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number, isNew: boolean) => {
    if (isNew) {
      setNewPhotos(prev => prev.filter((_, i) => i !== index));
    } else {
      setFacility(prev => ({
        ...prev,
        photos: prev.photos.filter((_, i) => i !== index)
      }));
    }
  };

  const toggleAmenity = (amenityId: string) => {
    setFacility(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenityId)
        ? prev.amenities.filter(id => id !== amenityId)
        : [...prev.amenities, amenityId]
    }));
  };

  const addCustomAmenity = () => {
    if (customAmenityInput.trim()) {
      setFacility(prev => ({
        ...prev,
        customAmenities: [...prev.customAmenities, customAmenityInput.trim()]
      }));
      setCustomAmenityInput('');
    }
  };

  const removeCustomAmenity = (index: number) => {
    setFacility(prev => ({
      ...prev,
      customAmenities: prev.customAmenities.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b sticky top-0 z-10 p-4">
        <div className="flex items-center gap-0 mb-4">
          {onBack && (
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}
          <h1 className="font-semibold text-gray-900">Facility Management</h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">Description</label>
          <textarea
            value={facility.description}
            onChange={(e) => setFacility(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe your facility..."
            rows={4}
            className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">Address</label>
          <input
            type="text"
            value={facility.address}
            onChange={(e) => setFacility(prev => ({ ...prev, address: e.target.value }))}
            placeholder="Enter facility address"
            className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">Operating Hours</label>
          <input
            type="text"
            value={facility.operatingHours}
            onChange={(e) => setFacility(prev => ({ ...prev, operatingHours: e.target.value }))}
            placeholder="e.g., Mon-Fri: 9AM-6PM"
            className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">Photos</label>
          <div className="grid grid-cols-3 gap-0 mb-0">
            {facility.photos.map((photo, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(index, false)}
                  className="absolute top-0 right-1 p-0 bg-red-500 text-white rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {newPhotos.map((photo, index) => (
              <div key={`new-${index}`} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                <img src={URL.createObjectURL(photo)} alt={`New photo ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(index, true)}
                  className="absolute top-0 right-1 p-0 bg-red-500 text-white rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {facility.photos.length + newPhotos.length < MAX_PHOTOS && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-primary">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handlePhotoUpload(e.target.files)}
                  className="hidden"
                />
                <Upload className="w-6 h-6 text-gray-400" />
              </label>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">Amenities</label>
          <div className="space-y-2">
            {['WiFi', 'Parking', 'AC', 'Wheelchair Access', 'Pet Play Area'].map(amenity => (
              <button
                key={amenity}
                onClick={() => toggleAmenity(amenity)}
                className={`w-full px-4 py-0 rounded-lg border-2 text-left transition-colors ${
                  facility.amenities.includes(amenity)
                    ? 'border-primary bg-orange-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{amenity}</span>
                  {facility.amenities.includes(amenity) && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">Custom Amenities</label>
          <div className="flex gap-0 mb-0">
            <input
              type="text"
              value={customAmenityInput}
              onChange={(e) => setCustomAmenityInput(e.target.value)}
              placeholder="Add custom amenity"
              className="flex-1 px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyPress={(e) => e.key === 'Enter' && addCustomAmenity()}
            />
            <button
              onClick={addCustomAmenity}
              className="px-4 py-0 bg-primary text-white rounded-lg"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-0">
            {facility.customAmenities.map((amenity, index) => (
              <span
                key={index}
                className="px-0 py-0 bg-orange-100 text-orange-700 rounded-full text-sm flex items-center gap-0"
              >
                {amenity}
                <button onClick={() => removeCustomAmenity(index)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="w-full px-4 py-0 bg-primary text-white rounded-lg font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Facility Details'}
        </button>
      </div>
    </div>
  );
}

