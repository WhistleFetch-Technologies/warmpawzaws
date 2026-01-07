'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface CustomerOnboardingProps {
  onComplete: (stage: string) => void;
}

export function CustomerOnboarding({ onComplete }: CustomerOnboardingProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-primary flex flex-col w-full max-w-[430px] mx-auto">
      {/* Orange Top Section */}
      <div className="flex flex-col items-center pt-16 pb-8 px-0">
        {/* Paw Logo with Heart */}
        <div className="mb-8 w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-xl">
          <img src="/logo.png" alt="Warmpawz" className="w-24 h-24 object-contain" />
        </div>
        
        <h1 className="text-3xl font-bold text-black text-center">Choose Your<br />Stage</h1>
      </div>

      {/* White Bottom Section */}
      <div className="flex-1 bg-white rounded-t-[40px] px-0 py-8 overflow-y-auto shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        <p className="text-center text-gray-700 mb-8 text-sm leading-relaxed">
          Choose your journey to get<br />
          personalized support 💖🐕🐈
        </p>

        {/* Journey Stage Cards */}
        <div className="space-y-4 mb-0">
          {/* Planning to Get a Pet */}
          <button
            onClick={() => setSelectedStage('planning')}
            className={`w-full bg-white border-2 rounded-2xl p-4 transition-all text-left ${
              selectedStage === 'planning' ? 'border-blue-500 bg-blue-50 shadow-lg' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Blue Icon */}
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L14 6L18 7L15 10L16 14L12 12L8 14L9 10L6 7L10 6L12 2Z" fill="white"/>
                  <path d="M12 16L14 19L18 20L15 22" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0">
                  <h3 className="font-semibold text-gray-900">Planning to Get a Pet</h3>
                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
                <p className="text-xs text-gray-600 mb-0 leading-relaxed">
                  Find your perfect match! Get expert guidance on breeds, adoption, preparation, and bringing home your new best friend 🐾💙
                </p>
                
                {/* Button */}
                <div className="inline-flex">
                  <span className="text-xs px-4 py-0.5 rounded-full border-2 border-blue-300 bg-blue-100 text-blue-700 font-medium">
                    Start Your Journey
                  </span>
                </div>
              </div>
            </div>
          </button>

          {/* Already Have a Pet */}
          <button
            onClick={() => setSelectedStage('have-pet')}
            className={`w-full bg-white border-2 rounded-2xl p-4 transition-all text-left ${
              selectedStage === 'have-pet' ? 'border-green-500 bg-green-50 shadow-lg' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Green Icon */}
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="10" r="3" fill="white"/>
                  <ellipse cx="8" cy="8" rx="2" ry="2.5" fill="white"/>
                  <ellipse cx="16" cy="8" rx="2" ry="2.5" fill="white"/>
                  <path d="M12 13C14 13 16 14 17 16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="18" r="2" fill="white"/>
                </svg>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0">
                  <h3 className="font-semibold text-gray-900">Already Have a Pet</h3>
                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
                <p className="text-xs text-gray-600 mb-0 leading-relaxed">
                  Complete pet care hub! Track health records, schedule vet visits, manage medications, log activities, and celebrate your bond 💚🐾
                </p>
                
                {/* Progress Bar */}
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="absolute left-0 top-0 h-full w-[70%] bg-gradient-to-r from-green-400 to-green-600 rounded-full"></div>
                </div>
              </div>
            </div>
          </button>

          {/* End of Life Care */}
          <button
            onClick={() => setSelectedStage('end-of-life')}
            className={`w-full bg-white border-2 rounded-2xl p-4 transition-all text-left ${
              selectedStage === 'end-of-life' ? 'border-purple-500 bg-purple-50 shadow-lg' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Purple Icon */}
              <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 21C16.5 21 20 17.5 20 13C20 8.5 16.5 5 12 5C7.5 5 4 8.5 4 13C4 17.5 7.5 21 12 21Z" stroke="white" strokeWidth="2"/>
                  <path d="M12 3V5M12 21V23M3 13H5M19 13H21M6 6L7.5 7.5M16.5 16.5L18 18M18 6L16.5 7.5M7.5 16.5L6 18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="13" r="2" fill="white"/>
                </svg>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0">
                  <h3 className="font-semibold text-gray-900">End of Life Care</h3>
                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
                <p className="text-xs text-gray-600 mb-0 leading-relaxed">
                  Compassionate support with quality of life guidance, hospice care, sunset services, memorial options, and grief counseling 🌈💜
                </p>
                
                {/* Button */}
                <div className="inline-flex">
                  <span className="text-xs px-4 py-0.5 rounded-full border-2 border-purple-300 bg-purple-100 text-purple-700 font-medium">
                    Manage care
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Footer Message */}
        <div className="text-center mb-0">
          <p className="text-sm text-gray-700">
            🐾💕🐾<br />
            Every pet deserves love and the best care
          </p>
        </div>

        {/* Continue Button */}
        <button
          onClick={() => selectedStage && onComplete(selectedStage)}
          disabled={!selectedStage}
          className="w-full h-14 bg-primary hover:bg-primary-dark text-white font-semibold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/30 mb-0"
        >
          Continue
        </button>

        {/* Footer Text */}
        <p className="text-center text-xs text-gray-500 leading-relaxed">
          Trusted by 15,000+ pet professionals worldwide<br />
          © 2025 WARMPAWZ Inc. All rights reserved
        </p>
      </div>
    </div>
  );
}

