'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface CustomerOnboardingProps {
  onBack?: () => void;
  /** Same-route finish: update parent state so home shows under `/` after `router.replace('/')`. */
  onNoPetComplete: () => void;
}

function persistStageOnboardingDone() {
  if (typeof window === 'undefined') return;
  localStorage.setItem('onboarding_completed', 'true');
  localStorage.setItem('customerOnboardingComplete', 'true');
}

export function CustomerOnboarding({ onBack, onNoPetComplete }: CustomerOnboardingProps) {
  const router = useRouter();
  const [selectedStage, setSelectedStage] = useState<string | null>('have-pet');

  const goHavePet = useCallback(() => {
    persistStageOnboardingDone();
    router.push('/add-pet');
  }, [router]);

  const goNoPet = useCallback(() => {
    persistStageOnboardingDone();
    onNoPetComplete();
    router.replace('/');
  }, [router, onNoPetComplete]);

  const handleContinue = useCallback(() => {
    if (selectedStage === 'have-pet') goHavePet();
    else if (selectedStage === 'no-pet') goNoPet();
  }, [selectedStage, goHavePet, goNoPet]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FF8C42] to-[#FF6B9D] flex flex-col w-full max-w-customer mx-auto">
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
          {/* Already Have a Pet */}
          <button
            type="button"
            onClick={() => {
              setSelectedStage('have-pet');
              goHavePet();
            }}
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

          {/* I Don't Have a Pet */}
          <button
            type="button"
            onClick={() => {
              setSelectedStage('no-pet');
              goNoPet();
            }}
            className={`w-full bg-white border-2 rounded-2xl p-4 transition-all text-left ${
              selectedStage === 'no-pet' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#FF8C42] to-[#FF6B9D]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"
                    stroke="white"
                    strokeWidth="2"
                  />
                  <path d="M8.5 10H8.51M15.5 10H15.51M9 15C9.8 15.8 10.8 16.2 12 16.2C13.2 16.2 14.2 15.8 15 15" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-black">I Don&apos;t Have a Pet</h3>
                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
                <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                  Explore services, learn about care, and find your future companion when you&apos;re ready 💖🐾
                </p>
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="absolute left-0 top-0 h-full w-[35%] bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] rounded-full"></div>
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
          type="button"
          onClick={handleContinue}
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
