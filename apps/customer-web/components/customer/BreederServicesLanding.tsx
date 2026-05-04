'use client';

import { useState } from 'react';
import { ArrowLeft, ShieldCheck, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface BreederServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function BreederServicesLanding({ phone, onBack, onNavigate }: BreederServicesLandingProps) {
  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto pb-24">
      {/* Header - Orange Background */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-4 mb-6">
           <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">Find Breeders</h1>
        </div>

        {/* Stats Bar - Glassmorphism */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
             <div className="text-2xl font-bold text-white">50+</div>
             <div className="text-xs text-white/80">Breeders</div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
             <div className="text-2xl font-bold text-white">200+</div>
             <div className="text-xs text-white/80">Puppies</div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
             <div className="text-2xl font-bold text-white leading-tight">Verified</div>
             <div className="text-xs text-white/80">Network</div>
          </div>
        </div>
      </div>

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white rounded-t-[32px] px-6 pt-8 min-h-[calc(100vh-180px)]">
        <div className="space-y-8">
          
          {/* Spotlight Offers */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-slate-900">Ethical Breeding</h2>
            </div>
            
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Verified Breeders</h2>
                  <p className="text-gray-700 mb-4">We only list verified, responsible breeders who prioritize health & welfare.</p>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => onNavigate?.('breeder_catalog')}
                  >
                    Browse Puppies
                  </Button>
                </div>
                <div className="text-5xl">🐕</div>
              </div>
            </Card>
          </div>

          {/* Pet Types */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Browse by Pet Type</h2>
            <div className="grid grid-cols-2 gap-3">
              <Card 
                className="p-4 text-center hover:bg-blue-50 cursor-pointer transition-colors border border-slate-100 hover:border-blue-200" 
                onClick={() => onNavigate?.('breeder_catalog', { petType: 'dog' })}
              >
                <div className="text-3xl mb-2">🐕</div>
                <h3 className="font-bold text-gray-900">Dogs</h3>
                <p className="text-xs text-gray-500">Golden, GSD, Beagle...</p>
              </Card>
              <Card 
                className="p-4 text-center hover:bg-blue-50 cursor-pointer transition-colors border border-slate-100 hover:border-blue-200" 
                onClick={() => onNavigate?.('breeder_catalog', { petType: 'cat' })}
              >
                <div className="text-3xl mb-2">🐈</div>
                <h3 className="font-bold text-gray-900">Cats</h3>
                <p className="text-xs text-gray-500">Persian, Siamese...</p>
              </Card>
            </div>
          </div>

          {/* Our Promise */}
          <Card className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              Our Promise
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>All breeders are vetted and verified</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Health certificates provided</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>No puppy mills allowed</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
