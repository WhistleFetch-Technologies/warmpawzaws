import { useState } from 'react';
import { Button } from '../ui/button';
import { ChevronLeft } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import logoImage from 'figma:asset/da6636b92da744b3db8eed5288ca6da9ab889afe.png';

interface CustomerPlanningJourneyProps {
  session: any;
  onComplete: () => void;
}

interface QuestionnaireData {
  timeCommitment: string;
  children: string;
  otherPets: string;
  allergies: string;
  dogSize: string;
  energyLevel: string;
  importantTraits: string[];
  selectedBreeds: string[];
  comparedBreeds: string[];
}

export function CustomerPlanningJourney({ session, onComplete }: CustomerPlanningJourneyProps) {
  const [currentStep, setCurrentStep] = useState(6);
  const [loading, setLoading] = useState(false);
  
  const [data, setData] = useState<QuestionnaireData>({
    timeCommitment: '',
    children: '',
    otherPets: '',
    allergies: '',
    dogSize: '',
    energyLevel: '',
    importantTraits: [],
    selectedBreeds: [],
    comparedBreeds: []
  });

  const totalSteps = 12;

  const handleNext = async () => {
    // Validate current step has selection
    if (!isStepValid()) return;

    if (currentStep === 11) {
      // Last step shown, save and complete
      await saveQuestionnaire(data);
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 6) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isStepValid = (): boolean => {
    switch (currentStep) {
      case 6: return !!data.timeCommitment;
      case 7: return !!(data.children && data.otherPets && data.allergies);
      case 8: return !!(data.dogSize && data.energyLevel);
      case 9: return true; // Skippable step
      case 10: return data.selectedBreeds.length > 0;
      case 11: return true; // Final comparison step
      default: return true;
    }
  };

  const saveQuestionnaire = async (questionnaireData: QuestionnaireData) => {
    setLoading(true);
    try {
      console.log('Saving questionnaire with phone:', session.phone);
      console.log('Questionnaire data:', questionnaireData);
      
      // Save to localStorage as mock storage
      const existingData = localStorage.getItem('warmpawz_customer_questionnaires') || '[]';
      const questionnaires = JSON.parse(existingData);
      
      questionnaires.push({
        id: `quest_${Date.now()}`,
        phone: session.phone,
        type: 'planning',
        data: questionnaireData,
        createdAt: new Date().toISOString()
      });
      
      localStorage.setItem('warmpawz_customer_questionnaires', JSON.stringify(questionnaires));
      
      console.log('Questionnaire saved successfully');
      
      // Small delay to simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error('Error saving questionnaire:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 6:
        return (
          <>
            {/* Logo */}
            <div className="flex justify-center pt-8 mb-6">
              <img src={logoImage} alt="WarmPawz" className="w-16 h-16 object-contain" />
            </div>

            {/* Orange Circle Icon */}
            <div className="flex flex-col items-center mb-8 px-6">
              <div className="w-24 h-24 bg-[#FF8C42] rounded-full flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M24 8L24 24L32 32" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M24 8C15 8 8 15 8 24C8 33 15 40 24 40C33 40 40 33 40 24" stroke="white" strokeWidth="4" strokeLinecap="round"/>
                </svg>
              </div>
              <h1 className="text-black text-center">Time<br />Commitment ⏱️</h1>
            </div>

            {/* Content */}
            <div className="px-6 mb-6">
              <p className="text-center text-black mb-6">
                Pets need daily attention and care 💕
              </p>

              {/* Info Card */}
              <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⏰</span>
                  <div>
                    <p className="text-sm font-semibold text-orange-900 mb-2">Daily time needs (average):</p>
                    <ul className="text-xs text-orange-800 space-y-1">
                      <li>• Feeding & water: 15-30 min</li>
                      <li>• Exercise/play: 30-120 min</li>
                      <li>• Grooming: 10-30 min</li>
                      <li>• Training/bonding: 15-45 min</li>
                    </ul>
                  </div>
                </div>
              </div>

              <p className="text-black mb-4 text-sm">How much time can you dedicate daily?</p>

              <div className="space-y-3">
                <button
                  onClick={() => setData({ ...data, timeCommitment: '1-2-hours' })}
                  className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                    data.timeCommitment === '1-2-hours' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  <p className="text-black font-medium">1-2 hours per day</p>
                  <p className="text-xs text-gray-600">Basic care & short activities</p>
                </button>

                <button
                  onClick={() => setData({ ...data, timeCommitment: '2-4-hours' })}
                  className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                    data.timeCommitment === '2-4-hours' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  <p className="text-black font-medium">2-4 hours per day</p>
                  <p className="text-xs text-gray-600">Good care & regular activities</p>
                </button>

                <button
                  onClick={() => setData({ ...data, timeCommitment: '4-plus-hours' })}
                  className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                    data.timeCommitment === '4-plus-hours' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  <p className="text-black font-medium">4+ hours per day</p>
                  <p className="text-xs text-gray-600">Lots of time for bonding & training</p>
                </button>
              </div>
            </div>
          </>
        );

      case 7:
        return (
          <>
            {/* Logo */}
            <div className="flex justify-center pt-8 mb-6">
              <img src={logoImage} alt="WarmPawz" className="w-16 h-16 object-contain" />
            </div>

            {/* Orange Circle Icon */}
            <div className="flex flex-col items-center mb-8 px-6">
              <div className="w-24 h-24 bg-[#FF8C42] rounded-full flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="16" r="6" fill="white"/>
                  <path d="M14 28C14 24 18 20 24 20C30 20 34 24 34 28V36H14V28Z" fill="white"/>
                  <circle cx="34" cy="20" r="4" fill="white"/>
                  <path d="M38 28C38 26 36 24 34 24" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h1 className="text-black text-center">Your<br />Household 👨‍👩‍👧</h1>
            </div>

            {/* Content */}
            <div className="px-6 mb-6">
              <p className="text-black mb-4">Important factors for choosing the right pet</p>

              {/* Children */}
              <div className="mb-6">
                <p className="text-black mb-3 text-sm font-medium">Do you have children at home?</p>
                <div className="space-y-2">
                  <button
                    onClick={() => setData({ ...data, children: 'no-children' })}
                    className={`w-full border-2 rounded-xl p-3 text-left transition-all ${
                      data.children === 'no-children' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <p className="text-black text-sm">No children</p>
                  </button>

                  <button
                    onClick={() => setData({ ...data, children: 'young-children' })}
                    className={`w-full border-2 rounded-xl p-3 text-left transition-all ${
                      data.children === 'young-children' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <p className="text-black text-sm">Yes, young children (under 6)</p>
                  </button>

                  <button
                    onClick={() => setData({ ...data, children: 'older-children' })}
                    className={`w-full border-2 rounded-xl p-3 text-left transition-all ${
                      data.children === 'older-children' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <p className="text-black text-sm">Yes, older children (6+)</p>
                  </button>
                </div>
              </div>

              {/* Other Pets */}
              <div className="mb-6">
                <p className="text-black mb-3 text-sm font-medium">Do you have other pets?</p>
                <div className="space-y-2">
                  <button
                    onClick={() => setData({ ...data, otherPets: 'no-other-pets' })}
                    className={`w-full border-2 rounded-xl p-3 text-left transition-all ${
                      data.otherPets === 'no-other-pets' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <p className="text-black text-sm">No other pets</p>
                  </button>

                  <button
                    onClick={() => setData({ ...data, otherPets: 'have-dogs' })}
                    className={`w-full border-2 rounded-xl p-3 text-left transition-all ${
                      data.otherPets === 'have-dogs' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <p className="text-black text-sm">Yes, I have dog(s)</p>
                  </button>

                  <button
                    onClick={() => setData({ ...data, otherPets: 'have-cats' })}
                    className={`w-full border-2 rounded-xl p-3 text-left transition-all ${
                      data.otherPets === 'have-cats' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <p className="text-black text-sm">Yes, I have cat(s)</p>
                  </button>

                  <button
                    onClick={() => setData({ ...data, otherPets: 'other-animals' })}
                    className={`w-full border-2 rounded-xl p-3 text-left transition-all ${
                      data.otherPets === 'other-animals' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <p className="text-black text-sm">Yes, other animals</p>
                  </button>
                </div>
              </div>

              {/* Allergies */}
              <div className="mb-6">
                <p className="text-black mb-3 text-sm font-medium">Any allergies in your household?</p>
                <div className="space-y-2">
                  <button
                    onClick={() => setData({ ...data, allergies: 'no-allergies' })}
                    className={`w-full border-2 rounded-xl p-3 text-left transition-all ${
                      data.allergies === 'no-allergies' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <p className="text-black text-sm">No allergies</p>
                  </button>

                  <button
                    onClick={() => setData({ ...data, allergies: 'mild-allergies' })}
                    className={`w-full border-2 rounded-xl p-3 text-left transition-all ${
                      data.allergies === 'mild-allergies' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <p className="text-black text-sm">Mild allergies (manageable)</p>
                  </button>

                  <button
                    onClick={() => setData({ ...data, allergies: 'severe-allergies' })}
                    className={`w-full border-2 rounded-xl p-3 text-left transition-all ${
                      data.allergies === 'severe-allergies' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <p className="text-black text-sm">Severe allergies (need hypoallergenic)</p>
                  </button>
                </div>
              </div>
            </div>
          </>
        );

      case 8:
        return (
          <>
            {/* Logo */}
            <div className="flex justify-center pt-8 mb-6">
              <img src={logoImage} alt="WarmPawz" className="w-16 h-16 object-contain" />
            </div>

            {/* Orange Circle Icon */}
            <div className="flex flex-col items-center mb-8 px-6">
              <div className="w-24 h-24 bg-[#FF8C42] rounded-full flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M24 8L20 14L14 16L18 22L16 28L24 24L32 28L30 22L34 16L28 14L24 8Z" fill="white"/>
                  <circle cx="24" cy="32" r="3" fill="white"/>
                </svg>
              </div>
              <h1 className="text-black text-center">Dog Size &<br />Energy ⚡</h1>
            </div>

            {/* Content */}
            <div className="px-6 mb-6">
              <p className="text-black mb-4">What size and energy level fits your lifestyle?</p>

              {/* Dog Size */}
              <div className="mb-6">
                <p className="text-black mb-3 text-sm font-medium">Preferred dog size</p>
                <div className="space-y-3">
                  <button
                    onClick={() => setData({ ...data, dogSize: 'small' })}
                    className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                      data.dogSize === 'small' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🐕</span>
                      <div className="flex-1">
                        <p className="text-black font-medium">Small (under 25 lbs)</p>
                        <p className="text-xs text-gray-600">Easier to handle, good for apartments</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setData({ ...data, dogSize: 'medium' })}
                    className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                      data.dogSize === 'medium' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🐕</span>
                      <div className="flex-1">
                        <p className="text-black font-medium">Medium (25-60 lbs)</p>
                        <p className="text-xs text-gray-600">Versatile, great family dogs</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setData({ ...data, dogSize: 'large' })}
                    className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                      data.dogSize === 'large' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🐕🐕</span>
                      <div className="flex-1">
                        <p className="text-black font-medium">Large (60+ lbs)</p>
                        <p className="text-xs text-gray-600">Need more space, great protectors</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setData({ ...data, dogSize: 'no-preference' })}
                    className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                      data.dogSize === 'no-preference' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🤷</span>
                      <div className="flex-1">
                        <p className="text-black font-medium">No preference</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Energy Level */}
              <div className="mb-6">
                <p className="text-black mb-3 text-sm font-medium">Preferred energy level</p>
                <div className="space-y-3">
                  <button
                    onClick={() => setData({ ...data, energyLevel: 'low' })}
                    className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                      data.energyLevel === 'low' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">😴</span>
                      <div className="flex-1">
                        <p className="text-black font-medium">Low energy</p>
                        <p className="text-xs text-gray-600">Calm, prefers lounging</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setData({ ...data, energyLevel: 'moderate' })}
                    className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                      data.energyLevel === 'moderate' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🚶</span>
                      <div className="flex-1">
                        <p className="text-black font-medium">Moderate energy</p>
                        <p className="text-xs text-gray-600">Balanced, adaptable</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setData({ ...data, energyLevel: 'high' })}
                    className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                      data.energyLevel === 'high' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⚡</span>
                      <div className="flex-1">
                        <p className="text-black font-medium">High energy</p>
                        <p className="text-xs text-gray-600">Active, needs lots of exercise</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </>
        );

      case 9:
        return (
          <>
            {/* Orange Circle Icon */}
            <div className="flex flex-col items-center pt-12 mb-6 px-6">
              <div className="w-24 h-24 bg-[#FF8C42] rounded-full flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect x="14" y="14" width="8" height="8" rx="2" fill="white"/>
                  <circle cx="30" cy="18" r="4" fill="white"/>
                  <rect x="26" y="26" width="8" height="8" rx="2" fill="white"/>
                  <path d="M14 30L18 26M30 22L26 26" stroke="white" strokeWidth="2"/>
                </svg>
              </div>
              <h1 className="text-black text-center">Important<br />Traits ⭐</h1>
            </div>

            {/* Content */}
            <div className="px-6 mb-6">
              <p className="text-center text-black mb-6 text-sm">
                Select all that are important to you
              </p>

              <div className="space-y-2">
                {[
                  { emoji: '😊', label: 'Friendly with kids' },
                  { emoji: '🐾', label: 'Good with other pets' },
                  { emoji: '✂️', label: 'Low maintenance grooming' },
                  { emoji: '🎓', label: 'Trainable' },
                  { emoji: '🤫', label: 'Quiet/Less barking' },
                  { emoji: '💖', label: 'Affectionate' },
                  { emoji: '😺', label: 'Independent' },
                  { emoji: '🎾', label: 'Playful' },
                  { emoji: '🛡️', label: 'Protective' }
                ].map((trait) => {
                  const isSelected = data.importantTraits.includes(trait.label);
                  return (
                    <button
                      key={trait.label}
                      onClick={() => {
                        if (isSelected) {
                          setData({
                            ...data,
                            importantTraits: data.importantTraits.filter(t => t !== trait.label)
                          });
                        } else {
                          setData({
                            ...data,
                            importantTraits: [...data.importantTraits, trait.label]
                          });
                        }
                      }}
                      className={`w-full border-2 rounded-xl p-3 text-left transition-all flex items-center gap-3 ${
                        isSelected ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <span className="text-lg">{trait.emoji}</span>
                      <span className="text-black text-sm flex-1">{trait.label}</span>
                      {isSelected && (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d="M7 10L9 12L13 8" stroke="#FF8C42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="text-center text-gray-500 text-xs mt-6">
                You can skip this step if you're not sure yet
              </p>
            </div>
          </>
        );

      case 10:
        return (
          <>
            {/* Orange Circle Icon */}
            <div className="flex flex-col items-center pt-12 mb-6 px-6">
              <div className="w-24 h-24 bg-[#FF8C42] rounded-full flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="16" stroke="white" strokeWidth="3" fill="none"/>
                  <circle cx="24" cy="24" r="10" stroke="white" strokeWidth="3" fill="none"/>
                  <circle cx="24" cy="24" r="4" fill="white"/>
                </svg>
              </div>
              <h1 className="text-black text-center">Perfect Breeds<br />for You</h1>
            </div>

            {/* Content */}
            <div className="px-6 mb-6">
              <p className="text-center text-black mb-4 text-sm">
                Based on your lifestyle and preferences
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-6">
                <p className="text-blue-900 text-xs text-center">
                  💡 Select up to 3 breeds to compare
                </p>
              </div>

              <div className="space-y-4">
                {/* French Bulldog */}
                <button
                  onClick={() => {
                    const isSelected = data.selectedBreeds.includes('French Bulldog');
                    if (isSelected) {
                      setData({
                        ...data,
                        selectedBreeds: data.selectedBreeds.filter(b => b !== 'French Bulldog')
                      });
                    } else if (data.selectedBreeds.length < 3) {
                      setData({
                        ...data,
                        selectedBreeds: [...data.selectedBreeds, 'French Bulldog']
                      });
                    }
                  }}
                  className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                    data.selectedBreeds.includes('French Bulldog') ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">🐕</span>
                    <div className="flex-1">
                      <h3 className="text-black font-medium">French Bulldog</h3>
                      <p className="text-xs text-gray-600 mb-2">Adaptable, playful, and smart</p>
                      <div className="flex gap-2 mb-2">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">Small</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">Low Energy</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 6L5 8L9 4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-gray-600">Apartment living</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 6L5 8L9 4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-gray-600">Little exercise needs</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 6L5 8L9 4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-gray-600">Seniors</span>
                    </div>
                  </div>
                </button>

                {/* Shih Tzu */}
                <button
                  onClick={() => {
                    const isSelected = data.selectedBreeds.includes('Shih Tzu');
                    if (isSelected) {
                      setData({
                        ...data,
                        selectedBreeds: data.selectedBreeds.filter(b => b !== 'Shih Tzu')
                      });
                    } else if (data.selectedBreeds.length < 3) {
                      setData({
                        ...data,
                        selectedBreeds: [...data.selectedBreeds, 'Shih Tzu']
                      });
                    }
                  }}
                  className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                    data.selectedBreeds.includes('Shih Tzu') ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">🐕</span>
                    <div className="flex-1">
                      <h3 className="text-black font-medium">Shih Tzu</h3>
                      <p className="text-xs text-gray-600 mb-2">Affectionate, playful, and outgoing</p>
                      <div className="flex gap-2 mb-2">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">Small</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">Low Energy</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 6L5 8L9 4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-gray-600">Apartment living</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 6L5 8L9 4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-gray-600">Families</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 6L5 8L9 4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-gray-600">Seniors</span>
                    </div>
                  </div>
                </button>

                {/* Cavalier King Charles */}
                <button
                  onClick={() => {
                    const isSelected = data.selectedBreeds.includes('Cavalier King Charles');
                    if (isSelected) {
                      setData({
                        ...data,
                        selectedBreeds: data.selectedBreeds.filter(b => b !== 'Cavalier King Charles')
                      });
                    } else if (data.selectedBreeds.length < 3) {
                      setData({
                        ...data,
                        selectedBreeds: [...data.selectedBreeds, 'Cavalier King Charles']
                      });
                    }
                  }}
                  className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                    data.selectedBreeds.includes('Cavalier King Charles') ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">🐕</span>
                    <div className="flex-1">
                      <h3 className="text-black font-medium">Cavalier King Charles</h3>
                      <p className="text-xs text-gray-600 mb-2">Gentle, affectionate, and graceful</p>
                      <div className="flex gap-2 mb-2">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">Small</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">Moderate Energy</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 6L5 8L9 4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-gray-600">Families</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 6L5 8L9 4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-gray-600">Seniors</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 6L5 8L9 4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-gray-600">First-time owners</span>
                    </div>
                  </div>
                </button>
              </div>

              <p className="text-center text-gray-500 text-xs mt-6">
                Select at least one breed to continue
              </p>
            </div>
          </>
        );

      case 11:
        return (
          <>
            {/* Orange Circle Icon */}
            <div className="flex flex-col items-center pt-12 mb-6 px-6">
              <div className="w-24 h-24 bg-[#FF8C42] rounded-full flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M12 18L24 10L36 18L36 32L24 40L12 32L12 18Z" stroke="white" strokeWidth="3" fill="none"/>
                  <path d="M24 24L24 10M12 18L24 24M36 18L24 24" stroke="white" strokeWidth="2"/>
                </svg>
              </div>
              <h1 className="text-black text-center">Compare<br />Breeds</h1>
            </div>

            {/* Content */}
            <div className="px-6 mb-6">
              <p className="text-center text-black mb-6 text-sm">
                Detailed pros & cons for your selections
              </p>

              <div className="space-y-6">
                {data.selectedBreeds.map((breed) => {
                  const breedData: Record<string, any> = {
                    'Shih Tzu': {
                      emoji: '🐕',
                      description: 'Affectionate, playful, and outgoing',
                      pros: ['Pros:', 'Good with kids', 'Friendly personality', 'Adaptable'],
                      cons: ['Cons:', 'Requires regular grooming', 'Can be stubborn', 'Health issues to watch'],
                      bestFor: ['Apartments', 'Families', 'Seniors', 'First-time owners']
                    },
                    'French Bulldog': {
                      emoji: '🐕',
                      description: 'Adaptable, playful, and smart',
                      pros: ['Pros:', 'Low exercise needs', 'Great apartment dog', 'Minimal barking'],
                      cons: ['Cons:', 'Heat sensitivity', 'Breathing issues', 'Health complications'],
                      bestFor: ['Apartments', 'Low active owners', 'Seniors']
                    },
                    'Cavalier King Charles': {
                      emoji: '🐕',
                      description: 'Gentle, affectionate, and graceful',
                      pros: ['Pros:', 'Excellent companions', 'Good with children', 'Adaptable to lifestyle'],
                      cons: ['Cons:', 'Health issues common', 'Needs companionship', 'Regular grooming needed'],
                      bestFor: ['Families', 'Seniors', 'First-time owners']
                    }
                  };

                  const info = breedData[breed];
                  if (!info) return null;

                  return (
                    <div key={breed} className="border-2 border-gray-200 rounded-xl p-4">
                      <div className="flex items-start gap-3 mb-4">
                        <span className="text-3xl">{info.emoji}</span>
                        <div>
                          <h3 className="text-black font-medium">{breed}</h3>
                          <p className="text-xs text-gray-600">{info.description}</p>
                        </div>
                      </div>

                      {/* Pros */}
                      <div className="mb-3">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          {info.pros.map((pro: string, idx: number) => (
                            <p key={idx} className={`text-xs ${idx === 0 ? 'font-medium text-green-900 mb-1' : 'text-green-800'}`}>
                              {idx > 0 && '✓ '}{pro}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Cons */}
                      <div className="mb-3">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          {info.cons.map((con: string, idx: number) => (
                            <p key={idx} className={`text-xs ${idx === 0 ? 'font-medium text-red-900 mb-1' : 'text-red-800'}`}>
                              {idx > 0 && '✗ '}{con}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Best For */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-blue-900 mb-2">🌟 Best for:</p>
                        <div className="flex flex-wrap gap-2">
                          {info.bestFor.map((item: string, idx: number) => (
                            <span key={idx} className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-center text-blue-600 text-sm mt-6">
                💡 Need more info? <span className="underline">Get detailed adoption guides & breeder info</span>
              </p>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col w-full max-w-[430px] mx-auto">
      {/* Status Bar */}
      <div className="px-6 pt-3 pb-2 flex justify-between items-center">
        <span className="text-black text-sm">09:41</span>
        <div className="flex gap-1.5 items-center">
          <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
            <rect y="8" width="3" height="4" rx="0.5" fill="black"/>
            <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="black"/>
            <rect x="9" y="2" width="3" height="10" rx="0.5" fill="black"/>
            <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="black"/>
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <path d="M0.5 7.5C2.5 5.5 5.5 4 8 4C10.5 4 13.5 5.5 15.5 7.5M3.5 10C5 8.5 6.5 8 8 8C9.5 8 11 8.5 12.5 10" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
            <rect x="0.75" y="1.5" width="20" height="9" rx="2" stroke="black" strokeWidth="1.5"/>
            <rect x="2.5" y="3" width="16.5" height="6" rx="1" fill="black"/>
            <rect x="22" y="4" width="2.5" height="4" rx="1" fill="black"/>
          </svg>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        {renderStep()}
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-[430px] mx-auto w-full">
        {/* Progress Bar with Back Button */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleBack}
            disabled={currentStep === 6}
            className="p-2 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5 text-black" />
          </button>
          
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#FF8C42] transition-all duration-300 rounded-full"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>
          
          <span className="text-sm text-gray-600 font-medium">
            Step {currentStep}/{totalSteps}
          </span>
        </div>

        {/* Continue Button */}
        <Button
          onClick={handleNext}
          disabled={!isStepValid() || loading}
          className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Continue'}
        </Button>

        {/* Home Indicator */}
        <div className="flex justify-center mt-4">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    </div>
  );
}