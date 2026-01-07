'use client';

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface CustomerHavePetJourneyProps {
  session: {
    phone: string;
    customerId?: string;
  };
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

  const [tempSelections, setTempSelections] = useState<Record<string, string>>({});

  const totalSteps = 5;

  const handleNext = async () => {
    const isValid = validateStep(currentStep);
    if (!isValid) return;

    // Save temp selections to main data
    if (currentStep === 1) {
      setData({
        ...data,
        livingSpace: {
          homeType: tempSelections.homeType || '',
          outdoorSpace: tempSelections.outdoorSpace || ''
        }
      });
    } else if (currentStep === 2) {
      setData({
        ...data,
        lifestyle: {
          workSchedule: tempSelections.workSchedule || '',
          activityLevel: tempSelections.activityLevel || '',
          travelFrequency: tempSelections.travelFrequency || ''
        }
      });
    } else if (currentStep === 3) {
      setData({
        ...data,
        budget: tempSelections.budget || ''
      });
    }

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
      case 1:
        return !!(tempSelections.homeType && tempSelections.outdoorSpace);
      case 2:
        return !!(tempSelections.workSchedule && tempSelections.activityLevel && tempSelections.travelFrequency);
      case 3:
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
      
      await apiClient.post('/customer/onboarding', {
        phone: session.phone,
        type: 'have-pet',
        data: onboardingData,
      });

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
      case 1:
        return (
          <>
            {/* Orange Top Section */}
            <div className="flex flex-col items-center pt-02 pb-8 px-0">
              <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mb-0">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M14 20L14 28L18 32L30 32L34 28L34 20L30 16L18 16L14 20Z" stroke="white" strokeWidth="3" fill="none"/>
                  <path d="M24 12L24 16M16 16L18 18M32 16L30 18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="24" cy="24" r="3" fill="white"/>
                </svg>
              </div>
              <h1 className="text-black text-center text-2xl font-bold">Your Living<br />Space 🏡</h1>
            </div>

            {/* White Bottom Section */}
            <div className="flex-1 bg-white rounded-t-[40px] px-0 py-8 overflow-y-auto">
              <p className="text-center text-black mb-0 text-base">
                Tell us about where you live
              </p>

              <div className="mb-0">
                <h3 className="text-black mb-0 text-sm font-medium">What type of home do you have?</h3>
                <div className="space-y-3">
                  {[
                    { id: 'apartment', emoji: '🏢', label: 'Apartment' },
                    { id: 'small-house', emoji: '🏠', label: 'Small House' },
                    { id: 'large-house', emoji: '🌳', label: 'Large House' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setTempSelections({ ...tempSelections, homeType: option.id })}
                      className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                        tempSelections.homeType === option.id ? 'border-primary bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-0">
                        <span className="text-2xl">{option.emoji}</span>
                        <h3 className="text-black font-medium">{option.label}</h3>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-0">
                <h3 className="text-black mb-0 text-sm font-medium">Do you have a yard or outdoor space?</h3>
                <div className="space-y-3">
                  {[
                    { id: 'large-yard', emoji: '🌳', label: 'Yes, large fenced yard' },
                    { id: 'small-patio', emoji: '🪴', label: 'Yes, small yard/patio' },
                    { id: 'no-outdoor', emoji: '🏙️', label: 'No outdoor space' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setTempSelections({ ...tempSelections, outdoorSpace: option.id })}
                      className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                        tempSelections.outdoorSpace === option.id ? 'border-primary bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-0">
                        <span className="text-2xl">{option.emoji}</span>
                        <h3 className="text-black font-medium">{option.label}</h3>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        );

      case 2:
        return (
          <>
            {/* Orange Top Section */}
            <div className="flex flex-col items-center pt-12 pb-8 px-0">
              <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mb-0">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="18" stroke="white" strokeWidth="3" fill="none"/>
                  <path d="M24 10L24 24L32 28" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h1 className="text-black text-center text-2xl font-bold">Your<br />Lifestyle ⭐</h1>
            </div>

            {/* White Bottom Section */}
            <div className="flex-1 bg-white rounded-t-[40px] px-0 py-8 overflow-y-auto">
              <p className="text-center text-black mb-0 text-base">
                Help us understand your daily routine
              </p>

              <div className="mb-0">
                <h3 className="text-black mb-0 text-sm font-medium">What&apos;s your typical work schedule?</h3>
                <div className="space-y-3">
                  {[
                    { id: 'work-from-home', emoji: '🏠', label: 'Work from home' },
                    { id: 'away-4-6', emoji: '⏰', label: 'Away 4-6 hours/day' },
                    { id: 'away-8-plus', emoji: '💼', label: 'Away 8+ hours/day' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setTempSelections({ ...tempSelections, workSchedule: option.id })}
                      className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                        tempSelections.workSchedule === option.id ? 'border-primary bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-0">
                        <span className="text-2xl">{option.emoji}</span>
                        <h3 className="text-black font-medium">{option.label}</h3>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-0">
                <h3 className="text-black mb-0 text-sm font-medium">How would you describe your activity level?</h3>
                <div className="space-y-3">
                  {[
                    { id: 'very-active', emoji: '🏃', label: 'Very Active (daily exercise/outdoors)' },
                    { id: 'moderate', emoji: '🚶', label: 'Moderate (regular walks/activities)' },
                    { id: 'relaxed', emoji: '🛋️', label: 'Relaxed (prefer indoor activities)' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setTempSelections({ ...tempSelections, activityLevel: option.id })}
                      className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                        tempSelections.activityLevel === option.id ? 'border-primary bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-0">
                        <span className="text-2xl">{option.emoji}</span>
                        <h3 className="text-black font-medium">{option.label}</h3>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-0">
                <h3 className="text-black mb-0 text-sm font-medium">How often do you travel?</h3>
                <div className="space-y-3">
                  {[
                    { id: 'rarely', emoji: '🏡', label: 'Rarely or never' },
                    { id: 'few-times', emoji: '✈️', label: 'A few times a year' },
                    { id: 'monthly', emoji: '🌍', label: 'Monthly or more' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setTempSelections({ ...tempSelections, travelFrequency: option.id })}
                      className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                        tempSelections.travelFrequency === option.id ? 'border-primary bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-0">
                        <span className="text-2xl">{option.emoji}</span>
                        <h3 className="text-black font-medium">{option.label}</h3>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        );

      case 3:
        return (
          <>
            {/* Orange Top Section */}
            <div className="flex flex-col items-center pt-12 pb-8 px-0">
              <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mb-0">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M18 12C18 9 20 7 23 7H25C28 7 30 9 30 12V14H18V12Z" fill="white"/>
                  <path d="M12 14H36C37 14 38 15 38 16V38C38 39 37 40 36 40H12C11 40 10 39 10 38V16C10 15 11 14 12 14Z" stroke="white" strokeWidth="3" fill="none"/>
                  <circle cx="24" cy="26" r="4" fill="white"/>
                </svg>
              </div>
              <h1 className="text-black text-center text-2xl font-bold">Budget<br />Planning 💳</h1>
            </div>

            {/* White Bottom Section */}
            <div className="flex-1 bg-white rounded-t-[40px] px-0 py-8 overflow-y-auto">
              <p className="text-center text-black mb-0 text-base">
                Let&apos;s understand the investment involved ❤️
              </p>

              {/* Typical Costs Overview */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-0">
                <p className="text-sm text-blue-900 mb-0">💡 Typical Costs Overview:</p>
                <div className="grid grid-cols-2 gap-0 text-sm">
                  <div>
                    <p className="text-blue-700">Initial Setup</p>
                    <p className="font-semibold text-blue-900">₹20,000 - ₹50,000</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Monthly Care</p>
                    <p className="font-semibold text-blue-900">₹3,000 - ₹12,000+</p>
                  </div>
                </div>
                <p className="text-xs text-blue-700 mt-0">Includes food, vet care, supplies & grooming</p>
              </div>

              <div className="mb-0">
                <h3 className="text-black mb-4 text-sm font-medium">What&apos;s your comfortable monthly budget?</h3>
                <div className="space-y-3">
                  {[
                    { id: '3000-6000', emoji: '💚', label: '₹3,000 - ₹6,000/month', desc: 'Essential care & basic needs' },
                    { id: '6000-12000', emoji: '⭐', label: '₹6,000 - ₹12,000/month', desc: 'Good care with extra comfort' },
                    { id: '12000-plus', emoji: '👑', label: '₹12,000+/month', desc: 'Comprehensive & premium services' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setTempSelections({ ...tempSelections, budget: option.id })}
                      className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                        tempSelections.budget === option.id ? 'border-primary bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-0">
                        <span className="text-2xl">{option.emoji}</span>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-0 mb-0">
                            <h3 className="text-black font-medium">{option.label}</h3>
                          </div>
                          <p className="text-xs text-gray-600">{option.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pro Tip */}
              <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4">
                <div className="flex items-start gap-0">
                  <span className="text-xl">💡</span>
                  <div>
                    <p className="text-sm font-semibold text-orange-900 mb-0">Pro Tip: Keep an emergency fund</p>
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
    <div className="min-h-screen bg-primary flex flex-col w-full max-w-[430px] mx-auto">
      {/* Status Bar */}
      <div className="px-0 pt-1 pb-0 flex justify-between items-center">
        <span className="text-black text-sm">09:41</span>
        <div className="flex gap-0.5 items-center">
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
      <div className="bg-white px-0 pb-8">
        {/* Progress Bar */}
        <div className="flex items-center gap-0 mb-4">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="p-0 disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5 text-black" />
          </button>
          
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
          
          <span className="text-sm text-gray-600 min-w-[80px] text-right">
            Step {currentStep}/{totalSteps}
          </span>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleNext}
          disabled={!validateStep(currentStep) || loading}
          className="w-full h-14 bg-primary hover:bg-primary-dark rounded-2xl text-black font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>

        {/* Home Indicator */}
        <div className="flex justify-center mt-0">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    </div>
  );
}

