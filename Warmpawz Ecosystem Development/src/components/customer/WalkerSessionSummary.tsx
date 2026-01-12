import { useState } from 'react';
import { ArrowLeft, Star, MapPin, Clock, TrendingUp, Camera, Download, Share2, Heart } from 'lucide-react';
import { Button } from '../ui/button';

interface SessionData {
  status: string;
  startTime?: Date;
  endTime?: Date;
  duration: number;
  distance: number;
  bookingId: string;
  petName: string;
}

export function WalkerSessionSummary({
  sessionData,
  onBack
}: {
  sessionData: SessionData;
  onBack: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m ${seconds % 60}s`;
  };

  const handleSubmitRating = () => {
    if (rating === 0) {
      alert('Please select a rating');
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="w-32 h-32 bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] rounded-full mx-auto mb-6 flex items-center justify-center">
            <Heart className="w-16 h-16 text-white" />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-3">Thank You! 🙏</h1>
            <p className="text-gray-600 mb-2">Your feedback helps us improve</p>
            <p className="text-sm text-gray-500">We've shared your rating with the walker</p>
          </div>

          <Button
            onClick={onBack}
            className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white py-6 rounded-xl font-semibold"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const photos = [
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400&h=400&fit=crop'
  ];

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pt-12 pb-6">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">Walk Summary</h1>
            <p className="text-white/90 text-sm">Session #{sessionData.bookingId}</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Success Banner */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200 text-center">
          <div className="w-20 h-20 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Walk Completed! 🎉</h2>
          <p className="text-gray-600">{sessionData.petName} had a great walk today</p>
        </div>

        {/* Stats Grid */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Walk Statistics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 text-center">
              <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">{formatDuration(sessionData.duration)}</p>
              <p className="text-xs text-gray-600">Total Duration</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-xl p-4 text-center">
              <MapPin className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">{sessionData.distance.toFixed(2)}</p>
              <p className="text-xs text-gray-600">Distance (km)</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 text-center">
              <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">
                {((sessionData.distance / (sessionData.duration / 3600)) || 4.5).toFixed(1)}
              </p>
              <p className="text-xs text-gray-600">Avg Speed (km/h)</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 text-center">
              <Heart className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">420</p>
              <p className="text-xs text-gray-600">Calories Burned</p>
            </div>
          </div>
        </div>

        {/* Time Details */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Session Timeline</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Start Time</span>
              <span className="font-semibold text-gray-800">
                {sessionData.startTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">End Time</span>
              <span className="font-semibold text-gray-800">
                {sessionData.endTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Date</span>
              <span className="font-semibold text-gray-800">
                {sessionData.startTime?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Walker's Notes */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-3">Walker's Notes</h3>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-700">
              "{sessionData.petName} was very energetic today! We covered the usual route through the park. 
              {sessionData.petName} enjoyed playing with other dogs and was well-behaved throughout. 
              Made sure to give plenty of water breaks. Great session overall! 🐕"
            </p>
          </div>
        </div>

        {/* Photos Gallery */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Walk Photos</h3>
            <button className="text-sm text-[#FF8C42] font-medium flex items-center gap-1">
              <Download className="w-4 h-4" />
              Download All
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {photos.map((photo, index) => (
              <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                <img src={photo} alt={`Walk photo ${index + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent flex items-end p-2">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rate Walker */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4 text-center">Rate Your Walker</h3>
          <div className="flex justify-center gap-3 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-12 h-12 ${
                    star <= (hoveredRating || rating)
                      ? 'text-yellow-500 fill-yellow-500'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-gray-600 mb-4">
            {rating === 0 ? 'Tap to rate' : 
             rating === 5 ? 'Excellent! ⭐' :
             rating === 4 ? 'Great! 😊' :
             rating === 3 ? 'Good 👍' :
             rating === 2 ? 'Okay 😐' :
             'Needs Improvement 😕'}
          </p>
          
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Share your experience (optional)"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none"
            rows={4}
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleSubmitRating}
            className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white py-6 rounded-xl font-semibold"
          >
            Submit Rating & Finish
          </Button>
          
          <button className="w-full bg-white border-2 border-gray-200 text-gray-700 py-4 rounded-xl font-medium flex items-center justify-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Walk Summary
          </button>
        </div>
      </div>
    </div>
  );
}