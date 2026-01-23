'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { VideoCallInterface } from '@/components/customer/video/VideoCallInterface';

interface VideoCallData {
  booking_id: string;
  meeting_id: string | null;
  attendee_id?: string;
  join_token?: string;
  external_meeting_id?: string;
  staff_name: string;
  service_name: string;
  status: 'waiting' | 'connecting' | 'connected' | 'ended';
  duration_minutes?: number;
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
      // ✅ FIX: Use correct endpoint format
      const response = await apiClient.get<any>(`/video-call/${bookingId}`);
      if (response.meeting || response.call) {
        setCallData(response.call || {
          meeting_id: response.meetingId,
          staff_name: response.staffName || 'Provider',
          service_name: response.serviceName || 'Tele Consultation',
          scheduled_time: response.scheduledTime || response.scheduled_time || 'Not scheduled',
          status: response.status,
        });
      } else if (response.status === 'not_created' || response.status === 'not_found') {
        // Meeting not created yet - this is okay, user can still try to join
        setCallData({
          booking_id: bookingId,
          meeting_id: null,
          staff_name: 'Provider',
          service_name: 'Tele Consultation',
          scheduled_time: 'Not scheduled',
          status: 'waiting',
        });
      } else {
        setError(response.message || 'No video call data available');
      }
    } catch (err: any) {
      // ✅ FIX: Don't show error if meeting just doesn't exist yet
      if (err.message?.includes('not found') || err.message?.includes('not yet created')) {
        setCallData({
          booking_id: bookingId,
          meeting_id: null,
          staff_name: 'Provider',
          service_name: 'Tele Consultation',
          scheduled_time: 'Not scheduled',
          status: 'waiting',
        });
      } else {
        setError(err.message || 'Failed to load call data');
      }
    } finally {
      setLoading(false);
    }
  };

  const startCall = async () => {
    try {
      setCallStatus('joining');
      setError(null);
      
      // ✅ FIX: Get customer ID from localStorage or phone
      const customerId = typeof window !== 'undefined' 
        ? localStorage.getItem('customerId') || localStorage.getItem('customerPhone') || 'customer'
        : 'customer';
      
      // Join the meeting with proper parameters
      const response = await apiClient.post<any>(`/video-call/join`, {
        bookingId: bookingId,
        participantId: customerId,
        participantType: 'customer',
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
      } else {
        throw new Error(response.error || response.message || 'Failed to join call');
      }
    } catch (err: any) {
      console.error('Error joining call:', err);
      setError(err.message || 'Failed to join call. Please check if the consultation is scheduled and confirmed.');
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

  // In Call Screen - Use VideoCallInterface component
  if (callStatus === 'in_call' && callData?.meeting_id && callData?.attendee_id && callData?.join_token) {
    return (
      <VideoCallInterface
        bookingId={bookingId}
        meetingId={callData.meeting_id}
        attendeeId={callData.attendee_id}
        joinToken={callData.join_token}
        onEndCall={() => {
          setCallStatus('ended');
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
        }}
        vendorName={callData.staff_name}
      />
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

