'use client';

import { ArrowLeft, Clock, Sparkles } from 'lucide-react';
import Image from 'next/image';

interface ComingSoonProps {
  serviceName: string;
  onBack: () => void;
}

export function ComingSoon({ serviceName, onBack }: ComingSoonProps) {
  // Format the service name for display
  const formatServiceName = (name: string): string => {
    return name
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-primary/10 flex flex-col w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="px-0 pt-0 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-0 text-gray-700 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-0 pb-12">
        {/* Logo/Icon */}
        <div className="w-32 h-32 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center mb-8 shadow-lg shadow-primary/30">
          <div className="relative">
            <Clock className="w-14 h-14 text-white" />
            <Sparkles className="w-6 h-6 text-yellow-300 absolute -top-0 -right-2" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-0 text-center">
          {formatServiceName(serviceName)}
        </h1>

        {/* Subtitle */}
        <p className="text-gray-600 text-center mb-8 max-w-xs leading-relaxed">
          We&apos;re working hard to bring you this feature. Stay tuned for updates!
        </p>

        {/* Coming Soon Badge */}
        <div className="bg-primary/10 border-2 border-primary/30 rounded-2xl px-0 py-4 mb-8">
          <div className="flex items-center gap-0">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">Coming Soon</p>
              <p className="text-xs text-gray-600">We&apos;ll notify you when it&apos;s ready</p>
            </div>
          </div>
        </div>

        {/* Features Preview */}
        <div className="w-full space-y-3 mb-8">
          <p className="text-sm font-medium text-gray-700 text-center mb-4">What to expect:</p>
          {[
            'Easy booking & scheduling',
            'Trusted service providers',
            'Real-time updates',
            'Secure payments'
          ].map((feature, index) => (
            <div key={index} className="flex items-center gap-0 bg-white rounded-xl p-0 shadow-sm">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-gray-700">{feature}</span>
            </div>
          ))}
        </div>

        {/* Back to Home Button */}
        <button
          onClick={onBack}
          className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-4 px-0 rounded-2xl transition-colors shadow-lg shadow-primary/30"
        >
          Back to Home
        </button>

        {/* Footer */}
        <p className="text-xs text-gray-400 text-center mt-8">
          🐾 Warmpawz - Pet Care Reimagined
        </p>
      </div>
    </div>
  );
}

