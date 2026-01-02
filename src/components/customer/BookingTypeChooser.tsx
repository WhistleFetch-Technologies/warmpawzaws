import { useState, useEffect } from 'react';
import { 
  Home, Video, Building2, Search, ChevronRight, MapPin, Clock,
  Heart, AlertCircle, Filter, Stethoscope, Shield, Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { toast } from 'sonner';

interface BookingTypeChooserProps {
  onTypeSelected: (type: 'at_home' | 'tele' | 'at_center', context?: any) => void;
  onProblemSearch: (problem: string) => void;
}

interface ProblemMapping {
  id: string;
  problem: string;
  keywords: string[];
  mappedServiceStyles: ('at_home' | 'tele' | 'at_center')[];
  urgency: 'low' | 'medium' | 'high';
  description: string;
}

export function BookingTypeChooser({ onTypeSelected, onProblemSearch }: BookingTypeChooserProps) {
  const [searchMode, setSearchMode] = useState<'type' | 'problem'>('type');
  const [problemQuery, setProblemQuery] = useState('');
  const [suggestedProblems, setSuggestedProblems] = useState<ProblemMapping[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // TASK 1: Problem-to-ServiceStyle mapping
  const problemMappings: ProblemMapping[] = [
    {
      id: 'emergency_urgent',
      problem: 'Emergency / Urgent Care',
      keywords: ['emergency', 'urgent', 'bleeding', 'accident', 'poison', 'critical'],
      mappedServiceStyles: ['tele', 'at_center'], // No home for emergencies
      urgency: 'high',
      description: 'Immediate attention needed. We recommend tele consultation first or visit nearest centre.'
    },
    {
      id: 'routine_checkup',
      problem: 'Routine Checkup / Vaccination',
      keywords: ['checkup', 'vaccination', 'vaccine', 'wellness', 'annual'],
      mappedServiceStyles: ['at_center', 'at_home'],
      urgency: 'low',
      description: 'Schedule a routine visit at our centre or request home service.'
    },
    {
      id: 'behavior_training',
      problem: 'Behavior Issues / Training',
      keywords: ['behavior', 'training', 'aggression', 'barking', 'obedience'],
      mappedServiceStyles: ['at_home', 'tele'],
      urgency: 'medium',
      description: 'Behavior assessment works best at home or via tele consultation.'
    },
    {
      id: 'grooming_spa',
      problem: 'Grooming / Spa',
      keywords: ['grooming', 'bath', 'haircut', 'spa', 'nail', 'trim'],
      mappedServiceStyles: ['at_center', 'at_home'],
      urgency: 'low',
      description: 'Professional grooming available at our centres or at your home.'
    },
    {
      id: 'diet_nutrition',
      problem: 'Diet / Nutrition Advice',
      keywords: ['diet', 'nutrition', 'food', 'weight', 'eating'],
      mappedServiceStyles: ['tele', 'at_center'],
      urgency: 'low',
      description: 'Get expert nutrition advice via tele consultation or centre visit.'
    },
    {
      id: 'skin_allergies',
      problem: 'Skin Issues / Allergies',
      keywords: ['skin', 'rash', 'itching', 'allergies', 'scratching'],
      mappedServiceStyles: ['tele', 'at_center', 'at_home'],
      urgency: 'medium',
      description: 'Start with tele consultation for initial assessment.'
    },
    {
      id: 'dental_care',
      problem: 'Dental Issues',
      keywords: ['dental', 'teeth', 'gums', 'bad breath', 'tooth'],
      mappedServiceStyles: ['at_center'],
      urgency: 'medium',
      description: 'Dental procedures require centre visit with proper equipment.'
    },
    {
      id: 'prescription_refill',
      problem: 'Prescription Refill / Follow-up',
      keywords: ['prescription', 'refill', 'followup', 'medication', 'medicine'],
      mappedServiceStyles: ['tele'],
      urgency: 'low',
      description: 'Quick tele consultation for prescription renewals.'
    },
    {
      id: 'walking_exercise',
      problem: 'Dog Walking / Exercise',
      keywords: ['walking', 'walk', 'exercise', 'activity'],
      mappedServiceStyles: ['at_home'],
      urgency: 'low',
      description: 'Professional dog walking at your doorstep.'
    }
  ];

  useEffect(() => {
    if (problemQuery.length >= 2) {
      const matches = problemMappings.filter(p => 
        p.problem.toLowerCase().includes(problemQuery.toLowerCase()) ||
        p.keywords.some(k => k.toLowerCase().includes(problemQuery.toLowerCase()))
      );
      setSuggestedProblems(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setSuggestedProblems([]);
      setShowSuggestions(false);
    }
  }, [problemQuery]);

  const handleProblemSelect = (problem: ProblemMapping) => {
    setProblemQuery(problem.problem);
    setShowSuggestions(false);
    
    // If only one service style is mapped, auto-select it
    if (problem.mappedServiceStyles.length === 1) {
      toast.success(`Redirecting to ${problem.mappedServiceStyles[0].replace('_', ' ')} services`);
      setTimeout(() => {
        onTypeSelected(problem.mappedServiceStyles[0], { problem: problem.problem });
      }, 500);
    } else {
      // Show service style options specific to this problem
      onProblemSearch(problem.problem);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Mode Toggle */}
      <div className="mb-6">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg max-w-md mx-auto">
          <button
            onClick={() => setSearchMode('type')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              searchMode === 'type'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Browse by Type
          </button>
          <button
            onClick={() => setSearchMode('problem')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              searchMode === 'problem'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Search by Problem
          </button>
        </div>
      </div>

      {/* Type Selection Mode */}
      {searchMode === 'type' && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">How would you like your service?</h1>
            <p className="text-gray-600">Choose your preferred booking type</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Home Service */}
            <Card
              onClick={() => onTypeSelected('at_home')}
              className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-[#FF8C42]"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Home className="w-8 h-8 text-[#FF8C42]" />
                </div>
                <h3 className="font-bold text-lg mb-2">Home Service</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Professional visits to your doorstep. Convenient and comfortable for your pet.
                </p>
                <div className="space-y-2 text-xs text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <MapPin className="w-3 h-3" />
                    <span>GPS tracked visits</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>Scheduled appointments</span>
                  </div>
                </div>
                <Button className="w-full mt-4 bg-[#FF8C42] hover:bg-[#FF7A2E]">
                  Choose Home Service
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>

            {/* Tele Consultation */}
            <Card
              onClick={() => onTypeSelected('tele')}
              className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-500"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Video className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-bold text-lg mb-2">Tele Consultation</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Quick video call with experts. Get instant advice from anywhere.
                </p>
                <div className="space-y-2 text-xs text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="w-3 h-3" />
                    <span>Instant or scheduled</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Shield className="w-3 h-3" />
                    <span>Secure video call</span>
                  </div>
                </div>
                <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
                  Choose Tele
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>

            {/* Centre Visit */}
            <Card
              onClick={() => onTypeSelected('at_center')}
              className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-green-500"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-bold text-lg mb-2">Visit Centre</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Full-service care at our equipped centres. Comprehensive facilities.
                </p>
                <div className="space-y-2 text-xs text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <Stethoscope className="w-3 h-3" />
                    <span>Advanced equipment</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Heart className="w-3 h-3" />
                    <span>Full medical suite</span>
                  </div>
                </div>
                <Button className="w-full mt-4 bg-green-600 hover:bg-green-700">
                  Choose Centre
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>
          </div>

          {/* Info Banner */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-blue-800">
                <p className="font-medium mb-1">Not sure which to choose?</p>
                <p>Switch to "Search by Problem" to get personalized recommendations based on your pet's needs.</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Problem Search Mode */}
      {searchMode === 'problem' && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">What's troubling your pet?</h1>
            <p className="text-gray-600">Describe the problem and we'll recommend the best service type</p>
          </div>

          {/* Search Input */}
          <div className="max-w-2xl mx-auto relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={problemQuery}
                onChange={(e) => setProblemQuery(e.target.value)}
                placeholder="e.g., skin rash, emergency, vaccination, grooming..."
                className="pl-12 h-14 text-lg"
                autoFocus
              />
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && (
              <Card className="absolute top-full left-0 right-0 mt-2 z-10 shadow-xl">
                <div className="divide-y">
                  {suggestedProblems.map((problem) => (
                    <button
                      key={problem.id}
                      onClick={() => handleProblemSelect(problem)}
                      className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-gray-900">{problem.problem}</h4>
                            <Badge className={`text-xs ${getUrgencyColor(problem.urgency)}`}>
                              {problem.urgency}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{problem.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {problem.mappedServiceStyles.map((style) => (
                              <Badge key={style} variant="outline" className="text-xs">
                                {style === 'at_home' && <Home className="w-3 h-3 mr-1" />}
                                {style === 'tele' && <Video className="w-3 h-3 mr-1" />}
                                {style === 'at_center' && <Building2 className="w-3 h-3 mr-1" />}
                                {style.replace('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Common Problems Quick Access */}
          <div className="max-w-2xl mx-auto">
            <h3 className="font-semibold text-gray-700 mb-3">Common Problems</h3>
            <div className="flex flex-wrap gap-2">
              {problemMappings.slice(0, 6).map((problem) => (
                <button
                  key={problem.id}
                  onClick={() => handleProblemSelect(problem)}
                  className="px-4 py-2 bg-white border-2 border-gray-200 rounded-lg hover:border-[#FF8C42] transition-colors text-sm"
                >
                  {problem.problem}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
