'use client';

/**
 * ============================================================================
 * VIDEO CALL INTERFACE COMPONENT
 * ============================================================================
 * 
 * Full-screen video call UI using AWS Chime SDK
 * - Local and remote video streams
 * - Audio/video toggle controls
 * - End call functionality
 * - Connection status indicators
 * 
 * Phase: Phase 3 - Video Call Integration
 * Date: 2026-01-28
 * ============================================================================
 */

import { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface VideoCallInterfaceProps {
  bookingId: string;
  meetingId: string;
  attendeeId: string;
  joinToken: string;
  onEndCall: () => void;
  vendorName?: string;
}

export function VideoCallInterface({
  bookingId,
  meetingId,
  attendeeId,
  joinToken,
  onEndCall,
  vendorName = 'Provider',
}: VideoCallInterfaceProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const meetingSessionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeChimeMeeting();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (connectionStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [connectionStatus]);

  const initializeChimeMeeting = async () => {
    try {
      setIsConnecting(true);
      setConnectionStatus('connecting');

      // Dynamically import AWS Chime SDK
      const {
        DefaultMeetingSession,
        MeetingSessionConfiguration,
        ConsoleLogger,
        LogLevel,
        DefaultDeviceController,
      } = await import('amazon-chime-sdk-js');

      // Create logger
      const logger = new ConsoleLogger('VideoCallInterface', LogLevel.INFO);

      // Create device controller
      const deviceController = new DefaultDeviceController(logger);

      // Create meeting session configuration
      const configuration = new MeetingSessionConfiguration({
        meetingId: meetingId,
        credentials: {
          attendeeId: attendeeId,
          joinToken: joinToken,
        },
      });

      // Create meeting session
      // DefaultMeetingSession(configuration, logger, deviceController, eventController?)
      const meetingSession = new DefaultMeetingSession(
        configuration,
        logger,
        deviceController
      );

      meetingSessionRef.current = meetingSession;

      // Set up audio/video
      await setupAudioVideo(meetingSession);

      setConnectionStatus('connected');
      setIsConnecting(false);
    } catch (err: any) {
      console.error('Error initializing Chime meeting:', err);
      setError(err.message || 'Failed to initialize video call');
      setConnectionStatus('disconnected');
      setIsConnecting(false);
      toast.error('Failed to connect to video call');
    }
  };

  const setupAudioVideo = async (meetingSession: any) => {
    try {
      // Get local video stream
      const localVideoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localVideoStream;
      }

      // Set up audio video observer
      const observer = {
        audioVideoDidStart: () => {
          console.log('Audio/Video started');
        },
        audioVideoDidStop: () => {
          console.log('Audio/Video stopped');
        },
        videoTileDidUpdate: (tileState: any) => {
          if (tileState.boundAttendeeId !== attendeeId && tileState.tileId) {
            // This is the remote video
            const videoElement = meetingSession.audioVideo.getVideoTile(tileState.tileId).getVideoElement();
            if (remoteVideoRef.current && videoElement) {
              remoteVideoRef.current.srcObject = videoElement.srcObject;
            }
          }
        },
        videoTileWasRemoved: () => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
        },
      };

      meetingSession.audioVideo.addObserver(observer);

      // Start audio/video
      meetingSession.audioVideo.start();
    } catch (err: any) {
      console.error('Error setting up audio/video:', err);
      throw err;
    }
  };

  const toggleMute = () => {
    if (meetingSessionRef.current) {
      if (isMuted) {
        meetingSessionRef.current.audioVideo.realtimeUnmuteLocalAudio();
      } else {
        meetingSessionRef.current.audioVideo.realtimeMuteLocalAudio();
      }
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (meetingSessionRef.current) {
      if (isVideoOff) {
        meetingSessionRef.current.audioVideo.startLocalVideoTile();
      } else {
        meetingSessionRef.current.audioVideo.stopLocalVideoTile();
      }
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleEndCall = async () => {
    try {
      cleanup();
      
      // Notify backend
      await apiClient.post('/video-call/end', {
        bookingId,
        duration: callDuration,
      });

      onEndCall();
      toast.success('Call ended');
    } catch (err: any) {
      console.error('Error ending call:', err);
      onEndCall(); // Still close the UI even if backend call fails
    }
  };

  const cleanup = () => {
    if (meetingSessionRef.current) {
      try {
        meetingSessionRef.current.audioVideo.stop();
      } catch (err) {
        console.error('Error stopping meeting session:', err);
      }
    }

    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current?.srcObject) {
      const stream = remoteVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      remoteVideoRef.current.srcObject = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={onEndCall} className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white">
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black">
      {/* Remote Video (Full Screen) */}
      <div className="absolute inset-0">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        {connectionStatus === 'connecting' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
              <p className="text-lg">Connecting to {vendorName}...</p>
            </div>
          </div>
        )}
      </div>

      {/* Local Video (Picture-in-Picture) */}
      <div className="absolute top-4 right-4 w-32 h-48 rounded-xl overflow-hidden border-2 border-white shadow-lg">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {isVideoOff && (
          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
            <VideoOff className="w-8 h-8 text-white" />
          </div>
        )}
      </div>

      {/* Call Duration */}
      <div className="absolute top-4 left-4 bg-black/50 text-white px-4 py-2 rounded-full text-sm font-medium">
        {formatDuration(callDuration)}
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
        <Button
          onClick={toggleMute}
          size="lg"
          className={`rounded-full w-14 h-14 ${
            isMuted
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-white/20 hover:bg-white/30 text-white'
          }`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </Button>

        <Button
          onClick={toggleVideo}
          size="lg"
          className={`rounded-full w-14 h-14 ${
            isVideoOff
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-white/20 hover:bg-white/30 text-white'
          }`}
        >
          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </Button>

        <Button
          onClick={handleEndCall}
          size="lg"
          className="rounded-full w-14 h-14 bg-red-500 hover:bg-red-600 text-white"
        >
          <PhoneOff className="w-6 h-6" />
        </Button>
      </div>

      {/* Connection Status Indicator */}
      {connectionStatus === 'connected' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          Connected
        </div>
      )}
    </div>
  );
}
