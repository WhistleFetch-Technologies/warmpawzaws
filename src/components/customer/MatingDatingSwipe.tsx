import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { 
  ChevronLeft, X, Heart, Star, MapPin, Info, Sparkles,
  Calendar, Shield
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface MatingDatingSwipeProps {
  phone: string;
  mode: 'pet' | 'owner';
  onBack: () => void;
  onMatch: (matchId: string) => void;
}

export function MatingDatingSwipe({ phone, mode, onBack, onMatch }: MatingDatingSwipeProps) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [myProfileId, setMyProfileId] = useState<string>('');
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<any>(null);

  useEffect(() => {
    loadMyProfile();
  }, []);

  useEffect(() => {
    if (myProfileId) {
      loadProfiles();
    }
  }, [myProfileId]);

  const loadMyProfile = async () => {
    try {
      // Try to get existing profile from API
      const profileId = mode === 'owner' 
        ? `owner_dating_${phone}` 
        : `pet_dating_${phone}_1`; // Default to first pet, can be enhanced later
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/dating/${mode}-profile/${profileId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.profile) {
          setMyProfileId(result.profile.id);
        } else {
          // Profile doesn't exist yet, user needs to create it
          toast.error('Please create your profile first');
          onBack();
        }
      } else {
        // Profile doesn't exist, user needs to create it
        toast.error('Please create your profile first');
        onBack();
      }
    } catch (error) {
      console.error('Error loading my profile:', error);
      toast.error('Please create your profile first');
      onBack();
    }
  };

  const loadProfiles = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/dating/discover`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            profileId: myProfileId,
            profileType: mode,
            filters: {} // You can add breed, distance, age filters here
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        setProfiles(result.profiles || []);
        if (result.profiles.length === 0) {
          toast.info('No more profiles to show. Check back later!');
        }
      } else {
        toast.error('Failed to load profiles');
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast.error('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (action: 'like' | 'dislike') => {
    if (currentIndex >= profiles.length) return;

    const currentProfile = profiles[currentIndex];
    
    setSwipeDirection(action === 'like' ? 'right' : 'left');

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/dating/swipe`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            profileId: myProfileId,
            targetProfileId: currentProfile.id,
            profileType: mode,
            action
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        
        if (result.isMatch) {
          // It's a match!
          setMatchedProfile(currentProfile);
          setShowMatchModal(true);
          
          // Wait for animation, then move to next
          setTimeout(() => {
            setSwipeDirection(null);
            setCurrentIndex(prev => prev + 1);
          }, 300);
        } else {
          // Just a swipe, move to next
          setTimeout(() => {
            setSwipeDirection(null);
            setCurrentIndex(prev => prev + 1);
          }, 300);
        }
      }
    } catch (error) {
      console.error('Error swiping:', error);
      toast.error('Failed to process swipe');
    }
  };

  const handleMatchModalClose = (startChat: boolean) => {
    setShowMatchModal(false);
    if (startChat && matchedProfile) {
      // This will trigger the subscription check in parent
      onMatch(matchedProfile.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profiles...</p>
        </div>
      </div>
    );
  }

  const currentProfile = profiles[currentIndex];
  const hasMoreProfiles = currentIndex < profiles.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={onBack} className="text-gray-600">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h1 className="font-bold text-lg bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Discover
            </h1>
            <p className="text-xs text-gray-500">{profiles.length - currentIndex} profiles</p>
          </div>
          <div className="w-6"></div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4">
        {!hasMoreProfiles ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-lg mt-8">
            <Star className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">No More Profiles</h2>
            <p className="text-gray-600 mb-4">
              You've seen all available profiles. Check back later for new matches!
            </p>
            <Button
              onClick={onBack}
              className="bg-gradient-to-r from-pink-500 to-purple-500 text-white"
            >
              Go Back
            </Button>
          </div>
        ) : (
          <>
            {/* Profile Card */}
            <div
              className={`relative bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
                swipeDirection === 'left' ? '-translate-x-full opacity-0' :
                swipeDirection === 'right' ? 'translate-x-full opacity-0' : ''
              }`}
              style={{ height: '70vh', maxHeight: '600px' }}
            >
              {/* Photos */}
              <div className="relative h-2/3">
                <img
                  src={currentProfile.photos[0] || 'https://via.placeholder.com/400x500'}
                  alt={currentProfile.name}
                  className="w-full h-full object-cover"
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>

                {/* Photo Counter */}
                {currentProfile.photos.length > 1 && (
                  <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                    1/{currentProfile.photos.length}
                  </div>
                )}

                {/* Vaccinated Badge */}
                {mode === 'pet' && currentProfile.vaccinated && (
                  <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Vaccinated
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="p-6 space-y-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    {currentProfile.name}
                    {mode === 'pet' && (
                      <span className="text-lg text-gray-500">{currentProfile.age} yrs</span>
                    )}
                  </h2>
                  {mode === 'pet' && (
                    <p className="text-gray-600">{currentProfile.breed}</p>
                  )}
                </div>

                {mode === 'pet' && (
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">
                      {currentProfile.temperament}
                    </span>
                    <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-sm">
                      {currentProfile.lookingFor === 'both' ? 'Mating & Playdate' : 
                       currentProfile.lookingFor === 'mating' ? 'Mating' : 'Playdate'}
                    </span>
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm capitalize">
                      {currentProfile.gender}
                    </span>
                  </div>
                )}

                {currentProfile.bio && (
                  <p className="text-gray-700 text-sm line-clamp-3">{currentProfile.bio}</p>
                )}

                {mode === 'owner' && currentProfile.interests && currentProfile.interests.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {currentProfile.interests.slice(0, 4).map((interest: string, idx: number) => (
                      <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                        {interest}
                      </span>
                    ))}
                  </div>
                )}

                {currentProfile.location && currentProfile.location.city && (
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{currentProfile.location.city}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-6 mt-6">
              <button
                onClick={() => handleSwipe('dislike')}
                className="bg-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
              >
                <X className="w-8 h-8 text-red-500" />
              </button>

              <button
                onClick={() => handleSwipe('like')}
                className="bg-gradient-to-r from-pink-500 to-purple-500 w-20 h-20 rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
              >
                <Heart className="w-10 h-10 text-white fill-white" />
              </button>

              <button className="bg-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform active:scale-95">
                <Star className="w-8 h-8 text-yellow-500" />
              </button>
            </div>

            {/* Tips */}
            <div className="mt-6 bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Swipe Tips</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Swipe right to like, left to pass. If both like each other, it's a match!
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Match Modal */}
      {showMatchModal && matchedProfile && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center relative overflow-hidden">
            {/* Confetti Effect */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 20 }).map((_, i) => (
                <Sparkles
                  key={i}
                  className="absolute text-yellow-400 animate-bounce"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`
                  }}
                />
              ))}
            </div>

            <div className="relative z-10">
              <div className="mb-4">
                <div className="w-24 h-24 mx-auto mb-4 relative">
                  <Heart className="w-full h-full text-pink-500 fill-pink-500 animate-pulse" />
                </div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  It's a Match!
                </h2>
                <p className="text-gray-600">
                  You and {matchedProfile.name} liked each other
                </p>
              </div>

              <div className="flex gap-2 mb-4">
                <div className="flex-1 aspect-square rounded-xl overflow-hidden">
                  <img 
                    src={matchedProfile.photos[0] || 'https://via.placeholder.com/200'} 
                    alt={matchedProfile.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                  <Heart className="w-16 h-16 text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={() => handleMatchModalClose(true)}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white"
                >
                  <Heart className="w-5 h-5 mr-2" />
                  Start Chatting
                </Button>
                <Button
                  onClick={() => handleMatchModalClose(false)}
                  variant="outline"
                  className="w-full"
                >
                  Keep Swiping
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}