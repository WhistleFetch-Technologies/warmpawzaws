import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { 
  ChevronLeft, Heart, Users, Sparkles, 
  Crown, MessageCircle, TrendingUp, Settings
} from 'lucide-react';
import { MatingDatingSwipe } from './MatingDatingSwipe';
import { MatingDatingMatches } from './MatingDatingMatches';
import { MatingDatingChat } from './MatingDatingChat';
import { MatingDatingProfile } from './MatingDatingProfile';
import { MatingDatingSubscription } from './MatingDatingSubscription';
// Brand color: #FF8C42

type ViewType = 'home' | 'swipe' | 'matches' | 'chat' | 'profile' | 'subscription';
type ModeType = 'pet' | 'owner';

interface MatingDatingHubProps {
  phone: string;
  onBack: () => void;
}

export function MatingDatingHub({ phone, onBack }: MatingDatingHubProps) {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [mode, setMode] = useState<ModeType>('pet');
  const [hasSubscription, setHasSubscription] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    // Check if user has active P2P dating subscription
    // This would call the API to verify subscription status
    setHasSubscription(false); // Placeholder
  };

  if (currentView === 'swipe') {
    return (
      <MatingDatingSwipe
        phone={phone}
        mode={mode}
        onBack={() => setCurrentView('home')}
        onMatch={(matchId) => {
          setSelectedMatchId(matchId);
          setCurrentView(hasSubscription ? 'chat' : 'subscription');
        }}
      />
    );
  }

  if (currentView === 'matches') {
    return (
      <MatingDatingMatches
        phone={phone}
        mode={mode}
        onBack={() => setCurrentView('home')}
        onChatClick={(matchId) => {
          setSelectedMatchId(matchId);
          setCurrentView(hasSubscription ? 'chat' : 'subscription');
        }}
      />
    );
  }

  if (currentView === 'chat' && selectedMatchId) {
    return (
      <MatingDatingChat
        phone={phone}
        matchId={selectedMatchId}
        onBack={() => setCurrentView('matches')}
      />
    );
  }

  if (currentView === 'profile') {
    return (
      <MatingDatingProfile
        phone={phone}
        mode={mode}
        onBack={() => setCurrentView('home')}
        onComplete={() => setCurrentView('swipe')}
      />
    );
  }

  if (currentView === 'subscription') {
    return (
      <MatingDatingSubscription
        phone={phone}
        onBack={() => setCurrentView('home')}
        onSuccess={() => {
          setHasSubscription(true);
          setCurrentView('chat');
        }}
      />
    );
  }

  // Home Screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={onBack} className="text-gray-600">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Mating & Dating
          </h1>
          <button onClick={() => setCurrentView('profile')} className="text-gray-600">
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* Mode Switcher */}
        <div className="bg-white rounded-2xl p-1 shadow-lg">
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setMode('pet')}
              className={`py-3 rounded-xl font-semibold transition-all ${
                mode === 'pet'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md'
                  : 'text-gray-600'
              }`}
            >
              <Heart className="w-5 h-5 mx-auto mb-1" />
              Pet Dating
            </button>
            <button
              onClick={() => setMode('owner')}
              className={`py-3 rounded-xl font-semibold transition-all ${
                mode === 'owner'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md'
                  : 'text-gray-600'
              }`}
            >
              <Users className="w-5 h-5 mx-auto mb-1" />
              Owner Dating
            </button>
          </div>
        </div>

        {/* Subscription Status */}
        {!hasSubscription && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Unlock Chat & More</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Subscribe to chat with matches, schedule meet-ups & access exclusive features
                </p>
                <Button
                  onClick={() => setCurrentView('subscription')}
                  className="mt-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white w-full"
                  size="sm"
                >
                  View Plans →
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 text-center shadow-sm">
            <Heart className="w-6 h-6 text-pink-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">12</p>
            <p className="text-xs text-gray-600">Matches</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-sm">
            <Users className="w-6 h-6 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">45</p>
            <p className="text-xs text-gray-600">Profiles</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-sm">
            <TrendingUp className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">78%</p>
            <p className="text-xs text-gray-600">Match Rate</p>
          </div>
        </div>

        {/* Main Actions */}
        <div className="space-y-3">
          <button
            onClick={() => setCurrentView('swipe')}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-2xl p-6 shadow-lg active:scale-95 transition-transform"
          >
            <Heart className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-lg">Start Swiping</p>
            <p className="text-sm opacity-90">Discover potential matches</p>
          </button>

          <button
            onClick={() => setCurrentView('matches')}
            className="w-full bg-white border-2 border-purple-200 text-purple-600 rounded-2xl p-6 shadow-sm active:scale-95 transition-transform"
          >
            <Users className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-lg">My Matches</p>
            <p className="text-sm opacity-75">View and chat with matches</p>
          </button>
        </div>

        {/* Features */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">What You Can Do</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-brown-500" />
              <div>
                <p className="font-medium text-gray-900">Schedule Meet-Ups</p>
                <p className="text-sm text-gray-600">At verified pet-friendly cafés</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5 text-blue-500" />
              <div>
                <p className="font-medium text-gray-900">Mating Appointments</p>
                <p className="text-sm text-gray-600">At approved vet clinics</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}