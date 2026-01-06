'use client';

import { useState, useEffect } from 'react';
import { Video, Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

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

      if (response.meeting_id) {
        setMeetingInfo(response);
        // TODO: Initialize AWS Chime SDK here
        // For now, simulate connection
        setTimeout(() => {
          setIsConnected(true);
          setLoading(false);
        }, 2000);
      }
    } catch (err: any) {
      console.error('Error initializing video call:', err);
      setError(err.message || 'Failed to initialize video call');
      setLoading(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // TODO: Implement actual mute/unmute with Chime SDK
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
    // TODO: Implement actual video toggle with Chime SDK
  };

  const endCall = async () => {
    try {
      await apiClient.post(`/video-call/${bookingId}/end`, {});
      setIsConnected(false);
      onEndCall?.();
    } catch (err) {
      console.error('Error ending call:', err);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600">Connecting...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="text-center py-8">
          <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={onEndCall}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
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
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-white text-center">
                <Video className="w-16 h-16 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Remote video feed</p>
                <p className="text-xs text-gray-400 mt-1">
                  AWS Chime SDK integration pending
                </p>
              </div>
            </div>

            {/* Local Video (Picture-in-Picture) */}
            {!isVideoOff && (
              <div className="absolute bottom-4 right-4 w-32 h-24 bg-gray-800 rounded-lg border-2 border-white">
                <div className="w-full h-full flex items-center justify-center">
                  <Video className="w-8 h-8 text-white opacity-50" />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-white text-center">
              <Phone className="w-16 h-16 mx-auto mb-2 opacity-50" />
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

