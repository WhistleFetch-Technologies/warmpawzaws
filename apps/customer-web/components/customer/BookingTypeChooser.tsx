'use client';

import { useState, useEffect } from 'react';
import { 
  Home, Video, Building2, Search, ChevronRight, MapPin, Clock,
  Heart, AlertCircle, Filter, Stethoscope, Shield, Sparkles
} from 'lucide-react';
import Image from 'next/image';

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

  const problemMappings: ProblemMapping[] = [
    {
      id: 'emergency_urgent',
      problem: 'Emergency / Urgent Care',
      keywords: ['emergency', 'urgent', 'bleeding', 'accident', 'poison', 'critical'],
      mappedServiceStyles: ['tele', 'at_center'],
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
    
    if (problem.mappedServiceStyles.length === 1) {
      setTimeout(() => {
        onTypeSelected(problem.mappedServiceStyles[0], { problem: problem.problem });
      }, 500);
    } else {
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
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Mode Toggle */}
      <div className="bg-white border-b px-4 py-4">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl max-w-md mx-auto">
          <button
            onClick={() => setSearchMode('type')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
              searchMode === 'type'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Choose Type
          </button>
          <button
            onClick={() => setSearchMode('problem')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
              searchMode === 'problem'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Search Problem
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {searchMode === 'type' ? (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">How would you like to book?</h2>
            
            {/* Service Type Cards */}
            <button
              onClick={() => onTypeSelected('at_home')}
              className="w-full bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-primary hover:shadow-lg transition-all text-left active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center">
                  <Home className="w-8 h-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg mb-1">At Home Service</h3>
                  <p className="text-sm text-gray-600">Professional service at your doorstep</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>

            <button
              onClick={() => onTypeSelected('tele')}
              className="w-full bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-primary hover:shadow-lg transition-all text-left active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
                  <Video className="w-8 h-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg mb-1">Tele Consultation</h3>
                  <p className="text-sm text-gray-600">Video consultation with experts</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>

            <button
              onClick={() => onTypeSelected('at_center')}
              className="w-full bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-primary hover:shadow-lg transition-all text-left active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg mb-1">Visit Center</h3>
                  <p className="text-sm text-gray-600">Book appointment at our facility</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">What's the problem?</h2>
            
            {/* Problem Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={problemQuery}
                onChange={(e) => setProblemQuery(e.target.value)}
                placeholder="Search for a problem or symptom..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
              />
            </div>

            {/* Suggestions */}
            {showSuggestions && suggestedProblems.length > 0 && (
              <div className="space-y-2">
                {suggestedProblems.map((problem) => (
                  <button
                    key={problem.id}
                    onClick={() => handleProblemSelect(problem)}
                    className="w-full bg-white rounded-xl border-2 border-gray-200 p-4 hover:border-primary hover:shadow-md transition-all text-left active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{problem.problem}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getUrgencyColor(problem.urgency)}`}>
                        {problem.urgency}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{problem.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {problem.mappedServiceStyles.map((style) => (
                        <span key={style} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                          {style.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* All Problems List */}
            {!showSuggestions && (
              <div className="space-y-2">
                {problemMappings.map((problem) => (
                  <button
                    key={problem.id}
                    onClick={() => handleProblemSelect(problem)}
                    className="w-full bg-white rounded-xl border-2 border-gray-200 p-4 hover:border-primary hover:shadow-md transition-all text-left active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{problem.problem}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getUrgencyColor(problem.urgency)}`}>
                        {problem.urgency}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{problem.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

