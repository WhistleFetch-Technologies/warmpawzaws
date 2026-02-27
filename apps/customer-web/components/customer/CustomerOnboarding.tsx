'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface CustomerOnboardingProps {
  onComplete: (stage: string) => void;
  onBack?: () => void;
}

export function CustomerOnboarding({ onComplete, onBack }: CustomerOnboardingProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FF8C42] to-[#FF6B9D] flex flex-col w-full max-w-[430px] mx-auto">
      {/* Top Bar with Back Button */}
      <div className="px-4 pt-4 pb-2 flex items-center">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-black/80 hover:text-black transition-colors bg-white/20 hover:bg-white/30 rounded-full px-3 py-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
        )}
      </div>

      {/* Orange Top Section */}
      <div className="flex flex-col items-center pt-6 pb-8 px-6">
        {/* Paw Logo with Heart */}
        <div className="mb-8 w-32 h-32 flex items-center justify-center">
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
            {/* Main paw pad */}
            <ellipse cx="60" cy="75" rx="22" ry="26" fill="black"/>
            {/* Heart in center */}
            <path d="M60 70C58 68 54 68 52 70C50 72 50 75 52 77L60 85L68 77C70 75 70 72 68 70C66 68 62 68 60 70Z" fill="#FF8C42"/>
            {/* Top left toe */}
            <ellipse cx="40" cy="45" rx="10" ry="14" transform="rotate(-15 40 45)" fill="black"/>
            {/* Top center-left toe */}
            <ellipse cx="50" cy="35" rx="10" ry="14" transform="rotate(-5 50 35)" fill="black"/>
            {/* Top center-right toe */}
            <ellipse cx="70" cy="35" rx="10" ry="14" transform="rotate(5 70 35)" fill="black"/>
            {/* Top right toe */}
            <ellipse cx="80" cy="45" rx="10" ry="14" transform="rotate(15 80 45)" fill="black"/>
          </svg>
        </div>
        
        <h1 className="text-black text-center">Choose Your<br />Stage</h1>
      </div>

      {/* White Bottom Section */}
      <div className="flex-1 bg-white rounded-t-[40px] px-6 py-8 overflow-y-auto">
        <p className="text-center text-gray-700 mb-8 text-sm leading-relaxed">
          Choose your journey to get<br />
          personalized support 💖🐕🐈
        </p>

        {/* Journey Stage Cards */}
        <div className="space-y-4 mb-6">
          {/* Planning to Get a Pet */}
          <button
            onClick={() => setSelectedStage('planning')}
            className={`w-full bg-white border-2 rounded-2xl p-4 transition-all text-left ${
              selectedStage === 'planning' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
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
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-black">Planning to Get a Pet</h3>
                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
                <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                  Find your perfect match! Get expert guidance on breeds, adoption, preparation, and bringing home your new best friend 🐾💙
                </p>
                
                {/* Button */}
                <div className="inline-flex">
                  <span className="text-xs px-4 py-1.5 rounded-full border-2 border-blue-300 bg-blue-100 text-blue-700">
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
              selectedStage === 'have-pet' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
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
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-black">Already Have a Pet</h3>
                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
                <p className="text-xs text-gray-600 mb-3 leading-relaxed">
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
              selectedStage === 'end-of-life' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
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
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-black">End of Life Care</h3>
                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
                <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                  Compassionate support with quality of life guidance, hospice care, sunset services, memorial options, and grief counseling 🌈💜
                </p>
                
                {/* Button */}
                <div className="inline-flex">
                  <span className="text-xs px-4 py-1.5 rounded-full border-2 border-purple-300 bg-purple-100 text-purple-700">
                    Manage care
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Footer Message */}
        <div className="text-center mb-6">
          <p className="text-sm text-gray-700">
            🐾💕🐾<br />
            Every pet deserves love and the best care
          </p>
        </div>

        {/* Continue Button */}
        <Button
          onClick={() => selectedStage && onComplete(selectedStage)}
          disabled={!selectedStage}
          className="w-full h-14 bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] rounded-2xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed mb-6 shadow-lg shadow-[#FF8C42]/30 transition-all"
        >
          Continue
        </Button>

        {/* Footer Text */}
        <p className="text-center text-xs text-gray-500 leading-relaxed">
          Trusted by 15,000+ pet professionals worldwide<br />
          © 2025 WARMPAWZ Inc. All rights reserved
        </p>
      </div>

      {/* Home Indicator */}
      <div className="flex justify-center py-4 bg-white">
        <div className="w-32 h-1 bg-black rounded-full"></div>
      </div>
    </div>
  );
}
