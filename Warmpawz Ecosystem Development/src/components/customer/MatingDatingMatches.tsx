import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { 
  ChevronLeft, MessageCircle, MapPin, Heart, 
  Calendar, Sparkles, Lock, Crown
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface MatingDatingMatchesProps {
  phone: string;
  mode: 'pet' | 'owner';
  onBack: () => void;
  onChatClick: (matchId: string) => void;
}

export function MatingDatingMatches({ phone, mode, onBack, onChatClick }: MatingDatingMatchesProps) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);

  useEffect(() => {
    checkSubscription();
    loadMatches();
  }, []);

  const checkSubscription = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/subscriptions/user/${phone}/check-access?feature=dating_chat&tierType=p2p_service`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        setHasSubscription(result.hasAccess);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const loadMatches = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/dating/matches/${phone}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        // Filter by mode
        const filteredMatches = (result.matches || []).filter((m: any) => m.profileType === mode);
        setMatches(filteredMatches);
      }
    } catch (error) {
      console.error('Error loading matches:', error);
      toast.error('Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const handleChatClick = (match: any) => {
    if (!hasSubscription) {
      toast.error('Subscription required to chat');
      onChatClick(match.id); // This will trigger subscription paywall
    } else {
      onChatClick(match.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading matches...</p>
        </div>
      </div>
    );
  }

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
              Your Matches
            </h1>
            <p className="text-xs text-gray-500">{matches.length} matches</p>
          </div>
          <div className="w-6"></div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Subscription Banner */}
        {!hasSubscription && matches.length > 0 && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Crown className="w-6 h-6 text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Unlock Chat to Connect</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Subscribe to start chatting with your matches
                </p>
              </div>
              <Lock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        )}

        {/* Matches List */}
        {matches.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm mt-8">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Matches Yet</h2>
            <p className="text-gray-600 mb-4">
              Start swiping to find your perfect match!
            </p>
            <Button
              onClick={onBack}
              className="bg-gradient-to-r from-pink-500 to-purple-500 text-white"
            >
              Start Swiping
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => {
              const profile = match.otherProfile;
              if (!profile) return null;

              return (
                <div
                  key={match.id}
                  className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="flex gap-4 p-4">
                    {/* Profile Photo */}
                    <div className="relative">
                      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                        <img
                          src={profile.photos?.[0] || 'https://via.placeholder.com/150'}
                          alt={profile.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {match.chatUnlocked && (
                        <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-1">
                          <MessageCircle className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    {/* Profile Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 truncate">
                            {profile.name}
                            {mode === 'pet' && profile.age && (
                              <span className="text-sm text-gray-500 ml-1">{profile.age} yrs</span>
                            )}
                          </h3>
                          {mode === 'pet' && profile.breed && (
                            <p className="text-sm text-gray-600">{profile.breed}</p>
                          )}
                        </div>
                        <Sparkles className="w-5 h-5 text-pink-500 flex-shrink-0" />
                      </div>

                      {mode === 'pet' && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {profile.temperament && (
                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs">
                              {profile.temperament}
                            </span>
                          )}
                          {profile.gender && (
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              profile.gender === 'male' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-pink-100 text-pink-700'
                            }`}>
                              {profile.gender}
                            </span>
                          )}
                        </div>
                      )}

                      {mode === 'owner' && profile.interests && profile.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {profile.interests.slice(0, 2).map((interest: string, idx: number) => (
                            <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                              {interest}
                            </span>
                          ))}
                        </div>
                      )}

                      {profile.location?.city && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="w-3 h-3" />
                          <span>{profile.location.city}</span>
                        </div>
                      )}

                      <div className="flex gap-2 mt-3">
                        <Button
                          onClick={() => handleChatClick(match)}
                          size="sm"
                          className={`flex-1 ${
                            hasSubscription
                              ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {hasSubscription ? (
                            <>
                              <MessageCircle className="w-4 h-4 mr-1" />
                              Chat
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4 mr-1" />
                              Unlock Chat
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Match Date */}
                  <div className="px-4 pb-3 flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    <span>Matched {new Date(match.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
