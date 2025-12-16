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
  ChevronRight,
  Info,
  TrendingUp,
  Users,
  Zap,
  Home as HomeIcon,
  Stethoscope,
  DollarSign
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

interface PetProfileConsumerViewProps {
  listing: PetListing;
  onInquire: () => void;
  onShare: () => void;
  onCompare?: () => void;
  similarListings?: PetListing[];
}

// ✅ NEW: Tooltip Component
function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  
  return (
    <div className="relative inline-block">
      <div 
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
      >
        {children}
      </div>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}

export function PetProfileConsumerView({
  listing,
  onInquire,
  onShare,
  onCompare,
  similarListings = []
}: PetProfileConsumerViewProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'health' | 'lineage' | 'temperament'>('overview');
  const [showFullLineage, setShowFullLineage] = useState(false);

  const photos = listing.media.photos.sort((a, b) => b.isPrimary ? 1 : -1);

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const getVaccinationStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; text: string; icon: any }> = {
      'complete': { color: 'bg-green-100 text-green-700 border-green-200', text: '✓ Fully Vaccinated', icon: CheckCircle },
      'partial': { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', text: '⚠ Partially Vaccinated', icon: AlertCircle },
      'not_started': { color: 'bg-red-100 text-red-700 border-red-200', text: '✗ Not Vaccinated', icon: AlertCircle }
    };
    return badges[status] || badges.complete;
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
      <div className={`${badge.color} text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-md`}>
        <Icon className="w-5 h-5" />
        <span className="font-semibold">{badge.text}</span>
      </div>
    );
  };

  // ✅ NEW: Health Score Calculation
  const calculateHealthScore = () => {
    let score = 0;
    if (listing.health.vaccinationStatus === 'complete') score += 40;
    else if (listing.health.vaccinationStatus === 'partial') score += 20;
    if (listing.health.dewormed) score += 20;
    if (listing.registration.kciRegistered) score += 20;
    if (listing.registration.microchipped) score += 20;
    return score;
  };

  const healthScore = calculateHealthScore();

  // ✅ NEW: Suitability Score
  const getSuitabilityRecommendations = () => {
    const recommendations = [];
    
    if (listing.temperament.socialWithKids) {
      recommendations.push({ icon: '👶', text: 'Great with Kids', color: 'bg-blue-100 text-blue-700' });
    }
    if (listing.temperament.socialWithPets) {
      recommendations.push({ icon: '🐾', text: 'Pet-Friendly', color: 'bg-green-100 text-green-700' });
    }
    if (listing.temperament.trainability >= 4) {
      recommendations.push({ icon: '🎓', text: 'Easy to Train', color: 'bg-purple-100 text-purple-700' });
    }
    if (listing.temperament.energyLevel === 'high') {
      recommendations.push({ icon: '⚡', text: 'High Energy', color: 'bg-orange-100 text-orange-700' });
    } else if (listing.temperament.energyLevel === 'low') {
      recommendations.push({ icon: '😴', text: 'Calm Temperament', color: 'bg-gray-100 text-gray-700' });
    }
    if (listing.age.months <= 6) {
      recommendations.push({ icon: '🍼', text: 'Puppy', color: 'bg-pink-100 text-pink-700' });
    }
    
    return recommendations;
  };

  const suitability = getSuitabilityRecommendations();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Image Gallery with Enhanced UI */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-lg">
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
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-all hover:scale-110 shadow-lg"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-900" />
                  </button>
                  
                  <button
                    onClick={nextPhoto}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-all hover:scale-110 shadow-lg"
                  >
                    <ChevronRight className="w-6 h-6 text-gray-900" />
                  </button>

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {photos.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentPhotoIndex(idx)}
                        className={`h-2 rounded-full transition-all ${\n                          idx === currentPhotoIndex\n                            ? 'bg-white w-8'\n                            : 'bg-white/50 hover:bg-white/75 w-2'\n                        }`}
                      />
                    ))}\n                  </div>
                </>\n              )}

              <div className=\"absolute top-4 right-4 flex gap-2\">\n                <button\n                  onClick={onShare}\n                  className=\"w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg\"\n                >\n                  <Share2 className=\"w-5 h-5 text-gray-900\" />\n                </button>\n                {onCompare && (\n                  <button\n                    onClick={onCompare}\n                    className=\"w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg\"\n                  >\n                    <TrendingUp className=\"w-5 h-5 text-gray-900\" />\n                  </button>\n                )}\n              </div>

              <div className=\"absolute bottom-4 right-4\">\n                <div className=\"bg-black/70 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2\">\n                  <Camera className=\"w-4 h-4\" />\n                  {currentPhotoIndex + 1} / {photos.length}\n                </div>\n              </div>\n              \n              {/* ✅ NEW: Availability Badge */}\n              <div className=\"absolute top-4 left-4\">\n                {getAvailabilityBadge()}\n              </div>\n            </>\n          ) : (\n            <div className=\"w-full h-full flex items-center justify-center\">\n              <Dog className=\"w-24 h-24 text-gray-300\" />\n            </div>\n          )}\n        </div>\n      </div>

      {/* Main Info Card with Health Score */}\n      <div className=\"bg-white rounded-xl border-2 border-gray-200 p-6 shadow-lg\">\n        <div className=\"flex items-start justify-between mb-6\">\n          <div className=\"flex-1\">\n            <div className=\"flex items-center gap-3 mb-2\">\n              <h1 className=\"text-3xl font-bold text-gray-900\">\n                {listing.name || listing.breed}\n              </h1>\n              {listing.gender === 'male' ? (\n                <span className=\"px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold\">\n                  ♂ Male\n                </span>\n              ) : (\n                <span className=\"px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm font-semibold\">\n                  ♀ Female\n                </span>\n              )}\n            </div>\n            \n            <p className=\"text-lg text-gray-600 mb-3\">{listing.breed}</p>\n            \n            <div className=\"flex flex-wrap gap-4 text-sm text-gray-600\">\n              <div className=\"flex items-center gap-2\">\n                <Calendar className=\"w-4 h-4\" />\n                {listing.age.displayText}\n              </div>\n              <div className=\"flex items-center gap-2\">\n                <Activity className=\"w-4 h-4\" />\n                {listing.color}\n              </div>\n              <div className=\"flex items-center gap-2\">\n                <MapPin className=\"w-4 h-4\" />\n                {listing.location.city}, {listing.location.state}\n              </div>\n            </div>\n          </div>

          <div className=\"text-right\">\n            <div className=\"mb-4\">\n              <p className=\"text-3xl font-bold text-gray-900\">\n                ₹{listing.price.toLocaleString('en-IN')}\n              </p>\n              {listing.negotiable && (\n                <p className=\"text-sm text-green-600 font-medium\">Price Negotiable</p>\n              )}\n            </div>\n            \n            {/* ✅ NEW: Health Score Badge */}\n            <Tooltip content=\"Health score based on vaccinations, deworming, registration, and microchipping status\">\n              <div className=\"inline-flex items-center gap-2 bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-200 rounded-lg px-4 py-2 cursor-help\">\n                <Stethoscope className=\"w-5 h-5 text-green-600\" />\n                <div>\n                  <p className=\"text-xs text-green-700 font-medium\">Health Score</p>\n                  <p className=\"text-xl font-bold text-green-800\">{healthScore}/100</p>\n                </div>\n              </div>\n            </Tooltip>\n          </div>\n        </div>

        {/* ✅ NEW: Suitability Tags */}\n        {suitability.length > 0 && (\n          <div className=\"mb-6\">\n            <h3 className=\"text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2\">\n              <Heart className=\"w-4 h-4\" />\n              Perfect For\n            </h3>\n            <div className=\"flex flex-wrap gap-2\">\n              {suitability.map((item, idx) => (\n                <span key={idx} className={`${item.color} px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2`}>\n                  <span>{item.icon}</span>\n                  {item.text}\n                </span>\n              ))}\n            </div>\n          </div>\n        )}\n\n        {/* Quick Stats with Tooltips */}\n        <div className=\"grid grid-cols-2 md:grid-cols-4 gap-4 mb-6\">\n          <Tooltip content=\"Vaccination protects your puppy from deadly diseases like Parvo, Distemper, and Rabies\">\n            <div className={`p-4 rounded-lg border-2 cursor-help transition-all hover:shadow-md ${getVaccinationStatusBadge(listing.health.vaccinationStatus).color}`}>\n              <div className=\"flex items-center gap-2 mb-1\">\n                <Shield className=\"w-5 h-5\" />\n                <span className=\"font-semibold\">Vaccination</span>\n              </div>\n              <p className=\"text-sm capitalize\">\n                {listing.health.vaccinationStatus.replace('_', ' ')}\n              </p>\n            </div>\n          </Tooltip>\n\n          {listing.registration.kciRegistered && (\n            <Tooltip content=\"Kennel Club of India (KCI) registration ensures purebred lineage and breed authenticity\">\n              <div className=\"p-4 bg-purple-50 border-2 border-purple-200 rounded-lg cursor-help transition-all hover:shadow-md\">\n                <div className=\"flex items-center gap-2 mb-1\">\n                  <Award className=\"w-5 h-5 text-purple-600\" />\n                  <span className=\"font-semibold text-purple-900\">KCI Registered</span>\n                </div>\n                <p className=\"text-sm text-purple-700\">{listing.registration.kciNumber}</p>\n              </div>\n            </Tooltip>\n          )}\n\n          {listing.registration.microchipped && (\n            <Tooltip content=\"Microchipping helps reunite lost pets with their owners. Contains unique identification number\">\n              <div className=\"p-4 bg-blue-50 border-2 border-blue-200 rounded-lg cursor-help transition-all hover:shadow-md\">\n                <div className=\"flex items-center gap-2 mb-1\">\n                  <CheckCircle className=\"w-5 h-5 text-blue-600\" />\n                  <span className=\"font-semibold text-blue-900\">Microchipped</span>\n                </div>\n                <p className=\"text-sm text-blue-700\">Verified</p>\n              </div>\n            </Tooltip>\n          )}\n\n          {listing.health.dewormed && (\n            <Tooltip content=\"Deworming removes intestinal parasites that can harm your puppy's health and growth\">\n              <div className=\"p-4 bg-green-50 border-2 border-green-200 rounded-lg cursor-help transition-all hover:shadow-md\">\n                <div className=\"flex items-center gap-2 mb-1\">\n                  <Heart className=\"w-5 h-5 text-green-600\" />\n                  <span className=\"font-semibold text-green-900\">Dewormed</span>\n                </div>\n                <p className=\"text-sm text-green-700\">\n                  {new Date(listing.health.dewormingDate!).toLocaleDateString()}\n                </p>\n              </div>\n            </Tooltip>\n          )}\n        </div>\n\n        {/* Action Buttons */}\n        <div className=\"flex gap-4\">\n          <Button\n            onClick={onInquire}\n            disabled={listing.availability === 'sold'}\n            className=\"flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white shadow-lg\"\n            size=\"lg\"\n          >\n            <Mail className=\"w-5 h-5 mr-2\" />\n            {listing.availability === 'sold' ? 'Sold Out' : 'Inquire Now'}\n          </Button>\n          <Button\n            onClick={onShare}\n            variant=\"outline\"\n            size=\"lg\"\n            className=\"border-2 border-gray-300 hover:border-orange-500 hover:bg-orange-50\"\n          >\n            <Share2 className=\"w-5 h-5 mr-2\" />\n            Share\n          </Button>\n          {onCompare && similarListings.length > 0 && (\n            <Button\n              onClick={onCompare}\n              variant=\"outline\"\n              size=\"lg\"\n              className=\"border-2 border-gray-300 hover:border-purple-500 hover:bg-purple-50\"\n            >\n              <TrendingUp className=\"w-5 h-5 mr-2\" />\n              Compare\n            </Button>\n          )}\n        </div>\n      </div>\n\n      {/* Tabs */}\n      <div className=\"bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-lg\">\n        <div className=\"border-b border-gray-200\">\n          <div className=\"flex\">\n            {[\n              { id: 'overview', label: 'Overview', icon: Dog },\n              { id: 'health', label: 'Health', icon: Shield },\n              { id: 'lineage', label: 'Lineage', icon: Award },\n              { id: 'temperament', label: 'Temperament', icon: Smile }\n            ].map(({ id, label, icon: Icon }) => (\n              <button\n                key={id}\n                onClick={() => setSelectedTab(id as any)}\n                className={`flex-1 px-6 py-4 font-semibold transition-colors flex items-center justify-center gap-2 ${\n                  selectedTab === id\n                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'\n                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'\n                }`}\n              >\n                <Icon className=\"w-5 h-5\" />\n                {label}\n              </button>\n            ))}\n          </div>\n        </div>\n\n        <div className=\"p-6\">\n          {selectedTab === 'overview' && (\n            <div className=\"space-y-6\">\n              <div>\n                <h3 className=\"font-bold text-gray-900 mb-3 flex items-center gap-2\">\n                  <Users className=\"w-5 h-5\" />\n                  Breeder Information\n                </h3>\n                <p className=\"text-gray-700 mb-2\">\n                  <strong>Breeder:</strong> {listing.breederName}\n                </p>\n              </div>\n\n              <div>\n                <h3 className=\"font-bold text-gray-900 mb-3 flex items-center gap-2\">\n                  <CheckCircle className=\"w-5 h-5\" />\n                  Key Features\n                </h3>\n                <div className=\"grid grid-cols-2 gap-4\">\n                  <div className=\"flex items-start gap-2 p-3 bg-gray-50 rounded-lg\">\n                    <CheckCircle className=\"w-5 h-5 text-green-600 flex-shrink-0 mt-0.5\" />\n                    <div>\n                      <p className=\"font-semibold text-gray-900\">Pure Breed</p>\n                      <p className=\"text-sm text-gray-600\">{listing.breed}</p>\n                    </div>\n                  </div>\n                  <div className=\"flex items-start gap-2 p-3 bg-gray-50 rounded-lg\">\n                    <CheckCircle className=\"w-5 h-5 text-green-600 flex-shrink-0 mt-0.5\" />\n                    <div>\n                      <p className=\"font-semibold text-gray-900\">Age</p>\n                      <p className=\"text-sm text-gray-600\">{listing.age.displayText}</p>\n                    </div>\n                  </div>\n                </div>\n              </div>\n              \n              {/* ✅ NEW: Cost Estimation */}\n              <div className=\"bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border-2 border-blue-200\">\n                <h3 className=\"font-bold text-gray-900 mb-3 flex items-center gap-2\">\n                  <DollarSign className=\"w-5 h-5\" />\n                  Monthly Cost Estimate\n                </h3>\n                <div className=\"grid grid-cols-2 gap-3 text-sm\">\n                  <div className=\"flex justify-between\">\n                    <span className=\"text-gray-600\">Food:</span>\n                    <span className=\"font-semibold\">₹2,000 - ₹3,000</span>\n                  </div>\n                  <div className=\"flex justify-between\">\n                    <span className=\"text-gray-600\">Healthcare:</span>\n                    <span className=\"font-semibold\">₹1,000 - ₹2,000</span>\n                  </div>\n                  <div className=\"flex justify-between\">\n                    <span className=\"text-gray-600\">Grooming:</span>\n                    <span className=\"font-semibold\">₹500 - ₹1,500</span>\n                  </div>\n                  <div className=\"flex justify-between\">\n                    <span className=\"text-gray-600\">Insurance:</span>\n                    <span className=\"font-semibold\">₹500 - ₹1,000</span>\n                  </div>\n                  <div className=\"col-span-2 pt-2 border-t border-blue-300 flex justify-between\">\n                    <span className=\"text-gray-900 font-bold\">Total/Month:</span>\n                    <span className=\"font-bold text-blue-700\">₹4,000 - ₹7,500</span>\n                  </div>\n                </div>\n              </div>\n            </div>\n          )}\n\n          {selectedTab === 'health' && (\n            <div className=\"space-y-6\">\n              <div>\n                <h3 className=\"font-bold text-gray-900 mb-3 flex items-center gap-2\">\n                  <Shield className=\"w-5 h-5\" />\n                  Vaccination Record\n                </h3>\n                <div className=\"space-y-3\">\n                  {listing.health.vaccinations.map((vac, idx) => (\n                    <div key={idx} className=\"p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200\">\n                      <div className=\"flex items-start justify-between\">\n                        <div>\n                          <p className=\"font-semibold text-gray-900 flex items-center gap-2\">\n                            {vac.vaccineName}\n                            <CheckCircle className=\"w-4 h-4 text-green-600\" />\n                          </p>\n                          <p className=\"text-sm text-gray-600 mt-1\">\n                            ✓ Given: {new Date(vac.dateGiven).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}\n                          </p>\n                          {vac.nextDue && (\n                            <p className=\"text-sm text-orange-600 mt-1 font-medium\">\n                              ⚠ Next due: {new Date(vac.nextDue).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}\n                            </p>\n                          )}\n                        </div>\n                      </div>\n                    </div>\n                  ))}\n                </div>\n              </div>\n              \n              {/* ✅ NEW: Health Tips */}\n              <div className=\"bg-blue-50 rounded-lg p-4 border-2 border-blue-200\">\n                <h4 className=\"font-bold text-blue-900 mb-2 flex items-center gap-2\">\n                  <Info className=\"w-5 h-5\" />\n                  Health Care Tips\n                </h4>\n                <ul className=\"space-y-2 text-sm text-blue-800\">\n                  <li className=\"flex items-start gap-2\">\n                    <span className=\"text-blue-600\">•</span>\n                    Continue vaccination schedule with your vet\n                  </li>\n                  <li className=\"flex items-start gap-2\">\n                    <span className=\"text-blue-600\">•</span>\n                    Deworm every 3 months\n                  </li>\n                  <li className=\"flex items-start gap-2\">\n                    <span className=\"text-blue-600\">•</span>\n                    Regular health checkups recommended\n                  </li>\n                  <li className=\"flex items-start gap-2\">\n                    <span className=\"text-blue-600\">•</span>\n                    Keep vaccination records safe\n                  </li>\n                </ul>\n              </div>\n            </div>\n          )}\n\n          {selectedTab === 'lineage' && (\n            <div className=\"space-y-6\">\n              {/* ✅ NEW: Lineage Tree Visualization */}\n              <div className=\"bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-6 border-2 border-amber-200\">\n                <h3 className=\"font-bold text-gray-900 mb-4 text-center flex items-center justify-center gap-2\">\n                  <Award className=\"w-6 h-6 text-amber-600\" />\n                  Family Tree\n                </h3>\n                \n                <div className=\"flex items-center justify-center gap-8\">\n                  {/* Sire */}\n                  <div className=\"text-center\">\n                    {listing.lineage.sire.photo && (\n                      <div className=\"w-24 h-24 mx-auto mb-2 rounded-full overflow-hidden border-4 border-blue-300\">\n                        <img\n                          src={listing.lineage.sire.photo}\n                          alt={listing.lineage.sire.name}\n                          className=\"w-full h-full object-cover\"\n                        />\n                      </div>\n                    )}\n                    <p className=\"font-bold text-blue-900\">♂ {listing.lineage.sire.name}</p>\n                    <p className=\"text-xs text-blue-700\">Father</p>\n                  </div>\n                  \n                  <div className=\"text-center\">\n                    <div className=\"w-20 h-20 mx-auto mb-2 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-2xl font-bold\">\n                      {(listing.name || listing.breed)[0]}\n                    </div>\n                    <p className=\"font-bold text-gray-900\">{listing.name || listing.breed}</p>\n                    <p className=\"text-xs text-gray-600\">Puppy</p>\n                  </div>\n                  \n                  {/* Dam */}\n                  <div className=\"text-center\">\n                    {listing.lineage.dam.photo && (\n                      <div className=\"w-24 h-24 mx-auto mb-2 rounded-full overflow-hidden border-4 border-pink-300\">\n                        <img\n                          src={listing.lineage.dam.photo}\n                          alt={listing.lineage.dam.name}\n                          className=\"w-full h-full object-cover\"\n                        />\n                      </div>\n                    )}\n                    <p className=\"font-bold text-pink-900\">♀ {listing.lineage.dam.name}</p>\n                    <p className=\"text-xs text-pink-700\">Mother</p>\n                  </div>\n                </div>\n              </div>\n              \n              <div className=\"grid md:grid-cols-2 gap-6\">\n                {/* Sire Details */}\n                <div className=\"p-4 border-2 border-blue-200 bg-blue-50 rounded-lg\">\n                  <h3 className=\"font-bold text-blue-900 mb-3 flex items-center gap-2\">\n                    <Award className=\"w-5 h-5\" />\n                    Sire (Father)\n                  </h3>\n                  <p className=\"font-semibold text-gray-900\">{listing.lineage.sire.name}</p>\n                  <p className=\"text-sm text-gray-700 mb-2\">{listing.lineage.sire.breed}</p>\n                  {listing.lineage.sire.kciNumber && (\n                    <p className=\"text-sm text-gray-600 mb-2\">KCI: {listing.lineage.sire.kciNumber}</p>\n                  )}\n                  {listing.lineage.sire.achievements && listing.lineage.sire.achievements.length > 0 && (\n                    <div className=\"mt-3\">\n                      <p className=\"text-sm font-semibold text-gray-900 mb-1\">Achievements:</p>\n                      <ul className=\"space-y-1\">\n                        {listing.lineage.sire.achievements.map((ach, idx) => (\n                          <li key={idx} className=\"text-sm text-gray-700 flex items-start gap-2\">\n                            <Star className=\"w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5 fill-yellow-500\" />\n                            {ach}\n                          </li>\n                        ))}\n                      </ul>\n                    </div>\n                  )}\n                </div>\n\n                {/* Dam Details */}\n                <div className=\"p-4 border-2 border-pink-200 bg-pink-50 rounded-lg\">\n                  <h3 className=\"font-bold text-pink-900 mb-3 flex items-center gap-2\">\n                    <Award className=\"w-5 h-5\" />\n                    Dam (Mother)\n                  </h3>\n                  <p className=\"font-semibold text-gray-900\">{listing.lineage.dam.name}</p>\n                  <p className=\"text-sm text-gray-700 mb-2\">{listing.lineage.dam.breed}</p>\n                  {listing.lineage.dam.kciNumber && (\n                    <p className=\"text-sm text-gray-600 mb-2\">KCI: {listing.lineage.dam.kciNumber}</p>\n                  )}\n                  {listing.lineage.dam.achievements && listing.lineage.dam.achievements.length > 0 && (\n                    <div className=\"mt-3\">\n                      <p className=\"text-sm font-semibold text-gray-900 mb-1\">Achievements:</p>\n                      <ul className=\"space-y-1\">\n                        {listing.lineage.dam.achievements.map((ach, idx) => (\n                          <li key={idx} className=\"text-sm text-gray-700 flex items-start gap-2\">\n                            <Star className=\"w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5 fill-yellow-500\" />\n                            {ach}\n                          </li>\n                        ))}\n                      </ul>\n                    </div>\n                  )}\n                </div>\n              </div>\n            </div>\n          )}\n\n          {selectedTab === 'temperament' && (\n            <div className=\"space-y-6\">\n              <div>\n                <h3 className=\"font-bold text-gray-900 mb-3 flex items-center gap-2\">\n                  <Smile className=\"w-5 h-5\" />\n                  Personality Traits\n                </h3>\n                <div className=\"flex flex-wrap gap-2 mb-4\">\n                  {listing.temperament.traits.map((trait, idx) => (\n                    <span\n                      key={idx}\n                      className=\"px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full font-medium\"\n                    >\n                      {trait}\n                    </span>\n                  ))}\n                </div>\n                <p className=\"text-gray-700 leading-relaxed\">{listing.temperament.description}</p>\n              </div>\n\n              <div className=\"grid grid-cols-2 gap-4\">\n                <Tooltip content=\"Energy level indicates how active and playful your pet is. High energy pets need more exercise.\">\n                  <div className=\"p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-200 cursor-help\">\n                    <p className=\"text-sm text-gray-600 mb-1 flex items-center gap-2\">\n                      <Zap className=\"w-4 h-4\" />\n                      Energy Level\n                    </p>\n                    <p className=\"font-bold text-gray-900 capitalize\">{listing.temperament.energyLevel.replace('_', ' ')}</p>\n                  </div>\n                </Tooltip>\n                \n                <Tooltip content=\"Friendliness measures how well your pet interacts with people and strangers.\">\n                  <div className=\"p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200 cursor-help\">\n                    <p className=\"text-sm text-gray-600 mb-1 flex items-center gap-2\">\n                      <Heart className=\"w-4 h-4\" />\n                      Friendliness\n                    </p>\n                    <div className=\"flex gap-1\">\n                      {Array.from({ length: 5 }).map((_, idx) => (\n                        <Star\n                          key={idx}\n                          className={`w-5 h-5 ${\n                            idx < listing.temperament.friendliness\n                              ? 'fill-yellow-400 text-yellow-400'\n                              : 'text-gray-300'\n                          }`}\n                        />\n                      ))}\n                    </div>\n                  </div>\n                </Tooltip>\n                \n                <Tooltip content=\"Trainability shows how easy it is to teach your pet new commands and behaviors.\">\n                  <div className=\"p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-200 cursor-help\">\n                    <p className=\"text-sm text-gray-600 mb-1 flex items-center gap-2\">\n                      <Activity className=\"w-4 h-4\" />\n                      Trainability\n                    </p>\n                    <div className=\"flex gap-1\">\n                      {Array.from({ length: 5 }).map((_, idx) => (\n                        <Star\n                          key={idx}\n                          className={`w-5 h-5 ${\n                            idx < listing.temperament.trainability\n                              ? 'fill-yellow-400 text-yellow-400'\n                              : 'text-gray-300'\n                          }`}\n                        />\n                      ))}\n                    </div>\n                  </div>\n                </Tooltip>\n                \n                <Tooltip content=\"Shows if your pet is comfortable living with other pets in the household.\">\n                  <div className=\"p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200 cursor-help\">\n                    <p className=\"text-sm text-gray-600 mb-1 flex items-center gap-2\">\n                      <Users className=\"w-4 h-4\" />\n                      Social with Pets\n                    </p>\n                    <p className=\"font-bold text-gray-900\">\n                      {listing.temperament.socialWithPets ? '✓ Yes' : '✗ No'}\n                    </p>\n                  </div>\n                </Tooltip>\n              </div>\n              \n              {/* ✅ NEW: Ideal Home Environment */}\n              <div className=\"bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border-2 border-indigo-200\">\n                <h4 className=\"font-bold text-indigo-900 mb-3 flex items-center gap-2\">\n                  <HomeIcon className=\"w-5 h-5\" />\n                  Ideal Home Environment\n                </h4>\n                <ul className=\"space-y-2 text-sm text-indigo-800\">\n                  {listing.temperament.energyLevel === 'high' && (\n                    <li className=\"flex items-start gap-2\">\n                      <CheckCircle className=\"w-4 h-4 flex-shrink-0 mt-0.5 text-green-600\" />\n                      Active family with time for daily exercise and play\n                    </li>\n                  )}\n                  {listing.temperament.socialWithKids && (\n                    <li className=\"flex items-start gap-2\">\n                      <CheckCircle className=\"w-4 h-4 flex-shrink-0 mt-0.5 text-green-600\" />\n                      Family-friendly, great with children\n                    </li>\n                  )}\n                  {listing.temperament.socialWithPets && (\n                    <li className=\"flex items-start gap-2\">\n                      <CheckCircle className=\"w-4 h-4 flex-shrink-0 mt-0.5 text-green-600\" />\n                      Can live harmoniously with other pets\n                    </li>\n                  )}\n                  {listing.temperament.trainability >= 4 && (\n                    <li className=\"flex items-start gap-2\">\n                      <CheckCircle className=\"w-4 h-4 flex-shrink-0 mt-0.5 text-green-600\" />\n                      Ideal for first-time pet owners (easy to train)\n                    </li>\n                  )}\n                </ul>\n              </div>\n            </div>\n          )}\n        </div>\n      </div>\n    </div>\n  );\n}
