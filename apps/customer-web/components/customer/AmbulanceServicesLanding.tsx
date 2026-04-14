'use client';

import { useState } from 'react';
import { ArrowLeft, Siren, Calendar, Building2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface AmbulanceServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function AmbulanceServicesLanding({ phone, onBack, onNavigate }: AmbulanceServicesLandingProps) {
  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      {/* Header with Red Gradient */}
      <div className="relative bg-gradient-to-br from-red-600 to-red-700 pb-16 pl-[max(1.5rem,env(safe-area-inset-left,0px))] pr-[max(1.5rem,env(safe-area-inset-right,0px))] text-white cw-header-safe-top">
        <button 
          type="button"
          onClick={onBack}
          className="mb-4 flex min-h-[44px] items-center gap-2 text-white/90 hover:text-white touch-manipulation"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <Siren className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pet Ambulance</h1>
            <p className="text-white/80 text-sm">Emergency & Transport Services</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
            <div className="text-2xl font-bold">24/7</div>
            <div className="text-white/80 text-xs">Available</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
            <div className="text-2xl font-bold">5 min</div>
            <div className="text-white/80 text-xs">Response Time</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
            <div className="text-2xl font-bold">50+</div>
            <div className="text-white/80 text-xs">Fleet Size</div>
          </div>
        </div>
        
        {/* Concave curve */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-white" 
             style={{
               borderTopLeftRadius: '50% 100%',
               borderTopRightRadius: '50% 100%',
             }}
        />
      </div>

      {/* Main Content on White Background */}
      <div className="px-6 pb-24">
        {/* Emergency SOS Button */}
        <Card className="bg-amber-50 border-amber-200 p-6 text-center mb-6">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Siren className="w-8 h-8 text-amber-700" />
          </div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-wide bg-amber-500 text-white px-3 py-1 rounded-full mb-3">
            Coming soon
          </span>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Emergency ambulance</h2>
          <p className="text-gray-700 mb-6">
            One-tap SOS dispatch is not available yet. We&apos;re building instant, location-based help for your pet.
          </p>
          <Button
            type="button"
            disabled
            className="w-full bg-slate-400 text-white h-12 text-lg font-bold cursor-not-allowed opacity-95"
          >
            COMING SOON
          </Button>
        </Card>

        {/* Service Types */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold">Other Services</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Card 
              className="p-4 text-center hover:bg-red-50 cursor-pointer border border-slate-100 hover:border-red-200 transition-colors"
              onClick={() => onNavigate?.('ambulance_schedule')}
            >
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Schedule Ride</h3>
              <p className="text-xs text-gray-500">For vet visits</p>
            </Card>
            <Card 
              className="p-4 text-center hover:bg-red-50 cursor-pointer border border-slate-100 hover:border-red-200 transition-colors"
              onClick={() => onNavigate?.('ambulance_transfer')}
            >
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Building2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Inter-Hospital</h3>
              <p className="text-xs text-gray-500">Transfer patient</p>
            </Card>
          </div>
        </div>

        {/* Features */}
        <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Why Choose Us?</h3>
          <div className="space-y-3">
            {[
              { icon: '⚡', title: 'Fast Response', desc: '5-minute average response time' },
              { icon: '🏥', title: 'Medical Equipment', desc: 'Fully equipped ambulances' },
              { icon: '👨‍⚕️', title: 'Trained Staff', desc: 'Certified veterinary technicians' },
              { icon: '📍', title: 'GPS Tracking', desc: 'Real-time location tracking' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{item.title}</h4>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
