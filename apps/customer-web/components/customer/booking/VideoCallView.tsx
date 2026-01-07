'use client';

import { useState, useEffect, useRef } from 'react';
import { Video, Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ChimeSDKManager } from '@/lib/chime-sdk';

interface VideoCallViewProps {
  bookingId: string;
  participantType: 'customer' | 'vendor';
  onEndCall?: () => void;
}

export function VideoCallView({ bookingId, participantType, onEndCall }: VideoCallViewProps) {
  const [meetingInfo, setMeetingInfo] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chimeManagerRef = useRef<ChimeSDKManager | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    initializeCall();
    return () => {
      // Cleanup on unmount
      if (isConnected) {
        endCall();
      }
    };
  }, [bookingId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected]);

  const initializeCall = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{
        meeting_id: string;
        attendee_info: any;
      }>(`/video-call/${bookingId}/meeting-info`);

      if (response.meeting_id && response.attendee_info) {
        setMeetingInfo(response);
        
        // Initialize AWS Chime SDK
        const manager = new ChimeSDKManager();
        await manager.initialize({
          meetingId: response.meeting_id,
          attendeeId: response.attendee_info.attendee_id,
          joinToken: response.attendee_info.join_token,
          mediaRegion: response.attendee_info.media_region || 'ap-south-1',
        });
        
        chimeManagerRef.current = manager;
        
        // Join the meeting
        await manager.join();
        
        // Start video streams
        if (localVideoRef.current) {
          await manager.startLocalVideo(localVideoRef.current);
        }
        if (remoteVideoRef.current) {
          await manager.startRemoteVideo(remoteVideoRef.current);
        }
        
        setIsConnected(true);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error initializing video call:', err);
      setError(err.message || 'Failed to initialize video call');
      setLoading(false);
    }
  };

  const toggleMute = async () => {
    if (chimeManagerRef.current) {
      try {
        const newMuted = await chimeManagerRef.current.toggleMute();
        setIsMuted(newMuted);
      } catch (err) {
        console.error('Error toggling mute:', err);
      }
    }
  };

  const toggleVideo = async () => {
    if (chimeManagerRef.current) {
      try {
        const newVideoOff = await chimeManagerRef.current.toggleVideo();
        setIsVideoOff(!newVideoOff);
      } catch (err) {
        console.error('Error toggling video:', err);
      }
    }
  };

  const endCall = async () => {
    try {
      // End Chime call
      if (chimeManagerRef.current) {
        await chimeManagerRef.current.endCall();
        chimeManagerRef.current = null;
      }
      
      // Notify backend
      await apiClient.post(`/video-call/${bookingId}/end`, {});
      setIsConnected(false);
      onEndCall?.();
    } catch (err) {
      console.error('Error ending call:', err);
      // Still disconnect even if backend call fails
      setIsConnected(false);
      onEndCall?.();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-0 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-0 text-gray-600">Connecting...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-0 shadow-sm">
        <div className="text-center py-8">
          <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={onEndCall}
            className="px-4 py-0 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-0 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-0">
          <Video className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-gray-900">Video Call</h3>
        </div>
        {isConnected && (
          <span className="text-sm text-gray-600">{formatDuration(callDuration)}</span>
        )}
      </div>

      {/* Video Container */}
      <div className="bg-gray-900 rounded-lg aspect-video mb-4 relative overflow-hidden">
        {isConnected ? (
          <>
            {/* Remote Video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              style={{ display: isVideoOff ? 'none' : 'block' }}
            />

            {/* Local Video (Picture-in-Picture) */}
            {!isVideoOff && (
              <div className="absolute bottom-4 right-4 w-32 h-24 bg-gray-800 rounded-lg border-2 border-white overflow-hidden">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-white text-center">
              <Phone className="w-16 h-16 mx-auto mb-0 opacity-50" />
              <p className="text-sm">Connecting...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {isConnected && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isMuted ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'
            } hover:opacity-80 transition-opacity`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isVideoOff ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'
            } hover:opacity-80 transition-opacity`}
          >
            {isVideoOff ? <Video className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          <button
            onClick={endCall}
            className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      )}

      {meetingInfo && (
        <p className="text-xs text-gray-500 text-center mt-4">
          Meeting ID: {meetingInfo.meeting_id?.slice(0, 8)}...
        </p>
      )}
    </div>
  );
}

