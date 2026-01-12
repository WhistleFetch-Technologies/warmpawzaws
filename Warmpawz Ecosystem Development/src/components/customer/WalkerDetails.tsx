import { useState } from 'react';
import { ArrowLeft, Star, MapPin, Award, Clock, Shield, Heart, ChevronRight, User, CheckCircle, TrendingUp } from 'lucide-react';
import { Button } from '../ui/button';

interface Walker {
  id: string;
  name: string;
  photo?: string;
  rating: number;
  reviews: number;
  experience: string;
  distance: number;
  price30min: number;
  price60min: number;
  serviceRadius: number;
  specialties: string[];
  verified: boolean;
  location: {
    address: string;
  };
  totalWalks: number;
  gender?: string;
  age?: number;
  policeVerified?: boolean;
}

interface BookingDetails {
  petId: string;
  petName: string;
  duration: '30' | '60' | 'custom';
  customDuration?: number;
  schedule: 'morning' | 'evening' | 'anytime';
  frequency: 'single' | 'weekly' | 'monthly';
  sessionsPerDay?: number;
}

export function WalkerDetails({
  walker,
  bookingDetails,
  phone,
  onBack,
  onConfirm
}: {
  walker: Walker;
  bookingDetails: BookingDetails;
  phone: string;
  onBack: () => void;
  onConfirm: () => void;
}) {
  // Add default values if not present
  const walkerWithDefaults = {
    ...walker,
    gender: walker.gender || 'Male',
    age: walker.age || 32,
    policeVerified: walker.policeVerified !== false
  };

  const reviews = [
    {
      name: 'Anita Desai',
      rating: 5,
      date: '2 days ago',
      comment: 'Excellent walker! Very caring and punctual. My dog Max loves him!',
      petName: 'Max'
    },
    {
      name: 'Rohan Mehta',
      rating: 5,
      date: '1 week ago',
      comment: 'Professional and trustworthy. Sends regular updates with photos.',
      petName: 'Bruno'
    },
    {
      name: 'Kavya Singh',
      rating: 4,
      date: '2 weeks ago',
      comment: 'Great experience! My puppy was well taken care of.',
      petName: 'Charlie'
    }
  ];

  const certifications = [
    { name: 'Pet First Aid Certified', icon: '🏥', verified: true },
    { name: 'Police Verification', icon: '👮', verified: walkerWithDefaults.policeVerified },
    { name: 'Background Verified', icon: '✅', verified: true },
    { name: 'Insurance Covered', icon: '🛡️', verified: true },
    { name: 'GPS Tracking Enabled', icon: '📍', verified: true }
  ];

  const getPrice = () => {
    if (bookingDetails.frequency === 'weekly') return 1199;
    if (bookingDetails.frequency === 'monthly') return 3999;
    if (bookingDetails.duration === '30') return walker.price30min;
    if (bookingDetails.duration === '60') return walker.price60min;
    return walker.price60min;
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-32">
      {/* Header with Back Button */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pt-12 pb-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">Walker Profile</h1>
            <p className="text-white/90 text-sm">View details and book</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Walker Profile Card */}
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100">
          {/* Photo and Basic Info */}
          <div className="flex items-start gap-4 mb-5">
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center">
                {walker.photo ? (
                  <img src={walker.photo} alt={walker.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl text-white">{walkerWithDefaults.gender === 'Male' ? '👨' : '👩'}</span>
                )}
              </div>
              {walkerWithDefaults.verified && (
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                  <Award className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-800 mb-2 break-words">{walker.name}</h2>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1 bg-yellow-50 px-2.5 py-1 rounded-full">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm font-bold text-gray-800">{walker.rating}</span>
                  <span className="text-xs text-gray-600">({walker.reviews})</span>
                </div>
                {walkerWithDefaults.policeVerified && (
                  <div className="flex items-center gap-1 bg-green-50 px-2.5 py-1 rounded-full">
                    <Shield className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs font-semibold text-green-700">Verified</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-3.5 h-3.5" />
                <span>{walker.distance.toFixed(1)} km away</span>
              </div>
            </div>
          </div>

          {/* Personal Details Grid */}
          <div className="grid grid-cols-2 gap-3 mb-5 pt-5 border-t border-gray-100">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 text-center">
              <User className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Gender</p>
              <p className="font-bold text-gray-800">{walkerWithDefaults.gender}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 text-center">
              <Clock className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Age</p>
              <p className="font-bold text-gray-800">{walkerWithDefaults.age} years</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-4 text-center">
              <TrendingUp className="w-6 h-6 text-orange-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Experience</p>
              <p className="font-bold text-gray-800">{walker.experience}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 text-center">
              <Star className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Total Walks</p>
              <p className="font-bold text-gray-800">{walker.totalWalks}+</p>
            </div>
          </div>

          {/* Service Details */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600 mb-1">Service Radius</p>
                <p className="text-lg font-bold text-[#FF8C42]">{walker.serviceRadius} km</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Reviews</p>
                <p className="text-lg font-bold text-[#FF8C42]">{walker.reviews}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Specialties */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-[#FF8C42]" />
            Specialties
          </h3>
          <div className="flex flex-wrap gap-2">
            {walker.specialties.map((specialty, index) => (
              <span
                key={index}
                className="bg-orange-50 text-orange-700 px-3 py-2 rounded-lg text-sm font-medium border border-orange-100"
              >
                {specialty}
              </span>
            ))}
          </div>
        </div>

        {/* Certifications & Verification */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            Certifications & Safety
          </h3>
          <div className="space-y-3">
            {certifications.map((cert, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    cert.verified ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <span className="text-lg">{cert.icon}</span>
                  </div>
                  <span className={`font-medium ${cert.verified ? 'text-gray-800' : 'text-gray-500'}`}>
                    {cert.name}
                  </span>
                </div>
                {cert.verified && (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Booking Details */}
        <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-2xl p-5 border-2 border-orange-200">
          <h3 className="font-semibold text-gray-800 mb-4">Booking Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Pet Name</span>
              <span className="font-semibold text-gray-800">{bookingDetails.petName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Duration</span>
              <span className="font-semibold text-gray-800">
                {bookingDetails.duration === 'custom' 
                  ? `${bookingDetails.customDuration} minutes`
                  : `${bookingDetails.duration} minutes`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Schedule</span>
              <span className="font-semibold text-gray-800 capitalize">{bookingDetails.schedule}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Frequency</span>
              <span className="font-semibold text-gray-800 capitalize">{bookingDetails.frequency}</span>
            </div>
            {bookingDetails.frequency === 'monthly' && (
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Sessions per day</span>
                <span className="font-semibold text-gray-800">{bookingDetails.sessionsPerDay}x daily</span>
              </div>
            )}
            <div className="pt-3 border-t-2 border-orange-300 flex items-center justify-between">
              <span className="text-gray-700 font-semibold">Total Price</span>
              <span className="text-3xl font-bold text-[#FF8C42]">₹{getPrice()}</span>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Customer Reviews</h3>
            <button className="text-sm text-[#FF8C42] font-medium">View All</button>
          </div>
          <div className="space-y-4">
            {reviews.map((review, index) => (
              <div key={index} className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-800">{review.name}</h4>
                    <p className="text-xs text-gray-500">{review.petName} • {review.date}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-full">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-semibold">{review.rating}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-700">{review.comment}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed Book Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-[430px] mx-auto">
        <Button
          onClick={onConfirm}
          className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white py-6 rounded-xl font-semibold shadow-lg"
        >
          Confirm Booking - ₹{getPrice()}
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
