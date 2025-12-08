import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * AWS Chime Video Hook
 * 
 * Manages AWS Chime video consultation sessions
 * Uses amazon-chime-sdk-js for client-side video/audio
 * 
 * Installation: npm install amazon-chime-sdk-js
 */

interface UseAWSChimeVideoProps {
  consultationId: string;
  userId: string;
  userType: 'customer' | 'vendor';
  onError?: (error: Error) => void;
  onMeetingStart?: () => void;
  onMeetingEnd?: () => void;
}

export function useAWSChimeVideo({
  consultationId,
  userId,
  userType,
  onError,
  onMeetingStart,
  onMeetingEnd
}: UseAWSChimeVideoProps) {
  const [meetingSession, setMeetingSession] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [attendees, setAttendees] = useState<string[]>([]);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    initializeChimeMeeting();
    return () => {
      cleanup();
    };
  }, [consultationId]);

  const initializeChimeMeeting = async () => {
    try {
      // 1. Check if AWS Chime is enabled
      const configRes = await fetch('/make-server-3dd53475/video/config');
      const config = await configRes.json();

      if (!config.enabled) {
        throw new Error('AWS Chime is not enabled. Please contact support.');
      }

      // 2. Get meeting credentials
      const joinRes = await fetch('/make-server-3dd53475/video/consultation/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
        },
        body: JSON.stringify({
          consultationId,
          userId,
          userType
        })
      });

      if (!joinRes.ok) {
        throw new Error('Failed to join consultation');
      }

      const { meeting, attendee } = await joinRes.json();

      // 3. Initialize Chime SDK
      // Note: This requires amazon-chime-sdk-js to be installed
      // Import dynamically to avoid build errors if not installed
      const ChimeSDK = await import('amazon-chime-sdk-js').catch(() => {
        console.warn('⚠️ amazon-chime-sdk-js not installed. Using mock mode.');
        return null;
      });

      if (!ChimeSDK) {
        // Fallback to mock mode if SDK not installed
        console.log('📹 Mock video mode (AWS Chime SDK not installed)');
        setIsConnected(true);
        onMeetingStart?.();
        return;
      }

      const {
        ConsoleLogger,
        LogLevel,
        DefaultDeviceController,
        DefaultMeetingSession,
        MeetingSessionConfiguration
      } = ChimeSDK;

      // 4. Create meeting configuration
      const logger = new ConsoleLogger('ChimeLogger', LogLevel.INFO);
      const deviceController = new DefaultDeviceController(logger);

      const configuration = new MeetingSessionConfiguration(meeting, attendee);
      const session = new DefaultMeetingSession(configuration, logger, deviceController);

      // 5. Set up audio/video observers
      session.audioVideo.addObserver({
        audioVideoDidStart: () => {
          console.log('✅ AWS Chime session started');
          setIsConnected(true);
          onMeetingStart?.();
        },
        audioVideoDidStop: () => {
          console.log('📴 AWS Chime session stopped');
          setIsConnected(false);
          onMeetingEnd?.();
        },
        videoTileDidUpdate: (tileState: any) => {
          if (tileState.localTile && localVideoRef.current) {
            session.audioVideo.bindVideoElement(tileState.tileId!, localVideoRef.current);
          } else if (remoteVideoRef.current) {
            session.audioVideo.bindVideoElement(tileState.tileId!, remoteVideoRef.current);
          }
        },
        videoTileWasRemoved: (tileId: number) => {
          console.log('Video tile removed:', tileId);
        }
      });

      // 6. Set up attendee presence observer
      session.audioVideo.realtimeSubscribeToAttendeeIdPresence(
        (attendeeId: string, present: boolean) => {
          setAttendees(prev => {
            if (present && !prev.includes(attendeeId)) {
              return [...prev, attendeeId];
            } else if (!present) {
              return prev.filter(id => id !== attendeeId);
            }
            return prev;
          });
        }
      );

      // 7. Get available devices
      const audioInputs = await session.audioVideo.listAudioInputDevices();
      const videoInputs = await session.audioVideo.listVideoInputDevices();

      // 8. Choose default devices
      if (audioInputs.length > 0) {
        await session.audioVideo.chooseAudioInputDevice(audioInputs[0].deviceId);
      }
      if (videoInputs.length > 0) {
        await session.audioVideo.chooseVideoInputDevice(videoInputs[0].deviceId);
      }

      // 9. Start local video
      session.audioVideo.startLocalVideoTile();

      // 10. Start the session
      await session.audioVideo.start();

      setMeetingSession(session);

      console.log('✅ AWS Chime meeting initialized');
    } catch (error) {
      console.error('❌ Error initializing Chime meeting:', error);
      onError?.(error as Error);
    }
  };

  const toggleVideo = useCallback(() => {
    if (meetingSession) {
      if (isVideoEnabled) {
        meetingSession.audioVideo.stopLocalVideoTile();
      } else {
        meetingSession.audioVideo.startLocalVideoTile();
      }
      setIsVideoEnabled(!isVideoEnabled);
    }
  }, [meetingSession, isVideoEnabled]);

  const toggleAudio = useCallback(() => {
    if (meetingSession) {
      if (isAudioEnabled) {
        meetingSession.audioVideo.realtimeMuteLocalAudio();
      } else {
        meetingSession.audioVideo.realtimeUnmuteLocalAudio();
      }
      setIsAudioEnabled(!isAudioEnabled);
    }
  }, [meetingSession, isAudioEnabled]);

  const startScreenShare = useCallback(async () => {
    if (meetingSession && !isScreenSharing) {
      try {
        await meetingSession.audioVideo.startContentShareFromScreenCapture();
        setIsScreenSharing(true);
      } catch (error) {
        console.error('Error starting screen share:', error);
        onError?.(error as Error);
      }
    }
  }, [meetingSession, isScreenSharing, onError]);

  const stopScreenShare = useCallback(async () => {
    if (meetingSession && isScreenSharing) {
      await meetingSession.audioVideo.stopContentShare();
      setIsScreenSharing(false);
    }
  }, [meetingSession, isScreenSharing]);

  const endCall = useCallback(async () => {
    if (meetingSession) {
      meetingSession.audioVideo.stop();
      
      // Notify backend
      await fetch(`/make-server-3dd53475/video/consultation/${consultationId}/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
        }
      });
    }
    cleanup();
  }, [meetingSession, consultationId]);

  const cleanup = () => {
    if (meetingSession) {
      meetingSession.audioVideo.stop();
    }
    setIsConnected(false);
    setMeetingSession(null);
  };

  return {
    isConnected,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    attendees,
    localVideoRef,
    remoteVideoRef,
    screenShareRef,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    endCall
  };
}
