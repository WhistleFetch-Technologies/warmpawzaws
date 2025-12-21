import { useState } from 'react';
import { Button } from '../ui/button';
import { ChevronLeft } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
// Logo placeholder - using base64 encoded SVG (Warmpawz logo)
const logoImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjRkY4QzQyIi8+CiAgPHBhdGggZD0iTTIwIDEyQzE2LjY4NjMgMTIgMTQgMTQuNjg2MyAxNCAxOEMxNCAxOS41OTEzIDE0LjYzMjEgMjEuMDI2MSAxNS42NTY5IDIyLjA1MTRDMTY4MjE3IDIzLjA3NjcgMTguMTE2NSAyMy43MDg4IDE5LjcwNzcgMjMuNzA4OEMyMS4yOTg5IDIzLjcwODggMjIuNzMzNyAyMy4wNzY3IDIzLjc1ODUgMjIuMDUxNEMyNC43ODMzIDIxLjAyNjEgMjUuNDE1NCAxOS41OTEzIDI1LjQxNTQgMThDMjUuNDE1NCAxNC42ODYzIDIyLjcyOTEgMTIgMTkuNDE1NCAxMkgyMFpNMjAgMTRDMjEuNjU2OSAxNCAyMyAxNS4zNDMxIDIzIDE3QzIzIDE4LjY1NjkgMjEuNjU2OSAyMCAyMCAyMEMxOC4zNDMxIDIwIDE3IDE4LjY1NjkgMTcgMTdDMTcgMTUuMzQzMSAxOC4zNDMxIDE0IDIwIDE0WiIgZmlsbD0id2hpdGUiLz4KICA8cGF0aCBkPSJNMTIgMjRDMTIgMjQuNTUyMyAxMi40NDc3IDI1IDEzIDI1SDI3QzI3LjU1MjMgMjUgMjggMjQuNTUyMyAyOCAyNEMyOCAyMi4zNDMxIDI2LjY1NjkgMjEgMjUgMjFIMTVDMTMuMzQzMSAyMSAxMiAyMi4zNDMxIDEyIDI0WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';

interface CustomerHavePetJourneyProps {
  session: any;
  onComplete: () => void;
}

interface OnboardingData {
  petName: string;
  petType: string;
  breed: string;
  age: string;
  gender: string;
  weight: string;
  livingSpace: {
    homeType: string;
    outdoorSpace: string;
  };
  lifestyle: {
    workSchedule: string;
    activityLevel: string;
    travelFrequency: string;
  };
  budget: string;
  healthInfo: {
    spayedNeutered: string;
    allergies: string;
    medications: string;
  };
  preferences: string[];
}

export function CustomerHavePetJourney({ session, onComplete }: CustomerHavePetJourneyProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [data, setData] = useState<OnboardingData>({
    petName: '',
    petType: '',
    breed: '',
    age: '',
    gender: '',
    weight: '',
    livingSpace: {
      homeType: '',
      outdoorSpace: ''
    },
    lifestyle: {
      workSchedule: '',
      activityLevel: '',
      travelFrequency: ''
    },
    budget: '',
    healthInfo: {
      spayedNeutered: '',
      allergies: '',
      medications: ''
    },
    preferences: []
  });

  const [tempSelections, setTempSelections] = useState<any>({});

  const totalSteps = 12;

  const handleNext = async () => {
    // Validate selections based on current step
    const isValid = validateStep(currentStep);
    if (!isValid) return;

    if (currentStep === totalSteps) {
      await saveOnboarding(data);
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
      setTempSelections({});
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 3:
        return !!(tempSelections.homeType && tempSelections.outdoorSpace);
      case 4:
        return !!(tempSelections.workSchedule && tempSelections.activityLevel && tempSelections.travelFrequency);
      case 5:
        return !!tempSelections.budget;
      default:
        return Object.keys(tempSelections).length > 0;
    }
  };

  const saveOnboarding = async (onboardingData: OnboardingData) => {
    setLoading(true);
    try {
      console.log('Saving onboarding with phone:', session.phone);
      console.log('Onboarding data:', onboardingData);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/onboarding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            phone: session.phone,
            type: 'have-pet',
            data: onboardingData,
          }),
        }
      );

      const responseData = await response.json();
      console.log('Response status:', response.status);
      console.log('Response data:', responseData);

      if (!response.ok) {
        throw new Error(`Failed to save onboarding data: ${responseData.error || response.statusText}`);
      }

      console.log('Onboarding data saved successfully');
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 3:
        return (
          <>
            {/* Orange Top Section */}
            <div className="flex flex-col items-center pt-12 pb-8 px-6">
              <div className="w-24 h-24 bg-[#FF8C42] rounded-full flex items-center justify-center mb-6">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M14 20L14 28L18 32L30 32L34 28L34 20L30 16L18 16L14 20Z" stroke="white" strokeWidth="3" fill="none"/>
                  <path d="M24 12L24 16M16 16L18 18M32 16L30 18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="24" cy="24" r="3" fill="white"/>
                </svg>
              </div>
              <h1 className="text-black text-center">Your Living<br />Space 🏡</h1>
            </div>

            {/* White Bottom Section */}
            <div className="flex-1 bg-white rounded-t-[40px] px-6 py-8 overflow-y-auto">
              <p className="text-center text-black mb-6 text-base">
                Tell us about where you live
              </p>

              <div className="mb-6">
                <h3 className="text-black mb-3 text-sm">What type of home do you have?</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setTempSelections({ ...tempSelections, homeType: 'apartment' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.homeType === 'apartment' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏢</span>
                      <h3 className="text-black">Apartment</h3>
                    </div>
                  </button>

                  <button
                    onClick={() => setTempSelections({ ...tempSelections, homeType: 'small-house' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.homeType === 'small-house' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏠</span>
                      <h3 className="text-black">Small House</h3>
                    </div>
                  </button>

                  <button
                    onClick={() => setTempSelections({ ...tempSelections, homeType: 'large-house' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.homeType === 'large-house' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🌳</span>
                      <h3 className="text-black">Large House</h3>
                    </div>
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-black mb-3 text-sm">Do you have a yard or outdoor space?</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setTempSelections({ ...tempSelections, outdoorSpace: 'large-yard' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.outdoorSpace === 'large-yard' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🌳</span>
                      <h3 className="text-black">Yes, large fenced yard</h3>
                    </div>
                  </button>

                  <button
                    onClick={() => setTempSelections({ ...tempSelections, outdoorSpace: 'small-patio' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.outdoorSpace === 'small-patio' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🪴</span>
                      <h3 className="text-black">Yes, small yard/patio</h3>
                    </div>
                  </button>

                  <button
                    onClick={() => setTempSelections({ ...tempSelections, outdoorSpace: 'no-outdoor' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.outdoorSpace === 'no-outdoor' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏙️</span>
                      <h3 className="text-black">No outdoor space</h3>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </>
        );

      case 4:
        return (
          <>
            {/* Orange Top Section */}
            <div className="flex flex-col items-center pt-12 pb-8 px-6">
              <div className="w-24 h-24 bg-[#FF8C42] rounded-full flex items-center justify-center mb-6">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="18" stroke="white" strokeWidth="3" fill="none"/>
                  <path d="M24 10L24 24L32 28" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h1 className="text-black text-center">Your<br />Lifestyle ⭐</h1>
            </div>

            {/* White Bottom Section */}
            <div className="flex-1 bg-white rounded-t-[40px] px-6 py-8 overflow-y-auto">
              <p className="text-center text-black mb-6 text-base">
                Help us understand your daily routine
              </p>

              <div className="mb-6">
                <h3 className="text-black mb-3 text-sm">What's your typical work schedule?</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setTempSelections({ ...tempSelections, workSchedule: 'work-from-home' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.workSchedule === 'work-from-home' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏠</span>
                      <h3 className="text-black">Work from home</h3>
                    </div>
                  </button>

                  <button
                    onClick={() => setTempSelections({ ...tempSelections, workSchedule: 'away-4-6' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.workSchedule === 'away-4-6' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⏰</span>
                      <h3 className="text-black">Away 4-6 hours/day</h3>
                    </div>
                  </button>

                  <button
                    onClick={() => setTempSelections({ ...tempSelections, workSchedule: 'away-8-plus' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.workSchedule === 'away-8-plus' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💼</span>
                      <h3 className="text-black">Away 8+ hours/day</h3>
                    </div>
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-black mb-3 text-sm">How would you describe your activity level?</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setTempSelections({ ...tempSelections, activityLevel: 'very-active' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.activityLevel === 'very-active' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏃</span>
                      <h3 className="text-black">Very Active (daily exercise/outdoors)</h3>
                    </div>
                  </button>

                  <button
                    onClick={() => setTempSelections({ ...tempSelections, activityLevel: 'moderate' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.activityLevel === 'moderate' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🚶</span>
                      <h3 className="text-black">Moderate (regular walks/activities)</h3>
                    </div>
                  </button>

                  <button
                    onClick={() => setTempSelections({ ...tempSelections, activityLevel: 'relaxed' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.activityLevel === 'relaxed' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🛋️</span>
                      <h3 className="text-black">Relaxed (prefer indoor activities)</h3>
                    </div>
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-black mb-3 text-sm">How often do you travel?</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setTempSelections({ ...tempSelections, travelFrequency: 'rarely' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.travelFrequency === 'rarely' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏡</span>
                      <h3 className="text-black">Rarely or never</h3>
                    </div>
                  </button>

                  <button
                    onClick={() => setTempSelections({ ...tempSelections, travelFrequency: 'few-times' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.travelFrequency === 'few-times' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">✈️</span>
                      <h3 className="text-black">A few times a year</h3>
                    </div>
                  </button>

                  <button
                    onClick={() => setTempSelections({ ...tempSelections, travelFrequency: 'monthly' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.travelFrequency === 'monthly' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🌍</span>
                      <h3 className="text-black">Monthly or more</h3>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </>
        );

      case 5:
        return (
          <>
            {/* Orange Top Section */}
            <div className="flex flex-col items-center pt-12 pb-8 px-6">
              <div className="w-24 h-24 bg-[#FF8C42] rounded-full flex items-center justify-center mb-6">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M18 12C18 9 20 7 23 7H25C28 7 30 9 30 12V14H18V12Z" fill="white"/>
                  <path d="M12 14H36C37 14 38 15 38 16V38C38 39 37 40 36 40H12C11 40 10 39 10 38V16C10 15 11 14 12 14Z" stroke="white" strokeWidth="3" fill="none"/>
                  <circle cx="24" cy="26" r="4" fill="white"/>
                </svg>
              </div>
              <h1 className="text-black text-center">Budget<br />Planning 💳</h1>
            </div>

            {/* White Bottom Section */}
            <div className="flex-1 bg-white rounded-t-[40px] px-6 py-8 overflow-y-auto">
              <p className="text-center text-black mb-6 text-base">
                Let's understand the investment involved ❤️
              </p>

              {/* Typical Costs Overview */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                <p className="text-sm text-blue-900 mb-3">💡 Typical Costs Overview:</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-blue-700">Initial Setup</p>
                    <p className="font-semibold text-blue-900">₹20,000 - ₹50,000</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Monthly Care</p>
                    <p className="font-semibold text-blue-900">₹3,000 - ₹12,000+</p>
                  </div>
                </div>
                <p className="text-xs text-blue-700 mt-2">Includes food, vet care, supplies & grooming</p>
              </div>

              <div className="mb-6">
                <h3 className="text-black mb-4 text-sm">What's your comfortable monthly budget?</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setTempSelections({ ...tempSelections, budget: '3000-6000' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.budget === '3000-6000' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">💚</span>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <h3 className="text-black">₹3,000 - ₹6,000/month</h3>
                        </div>
                        <p className="text-xs text-gray-600">Essential care & basic needs</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setTempSelections({ ...tempSelections, budget: '6000-12000' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.budget === '6000-12000' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">⭐</span>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <h3 className="text-black">₹6,000 - ₹12,000/month</h3>
                        </div>
                        <p className="text-xs text-gray-600">Good care with extra comfort</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setTempSelections({ ...tempSelections, budget: '12000-plus' })}
                    className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                      tempSelections.budget === '12000-plus' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">👑</span>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <h3 className="text-black">₹12,000+/month</h3>
                        </div>
                        <p className="text-xs text-gray-600">Comprehensive & premium services</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Pro Tip */}
              <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">💡</span>
                  <div>
                    <p className="text-sm font-semibold text-orange-900 mb-1">Pro Tip: Keep an emergency fund</p>
                    <p className="text-xs text-orange-800 leading-relaxed">
                      Save ₹15,000 - ₹50,000 for unexpected vet emergencies
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        );

      default:
        return (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white">Step {currentStep} - Coming soon</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#FF8C42] flex flex-col w-full max-w-[430px] mx-auto">
      {/* Status Bar */}
      <div className="px-6 pt-3 pb-2 flex justify-between items-center">
        <span className="text-black">09:41</span>
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

      {renderStep()}

      {/* Progress and Navigation - Fixed at bottom */}
      <div className="bg-white px-6 pb-8">
        {/* Progress Bar */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="p-2 disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5 text-black" />
          </button>
          
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#FF8C42] transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
          
          <span className="text-sm text-gray-600 min-w-[80px] text-right">
            Step {currentStep}/{totalSteps}
          </span>
        </div>

        {/* Continue Button */}
        <Button
          onClick={() => {
            // Save temp selections to main data
            if (currentStep === 3) {
              setData({
                ...data,
                livingSpace: {
                  homeType: tempSelections.homeType,
                  outdoorSpace: tempSelections.outdoorSpace
                }
              });
            } else if (currentStep === 4) {
              setData({
                ...data,
                lifestyle: {
                  workSchedule: tempSelections.workSchedule,
                  activityLevel: tempSelections.activityLevel,
                  travelFrequency: tempSelections.travelFrequency
                }
              });
            } else if (currentStep === 5) {
              setData({
                ...data,
                budget: tempSelections.budget
              });
            }
            handleNext();
          }}
          disabled={!validateStep(currentStep) || loading}
          className="w-full h-14 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-2xl text-black disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Continue'}
        </Button>

        {/* Home Indicator */}
        <div className="flex justify-center mt-6">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    </div>
  );
}