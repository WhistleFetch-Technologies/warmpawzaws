import React, { useState } from 'react';
import { Button } from '../ui/button';
import {
  Heart,
  Shield,
  Award,
  MapPin,
  Phone,
  Mail,
  Camera,
  Video,
  CheckCircle,
  AlertCircle,
  Calendar,
  Activity,
  Smile,
  Dog,
  Star,
  Share2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface PetListing {
  listingId: string;
  breederName: string;
  breed: string;
  name?: string;
  gender: 'male' | 'female';
  age: {
    months: number;
    displayText: string;
  };
  color: string;
  price: number;
  negotiable: boolean;
  lineage: {
    sire: {
      name: string;
      breed: string;
      kciNumber?: string;
      photo?: string;
      achievements?: string[];
    };
    dam: {
      name: string;
      breed: string;
      kciNumber?: string;
      photo?: string;
      achievements?: string[];
    };
  };
  health: {
    vaccinationStatus: 'complete' | 'partial' | 'not_started';
    vaccinations: Array<{
      vaccineName: string;
      dateGiven: string;
      nextDue?: string;
    }>;
    dewormed: boolean;
    dewormingDate?: string;
  };
  temperament: {
    energyLevel: string;
    friendliness: number;
    trainability: number;
    socialWithPets: boolean;
    socialWithKids: boolean;
    description: string;
    traits: string[];
  };
  registration: {
    kciRegistered: boolean;
    kciNumber?: string;
    microchipped: boolean;
    microchipNumber?: string;
  };
  media: {
    photos: Array<{
      photoId: string;
      url: string;
      caption?: string;
      isPrimary: boolean;
    }>;
    videos?: Array<{
      videoId: string;
      url: string;
      caption?: string;
    }>;
  };
  location: {
    city: string;
    state: string;
  };
  availability: 'available' | 'reserved' | 'sold';
}

interface PetProfileDisplayProps {
  listing: PetListing;
  onInquire: () => void;
  onShare: () => void;
}

export function PetProfileDisplay({
  listing,
  onInquire,
  onShare
}: PetProfileDisplayProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'health' | 'lineage' | 'temperament'>('overview');

  const photos = listing.media.photos.sort((a, b) => b.isPrimary ? 1 : -1);

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const getVaccinationStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'complete': 'bg-green-100 text-green-700 border-green-200',
      'partial': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'not_started': 'bg-red-100 text-red-700 border-red-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getAvailabilityBadge = () => {
    const badges: Record<string, { color: string; text: string; icon: any }> = {
      'available': { color: 'bg-green-600', text: 'Available Now', icon: CheckCircle },
      'reserved': { color: 'bg-yellow-600', text: 'Reserved', icon: AlertCircle },
      'sold': { color: 'bg-gray-600', text: 'Sold', icon: AlertCircle }
    };
    
    const badge = badges[listing.availability] || badges.available;
    const Icon = badge.icon;
    
    return (
      <div className={`${badge.color} text-white px-4 py-2 rounded-lg flex items-center gap-2`}>
        <Icon className="w-5 h-5" />
        <span className="font-medium">{badge.text}</span>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Image Gallery */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <div className="relative aspect-video bg-gray-100">
          {photos.length > 0 ? (
            <>
              <img
                src={photos[currentPhotoIndex].url}
                alt={photos[currentPhotoIndex].caption || listing.name || listing.breed}
                className="w-full h-full object-cover"
              />
              
              {photos.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-900" />
                  </button>
                  
                  <button
                    onClick={nextPhoto}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors"
                  >
                    <ChevronRight className="w-6 h-6 text-gray-900" />
                  </button>

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {photos.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentPhotoIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === currentPhotoIndex
                            ? 'bg-white w-8'
                            : 'bg-white/50 hover:bg-white/75'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}

              <div className="absolute top-4 right-4">
                <button
                  onClick={onShare}
                  className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors"
                >
                  <Share2 className="w-5 h-5 text-gray-900" />
                </button>
              </div>

              <div className="absolute bottom-4 right-4">
                <div className="bg-black/70 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  {currentPhotoIndex + 1} / {photos.length}
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Dog className="w-24 h-24 text-gray-300" />
            </div>
          )}
        </div>
      </div>

      {/* Main Info */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">
                {listing.name || listing.breed}
              </h1>
              {listing.gender === 'male' ? (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  ♂ Male
                </span>
              ) : (
                <span className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm font-medium">
                  ♀ Female
                </span>
              )}
            </div>
            
            <p className="text-lg text-gray-600 mb-3">{listing.breed}</p>
            
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {listing.age.displayText}
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                {listing.color}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {listing.location.city}, {listing.location.state}
              </div>
            </div>
          </div>

          <div className="text-right">
            {getAvailabilityBadge()}
            <div className="mt-4">
              <p className="text-3xl font-bold text-gray-900">
                ₹{listing.price.toLocaleString('en-IN')}
              </p>
              {listing.negotiable && (
                <p className="text-sm text-green-600">Negotiable</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className={`p-4 rounded-lg border-2 ${getVaccinationStatusColor(listing.health.vaccinationStatus)}`}>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5" />
              <span className="font-medium">Vaccination</span>
            </div>
            <p className="text-sm capitalize">
              {listing.health.vaccinationStatus.replace('_', ' ')}
            </p>
          </div>

          {listing.registration.kciRegistered && (
            <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-purple-900">KCI Registered</span>
              </div>
              <p className="text-sm text-purple-700">{listing.registration.kciNumber}</p>
            </div>
          )}

          {listing.registration.microchipped && (
            <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-900">Microchipped</span>
              </div>
              <p className="text-sm text-blue-700">Verified</p>
            </div>
          )}

          {listing.health.dewormed && (
            <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-900">Dewormed</span>
              </div>
              <p className="text-sm text-green-700">
                {new Date(listing.health.dewormingDate!).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={onInquire}
            disabled={listing.availability === 'sold'}
            className="flex-1 bg-orange-600 hover:bg-orange-700"
            size="lg"
          >
            <Mail className="w-5 h-5 mr-2" />
            {listing.availability === 'sold' ? 'Sold Out' : 'Inquire Now'}
          </Button>
          <Button
            onClick={onShare}
            variant="outline"
            size="lg"
            className="border-2"
          >
            <Share2 className="w-5 h-5 mr-2" />
            Share
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex">
            {[
              { id: 'overview', label: 'Overview', icon: Dog },
              { id: 'health', label: 'Health', icon: Shield },
              { id: 'lineage', label: 'Lineage', icon: Award },
              { id: 'temperament', label: 'Temperament', icon: Smile }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSelectedTab(id as any)}
                className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                  selectedTab === id
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {selectedTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Breeder Information</h3>
                <p className="text-gray-700 mb-2">
                  <strong>Breeder:</strong> {listing.breederName}
                </p>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-3">Key Features</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Pure Breed</p>
                      <p className="text-sm text-gray-600">{listing.breed}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Age</p>
                      <p className="text-sm text-gray-600">{listing.age.displayText}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'health' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Vaccination Record</h3>
                <div className="space-y-3">
                  {listing.health.vaccinations.map((vac, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{vac.vaccineName}</p>
                          <p className="text-sm text-gray-600">
                            Given: {new Date(vac.dateGiven).toLocaleDateString()}
                          </p>
                          {vac.nextDue && (
                            <p className="text-sm text-gray-600">
                              Next due: {new Date(vac.nextDue).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'lineage' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Sire */}
                <div className="p-4 border-2 border-blue-200 bg-blue-50 rounded-lg">
                  <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Sire (Father)
                  </h3>
                  {listing.lineage.sire.photo && (
                    <img
                      src={listing.lineage.sire.photo}
                      alt={listing.lineage.sire.name}
                      className="w-full h-48 object-cover rounded-lg mb-3"
                    />
                  )}
                  <p className="font-medium text-gray-900">{listing.lineage.sire.name}</p>
                  <p className="text-sm text-gray-700 mb-2">{listing.lineage.sire.breed}</p>
                  {listing.lineage.sire.kciNumber && (
                    <p className="text-sm text-gray-600">KCI: {listing.lineage.sire.kciNumber}</p>
                  )}
                  {listing.lineage.sire.achievements && listing.lineage.sire.achievements.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-900 mb-1">Achievements:</p>
                      <ul className="space-y-1">
                        {listing.lineage.sire.achievements.map((ach, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <Star className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                            {ach}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Dam */}
                <div className="p-4 border-2 border-pink-200 bg-pink-50 rounded-lg">
                  <h3 className="font-bold text-pink-900 mb-3 flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Dam (Mother)
                  </h3>
                  {listing.lineage.dam.photo && (
                    <img
                      src={listing.lineage.dam.photo}
                      alt={listing.lineage.dam.name}
                      className="w-full h-48 object-cover rounded-lg mb-3"
                    />
                  )}
                  <p className="font-medium text-gray-900">{listing.lineage.dam.name}</p>
                  <p className="text-sm text-gray-700 mb-2">{listing.lineage.dam.breed}</p>
                  {listing.lineage.dam.kciNumber && (
                    <p className="text-sm text-gray-600">KCI: {listing.lineage.dam.kciNumber}</p>
                  )}
                  {listing.lineage.dam.achievements && listing.lineage.dam.achievements.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-900 mb-1">Achievements:</p>
                      <ul className="space-y-1">
                        {listing.lineage.dam.achievements.map((ach, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <Star className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                            {ach}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'temperament' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Personality Traits</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {listing.temperament.traits.map((trait, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
                <p className="text-gray-700">{listing.temperament.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Energy Level</p>
                  <p className="font-medium text-gray-900 capitalize">{listing.temperament.energyLevel.replace('_', ' ')}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Friendliness</p>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star
                        key={idx}
                        className={`w-5 h-5 ${
                          idx < listing.temperament.friendliness
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Trainability</p>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star
                        key={idx}
                        className={`w-5 h-5 ${
                          idx < listing.temperament.trainability
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Social with Pets</p>
                  <p className="font-medium text-gray-900">
                    {listing.temperament.socialWithPets ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
