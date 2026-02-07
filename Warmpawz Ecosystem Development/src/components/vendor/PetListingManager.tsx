import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit, Trash2, Save, Upload, Heart, DollarSign } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

interface PetListingManagerProps {
  vendorId: string;
  vendorName: string;
  vendorType: 'breeder' | 'ngo' | 'other';
  onBack: () => void;
}

const BREEDS = ['Golden Retriever', 'Labrador', 'German Shepherd', 'Indie', 'Persian Cat', 'Beagle', 'Pug', 'Shih Tzu', 'Other'];
const BEHAVIORS = ['Friendly', 'Playful', 'Calm', 'Energetic', 'Protective', 'Shy', 'Curious'];

export function PetListingManager({ vendorId, vendorName, vendorType, onBack }: PetListingManagerProps) {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingListing, setEditingListing] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  const isBreeder = vendorType === 'breeder';
  const isNGO = vendorType === 'ngo';

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    breed: '',
    age: '',
    gender: 'male',
    color: '',
    vaccinationStatus: 'complete',
    behavior: [] as string[],
    price: '',
    adoptionFee: '',
    isFreeAdoption: false,
    photos: [] as string[],
    videos: [] as string[],
    lineage: { sire: '', dam: '', pedigree: false },
    rescueStory: '',
    whatToExpect: '',
    description: ''
  });

  useEffect(() => {
    loadListings();
  }, [vendorId]);

  const loadListings = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/pet-listings`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setListings(data.listings || []);
      }
    } catch (error) {
      toast.error('Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.breed || !formData.age || !formData.gender) {
      toast.error('Please fill required fields');
      return;
    }

    if (formData.photos.length === 0) {
      toast.error('At least one photo is required');
      return;
    }

    if (formData.videos.length === 0) {
      toast.error('At least one video is required');
      return;
    }

    if (isBreeder && !formData.price) {
      toast.error('Price is required for breeders');
      return;
    }

    try {
      const endpoint = editingListing
        ? `${getApiBaseUrl()}/vendor/${vendorId}/pet-listings/${editingListing.id}`
        : `${getApiBaseUrl()}/vendor/${vendorId}/pet-listings`;

      const response = await fetch(endpoint, {
        method: editingListing ? 'PUT' : 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(editingListing ? 'Listing updated' : 'Listing created');
        setShowAddModal(false);
        setEditingListing(null);
        resetForm();
        loadListings();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Operation failed');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (file.size > 52428800) {
      toast.error('File size must be less than 50MB');
      return;
    }

    try {
      setUploading(true);

      const formDataPayload = new FormData();
      formDataPayload.append('file', file);
      if (editingListing) {
        formDataPayload.append('listingId', editingListing.id);
      }

      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/pet-listings/media/upload`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formDataPayload
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        if (data.type === 'photo') {
          setFormData({ ...formData, photos: [...formData.photos, data.filePath] });
        } else {
          setFormData({ ...formData, videos: [...formData.videos, data.filePath] });
        }

        toast.success('File uploaded successfully');
      } else {
        toast.error('Upload failed');
      }
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (listingId: string) => {
    if (!confirm('Delete this listing? This will remove all photos and videos.')) return;

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/pet-listings/${listingId}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        toast.success('Listing deleted');
        loadListings();
      } else {
        toast.error('Failed to delete');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      breed: '',
      age: '',
      gender: 'male',
      color: '',
      vaccinationStatus: 'complete',
      behavior: [],
      price: '',
      adoptionFee: '',
      isFreeAdoption: false,
      photos: [],
      videos: [],
      lineage: { sire: '', dam: '', pedigree: false },
      rescueStory: '',
      whatToExpect: '',
      description: ''
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-bold text-gray-900">
                {isBreeder ? 'Pet Listings' : 'Adoption Listings'}
              </h1>
              <p className="text-sm text-gray-600">{vendorName}</p>
            </div>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isBreeder ? 'Add Pet' : 'Add for Adoption'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {listings.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="font-bold text-gray-900 mb-2">No Listings Yet</h3>
            <p className="text-gray-600 mb-6">
              {isBreeder ? 'Start listing your puppies' : 'Start listing pets for adoption'}
            </p>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Listing
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="bg-white rounded-xl border hover:shadow-lg transition-shadow overflow-hidden"
              >
                {listing.photoUrls?.[0] && (
                  <img
                    src={listing.photoUrls[0]}
                    alt={listing.breed}
                    className="w-full h-48 object-cover"
                  />
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900">{listing.breed}</h3>
                      <p className="text-sm text-gray-600">
                        {listing.age} • {listing.gender}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      listing.status === 'available'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {listing.status}
                    </span>
                  </div>

                  {/* Behavior Tags */}
                  {listing.behavior?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {listing.behavior.slice(0, 3).map((b: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {b}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Pricing */}
                  <div className="mb-3">
                    {isBreeder ? (
                      <p className="font-bold text-green-600">₹{listing.price}</p>
                    ) : (
                      <p className="font-bold text-purple-600">
                        {listing.isFreeAdoption ? 'Free Adoption' : `₹${listing.adoptionFee} Fee`}
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    <span>{listing.views || 0} views</span>
                    <span>{listing.inquiries || 0} inquiries</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t">
                    <button
                      onClick={() => {
                        setEditingListing(listing);
                        setFormData({
                          name: listing.name || '',
                          breed: listing.breed,
                          age: listing.age,
                          gender: listing.gender,
                          color: listing.color || '',
                          vaccinationStatus: listing.vaccinationStatus,
                          behavior: listing.behavior || [],
                          price: listing.price?.toString() || '',
                          adoptionFee: listing.adoptionFee?.toString() || '',
                          isFreeAdoption: listing.isFreeAdoption || false,
                          photos: listing.photos || [],
                          videos: listing.videos || [],
                          lineage: listing.lineage || { sire: '', dam: '', pedigree: false },
                          rescueStory: listing.rescueStory || '',
                          whatToExpect: listing.whatToExpect || '',
                          description: listing.description || ''
                        });
                        setShowAddModal(true);
                      }}
                      className="flex-1 py-2 border rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(listing.id)}
                      className="p-2 border border-red-200 rounded-lg hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={() => { setShowAddModal(false); setEditingListing(null); resetForm(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingListing ? 'Edit Listing' : 'Add New Listing'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Breed *</label>
                <select
                  value={formData.breed}
                  onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Select breed</option>
                  {BREEDS.map(breed => <option key={breed} value={breed}>{breed}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Age *</label>
                <input
                  type="text"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., 2 months, 1 year"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Gender *</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Vaccination Status</label>
                <select
                  value={formData.vaccinationStatus}
                  onChange={(e) => setFormData({ ...formData, vaccinationStatus: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="complete">Complete</option>
                  <option value="partial">Partial</option>
                  <option value="none">None</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
            </div>

            {/* Behavior */}
            <div>
              <label className="block text-sm font-medium mb-2">Behavior</label>
              <div className="flex flex-wrap gap-2">
                {BEHAVIORS.map(behavior => (
                  <label key={behavior} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.behavior.includes(behavior)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, behavior: [...formData.behavior, behavior] });
                        } else {
                          setFormData({ ...formData, behavior: formData.behavior.filter(b => b !== behavior) });
                        }
                      }}
                    />
                    <span className="text-sm">{behavior}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Pricing */}
            {isBreeder && (
              <div>
                <label className="block text-sm font-medium mb-2">Price (₹) *</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="30000"
                />
              </div>
            )}

            {isNGO && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Adoption Fee (₹)</label>
                  <input
                    type="number"
                    value={formData.adoptionFee}
                    onChange={(e) => setFormData({ ...formData, adoptionFee: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    disabled={formData.isFreeAdoption}
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isFreeAdoption}
                      onChange={(e) => setFormData({ ...formData, isFreeAdoption: e.target.checked })}
                    />
                    <span className="text-sm">Free Adoption</span>
                  </label>
                </div>
              </div>
            )}

            {/* Lineage (Breeder only) */}
            {isBreeder && (
              <div>
                <label className="block text-sm font-medium mb-2">Lineage</label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={formData.lineage.sire}
                    onChange={(e) => setFormData({ ...formData, lineage: { ...formData.lineage, sire: e.target.value } })}
                    className="px-4 py-2 border rounded-lg"
                    placeholder="Sire (Father)"
                  />
                  <input
                    type="text"
                    value={formData.lineage.dam}
                    onChange={(e) => setFormData({ ...formData, lineage: { ...formData.lineage, dam: e.target.value } })}
                    className="px-4 py-2 border rounded-lg"
                    placeholder="Dam (Mother)"
                  />
                </div>
              </div>
            )}

            {/* What to Expect */}
            <div>
              <label className="block text-sm font-medium mb-2">What to Expect</label>
              <textarea
                value={formData.whatToExpect}
                onChange={(e) => setFormData({ ...formData, whatToExpect: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg resize-none"
                rows={3}
                placeholder="Expected temperament, care requirements, etc."
              />
            </div>

            {/* Media Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">Photos & Videos * (mandatory)</label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                  id="pet-media-upload"
                  disabled={uploading}
                />
                <label htmlFor="pet-media-upload" className="cursor-pointer flex flex-col items-center">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    {uploading ? 'Uploading...' : 'Click to upload'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Photos and videos required</p>
                </label>

                {(formData.photos.length > 0 || formData.videos.length > 0) && (
                  <div className="mt-4 flex items-center justify-center gap-4 text-sm">
                    <span className="text-blue-600">{formData.photos.length} photos</span>
                    <span className="text-purple-600">{formData.videos.length} videos</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button onClick={() => { setShowAddModal(false); setEditingListing(null); resetForm(); }} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white" disabled={uploading}>
                <Save className="w-4 h-4 mr-2" />
                {editingListing ? 'Update' : 'Create'} Listing
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
