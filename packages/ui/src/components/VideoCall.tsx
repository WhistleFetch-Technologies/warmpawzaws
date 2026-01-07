'use client';

import React, { useState, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface VideoCallProps {
  bookingId: string;
  participantType: 'customer' | 'vendor';
  onEndCall?: () => void;
  onError?: (error: string) => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VideoCall({ bookingId, participantType, onEndCall, onError }: VideoCallProps) {
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [meetingInfo, setMeetingInfo] = useState<{ meetingId: string; attendeeId: string } | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    initializeCall();
    return () => {
      cleanup();
    };
  }, [bookingId]);

  const initializeCall = async () => {
    try {
      setIsConnecting(true);
      
      // In production, this would call AWS Chime SDK APIs
      // For now, we'll simulate the connection
      
      // Request camera and microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Simulate meeting info from backend
      // In production: await apiClient.post('/video-call/join', { bookingId, participantType })
      setMeetingInfo({
        meetingId: `meeting-${bookingId}`,
        attendeeId: `${participantType}-${Date.now()}`,
      });
      
      // Simulate connection delay
      setTimeout(() => {
        setIsConnecting(false);
        setIsConnected(true);
        startDurationTimer();
      }, 2000);
      
    } catch (err: any) {
      console.error('Error initializing call:', err);
      const errorMsg = err.message || 'Failed to start video call';
      if (onError) onError(errorMsg);
      setIsConnecting(false);
    }
  };

  const startDurationTimer = () => {
    durationIntervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const cleanup = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleToggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const handleToggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleEndCall = async () => {
    try {
      // In production: await apiClient.post('/video-call/end', { bookingId, meetingId: meetingInfo?.meetingId })
      cleanup();
      if (onEndCall) onEndCall();
    } catch (err: any) {
      console.error('Error ending call:', err);
      if (onError) onError(err.message || 'Failed to end call');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isConnecting) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Connecting to call...</p>
          <p className="text-gray-400 mt-2">Please wait</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      {/* Remote Video (Main) */}
      <div className="flex-1 relative">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Call Info Overlay */}
        <div className="absolute top-4 left-4 bg-black/50 rounded-lg px-4 py-2 text-white">
          <p className="text-sm">Call Duration: {formatDuration(callDuration)}</p>
          {meetingInfo && (
            <p className="text-xs text-gray-300">Meeting: {meetingInfo.meetingId}</p>
          )}
        </div>
        
        {/* Connection Status */}
        {isConnected && (
          <div className="absolute top-4 right-4 bg-green-500 rounded-full px-3 py-1 text-white text-sm">
            ● Connected
          </div>
        )}
      </div>

      {/* Local Video (Picture-in-Picture) */}
      <div className="absolute bottom-24 right-4 w-48 h-36 bg-gray-900 rounded-lg overflow-hidden border-2 border-white">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {isVideoOff && (
          <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center">
              <span className="text-2xl text-white">
                {participantType === 'customer' ? '👤' : '🏪'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-6">
        <div className="flex items-center justify-center gap-4">
          {/* Mute Toggle */}
          <button
            onClick={handleToggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
              isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
            } text-white`}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>

          {/* Video Toggle */}
          <button
            onClick={handleToggleVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
              isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
            } text-white`}
          >
            {isVideoOff ? '📷' : '📹'}
          </button>

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition"
          >
            📞
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-20 left-4 bg-black/50 rounded-lg p-4 text-white text-sm max-w-xs">
        <p className="font-medium mb-2">Video Call Tips:</p>
        <ul className="space-y-1 text-gray-300">
          <li>• Ensure good lighting</li>
          <li>• Use headphones to avoid echo</li>
          <li>• Check your internet connection</li>
          <li>• Click controls to mute/unmute</li>
        </ul>
      </div>
    </div>
  );
}

