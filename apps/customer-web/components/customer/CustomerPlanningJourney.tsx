'use client';

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface CustomerPlanningJourneyProps {
  session: {
    phone: string;
    customerId?: string;
  };
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
  const [currentStep, setCurrentStep] = useState(1);
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

  const totalSteps = 6;

  const handleNext = async () => {
    if (!isStepValid()) return;

    if (currentStep === totalSteps) {
      await saveQuestionnaire(data);
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isStepValid = (): boolean => {
    switch (currentStep) {
      case 1: return !!data.timeCommitment;
      case 2: return !!(data.children && data.otherPets && data.allergies);
      case 3: return !!(data.dogSize && data.energyLevel);
      case 4: return true; // Skippable step
      case 5: return data.selectedBreeds.length > 0;
      case 6: return true; // Final comparison step
      default: return true;
    }
  };

  const saveQuestionnaire = async (questionnaireData: QuestionnaireData) => {
    setLoading(true);
    try {
      console.log('Saving questionnaire with phone:', session.phone);
      console.log('Questionnaire data:', questionnaireData);
      
      await apiClient.post('/customer/onboarding', {
        phone: session.phone,
        type: 'planning',
        data: questionnaireData,
      });

      console.log('Questionnaire saved successfully');
    } catch (error) {
      console.error('Error saving questionnaire:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleTrait = (trait: string) => {
    if (data.importantTraits.includes(trait)) {
      setData({
        ...data,
        importantTraits: data.importantTraits.filter(t => t !== trait)
      });
    } else {
      setData({
        ...data,
        importantTraits: [...data.importantTraits, trait]
      });
    }
  };

  const toggleBreed = (breed: string) => {
    if (data.selectedBreeds.includes(breed)) {
      setData({
        ...data,
        selectedBreeds: data.selectedBreeds.filter(b => b !== breed)
      });
    } else if (data.selectedBreeds.length < 3) {
      setData({
        ...data,
        selectedBreeds: [...data.selectedBreeds, breed]
      });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            {/* Logo */}
            <div className="flex justify-center pt-8 mb-0">
              <Image src="/logo.png" alt="Warmpawz" width={64} height={64} className="object-contain" />
            </div>

            {/* Orange Circle Icon */}
            <div className="flex flex-col items-center mb-8 px-0">
              <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M24 8L24 24L32 32" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M24 8C15 8 8 15 8 24C8 33 15 40 24 40C33 40 40 33 40 24" stroke="white" strokeWidth="4" strokeLinecap="round"/>
                </svg>
              </div>
              <h1 className="text-black text-center text-2xl font-bold">Time<br />Commitment ⏱️</h1>
            </div>

            {/* Content */}
            <div className="px-0 mb-0">
              <p className="text-center text-black mb-0">
                Pets need daily attention and care 💕
              </p>

              {/* Info Card */}
              <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 mb-0">
                <div className="flex items-start gap-0">
                  <span className="text-xl">⏰</span>
                  <div>
                    <p className="text-sm font-semibold text-orange-900 mb-0">Daily time needs (average):</p>
                    <ul className="text-xs text-orange-800 space-y-1">
                      <li>• Feeding & water: 15-30 min</li>
                      <li>• Exercise/play: 30-120 min</li>
                      <li>• Grooming: 10-30 min</li>
                      <li>• Training/bonding: 15-45 min</li>
                    </ul>
                  </div>
                </div>
              </div>

              <p className="text-black mb-4 text-sm font-medium">How much time can you dedicate daily?</p>

              <div className="space-y-3">
                {[
                  { id: '1-2-hours', label: '1-2 hours per day', desc: 'Basic care & short activities' },
                  { id: '2-4-hours', label: '2-4 hours per day', desc: 'Good care & regular activities' },
                  { id: '4-plus-hours', label: '4+ hours per day', desc: 'Lots of time for bonding & training' },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setData({ ...data, timeCommitment: option.id })}
                    className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                      data.timeCommitment === option.id ? 'border-primary bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <p className="text-black font-medium">{option.label}</p>
                    <p className="text-xs text-gray-600">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </>
        );

      case 2:
        return (
          <>
            {/* Logo */}
            <div className="flex justify-center pt-8 mb-0">
              <Image src="/logo.png" alt="Warmpawz" width={64} height={64} className="object-contain" />
            </div>

            {/* Orange Circle Icon */}
            <div className="flex flex-col items-center mb-8 px-0">
              <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="16" r="6" fill="white"/>
                  <path d="M14 28C14 24 18 20 24 20C30 20 34 24 34 28V36H14V28Z" fill="white"/>
                  <circle cx="34" cy="20" r="4" fill="white"/>
                  <path d="M38 28C38 26 36 24 34 24" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h1 className="text-black text-center text-2xl font-bold">Your<br />Household 👨‍👩‍👧</h1>
            </div>

            {/* Content */}
            <div className="px-0 mb-0">
              <p className="text-black mb-4">Important factors for choosing the right pet</p>

              {/* Children */}
              <div className="mb-0">
                <p className="text-black mb-0 text-sm font-medium">Do you have children at home?</p>
                <div className="space-y-2">
                  {[
                    { id: 'no-children', label: 'No children' },
                    { id: 'young-children', label: 'Yes, young children (under 6)' },
                    { id: 'older-children', label: 'Yes, older children (6+)' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setData({ ...data, children: option.id })}
                      className={`w-full border-2 rounded-xl p-0 text-left transition-all ${
                        data.children === option.id ? 'border-primary bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <p className="text-black text-sm">{option.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Other Pets */}
              <div className="mb-0">
                <p className="text-black mb-0 text-sm font-medium">Do you have other pets?</p>
                <div className="space-y-2">
                  {[
                    { id: 'no-other-pets', label: 'No other pets' },
                    { id: 'have-dogs', label: 'Yes, I have dog(s)' },
                    { id: 'have-cats', label: 'Yes, I have cat(s)' },
                    { id: 'other-animals', label: 'Yes, other animals' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setData({ ...data, otherPets: option.id })}
                      className={`w-full border-2 rounded-xl p-0 text-left transition-all ${
                        data.otherPets === option.id ? 'border-primary bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <p className="text-black text-sm">{option.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Allergies */}
              <div className="mb-0">
                <p className="text-black mb-0 text-sm font-medium">Any allergies in your household?</p>
                <div className="space-y-2">
                  {[
                    { id: 'no-allergies', label: 'No allergies' },
                    { id: 'mild-allergies', label: 'Mild allergies (manageable)' },
                    { id: 'severe-allergies', label: 'Severe allergies (need hypoallergenic)' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setData({ ...data, allergies: option.id })}
                      className={`w-full border-2 rounded-xl p-0 text-left transition-all ${
                        data.allergies === option.id ? 'border-primary bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <p className="text-black text-sm">{option.label}</p>
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
            {/* Logo */}
            <div className="flex justify-center pt-8 mb-0">
              <Image src="/logo.png" alt="Warmpawz" width={64} height={64} className="object-contain" />
            </div>

            {/* Orange Circle Icon */}
            <div className="flex flex-col items-center mb-8 px-0">
              <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M24 8L20 14L14 16L18 22L16 28L24 24L32 28L30 22L34 16L28 14L24 8Z" fill="white"/>
                  <circle cx="24" cy="32" r="3" fill="white"/>
                </svg>
              </div>
              <h1 className="text-black text-center text-2xl font-bold">Dog Size &<br />Energy ⚡</h1>
            </div>

            {/* Content */}
            <div className="px-0 mb-0">
              <p className="text-black mb-4">What size and energy level fits your lifestyle?</p>

              {/* Dog Size */}
              <div className="mb-0">
                <p className="text-black mb-0 text-sm font-medium">Preferred dog size</p>
                <div className="space-y-3">
                  {[
                    { id: 'small', emoji: '🐕', label: 'Small (under 25 lbs)', desc: 'Easier to handle, good for apartments' },
                    { id: 'medium', emoji: '🐕', label: 'Medium (25-60 lbs)', desc: 'Versatile, great family dogs' },
                    { id: 'large', emoji: '🐕🐕', label: 'Large (60+ lbs)', desc: 'Need more space, great protectors' },
                    { id: 'no-preference', emoji: '🤷', label: 'No preference', desc: '' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setData({ ...data, dogSize: option.id })}
                      className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                        data.dogSize === option.id ? 'border-primary bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-0">
                        <span className="text-2xl">{option.emoji}</span>
                        <div className="flex-1">
                          <p className="text-black font-medium">{option.label}</p>
                          {option.desc && <p className="text-xs text-gray-600">{option.desc}</p>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy Level */}
              <div className="mb-0">
                <p className="text-black mb-0 text-sm font-medium">Preferred energy level</p>
                <div className="space-y-3">
                  {[
                    { id: 'low', emoji: '😴', label: 'Low energy', desc: 'Calm, prefers lounging' },
                    { id: 'moderate', emoji: '🚶', label: 'Moderate energy', desc: 'Balanced, adaptable' },
                    { id: 'high', emoji: '⚡', label: 'High energy', desc: 'Active, needs lots of exercise' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setData({ ...data, energyLevel: option.id })}
                      className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                        data.energyLevel === option.id ? 'border-primary bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-0">
                        <span className="text-2xl">{option.emoji}</span>
                        <div className="flex-1">
                          <p className="text-black font-medium">{option.label}</p>
                          <p className="text-xs text-gray-600">{option.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        );

      case 4:
        return (
          <>
            {/* Orange Circle Icon */}
            <div className="flex flex-col items-center pt-02 mb-0 px-0">
              <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect x="14" y="14" width="8" height="8" rx="2" fill="white"/>
                  <circle cx="30" cy="18" r="4" fill="white"/>
                  <rect x="26" y="26" width="8" height="8" rx="2" fill="white"/>
                  <path d="M14 30L18 26M30 22L26 26" stroke="white" strokeWidth="2"/>
                </svg>
              </div>
              <h1 className="text-black text-center text-2xl font-bold">Important<br />Traits ⭐</h1>
            </div>

            {/* Content */}
            <div className="px-0 mb-0">
              <p className="text-center text-black mb-0 text-sm">
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
                      onClick={() => toggleTrait(trait.label)}
                      className={`w-full border-2 rounded-xl p-0 text-left transition-all flex items-center gap-0 ${
                        isSelected ? 'border-primary bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <span className="text-lg">{trait.emoji}</span>
                      <span className="text-black text-sm flex-1">{trait.label}</span>
                      {isSelected && (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d="M7 10L9 12L13 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary"/>
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="text-center text-gray-500 text-xs mt-0">
                You can skip this step if you&apos;re not sure yet
              </p>
            </div>
          </>
        );

      case 5:
        return (
          <>
            {/* Orange Circle Icon */}
            <div className="flex flex-col items-center pt-12 mb-0 px-0">
              <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="16" stroke="white" strokeWidth="3" fill="none"/>
                  <circle cx="24" cy="24" r="10" stroke="white" strokeWidth="3" fill="none"/>
                  <circle cx="24" cy="24" r="4" fill="white"/>
                </svg>
              </div>
              <h1 className="text-black text-center text-2xl font-bold">Perfect Breeds<br />for You</h1>
            </div>

            {/* Content */}
            <div className="px-0 mb-0">
              <p className="text-center text-black mb-4 text-sm">
                Based on your lifestyle and preferences
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-0 mb-0">
                <p className="text-blue-900 text-xs text-center">
                  💡 Select up to 3 breeds to compare
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    name: 'French Bulldog',
                    desc: 'Adaptable, playful, and smart',
                    tags: ['Small', 'Low Energy'],
                    features: ['Apartment living', 'Little exercise needs', 'Seniors']
                  },
                  {
                    name: 'Shih Tzu',
                    desc: 'Affectionate, playful, and outgoing',
                    tags: ['Small', 'Low Energy'],
                    features: ['Apartment living', 'Families', 'Seniors']
                  },
                  {
                    name: 'Cavalier King Charles',
                    desc: 'Gentle, affectionate, and graceful',
                    tags: ['Small', 'Moderate Energy'],
                    features: ['Families', 'Seniors', 'First-time owners']
                  }
                ].map((breed) => (
                  <button
                    key={breed.name}
                    onClick={() => toggleBreed(breed.name)}
                    className={`w-full border-2 rounded-xl p-4 text-left transition-all ${
                      data.selectedBreeds.includes(breed.name) ? 'border-primary bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-0 mb-0">
                      <span className="text-3xl">🐕</span>
                      <div className="flex-1">
                        <h3 className="text-black font-medium">{breed.name}</h3>
                        <p className="text-xs text-gray-600 mb-0">{breed.desc}</p>
                        <div className="flex gap-0 mb-0">
                          {breed.tags.map((tag) => (
                            <span key={tag} className="text-xs px-0 py-0.5 bg-gray-100 rounded">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-0 text-xs">
                      {breed.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-0">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M3 6L5 8L9 4" stroke="#4CAF50" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-green-500"/>
                          </svg>
                          <span className="text-gray-600">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              <p className="text-center text-gray-500 text-xs mt-0">
                Select at least one breed to continue
              </p>
            </div>
          </>
        );

      case 6:
        return (
          <>
            {/* Orange Circle Icon */}
            <div className="flex flex-col items-center pt-12 mb-0 px-0">
              <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M12 18L24 10L36 18L36 32L24 40L12 32L12 18Z" stroke="white" strokeWidth="3" fill="none"/>
                  <path d="M24 24L24 10M12 18L24 24M36 18L24 24" stroke="white" strokeWidth="2"/>
                </svg>
              </div>
              <h1 className="text-black text-center text-2xl font-bold">Compare<br />Breeds</h1>
            </div>

            {/* Content */}
            <div className="px-0 mb-0">
              <p className="text-center text-black mb-0 text-sm">
                Detailed pros & cons for your selections
              </p>

              <div className="space-y-6">
                {data.selectedBreeds.map((breed) => {
                  const breedData: Record<string, { emoji: string; description: string; pros: string[]; cons: string[]; bestFor: string[] }> = {
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
                      <div className="flex items-start gap-0 mb-4">
                        <span className="text-3xl">{info.emoji}</span>
                        <div>
                          <h3 className="text-black font-medium">{breed}</h3>
                          <p className="text-xs text-gray-600">{info.description}</p>
                        </div>
                      </div>

                      {/* Pros */}
                      <div className="mb-0">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-0">
                          {info.pros.map((pro, idx) => (
                            <p key={idx} className={`text-xs ${idx === 0 ? 'font-medium text-green-900 mb-0' : 'text-green-800'}`}>
                              {idx > 0 && '✓ '}{pro}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Cons */}
                      <div className="mb-0">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-0">
                          {info.cons.map((con, idx) => (
                            <p key={idx} className={`text-xs ${idx === 0 ? 'font-medium text-red-900 mb-0' : 'text-red-800'}`}>
                              {idx > 0 && '✗ '}{con}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Best For */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-0">
                        <p className="text-xs font-medium text-blue-900 mb-0">🌟 Best for:</p>
                        <div className="flex flex-wrap gap-0">
                          {info.bestFor.map((item, idx) => (
                            <span key={idx} className="text-xs px-0 py-0 bg-blue-100 text-blue-800 rounded">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-center text-blue-600 text-sm mt-0">
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

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        {renderStep()}
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-0 py-4 max-w-[430px] mx-auto w-full">
        {/* Progress Bar with Back Button */}
        <div className="flex items-center gap-0 mb-4">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="p-0 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5 text-black" />
          </button>
          
          <div className="flex-1 flex items-center gap-0">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>
          
          <span className="text-sm text-gray-600 font-medium">
            Step {currentStep}/{totalSteps}
          </span>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleNext}
          disabled={!isStepValid() || loading}
          className="w-full h-12 bg-primary hover:bg-primary-dark rounded-xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>

        {/* Home Indicator */}
        <div className="flex justify-center mt-4">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    </div>
  );
}

