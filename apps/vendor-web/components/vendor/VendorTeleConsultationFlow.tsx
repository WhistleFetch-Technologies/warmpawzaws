'use client';

import { useState } from 'react';
import { ArrowLeft, Video, VideoOff, Mic, MicOff, Phone, PhoneOff, MessageSquare } from 'lucide-react';

interface VendorTeleConsultationFlowProps {
  vendorId: string;
  bookingId?: string;
  vendorData?: any;
  bookingData?: any;
  onBack: () => void;
}

export function VendorTeleConsultationFlow({ vendorId, bookingId, onBack }: VendorTeleConsultationFlowProps) {
  const [status, setStatus] = useState<'waiting' | 'connecting' | 'active' | 'ended'>('waiting');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  return (
    <div className="min-h-screen bg-gray-900 w-full max-w-[430px] mx-auto flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 text-white p-4 flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-lg font-semibold">Teleconsultation</h1>
          <p className="text-sm text-gray-400">
            {status === 'waiting' && 'Waiting for patient...'}
            {status === 'connecting' && 'Connecting...'}
            {status === 'active' && 'In session'}
            {status === 'ended' && 'Session ended'}
          </p>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative bg-gray-800 flex items-center justify-center">
        {status === 'waiting' && (
          <div className="text-center p-8">
            <div className="w-24 h-24 bg-[#FF8C42] rounded-full flex items-center justify-center mx-auto mb-4">
              <Video className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Ready for Consultation</h2>
            <p className="text-gray-400 mb-6">
              {bookingId 
                ? `Booking #${bookingId.substring(0, 8)}` 
                : 'Waiting for the patient to join the call'}
            </p>
            <button
              onClick={() => setStatus('connecting')}
              className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2 mx-auto"
            >
              <Phone className="w-5 h-5" />
              Start Call (Demo)
            </button>
          </div>
        )}

        {status === 'connecting' && (
          <div className="text-center">
            <div className="animate-spin w-16 h-16 border-4 border-[#FF8C42] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-white">Connecting to patient...</p>
          </div>
        )}

        {status === 'active' && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-16 h-16 text-gray-500" />
              </div>
              <p className="text-white">Video feed placeholder</p>
              <p className="text-gray-400 text-sm mt-2">Demo mode - no actual video</p>
            </div>
          </div>
        )}

        {status === 'ended' && (
          <div className="text-center p-8">
            <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <PhoneOff className="w-12 h-12 text-gray-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Call Ended</h2>
            <p className="text-gray-400 mb-6">Duration: 15:32</p>
            <button
              onClick={onBack}
              className="bg-[#FF8C42] text-white px-8 py-3 rounded-xl font-semibold"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      {(status === 'active' || status === 'connecting') && (
        <div className="bg-gray-800 p-6">
          <div className="flex justify-center gap-6">
            <button
              onClick={() => setVideoEnabled(!videoEnabled)}
              className={`w-14 h-14 rounded-full flex items-center justify-center ${
                videoEnabled ? 'bg-gray-700 text-white' : 'bg-red-500 text-white'
              }`}
            >
              {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>
            
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`w-14 h-14 rounded-full flex items-center justify-center ${
                audioEnabled ? 'bg-gray-700 text-white' : 'bg-red-500 text-white'
              }`}
            >
              {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </button>

            <button
              onClick={() => setStatus('ended')}
              className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center"
            >
              <PhoneOff className="w-6 h-6" />
            </button>

            <button className="w-14 h-14 rounded-full bg-gray-700 text-white flex items-center justify-center">
              <MessageSquare className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
