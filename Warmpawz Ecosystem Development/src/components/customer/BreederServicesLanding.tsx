import { useState } from 'react';
import { ArrowLeft, ShieldCheck, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

interface BreederServicesLandingProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  phone?: string;
}

export function BreederServicesLanding({ onBack, onNavigate, phone }: BreederServicesLandingProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Find Breeders</h1>
            <p className="text-xs text-white/80">Responsible Pet Breeding</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-24">
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Ethical Breeding</h2>
              <p className="text-gray-700 mb-4">We only list verified, responsible breeders who prioritize health & welfare.</p>
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => onNavigate('breeder_catalog')}
              >
                <Search className="w-4 h-4 mr-2" /> Browse Puppies
              </Button>
            </div>
            <div className="text-5xl">🐕</div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 text-center hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => onNavigate('breeder_catalog')}>
                <div className="text-3xl mb-2">🐕</div>
                <h3 className="font-bold text-gray-900">Dogs</h3>
                <p className="text-xs text-gray-500">Golden, GSD, Beagle...</p>
            </Card>
            <Card className="p-4 text-center hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => onNavigate('breeder_catalog')}>
                <div className="text-3xl mb-2">🐈</div>
                <h3 className="font-bold text-gray-900">Cats</h3>
                <p className="text-xs text-gray-500">Persian, Siamese...</p>
            </Card>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                Our Promise
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span> All breeders are vetted and verified
                </li>
                <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span> Health certificates provided
                </li>
                <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span> No puppy mills allowed
                </li>
            </ul>
        </div>
      </div>
    </div>
  );
}