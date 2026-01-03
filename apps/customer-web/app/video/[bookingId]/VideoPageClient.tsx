'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface VideoCallData {
  booking_id: string;
  meeting_id: string;
  attendee_id: string;
  join_token: string;
  external_meeting_id: string;
  staff_name: string;
  service_name: string;
  status: 'waiting' | 'connecting' | 'connected' | 'ended';
  duration_minutes: number;
  scheduled_time: string;
}

interface VideoPageClientProps {
  bookingId: string;
}

export function VideoPageClient({ bookingId }: VideoPageClientProps) {
  const router = useRouter();
  
  const [callData, setCallData] = useState<VideoCallData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'joining' | 'in_call' | 'ended'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadCallData();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [bookingId]);

  const loadCallData = async () => {
    try {
      const response = await apiClient.get<any>(`/video-call/booking/${bookingId}`);
      if (response.call) {
        setCallData(response.call);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load call data');
    } finally {
      setLoading(false);
    }
  };

  const startCall = async () => {
    try {
      setCallStatus('joining');
      
      // Join the meeting
      const response = await apiClient.post<any>(`/video-call/join`, {
        booking_id: bookingId,
        meeting_id: callData?.meeting_id,
      });

      if (response.success) {
        setCallStatus('in_call');
        
        // Start duration timer
        timerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
        
        // In a real implementation, you would initialize AWS Chime SDK here
        // and connect to the video call
        initializeVideoCall(response);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to join call');
      setCallStatus('idle');
    }
  };

  const initializeVideoCall = async (meetingData: any) => {
    // This would integrate with AWS Chime SDK
    // For now, we'll simulate the video call
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Failed to access camera/mic:', err);
    }
  };

  const endCall = async () => {
    try {
      await apiClient.post(`/video-call/end`, {
        booking_id: bookingId,
        meeting_id: callData?.meeting_id,
        duration_seconds: callDuration,
      });
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Stop video stream
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      
      setCallStatus('ended');
    } catch (err: any) {
      console.error('Error ending call:', err);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // In real implementation, mute the audio track
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
    // In real implementation, disable the video track
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Preparing video call...</p>
        </div>
      </div>
    );
  }

  if (error || !callData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="text-center p-6 bg-slate-800 rounded-2xl max-w-md">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-white mb-2">Call Not Available</h2>
          <p className="text-gray-400 mb-4">{error || 'Unable to start video call'}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Waiting Screen
  if (callStatus === 'idle') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        {/* Header */}
        <header className="p-4 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-white/70 hover:text-white">
            ← Back
          </button>
          <span className="text-white/50 text-sm">Tele Consultation</span>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-4xl mb-6">
              👤
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{callData.staff_name}</h2>
            <p className="text-gray-400 mb-2">{callData.service_name}</p>
            <p className="text-gray-500 text-sm mb-8">Scheduled: {callData.scheduled_time}</p>

            <button
              onClick={startCall}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white text-lg font-semibold rounded-2xl hover:from-green-600 hover:to-green-700 transition shadow-lg shadow-green-500/30 flex items-center gap-3 mx-auto"
            >
              <span className="text-2xl">📹</span>
              Join Video Call
            </button>

            <div className="mt-8 p-4 bg-slate-800 rounded-xl text-left">
              <p className="text-gray-400 text-sm mb-3">Before joining:</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Allow camera and microphone access
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Ensure stable internet connection
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Find a quiet, well-lit place
                </li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Joining Screen
  if (callStatus === 'joining') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-6xl mb-6">📹</div>
          <h2 className="text-xl font-bold text-white mb-2">Connecting...</h2>
          <p className="text-gray-400">Please wait while we connect you</p>
        </div>
      </div>
    );
  }

  // In Call Screen
  if (callStatus === 'in_call') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        {/* Remote Video (Full Screen) */}
        <div className="flex-1 relative bg-slate-800">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Placeholder when no remote video */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-6xl mb-4">
                👤
              </div>
              <p className="text-white font-medium">{callData.staff_name}</p>
              <p className="text-gray-400 text-sm">Video will appear here</p>
            </div>
          </div>

          {/* Local Video (Picture-in-Picture) */}
          <div className="absolute top-4 right-4 w-32 h-44 bg-slate-700 rounded-xl overflow-hidden shadow-lg">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
            />
            {isVideoOff && (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-3xl">📵</span>
              </div>
            )}
          </div>

          {/* Call Duration */}
          <div className="absolute top-4 left-4 px-4 py-2 bg-black/50 rounded-full">
            <p className="text-white font-mono">{formatDuration(callDuration)}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-800 p-6 safe-area-bottom">
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
                isMuted ? 'bg-red-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              <span className="text-2xl">{isMuted ? '🔇' : '🎤'}</span>
            </button>
            
            <button
              onClick={toggleVideo}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
                isVideoOff ? 'bg-red-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              <span className="text-2xl">{isVideoOff ? '📵' : '📹'}</span>
            </button>
            
            <button className="w-14 h-14 rounded-full bg-slate-700 text-white flex items-center justify-center hover:bg-slate-600 transition">
              <span className="text-2xl">💬</span>
            </button>
            
            <button
              onClick={endCall}
              className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition"
            >
              <span className="text-2xl">📞</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Call Ended Screen
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-8xl mb-6">✅</div>
        <h2 className="text-2xl font-bold text-white mb-2">Consultation Completed</h2>
        <p className="text-gray-400 mb-6">
          Call duration: {formatDuration(callDuration)}
        </p>
        
        <div className="space-y-4">
          <button
            onClick={() => router.push(`/bookings/${bookingId}`)}
            className="w-full py-4 bg-blue-500 text-white font-semibold rounded-2xl hover:bg-blue-600 transition"
          >
            View Booking Details
          </button>
          
          <button
            onClick={() => router.push(`/bookings/${bookingId}/review`)}
            className="w-full py-4 bg-orange-500 text-white font-semibold rounded-2xl hover:bg-orange-600 transition"
          >
            Rate & Review
          </button>
          
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 text-gray-400 font-medium hover:text-white transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

