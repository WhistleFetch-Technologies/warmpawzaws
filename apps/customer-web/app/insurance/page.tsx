'use client';

import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function InsurancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="bg-white/90 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="w-11 h-11 rounded-2xl border border-orange-200 flex items-center justify-center text-orange-700 hover:bg-orange-50 transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Pet Insurance</h1>
            <p className="text-sm text-gray-500 mt-0.5">Not available yet — launching in the future</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-10">
        <Card className="bg-amber-50 border-amber-200 p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-amber-700" />
          </div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-wide bg-amber-500 text-white px-3 py-1 rounded-full mb-3">
            Coming soon
          </span>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pet insurance</h2>
          <p className="text-gray-700 mb-8 text-sm leading-relaxed">
            We&apos;re not launching pet insurance right now. When we do, you&apos;ll be able to browse plans and protect your pet from this page.
          </p>
          <Button
            type="button"
            disabled
            className="w-full max-w-sm mx-auto bg-slate-400 text-white h-12 text-base font-bold cursor-not-allowed"
          >
            COMING SOON
          </Button>
        </Card>
      </div>
    </div>
  );
}
