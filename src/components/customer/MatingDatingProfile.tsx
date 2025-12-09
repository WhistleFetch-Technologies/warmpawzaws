import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { 
  ChevronLeft, Upload, X, Check, Heart, User, MapPin,
  Calendar, Shield, Info
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface MatingDatingProfileProps {
  phone: string;
  mode: 'pet' | 'owner';
  onBack: () => void;
  onComplete: () => void;
}

const TEMPERAMENTS = ['Friendly', 'Playful', 'Calm', 'Energetic', 'Shy', 'Protective', 'Social'];
const INTERESTS = ['Walking', 'Playing', 'Traveling', 'Photography', 'Training', 'Cafes', 'Parks'];

export function MatingDatingProfile({ phone, mode, onBack, onComplete }: MatingDatingProfileProps) {
  const [loading, setLoading] = useState(false);
  const [existingProfile, setExistingProfile] = useState<any>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>('');

  // Pet Profile Form
  const [petForm, setPetForm] = useState({
    name: '',
    breed: '',
    age: '',
    gender: 'male',
    photos: [] as string[],
    temperament: 'Friendly',
    vaccinated: true,
    bio: '',
    lookingFor: 'both' as 'mating' | 'playdate' | 'both',
    location: { lat: 0, lng: 0, city: '' }
  });

  // Owner Profile Form
  const [ownerForm, setOwnerForm] = useState({
    name: '',
    age: '',
    photos: [] as string[],
    bio: '',
    pets: [] as string[],
    interests: [] as string[],
    location: { lat: 0, lng: 0, city: '' }
  });

  useEffect(() => {
    if (mode === 'pet') {
      loadUserPets();
    }
    loadExistingProfile();
    getCurrentLocation();
  }, [mode]);

  const loadUserPets = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/pets?phone=${phone}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      if (response.ok) {
        const result = await response.json();
        setPets(result.pets || []);
      }
    } catch (error) {
      console.error('Error loading pets:', error);
    }
  };

  const loadExistingProfile = async () => {
    try {
      const profileKey = mode === 'pet' && selectedPetId 
        ? `pet_dating_${selectedPetId}` 
        : `owner_dating_${phone}`;
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/dating/${mode}-profile/${profileKey}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.profile) {
          setExistingProfile(result.profile);
          if (mode === 'pet') {
            setPetForm({
              name: result.profile.name,
              breed: result.profile.breed,
              age: result.profile.age.toString(),
              gender: result.profile.gender,
              photos: result.profile.photos,
              temperament: result.profile.temperament,
              vaccinated: result.profile.vaccinated,
              bio: result.profile.bio,
              lookingFor: result.profile.lookingFor,
              location: result.profile.location
            });
          } else {
            setOwnerForm({
              name: result.profile.name,
              age: result.profile.age.toString(),
              photos: result.profile.photos,
              bio: result.profile.bio,
              pets: result.profile.pets,
              interests: result.profile.interests,
              location: result.profile.location
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            city: 'Current Location'
          };
          if (mode === 'pet') {
            setPetForm(prev => ({ ...prev, location }));
          } else {
            setOwnerForm(prev => ({ ...prev, location }));
          }
        },
        (error) => console.error('Geolocation error:', error)
      );
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // In production, upload to S3/Supabase Storage
    // For now, convert to base64 or use placeholder URLs
    const photoPromises = Array.from(files).map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(photoPromises).then(photoUrls => {
      if (mode === 'pet') {
        setPetForm(prev => ({ ...prev, photos: [...prev.photos, ...photoUrls].slice(0, 6) }));
      } else {
        setOwnerForm(prev => ({ ...prev, photos: [...prev.photos, ...photoUrls].slice(0, 6) }));
      }
    });
  };

  const removePhoto = (index: number) => {
    if (mode === 'pet') {
      setPetForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
    } else {
      setOwnerForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
    }
  };

  const toggleInterest = (interest: string) => {
    setOwnerForm(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const endpoint = mode === 'pet' 
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/dating/pet-profile`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/dating/owner-profile`;

      const payload = mode === 'pet' ? {
        petId: selectedPetId || `temp_${Date.now()}`,
        userId: phone,
        ...petForm,
        age: parseInt(petForm.age) || 0
      } : {
        userId: phone,
        ...ownerForm,
        age: parseInt(ownerForm.age) || 0
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success('Profile saved successfully! 🎉');
        onComplete();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={onBack} className="text-gray-600">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg text-gray-900">
              {mode === 'pet' ? 'Pet Dating Profile' : 'Your Dating Profile'}
            </h1>
            <p className="text-sm text-gray-600">
              {existingProfile ? 'Update your profile' : 'Create your profile'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6 pb-24">
        {/* Pet Selection (Pet Mode Only) */}
        {mode === 'pet' && pets.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Your Pet
            </label>
            <select
              value={selectedPetId}
              onChange={(e) => {
                setSelectedPetId(e.target.value);
                loadExistingProfile();
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            >
              <option value="">Create New Profile</option>
              {pets.map(pet => (
                <option key={pet.id} value={pet.id}>{pet.name} ({pet.breed})</option>
              ))}
            </select>
          </div>
        )}

        {/* Photo Upload */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Photos (Max 6)
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(mode === 'pet' ? petForm.photos : ownerForm.photos).map((photo, idx) => (
              <div key={idx} className="relative aspect-square">
                <img src={photo} alt="" className="w-full h-full object-cover rounded-lg" />
                <button
                  onClick={() => removePhoto(idx)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {(mode === 'pet' ? petForm.photos.length : ownerForm.photos.length) < 6 && (
              <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-pink-500 transition">
                <Upload className="w-6 h-6 text-gray-400" />
                <span className="text-xs text-gray-500 mt-1">Add Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {mode === 'pet' ? (
          <>
            {/* Pet Details */}
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={petForm.name}
                  onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
                  placeholder="Your pet's name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Breed *</label>
                  <input
                    type="text"
                    value={petForm.breed}
                    onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
                    placeholder="e.g., Golden Retriever"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Age *</label>
                  <input
                    type="number"
                    value={petForm.age}
                    onChange={(e) => setPetForm({ ...petForm, age: e.target.value })}
                    placeholder="Years"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Gender *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPetForm({ ...petForm, gender: 'male' })}
                    className={`py-2 rounded-lg font-medium transition ${
                      petForm.gender === 'male'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Male
                  </button>
                  <button
                    onClick={() => setPetForm({ ...petForm, gender: 'female' })}
                    className={`py-2 rounded-lg font-medium transition ${
                      petForm.gender === 'female'
                        ? 'bg-pink-500 text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Female
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Temperament</label>
                <select
                  value={petForm.temperament}
                  onChange={(e) => setPetForm({ ...petForm, temperament: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                >
                  {TEMPERAMENTS.map(temp => (
                    <option key={temp} value={temp}>{temp}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Looking For</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'mating', label: 'Mating', icon: Heart },
                    { value: 'playdate', label: 'Playdate', icon: Heart },
                    { value: 'both', label: 'Both', icon: Heart }
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setPetForm({ ...petForm, lookingFor: value as any })}
                      className={`py-2 px-3 rounded-lg font-medium transition flex flex-col items-center ${
                        petForm.lookingFor === value
                          ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-1" />
                      <span className="text-xs">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="vaccinated"
                  checked={petForm.vaccinated}
                  onChange={(e) => setPetForm({ ...petForm, vaccinated: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="vaccinated" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Shield className="w-4 h-4 text-green-500" />
                  Fully Vaccinated
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Bio</label>
                <textarea
                  value={petForm.bio}
                  onChange={(e) => setPetForm({ ...petForm, bio: e.target.value })}
                  placeholder="Tell us about your pet..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Owner Details */}
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={ownerForm.name}
                  onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })}
                  placeholder="Your name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Age</label>
                <input
                  type="number"
                  value={ownerForm.age}
                  onChange={(e) => setOwnerForm({ ...ownerForm, age: e.target.value })}
                  placeholder="Your age"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Bio</label>
                <textarea
                  value={ownerForm.bio}
                  onChange={(e) => setOwnerForm({ ...ownerForm, bio: e.target.value })}
                  placeholder="Tell us about yourself and your pets..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Interests</label>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map(interest => (
                    <button
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                        ownerForm.interests.includes(interest)
                          ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Location */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-pink-500" />
            <label className="text-sm font-semibold text-gray-700">Location</label>
          </div>
          <p className="text-sm text-gray-600">
            {mode === 'pet' ? petForm.location.city : ownerForm.location.city}
          </p>
          <Button
            onClick={getCurrentLocation}
            variant="outline"
            size="sm"
            className="mt-2"
          >
            Update Location
          </Button>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm text-blue-900 font-medium">Profile Visibility</p>
              <p className="text-xs text-blue-700 mt-1">
                Your profile will be visible to other users in your area. You can update or pause it anytime.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-10">
        <div className="max-w-md mx-auto">
          <Button
            onClick={handleSave}
            disabled={loading || (mode === 'pet' ? !petForm.name || !petForm.breed : !ownerForm.name)}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </div>
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                {existingProfile ? 'Update Profile' : 'Save & Continue'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}