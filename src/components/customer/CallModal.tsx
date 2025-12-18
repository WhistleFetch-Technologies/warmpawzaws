import { useState, useEffect, useRef } from 'react';
import { X, Phone, Video, Mic, MicOff, VideoOff, PhoneOff } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface CallModalProps {
  bookingId: string;
  customerPhone: string;
  customerName: string;
  callType: 'video' | 'voice';
  onClose: () => void;
}

interface CallSession {
  id: string;
  vendorName: string;
  petName: string;
  status: 'initiated' | 'ringing' | 'active' | 'ended';
  startedAt?: string;
  duration?: number;
}

export function CallModal({ bookingId, customerPhone, customerName, callType, onClose }: CallModalProps) {
  const [callSession, setCallSession] = useState<CallSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [callStatus, setCallStatus] = useState<'initiating' | 'ringing' | 'active' | 'ended'>('initiating');
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(callType === 'video');
  const [callDuration, setCallDuration] = useState(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initiateCall();
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (callStatus === 'active') {
      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    }
  }, [callStatus]);

  const initiateCall = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/call/initiate`,
        {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bookingId,
            callType,
            initiatedBy: 'customer'
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        setCallSession(result.call);
        setCallStatus('ringing');
        
        // Simulate vendor answering after 3 seconds (in real app, use polling or websockets)
        setTimeout(async () => {
          await answerCall(result.call.id);
        }, 3000);
      }
    } catch (error) {
      console.error('Error initiating call:', error);
    } finally {
      setLoading(false);
    }
  };

  const answerCall = async (callId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/call/${callId}/answer`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        setCallStatus('active');
      }
    } catch (error) {
      console.error('Error answering call:', error);
    }
  };

  const endCall = async () => {
    if (!callSession) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/call/${callSession.id}/end`,
        {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        }
      );

      if (response.ok) {
        setCallStatus('ended');
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-[#FF8C42] gradient-to-br from-purple-900 via-indigo-900 to-blue-900 z-50 flex items-center justify-center">
      <div className="w-full max-w-[430px] h-screen flex flex-col">
        {/* Header */}
        <div className="pt-12 pb-6 px-6">
          <div className="flex items-center justify-between">
            <div className="text-white text-sm font-medium">
              {callType === 'video' ? 'Video Call' : 'Voice Call'}
            </div>
            {callStatus !== 'ended' && (
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-[#FF8C42] white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Call Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Avatar */}
          <div className={`mb-8 ${callStatus === 'active' ? 'animate-pulse' : ''}`}>
            <div className="w-32 h-32 bg-gradient-to-br from-orange-400 to-pink-400 rounded-full flex items-center justify-center">
              <span className="text-5xl">👨‍⚕️</span>
            </div>
          </div>

          {/* Vendor Name */}
          <h2 className="text-3xl font-bold text-white mb-2">
            {callSession?.vendorName || 'Connecting...'}
          </h2>

          {/* Pet Name */}
          <p className="text-lg text-white/80 mb-6">
            {callSession?.petName && `for ${callSession.petName}`}
          </p>

          {/* Call Status */}
          <div className="mb-8">
            {callStatus === 'initiating' && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-[#FF8C42] white rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-[#FF8C42] white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-[#FF8C42] white rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            )}
            {callStatus === 'ringing' && (
              <p className="text-xl text-white/90 animate-pulse">Ringing...</p>
            )}
            {callStatus === 'active' && (
              <p className="text-2xl font-mono text-white">{formatDuration(callDuration)}</p>
            )}
            {callStatus === 'ended' && (
              <p className="text-xl text-white/90">Call Ended</p>
            )}
          </div>

          {/* Video placeholder for video calls */}
          {callType === 'video' && callStatus === 'active' && videoEnabled && (
            <div className="w-full aspect-video bg-[#FF8C42] black/30 rounded-2xl mb-8 border-2 border-white/20 flex items-center justify-center">
              <Video className="w-12 h-12 text-white/50" />
              <p className="text-white/70 ml-3">Video feed would appear here</p>
            </div>
          )}
        </div>

        {/* Call Controls */}
        {callStatus !== 'ended' && (
          <div className="pb-12 px-6">
            <div className="flex items-center justify-center gap-6 mb-8">
              {/* Mute */}
              <button
                onClick={() => setMuted(!muted)}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                  muted ? 'bg-white text-purple-900' : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {muted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
              </button>

              {/* End Call */}
              <button
                onClick={endCall}
                className="w-20 h-20 rounded-full bg-red-500 hover:bg-[#FF8C42] red-600 flex items-center justify-center transition-colors shadow-lg"
              >
                <PhoneOff className="w-8 h-8 text-white" />
              </button>

              {/* Video toggle (only for video calls) */}
              {callType === 'video' && (
                <button
                  onClick={() => setVideoEnabled(!videoEnabled)}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                    !videoEnabled ? 'bg-white text-purple-900' : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {videoEnabled ? <Video className="w-7 h-7" /> : <VideoOff className="w-7 h-7" />}
                </button>
              )}
            </div>

            <p className="text-center text-white/60 text-sm">
              {callStatus === 'ringing' ? 'Calling vendor...' : 
               callStatus === 'active' ? 'Call in progress' : 'Connecting...'}
            </p>
          </div>
        )}

        {callStatus === 'ended' && (
          <div className="pb-12 px-6 text-center">
            <p className="text-white/80 mb-4">
              Call duration: {formatDuration(callDuration)}
            </p>
            <Button
              onClick={onClose}
              className="w-full bg-white text-purple-900 hover:bg-[#FF8C42] white/90"
            >
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
