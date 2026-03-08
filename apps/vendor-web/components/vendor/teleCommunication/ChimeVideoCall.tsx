'use client';

/**
 * ============================================================================
 * AWS CHIME VIDEO CALL COMPONENT - PRODUCTION IMPLEMENTATION
 * ============================================================================
 * 
 * Full-featured video consultation using AWS Chime SDK for JavaScript
 * 
 * Features:
 * - HD video calling with echo cancellation
 * - Real-time chat during call using Chime Data Messages
 * - Screen sharing support
 * - Call duration tracking
 * - Waiting room with status updates
 * - Responsive design matching Warmpawz theme
 * - Typing indicators
 * - Unread message badges
 * - Message persistence to backend
 * 
 * Date: 2026-01-20
 * Updated: 2026-01-27 - Replaced CDN loading with npm package imports
 * Updated: 2026-01-27 - Added real-time chat via Chime Data Messages
 * ============================================================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video, VideoOff, Phone, PhoneOff, Mic, MicOff,
  MessageSquare, Settings, Maximize2, Minimize2,
  RotateCcw, User, Clock, Send, X, AlertCircle,
  Monitor, MonitorOff, Loader2, Users, Check, Circle,
  Paperclip, FileText
} from 'lucide-react';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AttendeeStatus, CallStatus, ChatDataMessage, ChatMessage, ChimeAttendeeData, ChimeMeetingData, ChimeVideoCallProps, TypingDataMessage } from './constants/interface';
import { CALL_ENDED_TOPIC, CHAT_TOPIC, MESSAGE_LIFETIME_MS, TYPING_TOPIC } from './constants';
import { useActiveVideoCallForVendor } from '@/hooks/useActivevideocallTracker';
import { TeleTracker } from './TeleTracker';





export function ChimeVideoCall({
  bookingId,
  participantType,
  participantId,
  vendorName = 'Doctor',
  customerName = 'Customer',
  serviceName = 'Tele Consultation',
  onEndCall,
  onPrescriptionUpload
}: ChimeVideoCallProps) {


  //---------------------------state management------------------------------//
  {/* Call state*/ }
  const [status, setStatus] = useState<CallStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);

  {/* Media controls*/ }
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<{
    audioInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
  }>({
    audioInputs: [],
    audioOutputs: [],
    videoInputs: [],
  });
  const [selectedDevices, setSelectedDevices] = useState<{
    audioInput: string;
    audioOutput: string;
    videoInput: string;
  }>({
    audioInput: '',
    audioOutput: '',
    videoInput: '',
  });

  {/* Chat*/ }
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [otherTypingName, setOtherTypingName] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  {/* Attendee status*/ }
  const [attendeeStatus, setAttendeeStatus] = useState<AttendeeStatus>({
    customerJoined: false,
    vendorJoined: false,
  });
  const [endedByOther, setEndedByOther] = useState(false);
  const endedByOtherRef = useRef(false);

  {/* Meeting data*/ }
  const [meetingData, setMeetingData] = useState<any>(null);
  const [attendeeData, setAttendeeData] = useState<any>(null);

  {/* Refs for Chime SDK objects*/ }
  const meetingSessionRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusPollerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectingToastShownRef = useRef(false);
  const hasAutoJoinedRef = useRef(false);
  const lastLocalTileIdRef = useRef<number | null>(null);
  const lastRemoteTileIdRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chimeSDKRef = useRef<any>(null);
  const myAttendeeIdRef = useRef<string | null>(null);
  const disconnectingRef = useRef(false);
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  {/* Remote audio blocked*/ }
  const [remoteAudioBlocked, setRemoteAudioBlocked] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);


  //---------------------------helper functions------------------------------//

  {/* Load Chime SDK*/ }
  const loadChimeSDK = async (retryCount = 0) => {
    const MAX_RETRIES = 2;

    try {
      // Check if SDK is already loaded
      if (chimeSDKRef.current) {
        setStatus('ready');
        return;
      }

      // Dynamically import AWS Chime SDK from npm package
      // This is the recommended approach instead of CDN loading
      const ChimeSDK = await import('amazon-chime-sdk-js');

      if (!ChimeSDK || !ChimeSDK.DefaultMeetingSession) {
        throw new Error('Chime SDK modules not available');
      }

      chimeSDKRef.current = ChimeSDK;
      setStatus('ready');
      console.log('✅ AWS Chime SDK loaded successfully from npm package');

    } catch (err: any) {
      console.error('Error loading Chime SDK:', err);

      // Retry on failure
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying SDK load (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return loadChimeSDK(retryCount + 1);
      }

      const msg = `Failed to load video call SDK. Please check your internet connection and try again.`;
      setError(msg);
      setStatus('error');
      toast.error(msg);
    }
  };

  {/* Cleanup*/ }
  const cleanup = () => {

    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    if (statusPollerRef.current) {
      clearInterval(statusPollerRef.current);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (meetingSessionRef.current) {
      try {
        meetingSessionRef.current.audioVideo.stop();
      } catch (e) {
        console.warn('Error stopping meeting session:', e);
      }
    }
  };

  {/* Ensure audio context*/ }
  const ensureAudioContext = useCallback(async () => {
    if (typeof window === 'undefined') return null;
    const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch {
        // Ignore resume errors (autoplay restrictions)
      }
    }
    return audioContextRef.current;
  }, []);

  {/* Remote audio autoplay: surface failures, allow retry on user gesture*/ }
  const retryRemoteAudio = useCallback(() => {
    const session = meetingSessionRef.current;
    const el = audioElementRef.current;
    if (!session || !el) return;
    try {
      session.audioVideo.bindAudioElement(el);
      const p = el.play();
      if (p) {
        p.then(() => setRemoteAudioBlocked(false)).catch(() => setRemoteAudioBlocked(true));
      }
    } catch {
      setRemoteAudioBlocked(true);
    }
  }, []);

  {/* Join meeting*/ }
  const joinMeeting = async (retryCount = 0) => {
    const MAX_RETRIES = 2;

    try {
      setStatus('connecting');
      setError(null);

      // Request meeting credentials from backend
      const response = await apiClient.post<{
        success: boolean;
        meeting: ChimeMeetingData;
        attendee: ChimeAttendeeData;
        meetingId: string;
        error?: string;
        session?: { id: string; status: string };
      }>('/video-call/join', {
        bookingId,
        participantId,
        participantType,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to get meeting credentials');
      }

      if (!response.meeting || !response.attendee) {
        throw new Error('Invalid response: missing meeting or attendee data');
      }

      // Validate MediaPlacement is present (required for Chime SDK)
      if (!response.meeting.MediaPlacement) {
        throw new Error('Invalid meeting data: MediaPlacement is missing. The meeting may have expired.');
      }

      if (!response.meeting.MediaPlacement.AudioHostUrl || !response.meeting.MediaPlacement.SignalingUrl) {
        throw new Error('Invalid meeting data: MediaPlacement is incomplete');
      }

      // Validate attendee data
      if (!response.attendee.AttendeeId || !response.attendee.JoinToken) {
        throw new Error('Invalid attendee data: AttendeeId or JoinToken is missing');
      }

      setMeetingData(response.meeting);
      setAttendeeData(response.attendee);
      disconnectingRef.current = false;
      endedByOtherRef.current = false;
      setEndedByOther(false);

      // Initialize Chime meeting session
      await initializeChimeMeeting(response.meeting, response.attendee);

      // Start polling for attendee status
      startStatusPolling();

      // Add system message
      addChatMessage('system', 'System', 'Connected to video call');

    } catch (err: any) {
      console.error('Error joining meeting:', err);

      // Retry on network errors
      if (retryCount < MAX_RETRIES && (err.code === 'network' || err.message?.includes('fetch'))) {
        console.log(`Retrying join (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return joinMeeting(retryCount + 1);
      }

      // Provide user-friendly error messages
      let errorMessage = err.message || 'Failed to join video call';
      if (err.status === 404) {
        errorMessage = 'Meeting not found. Please ask the other participant to start the call first.';
      } else if (err.status === 400) {
        errorMessage = err.message || 'Unable to join this meeting. It may not be scheduled yet.';
      } else if (err.code === 'network' || err.code === 'offline') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      }

      setError(errorMessage);
      setStatus('error');
      toast.error(errorMessage);
    }
  };

  {/* Initialize Chime meeting*/ }
  const initializeChimeMeeting = async (meeting: ChimeMeetingData, attendee: ChimeAttendeeData) => {
    try {
      const ChimeSDK = chimeSDKRef.current;

      if (!ChimeSDK) {
        throw new Error('Chime SDK not loaded. Please refresh and try again.');
      }

      const {
        DefaultMeetingSession,
        MeetingSessionConfiguration,
        ConsoleLogger,
        LogLevel,
        DefaultDeviceController,
      } = ChimeSDK;

      // Validate meeting data has required MediaPlacement
      if (!meeting.MediaPlacement || !meeting.MediaPlacement.AudioHostUrl) {
        throw new Error('Invalid meeting data: MediaPlacement is missing or incomplete');
      }

      // Create meeting session configuration with PROPER structure
      // MeetingSessionConfiguration expects:
      // - meeting: { MeetingId, MediaPlacement, MediaRegion }
      // - attendee: { AttendeeId, JoinToken }
      const configuration = new MeetingSessionConfiguration(
        {
          MeetingId: meeting.MeetingId,
          MediaPlacement: meeting.MediaPlacement,
          MediaRegion: meeting.MediaRegion,
        },
        {
          AttendeeId: attendee.AttendeeId,
          JoinToken: attendee.JoinToken,
        }
      );

      // Create logger
      const logger = new ConsoleLogger('ChimeVideoCall', LogLevel.WARN);

      // Create device controller
      const deviceController = new DefaultDeviceController(logger);

      // Create meeting session
      const meetingSession = new DefaultMeetingSession(
        configuration,
        logger,
        deviceController
      );

      meetingSessionRef.current = meetingSession;
      myAttendeeIdRef.current = attendee.AttendeeId;

      // Set up audio and video
      await setupMediaDevices(meetingSession);

      // Set up event observers
      setupObservers(meetingSession);

      // Bind audio element for remote audio BEFORE starting
      if (audioElementRef.current) {
        meetingSession.audioVideo.bindAudioElement(audioElementRef.current);
      }

      // Start the meeting
      meetingSession.audioVideo.start();
      // Ensure local media starts even if observer callbacks are delayed
      try {
        meetingSession.audioVideo.realtimeUnmuteLocalAudio();
      } catch { }
      try {
        meetingSession.audioVideo.startLocalVideoTile();
      } catch { }

      setStatus('waiting');
      console.log('✅ Chime meeting initialized successfully');

    } catch (err: any) {
      console.error('Error initializing Chime meeting:', err);
      throw new Error('Failed to initialize video call: ' + (err.message || 'Unknown error'));
    }
  };

  {/* Refresh device lists*/ }
  const refreshDeviceLists = useCallback(async (sessionOverride?: any) => {
    const session = sessionOverride || meetingSessionRef.current;
    if (!session) return;
    try {
      const audioInputDevices = await session.audioVideo.listAudioInputDevices();
      const videoInputDevices = await session.audioVideo.listVideoInputDevices();
      const audioOutputDevices = await session.audioVideo.listAudioOutputDevices();

      setAvailableDevices({
        audioInputs: audioInputDevices,
        audioOutputs: audioOutputDevices,
        videoInputs: videoInputDevices,
      });

      setSelectedDevices((prev) => ({
        audioInput: prev.audioInput || audioInputDevices[0]?.deviceId || '',
        audioOutput: prev.audioOutput || audioOutputDevices[0]?.deviceId || '',
        videoInput: prev.videoInput || videoInputDevices[0]?.deviceId || '',
      }));
    } catch (err) {
      console.warn('Unable to refresh device lists:', err);
    }
  }, []);

  {/* Prime device permissions*/ }
  const primeDevicePermissions = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    const stopTracks = (stream: MediaStream) => stream.getTracks().forEach(track => track.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stopTracks(stream);
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stopTracks(stream);
      } catch { }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stopTracks(stream);
      } catch { }
    }
  };

  {/* Setup media devices*/ }
  const setupMediaDevices = async (meetingSession: any) => {
    try {
      // Get available devices
      let audioInputDevices = await meetingSession.audioVideo.listAudioInputDevices();
      let videoInputDevices = await meetingSession.audioVideo.listVideoInputDevices();
      let audioOutputDevices = await meetingSession.audioVideo.listAudioOutputDevices();

      // If device lists are empty (common on mobile before permission), prime permissions then re-list
      if (audioInputDevices.length === 0 || videoInputDevices.length === 0) {
        await primeDevicePermissions();
        audioInputDevices = await meetingSession.audioVideo.listAudioInputDevices();
        videoInputDevices = await meetingSession.audioVideo.listVideoInputDevices();
        audioOutputDevices = await meetingSession.audioVideo.listAudioOutputDevices();
      }

      setAvailableDevices({
        audioInputs: audioInputDevices,
        audioOutputs: audioOutputDevices,
        videoInputs: videoInputDevices,
      });

      setSelectedDevices((prev) => ({
        audioInput: prev.audioInput || audioInputDevices[0]?.deviceId || '',
        audioOutput: prev.audioOutput || audioOutputDevices[0]?.deviceId || '',
        videoInput: prev.videoInput || videoInputDevices[0]?.deviceId || '',
      }));

      // Select first available devices
      if (audioInputDevices.length > 0) {
        await meetingSession.audioVideo.startAudioInput(audioInputDevices[0].deviceId);
      } else {
        toast.error('No microphone detected');
      }

      if (audioOutputDevices.length > 0) {
        try {
          await meetingSession.audioVideo.chooseAudioOutput(audioOutputDevices[0].deviceId);
        } catch (e) {
          console.warn('Audio output selection not supported:', e);
        }
      }

      if (videoInputDevices.length > 0) {
        await meetingSession.audioVideo.startVideoInput(videoInputDevices[0].deviceId);
      } else {
        toast.error('No camera detected');
      }

    } catch (err) {
      console.error('Error setting up media devices:', err);
      toast.error('Camera or microphone access denied');
    }
  };

  {/* Setup observers*/ }
  const setupObservers = (meetingSession: any) => {
    const audioVideo = meetingSession.audioVideo;

    // Audio video observer
    const observer = {
      audioVideoDidStart: () => {
        console.log('Audio/Video started');
        // Start local video tile
        audioVideo.startLocalVideoTile();
      },
      audioVideoDidStop: (sessionStatus: any) => {
        console.log('Audio/Video stopped:', sessionStatus.statusCode());
        if (status !== 'ended') {
          setStatus('ended');
        }
      },
      audioVideoDidStartConnecting: (reconnecting: boolean) => {
        if (reconnecting) {
          setStatus('reconnecting');
        }
      },
      connectionHealthDidChange: (connectionHealthData: any) => {
        // Call quality metrics for observability (packet loss, jitter, RTT proxies)
        const metric = connectionHealthData?.connectionHealth || 'unknown';
        if (metric !== 'good' && metric !== 'unknown') {
          console.warn('[ChimeVideoCall] Connection health:', metric, connectionHealthData);
        }
      },
      videoTileDidUpdate: (tileState: any) => {
        if (tileState.localTile) {
          lastLocalTileIdRef.current = tileState.tileId;
          // Bind local video
          if (localVideoRef.current) {
            audioVideo.bindVideoElement(tileState.tileId, localVideoRef.current);
          }
        } else if (!tileState.isContent) {
          lastRemoteTileIdRef.current = tileState.tileId;
          // Bind remote video
          if (remoteVideoRef.current) {
            audioVideo.bindVideoElement(tileState.tileId, remoteVideoRef.current);
          }
          // Remote participant joined
          setStatus('active');
          startCallTimer();

          if (participantType === 'customer') {
            setAttendeeStatus(prev => ({ ...prev, vendorJoined: true }));
          } else {
            setAttendeeStatus(prev => ({ ...prev, customerJoined: true }));
          }
        }
      },
      videoTileWasRemoved: (tileId: number) => {
        console.log('Video tile removed:', tileId);
      },
    };

    audioVideo.addObserver(observer);

    // Attendee presence - Chime SDK 3.x expects single callback (attendeeId, present), not object
    const attendeePresenceCallback = (attendeeId: string, present: boolean) => {
      if (attendeeId.includes('#content') || attendeeId === myAttendeeIdRef.current) return;

      if (present) {
        console.log('Attendee joined:', attendeeId);
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        addChatMessage('system', 'System', `${customerName} joined the call`);
        setAttendeeStatus(prev => ({
          ...prev,
          customerJoined: true,
        }));
      } else {
        console.log('Attendee left:', attendeeId);
        setAttendeeStatus(prev => ({
          ...prev,
          customerJoined: false,
        }));
        addChatMessage('system', 'System', `${customerName} left the call`);

        if (!disconnectingRef.current && !disconnectTimerRef.current) {
          addChatMessage('system', 'System', 'Waiting for customer to rejoin...');

          disconnectTimerRef.current = setTimeout(() => {
            if (!disconnectingRef.current) {
              disconnectingRef.current = true;
              endedByOtherRef.current = true;
              setEndedByOther(true);
              endCall(false);
            }
            disconnectTimerRef.current = null;
          }, 60000);
        }
      }
    };
    audioVideo.realtimeSubscribeToAttendeeIdPresence(attendeePresenceCallback);

    // Fatal realtime error handler - prevents RealtimeApiFailed from crashing the call
    audioVideo.realtimeSubscribeToFatalError((err: Error) => {
      console.error('[ChimeVideoCall] realtime error:', err);
    });

    // =========================================================================
    // REAL-TIME CHAT VIA DATA MESSAGES - Chime SDK 3.x requires (topic, callback)
    // =========================================================================
    const handleDataMessage = (dataMessage: any) => {
      try {
        const topic = dataMessage.topic;
        const data = JSON.parse(new TextDecoder().decode(dataMessage.data));
        if (topic === CHAT_TOPIC) {
          handleReceivedChatMessage(data as ChatDataMessage);
        } else if (topic === TYPING_TOPIC) {
          handleReceivedTypingIndicator(data as TypingDataMessage);
        } else if (topic === CALL_ENDED_TOPIC) {
          if (!disconnectingRef.current) {
            disconnectingRef.current = true;
            endedByOtherRef.current = true;
            setEndedByOther(true);
            endCall(false);
          }
        }
      } catch (err) {
        console.error('Error processing data message:', err);
      }
    };
    audioVideo.realtimeSubscribeToReceiveDataMessage(CHAT_TOPIC, handleDataMessage);
    audioVideo.realtimeSubscribeToReceiveDataMessage(TYPING_TOPIC, handleDataMessage);
    audioVideo.realtimeSubscribeToReceiveDataMessage(CALL_ENDED_TOPIC, handleDataMessage);
  };

  {/* Handle received chat message from other participant*/ }
  const handleReceivedChatMessage = (data: ChatDataMessage) => {
    // Don't add our own messages (they're already added locally)
    if (data.sender === participantType) return;

    const messageType =
      data.messageType || (data.type === 'file' ? 'file' : 'text');

    const newMsg: ChatMessage = {
      id: data.id,
      sender: data.sender,
      senderName: data.senderName,
      message: data.message,
      messageType,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      timestamp: new Date(data.timestamp),
    };

    setChatMessages(prev => {
      // Avoid duplicate messages
      if (prev.some(m => m.id === data.id)) return prev;
      return [...prev, newMsg];
    });

    // Increment unread count if chat panel is hidden
    if (!showChat) {
      setUnreadCount(prev => prev + 1);
    }

    // Clear typing indicator when message received
    setIsOtherTyping(false);

    // Play notification sound (optional)
    playNotificationSound();
  };

  {/* Handle received typing indicator*/ }
  const handleReceivedTypingIndicator = (data: TypingDataMessage) => {
    // Don't show our own typing indicator
    if (data.sender === participantType) return;

    setIsOtherTyping(data.isTyping);
    setOtherTypingName(data.senderName);

    // Auto-clear typing indicator after 3 seconds
    if (data.isTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsOtherTyping(false);
      }, 3000);
    }
  };

  {/* Play notification sound for new message*/ }
  const playNotificationSound = () => {
    void (async () => {
      try {
        const ctx = await ensureAudioContext();
        if (!ctx) return;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);

        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.21);
      } catch {
        // Ignore sound errors
      }
    })();
  };

  {/* Start status polling*/ }
  const startStatusPolling = () => {
    if (statusPollerRef.current) {
      clearInterval(statusPollerRef.current);
    }

    statusPollerRef.current = setInterval(async () => {
      try {
        const response = await apiClient.get<any>(`/video-call/${bookingId}/attendees`);
        if (response.success) {
          setAttendeeStatus({
            customerJoined: response.customerJoined,
            vendorJoined: response.vendorJoined,
          });

          if (response.sessionEnded && !disconnectingRef.current) {
            disconnectingRef.current = true;
            endedByOtherRef.current = true;
            setEndedByOther(true);
            endCall(false);
            return;
          }

          if (response.customerJoined && response.vendorJoined && status === 'waiting') {
            setStatus('active');
            startCallTimer();
          }
        }
      } catch (e) {
        // Silent fail for polling
      }
    }, 2000); // Poll every 2s for faster transition when both join
  };

  {/* Start call timer*/ }
  const startCallTimer = () => {
    if (callTimerRef.current) return;

    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  {/* Handle end call click*/ }
  const handleEndCallClick = () => {
    if (typeof window !== 'undefined' && window.confirm('End the call?')) {
      endCall(true);
    }
  };

  {/* End call*/ }
  const endCall = async (initiatedByUs = true) => {
    try {
      const session = meetingSessionRef.current;

      // Notify other participant we're ending (only if we initiated)
      if (initiatedByUs && session?.audioVideo) {
        try {
          const payload = new TextEncoder().encode(JSON.stringify({ endedBy: participantType }));
          session.audioVideo.realtimeSendDataMessage(CALL_ENDED_TOPIC, payload, 5000);
        } catch { }
      }

      // Stop local media
      if (session) {
        session.audioVideo.stopLocalVideoTile();
        session.audioVideo.stop();
      }

      // Clear timers
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      if (statusPollerRef.current) {
        clearInterval(statusPollerRef.current);
        statusPollerRef.current = null;
      }

      // Notify backend
      await apiClient.post(`/video-call/${bookingId}/end`, {
        duration: callDuration,
        participantType,
      });

      setStatus('ended');

      if (onEndCall) {
        onEndCall(callDuration);
      }
    } catch (err) {
      console.error('Error ending call:', err);
      setStatus('ended');
    }
  };

  {/* Add chat message*/ }
  const addChatMessage = (
    sender: 'customer' | 'vendor' | 'system',
    senderName: string,
    message: string,
    id?: string,
    messageType: 'text' | 'file' | 'image' = 'text',
    fileName?: string,
    fileUrl?: string
  ) => {
    const newMsg: ChatMessage = {
      id: id || Date.now().toString(),
      sender,
      senderName,
      message,
      messageType,
      fileName,
      fileUrl,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, newMsg]);

    // Auto-scroll to latest message
    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    }, 100);

    return newMsg;
  };

  {/* Send message*/ }
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    if (!meetingSessionRef.current) return;

    const senderName = participantType === 'customer' ? customerName : vendorName;
    const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageText = newMessage.trim();
    const timestamp = new Date();

    // Add message locally first (optimistic update)
    addChatMessage(participantType as 'customer' | 'vendor', senderName, messageText, messageId, 'text');
    setNewMessage('');

    // Send via Chime Data Messages for real-time delivery
    try {
      const audioVideo = meetingSessionRef.current.audioVideo;

      const chatData: ChatDataMessage = {
        type: 'message',
        id: messageId,
        sender: participantType as 'customer' | 'vendor',
        senderName,
        message: messageText,
        messageType: 'text',
        timestamp: timestamp.toISOString(),
      };

      const payload = new TextEncoder().encode(JSON.stringify(chatData));
      audioVideo.realtimeSendDataMessage(CHAT_TOPIC, payload, MESSAGE_LIFETIME_MS);

      console.log('📤 Chat message sent via Chime data channel');
    } catch (err) {
      console.error('Error sending chat message via Chime:', err);
      toast.error('Failed to send message');
    }

    // Persist message to backend for records
    persistMessageToBackend(messageId, messageText, senderName, timestamp);
  };

  {/* Persist message to backend (fire and forget)*/ }
  const persistMessageToBackend = async (
    messageId: string,
    message: string,
    senderName: string,
    timestamp: Date
  ) => {
    try {
      await apiClient.post(`/chat/${bookingId}/send`, {
        message,
        senderType: participantType,
        senderId: participantId,
        senderName,
        timestamp: timestamp.toISOString(),
      });

      // Mark message as persisted
      setChatMessages(prev =>
        prev.map(msg =>
          msg.id === messageId ? { ...msg, persisted: true } : msg
        )
      );
    } catch (err) {
      console.error('Error persisting message to backend:', err);
      // Don't show error to user - message was still sent via Chime
    }
  };

  {/* Handle file upload*/ }
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!meetingSessionRef.current) return;

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const senderName = participantType === 'customer' ? customerName : vendorName;
    setUploadingFile(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bookingId', bookingId);
      formData.append('senderPhone', participantId || 'unknown');
      formData.append('senderName', senderName);
      formData.append('senderType', participantType);

      // ✅ FIX: Use getApiBaseUrl() instead of process.env.NEXT_PUBLIC_API_URL to ensure correct API Gateway URL
      const apiBaseUrl = getApiBaseUrl();
      if (!apiBaseUrl) {
        throw new Error('API base URL is not configured');
      }

      const response = await fetch(`${apiBaseUrl}/chat/upload-file`, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const result = await response.json();
      const fileUrl = result.fileUrl || result.file_url;
      const messageId = result.message?.id || `file-${Date.now()}`;
      const messageType = file.type.startsWith('image/') ? 'image' : 'file';

      addChatMessage(
        participantType as 'customer' | 'vendor',
        senderName,
        file.name,
        messageId,
        messageType,
        file.name,
        fileUrl
      );

      // Send file message via Chime data channel for real-time delivery
      const audioVideo = meetingSessionRef.current.audioVideo;
      const chatData: ChatDataMessage = {
        type: 'file',
        id: messageId,
        sender: participantType as 'customer' | 'vendor',
        senderName,
        message: file.name,
        messageType,
        fileName: file.name,
        fileUrl,
        timestamp: new Date().toISOString(),
      };

      const payload = new TextEncoder().encode(JSON.stringify(chatData));
      audioVideo.realtimeSendDataMessage(CHAT_TOPIC, payload, MESSAGE_LIFETIME_MS);
    } catch (err) {
      console.error('Error uploading file:', err);
      toast.error('Failed to send file');
    } finally {
      setUploadingFile(false);
    }
  };

  {/* Send typing indicator*/ }
  const sendTypingIndicator = (isTyping: boolean) => {
    if (!meetingSessionRef.current) return;

    // Throttle typing indicators to once per second
    const now = Date.now();
    if (isTyping && now - lastTypingSentRef.current < 1000) return;
    lastTypingSentRef.current = now;

    try {
      const audioVideo = meetingSessionRef.current.audioVideo;
      const senderName = participantType === 'customer' ? customerName : vendorName;

      const typingData: TypingDataMessage = {
        type: 'typing',
        sender: participantType as 'customer' | 'vendor',
        senderName,
        isTyping,
      };

      const payload = new TextEncoder().encode(JSON.stringify(typingData));
      audioVideo.realtimeSendDataMessage(TYPING_TOPIC, payload, 3000); // Short lifetime for typing indicators
    } catch (err) {
      // Ignore typing indicator errors
    }
  };

  {/* Handle input change with typing indicator*/ }
  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    // Send typing indicator when user starts typing
    if (value.length > 0) {
      sendTypingIndicator(true);
    }
  };

  {/* Toggle mute*/ }
  const toggleMute = () => {
    if (meetingSessionRef.current) {
      const audioVideo = meetingSessionRef.current.audioVideo;
      if (isMuted) {
        audioVideo.realtimeUnmuteLocalAudio();
      } else {
        audioVideo.realtimeMuteLocalAudio();
      }
      setIsMuted(!isMuted);
    }
  };

  {/* Toggle video*/ }
  const toggleVideo = () => {
    if (meetingSessionRef.current) {
      const audioVideo = meetingSessionRef.current.audioVideo;
      if (isVideoOff) {
        audioVideo.startLocalVideoTile();
      } else {
        audioVideo.stopLocalVideoTile();
      }
      setIsVideoOff(!isVideoOff);
    }
  };

  {/* Toggle screen share*/ }
  const toggleScreenShare = async () => {
    if (meetingSessionRef.current) {
      const audioVideo = meetingSessionRef.current.audioVideo;
      try {
        if (isScreenSharing) {
          await audioVideo.stopContentShare();
        } else {
          await audioVideo.startContentShareFromScreenCapture();
        }
        setIsScreenSharing(!isScreenSharing);
      } catch (err) {
        console.error('Screen share error:', err);
        toast.error('Failed to share screen');
      }
    }
  };

  {/* Handle audio input change*/ }
  const handleAudioInputChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setSelectedDevices(prev => ({ ...prev, audioInput: deviceId }));
    try {
      if (meetingSessionRef.current) {
        await meetingSessionRef.current.audioVideo.startAudioInput(deviceId);
        toast.success('Microphone updated');
      }
    } catch (err) {
      console.error('Failed to switch microphone:', err);
      toast.error('Failed to switch microphone');
    }
  };

  {/* Handle audio output change*/ }
  const handleAudioOutputChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setSelectedDevices(prev => ({ ...prev, audioOutput: deviceId }));
    try {
      if (meetingSessionRef.current?.audioVideo?.chooseAudioOutput) {
        await meetingSessionRef.current.audioVideo.chooseAudioOutput(deviceId);
        toast.success('Speaker updated');
      } else {
        toast.error('Audio output selection not supported in this browser');
      }
    } catch (err) {
      console.error('Failed to switch speaker:', err);
      toast.error('Failed to switch speaker');
    }
  };

  {/* Handle video input change*/ }
  const handleVideoInputChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setSelectedDevices(prev => ({ ...prev, videoInput: deviceId }));
    try {
      if (meetingSessionRef.current) {
        await meetingSessionRef.current.audioVideo.startVideoInput(deviceId);
        if (!isVideoOff) {
          meetingSessionRef.current.audioVideo.startLocalVideoTile();
        }
        toast.success('Camera updated');
      }
    } catch (err) {
      console.error('Failed to switch camera:', err);
      toast.error('Failed to switch camera');
    }
  };

  {/* Format duration*/ }
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  {/* Toggle full screen*/ }
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  {/* Other participant name*/ }
  const otherParticipantName = participantType === 'customer' ? vendorName : customerName;



  //---------------------------useEffect hooks------------------------------//

  {/* Auto-join when SDK is ready (e.g. vendor accepted call or opened video from appointment)*/ }
  useEffect(() => {
    if (status !== 'ready' || !bookingId || !participantId || hasAutoJoinedRef.current) return;
    hasAutoJoinedRef.current = true;
    joinMeeting();
  }, [status, bookingId, participantId]);

  {/* Show toast when entering reconnecting state (once per reconnection cycle)*/ }
  useEffect(() => {
    if (status === 'reconnecting') {
      if (!reconnectingToastShownRef.current) {
        reconnectingToastShownRef.current = true;
        toast.info('Reconnecting...');
      }
    } else {
      reconnectingToastShownRef.current = false;
    }
  }, [status]);

  {/* Load Chime SDK*/ }
  useEffect(() => {
    loadChimeSDK();
    return () => {
      cleanup();
    };
  }, []);

  {/* Unlock audio context on first user interaction (for notification beeps)*/ }
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      void ensureAudioContext();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [ensureAudioContext]);

  // Rebind audio/video elements after UI mounts (prevents blank remote video/audio)
  useEffect(() => {
    const session = meetingSessionRef.current;
    if (!session) return;
    const audioVideo = session.audioVideo;

    if (audioElementRef.current) {
      try {
        audioVideo.bindAudioElement(audioElementRef.current);
        const playPromise = audioElementRef.current.play();
        if (playPromise) {
          playPromise.then(() => setRemoteAudioBlocked(false)).catch(() => setRemoteAudioBlocked(true));
        }
      } catch {
        setRemoteAudioBlocked(true);
      }
    }

    if (localVideoRef.current && lastLocalTileIdRef.current !== null) {
      try {
        audioVideo.bindVideoElement(lastLocalTileIdRef.current, localVideoRef.current);
      } catch {
        // Ignore bind errors
      }
    }

    if (remoteVideoRef.current && lastRemoteTileIdRef.current !== null) {
      try {
        audioVideo.bindVideoElement(lastRemoteTileIdRef.current, remoteVideoRef.current);
      } catch {
        // Ignore bind errors
      }
    }
  }, [status]);

  {/* Refresh device lists*/ }
  useEffect(() => {
    if (!showSettings) return;
    void refreshDeviceLists();
  }, [showSettings, refreshDeviceLists]);

  {/* Clear typing indicator when user stops typing*/ }
  useEffect(() => {
    if (newMessage.length === 0) {
      sendTypingIndicator(false);
    }
  }, [newMessage]);

  {/* Clear unread count when chat is opened*/ }
  useEffect(() => {
    if (showChat) {
      setUnreadCount(0);
    }
  }, [showChat]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedVendorId =
        localStorage.getItem('vendorId') ||
        localStorage.getItem('vendor_id') ||
        sessionStorage.getItem('vendorId') ||
        sessionStorage.getItem('vendor_id') ||
        null;
      if (storedVendorId) {
        setVendorId(storedVendorId);
      }
    }
  }, []);
  
  //--------------------------------created-hooks----------------------------------//

  const {
    activeSessions: activeVideoCalls,
    hasActiveCall: hasActiveVideoCall,
    joinCall: joinVideoCall,
  } = useActiveVideoCallForVendor(vendorId, {
    enabled: !!vendorId,
    pollingIntervalMs: 10000,
  });



  //---------------------------render components------------------------------//

  {/* Loading state*/ }
  if (status === 'loading') {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 shadow-xl min-h-[400px] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#FF8C42] mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Loading Video Call</h3>
        <p className="text-slate-400 text-sm">Initializing secure connection...</p>
      </div>
    );
  }

  {/* Error state*/ }
  if (status === 'error') {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Error</h3>
          <p className="text-gray-600 mb-6">{error || 'Failed to connect to video call'}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => onEndCall?.(0)}>
              Go Back
            </Button>
            <Button
              onClick={() => {
                setStatus('ready');
                setError(null);
              }}
              className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  {/* Ready state - Join button*/ }
  if (status === 'ready') {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 shadow-xl">
        <div className="text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-[#FF8C42] to-[#FF6B1A] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#FF8C42]/30">
            <Video className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Ready to Join</h2>
          <p className="text-slate-400 mb-6">{serviceName} with {otherParticipantName}</p>

          <Button
            onClick={() => joinMeeting()}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-6 rounded-xl font-semibold text-lg shadow-lg shadow-green-500/30"
          >
            <Phone className="w-5 h-5 mr-2" />
            Join Video Call
          </Button>

          <p className="text-slate-500 text-xs mt-6">
            Camera and microphone access will be requested
          </p>
        </div>
      </div>
    );
  }

  // Connecting state
  if (status === 'connecting') {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 shadow-xl min-h-[400px] flex flex-col items-center justify-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 border-4 border-[#FF8C42]/30 rounded-full"></div>
          <div className="absolute inset-0 w-20 h-20 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Video className="w-8 h-8 text-[#FF8C42]" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Connecting...</h3>
        <p className="text-slate-400 text-sm">Setting up your video call with {otherParticipantName}</p>
      </div>
    );
  }

  {/* Waiting state*/ }
  if (status === 'waiting') {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 shadow-xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Waiting for {otherParticipantName}</h2>
          <p className="text-slate-400">They will join shortly...</p>
        </div>

        {/* Local video preview */}
        <div className="aspect-video bg-slate-800 rounded-xl overflow-hidden mb-6 relative">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
          {isVideoOff && (
            <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
              <VideoOff className="w-12 h-12 text-slate-500" />
            </div>
          )}
          <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
            You
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          <button
            onClick={toggleVideo}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          <button
            onClick={handleEndCallClick}
            className="w-14 h-14 rounded-2xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>

        {remoteAudioBlocked && (
          <button
            type="button"
            onClick={retryRemoteAudio}
            className="mt-2 w-full py-2 bg-amber-500/90 hover:bg-amber-500 text-white rounded-lg text-sm font-medium"
          >
            Tap to enable sound
          </button>
        )}
        <audio ref={audioElementRef} autoPlay />
      </div>
    );
  }

  {/* Ended state*/ }
  if (status === 'ended') {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {endedByOther ? `${otherParticipantName} left the call` : 'Call ended'}
          </h2>
          <p className="text-gray-600 mb-1">Duration: {formatDuration(callDuration)}</p>
          <p className="text-gray-500 text-sm mb-6">
            {endedByOther ? 'The other participant has disconnected.' : 'Thank you for using Warmpawz'}
          </p>

          <div className="flex gap-3 justify-center">
            {participantType === 'vendor' && onPrescriptionUpload && (
              <Button
                onClick={onPrescriptionUpload}
                variant="outline"
                className="border-[#FF8C42] text-[#FF8C42]"
              >
                Upload Prescription
              </Button>
            )}
            <Button
              onClick={() => onEndCall?.(callDuration)}
              className="bg-[#FF8C42] hover:bg-[#FF7A2E] px-6 py-3 rounded-xl"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active call
  return (
    <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-xl relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-slate-900/90 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">{otherParticipantName}</p>
              <p className="text-slate-400 text-xs">{serviceName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Duration */}
            <div className="bg-slate-800/80 backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-white text-sm font-mono">{formatDuration(callDuration)}</span>
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullScreen}
              className="p-2 bg-slate-800/80 backdrop-blur rounded-full hover:bg-slate-700 transition-colors"
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
            </button>

            {/* Chat with unread badge */}
            <button
              onClick={() => setShowChat(!showChat)}
              className={`p-2 rounded-full transition-colors relative ${showChat ? 'bg-[#FF8C42]' : 'bg-slate-800/80 backdrop-blur hover:bg-slate-700'
                }`}
            >
              <MessageSquare className="w-4 h-4 text-white" />
              {unreadCount > 0 && !showChat && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Video Container */}
      <div className="aspect-[4/3] bg-slate-800 relative">
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Remote Placeholder */}
        {!attendeeStatus.vendorJoined && participantType === 'customer' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <User className="w-10 h-10 text-slate-500" />
              </div>
              <p className="text-slate-400 text-sm">Waiting for {otherParticipantName}...</p>
            </div>
          </div>
        )}

        {/* Local Video PIP */}
        <div className="absolute bottom-20 right-4 w-28 h-36 rounded-xl overflow-hidden shadow-2xl border-2 border-slate-600 bg-slate-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
          {isVideoOff && (
            <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
              <VideoOff className="w-6 h-6 text-slate-500" />
            </div>
          )}
        </div>

        {/* Remote audio blocked - tap to enable */}
        {remoteAudioBlocked && (
          <button
            type="button"
            onClick={retryRemoteAudio}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-amber-500/90 hover:bg-amber-500 text-white px-4 py-2 rounded-full text-sm font-medium z-10"
          >
            Tap to enable sound
          </button>
        )}

        {/* Reconnecting Overlay */}
        {status === 'reconnecting' && (
          <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center">
            <RotateCcw className="w-10 h-10 text-yellow-400 animate-spin mb-3" />
            <p className="text-white">Reconnecting...</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-slate-800/90 backdrop-blur-lg border-t border-slate-700">
        <div className="flex justify-center items-center gap-4">
          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleScreenShare}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isScreenSharing ? 'bg-blue-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          <button
            onClick={handleEndCallClick}
            className="w-14 h-14 rounded-2xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="w-12 h-12 rounded-2xl bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Audio element for remote audio */}
      <audio ref={audioElementRef} autoPlay />

      {/* Chat Panel */}
      {showChat && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-lg flex flex-col">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold">Chat with {otherParticipantName}</h3>
              {isOtherTyping && (
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <span className="flex gap-0.5">
                    <Circle className="w-1.5 h-1.5 fill-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <Circle className="w-1.5 h-1.5 fill-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <Circle className="w-1.5 h-1.5 fill-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  {otherTypingName} is typing...
                </p>
              )}
            </div>
            <button onClick={() => setShowChat(false)} className="p-2 hover:bg-slate-700 rounded-xl">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1">Messages sent during the call will appear here</p>
              </div>
            ) : (
              <>
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'system' ? 'justify-center' :
                    msg.sender === participantType ? 'justify-end' : 'justify-start'
                    }`}>
                    {msg.sender === 'system' ? (
                      <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
                        {msg.message}
                      </span>
                    ) : (
                      <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${msg.sender === participantType
                        ? 'bg-[#FF8C42] text-white rounded-br-none'
                        : 'bg-slate-700 text-white rounded-bl-none'
                        }`}>
                        {msg.sender !== participantType && (
                          <p className="text-[10px] font-medium opacity-80 mb-0.5">{msg.senderName}</p>
                        )}
                        {msg.messageType === 'image' && msg.fileUrl ? (
                          <div className="space-y-2">
                            <img
                              src={msg.fileUrl}
                              alt={msg.fileName || 'Shared image'}
                              className="max-w-full rounded-lg border border-white/10"
                            />
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 opacity-80" />
                              <p className="text-xs opacity-80">{msg.fileName || msg.message}</p>
                            </div>
                            <a
                              href={msg.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs underline opacity-90"
                            >
                              Open image
                            </a>
                          </div>
                        ) : msg.messageType === 'file' || msg.fileUrl ? (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 opacity-80" />
                            <div className="flex flex-col">
                              <span className="text-sm">{msg.fileName || msg.message}</span>
                              {msg.fileUrl && (
                                <a
                                  href={msg.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs underline opacity-90"
                                >
                                  Download
                                </a>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm">{msg.message}</p>
                        )}
                        <p className="text-[10px] opacity-70 mt-1 flex items-center gap-1">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {msg.sender === participantType && msg.persisted && (
                            <Check className="w-3 h-3" />
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing indicator in message area */}
                {isOtherTyping && (
                  <div className="flex justify-start">
                    <div className="bg-slate-700 text-white px-4 py-2.5 rounded-2xl rounded-bl-none">
                      <div className="flex gap-1 py-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="p-4 border-t border-slate-700">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                disabled={uploadingFile}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="w-12 h-12 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors"
              >
                {uploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={handleMessageInputChange}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                onBlur={() => sendTypingIndicator(false)}
                placeholder="Type a message..."
                className="flex-1 bg-slate-700 text-white px-4 py-3 rounded-xl border-0 focus:ring-2 focus:ring-[#FF8C42] outline-none"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="w-12 h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
      {hasActiveVideoCall && (
        <TeleTracker
          hasActiveCall={hasActiveVideoCall}
          activeVideoCalls={activeVideoCalls.map(session => ({
            sessionId: session.sessionId,
            bookingId: session.bookingId,
            customerName: session.customerName || 'Customer',
            serviceName: session.serviceName,
            petName: session.petName,
          }))}
          joinCall={(call) => {
            const session = activeVideoCalls.find(s => s.bookingId === call.bookingId);
            if (session) {
              joinVideoCall(session);
            }
          }}
        />
      )}
      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-semibold">Call Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-700 rounded-xl">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-2">Microphone</label>
                <select
                  value={selectedDevices.audioInput}
                  onChange={handleAudioInputChange}
                  className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700"
                >
                  {availableDevices.audioInputs.length === 0 && (
                    <option value="">No microphones detected</option>
                  )}
                  {availableDevices.audioInputs.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || 'Microphone'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-2">Speaker</label>
                <select
                  value={selectedDevices.audioOutput}
                  onChange={handleAudioOutputChange}
                  className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700"
                >
                  {availableDevices.audioOutputs.length === 0 && (
                    <option value="">Default speaker</option>
                  )}
                  {availableDevices.audioOutputs.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || 'Speaker'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-2">Camera</label>
                <select
                  value={selectedDevices.videoInput}
                  onChange={handleVideoInputChange}
                  className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700"
                >
                  {availableDevices.videoInputs.length === 0 && (
                    <option value="">No cameras detected</option>
                  )}
                  {availableDevices.videoInputs.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || 'Camera'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-end">
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChimeVideoCall;
