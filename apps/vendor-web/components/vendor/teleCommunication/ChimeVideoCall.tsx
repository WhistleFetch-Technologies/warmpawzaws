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
 * - Consultation countdown from vendor service duration with auto-end
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
  RotateCcw, User, Send, X, AlertCircle,
  Loader2, Users, Check, Circle,
  Paperclip, FileText, SwitchCamera,
} from 'lucide-react';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';
import {
  requestCameraMicrophonePermission,
  requiresUserGestureForMediaPrompt,
} from '@/lib/runtime-permissions';
import { AttendeeStatus, CallStatus, ChatDataMessage, ChatMessage, ChimeAttendeeData, ChimeMeetingData, ChimeVideoCallProps, TypingDataMessage } from './constants/interface';
import {
  CALL_ENDED_TOPIC,
  DEFAULT_CALL_SLOT_SECONDS,
  CHAT_TOPIC,
  MEDIA_STATE_TOPIC,
  MESSAGE_LIFETIME_MS,
  TYPING_TOPIC,
  CallTimerPayload,
  computeClientCallRemaining,
} from './constants';
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
  const [callRemainingSeconds, setCallRemainingSeconds] = useState(DEFAULT_CALL_SLOT_SECONDS);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [pseudoFullScreen, setPseudoFullScreen] = useState(false);

  {/* Media controls*/ }
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remoteMediaState, setRemoteMediaState] = useState({ muted: false, videoOff: false });
  const [pipOffset, setPipOffset] = useState({ x: 0, y: 0 });
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
  const [isChimeNativeWebView, setIsChimeNativeWebView] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const callRootRef = useRef<HTMLDivElement>(null);
  const videoStageRef = useRef<HTMLDivElement>(null);
  const callRemainingRef = useRef(DEFAULT_CALL_SLOT_SECONDS);
  const callSlotSecondsRef = useRef(DEFAULT_CALL_SLOT_SECONDS);
  const consultationStartedAtRef = useRef<string | null>(null);
  const timerPausedRef = useRef(true);
  const timerBaseSecondsRef = useRef<number | null>(null);
  const pipDragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });
  const endingCallRef = useRef(false);

  {/* Attendee status*/ }
  const [attendeeStatus, setAttendeeStatus] = useState<AttendeeStatus>({
    customerJoined: false,
    vendorJoined: false,
  });
  const [endedByOther, setEndedByOther] = useState(false);
  const endedByOtherRef = useRef(false);
  const [endOutcome, setEndOutcome] = useState<{
    userMessage?: string;
    teleCompletionStatus?: string;
    bookingCompleted?: boolean;
    overlapSeconds?: number;
  } | null>(null);
  const leftReportedRef = useRef(false);

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

  const applyCallTimer = useCallback((callTimer: CallTimerPayload | undefined, opts?: { syncDisplay?: boolean }) => {
    if (!callTimer) return;
    const syncDisplay = opts?.syncDisplay !== false;
    const slot =
      callTimer.serviceDurationSeconds != null && callTimer.serviceDurationSeconds > 0
        ? callTimer.serviceDurationSeconds
        : callSlotSecondsRef.current;
    callSlotSecondsRef.current = slot;
    timerPausedRef.current = !!callTimer.timerPaused;

    const running = !callTimer.timerPaused && !!callTimer.timerRunningSince;

    if (running) {
      if (callTimer.timerRunningSince) {
        consultationStartedAtRef.current = callTimer.timerRunningSince;
      }
      if (callTimer.timerBaseSeconds != null) {
        timerBaseSecondsRef.current = callTimer.timerBaseSeconds;
      } else if (timerBaseSecondsRef.current == null) {
        timerBaseSecondsRef.current = slot;
      }
    } else {
      consultationStartedAtRef.current = null;
      if (callTimer.callRemainingSeconds != null) {
        timerBaseSecondsRef.current = callTimer.callRemainingSeconds;
      } else if (callTimer.timerBaseSeconds != null) {
        timerBaseSecondsRef.current = callTimer.timerBaseSeconds;
      }
    }

    if (!syncDisplay && running) {
      return;
    }

    const remaining = computeClientCallRemaining(slot, {
      timerPaused: timerPausedRef.current,
      timerRunningSince: consultationStartedAtRef.current,
      timerBaseSeconds: timerBaseSecondsRef.current,
    });
    setCallRemainingSeconds(remaining);
    callRemainingRef.current = remaining;
  }, []);

  const getElapsedCallSeconds = useCallback(() => {
    const slot = callSlotSecondsRef.current;
    return Math.min(slot, Math.max(0, slot - callRemainingRef.current));
  }, []);

  const getConsultationOverlapSeconds = useCallback(() => {
    if (endOutcome?.overlapSeconds != null) {
      return Math.max(0, endOutcome.overlapSeconds);
    }
    return getElapsedCallSeconds();
  }, [endOutcome?.overlapSeconds, getElapsedCallSeconds]);

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
      leftReportedRef.current = false;

      // Request meeting credentials from backend
      const response = await apiClient.post<{
        success: boolean;
        meeting: ChimeMeetingData;
        attendee: ChimeAttendeeData;
        meetingId: string;
        error?: string;
        session?: { id: string; status: string };
        callTimer?: CallTimerPayload;
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
      applyCallTimer(response.callTimer);
      disconnectingRef.current = false;
      endedByOtherRef.current = false;
      setEndedByOther(false);

      // Initialize Chime meeting session
      await initializeChimeMeeting(response.meeting, response.attendee);

      // Start polling for attendee status
      startStatusPolling();

      if (response.callTimer?.consultationActive && response.callTimer?.timerRunningSince) {
        startCallTimer();
      }

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
    await requestCameraMicrophonePermission();
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
          const finalized = !!(data as { finalize?: boolean }).finalize;
          if (finalized && !disconnectingRef.current) {
            disconnectingRef.current = true;
            endedByOtherRef.current = true;
            setEndedByOther(true);
            void endCall(false, true);
          } else if (!disconnectingRef.current) {
            toast.info('The other participant stepped out. Waiting for them to rejoin.');
          }
        } else if (topic === MEDIA_STATE_TOPIC) {
          const m = data as { sender?: string; muted?: boolean; videoOff?: boolean };
          if (m.sender === participantType) return;
          setRemoteMediaState({
            muted: !!m.muted,
            videoOff: !!m.videoOff,
          });
        }
      } catch (err) {
        console.error('Error processing data message:', err);
      }
    };
    audioVideo.realtimeSubscribeToReceiveDataMessage(CHAT_TOPIC, handleDataMessage);
    audioVideo.realtimeSubscribeToReceiveDataMessage(TYPING_TOPIC, handleDataMessage);
    audioVideo.realtimeSubscribeToReceiveDataMessage(CALL_ENDED_TOPIC, handleDataMessage);
    audioVideo.realtimeSubscribeToReceiveDataMessage(MEDIA_STATE_TOPIC, handleDataMessage);
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

          if (response.callTimer) {
            applyCallTimer(response.callTimer, {
              syncDisplay: !(response.callTimer.consultationActive && response.callTimer.timerRunningSince),
            });
          }

          if (response.sessionEnded && !disconnectingRef.current) {
            disconnectingRef.current = true;
            endedByOtherRef.current = true;
            setEndedByOther(true);
            void endCall(false, true);
            return;
          }

          if (response.customerJoined && response.vendorJoined) {
            setStatus((prev) => (prev === 'waiting' || prev === 'connecting' ? 'active' : prev));
            if (response.callTimer?.consultationActive && response.callTimer?.timerRunningSince) {
              startCallTimer();
            } else if (response.callTimer?.timerPaused) {
              if (callTimerRef.current) {
                clearInterval(callTimerRef.current);
                callTimerRef.current = null;
              }
            }
          } else if (response.callTimer?.timerPaused) {
            if (callTimerRef.current) {
              clearInterval(callTimerRef.current);
              callTimerRef.current = null;
            }
          }
        }
      } catch (e) {
        // Silent fail for polling
      }
    }, 2000); // Poll every 2s for faster transition when both join
  };

  {/* Start call timer — ticks from server consultation start (persists across refresh) */}
  const startCallTimer = () => {
    if (callTimerRef.current) return;
    if (timerPausedRef.current) return;
    if (callRemainingRef.current <= 0) return;

    callTimerRef.current = setInterval(() => {
      const remaining = computeClientCallRemaining(callSlotSecondsRef.current, {
        timerPaused: timerPausedRef.current,
        timerRunningSince: consultationStartedAtRef.current,
        timerBaseSeconds: timerBaseSecondsRef.current,
      });
      callRemainingRef.current = remaining;
      setCallRemainingSeconds(remaining);
      if (remaining <= 0) {
        if (callTimerRef.current) {
          clearInterval(callTimerRef.current);
          callTimerRef.current = null;
        }
        queueMicrotask(() => {
          toast.info('Consultation time limit reached. Ending call.');
          void endCall(true, true);
        });
      }
    }, 1000);
  };

  const reportParticipantLeft = useCallback(async () => {
    if (leftReportedRef.current) return;
    leftReportedRef.current = true;
    try {
      const res = await apiClient.post<{
        callTimer?: CallTimerPayload;
        canRejoin?: boolean;
      }>(`/video-call/${bookingId}/participant-left`, { participantType });
      if (res?.callTimer) {
        applyCallTimer(res.callTimer);
      }
      return res;
    } catch {
      return null;
    }
  }, [bookingId, participantType, applyCallTimer]);

  const handleEndCallClick = () => {
    const remaining = callRemainingRef.current;
    const msg =
      remaining > 0
        ? 'Leave the call? Your remaining consultation time is saved — you can rejoin until the slot ends.'
        : 'End the consultation? Your slot time has run out.';
    if (typeof window !== 'undefined' && window.confirm(msg)) {
      endCall(true, remaining <= 0);
    }
  };

  const disconnectLocalMedia = () => {
    const session = meetingSessionRef.current;
    if (session) {
      try {
        session.audioVideo.stopLocalVideoTile();
        session.audioVideo.stop();
      } catch { /* ignore */ }
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (statusPollerRef.current) {
      clearInterval(statusPollerRef.current);
      statusPollerRef.current = null;
    }
  };

  const endCall = async (initiatedByUs = true, finalizeSession = false) => {
    if (endingCallRef.current) return;
    endingCallRef.current = true;
    const elapsedSeconds = getElapsedCallSeconds();
    const shouldFinalize = finalizeSession || callRemainingRef.current <= 0;

    try {
      const session = meetingSessionRef.current;

      if (shouldFinalize && initiatedByUs && session?.audioVideo) {
        try {
          const payload = new TextEncoder().encode(JSON.stringify({ endedBy: participantType, finalize: true }));
          session.audioVideo.realtimeSendDataMessage(CALL_ENDED_TOPIC, payload, 5000);
        } catch { /* ignore */ }
      }

      disconnectLocalMedia();

      if (shouldFinalize) {
        const endResponse = await apiClient.post<any>(`/video-call/${bookingId}/end`, {
          duration: elapsedSeconds,
          participantType,
        });

        if (endResponse?.userMessage || endResponse?.teleCompletionStatus) {
          setEndOutcome({
            userMessage: endResponse.userMessage,
            teleCompletionStatus: endResponse.teleCompletionStatus,
            bookingCompleted: endResponse.bookingCompleted,
            overlapSeconds:
              endResponse.overlapSeconds != null
                ? Number(endResponse.overlapSeconds)
                : undefined,
          });
          if (endResponse.teleCompletionStatus === 'customer_no_show') {
            toast.error(endResponse.userMessage || 'Customer did not join the consultation.');
          } else if (endResponse.bookingCompleted) {
            toast.success(endResponse.userMessage || 'Consultation completed successfully.');
          } else if (endResponse.userMessage) {
            toast.info(endResponse.userMessage);
          }
        }

        setStatus('ended');
        if (onEndCall) {
          onEndCall(elapsedSeconds);
        }
      } else {
        const leaveRes = await reportParticipantLeft();
        leftReportedRef.current = false;
        setStatus('left');
        if (leaveRes?.canRejoin !== false) {
          toast.info('You left the call. Rejoin anytime while time remains.');
        }
      }
    } catch (err) {
      console.error('Error ending call:', err);
      setStatus(shouldFinalize ? 'ended' : 'left');
    } finally {
      endingCallRef.current = false;
    }
  };

  const handleRejoinCall = () => {
    leftReportedRef.current = false;
    endingCallRef.current = false;
    disconnectingRef.current = false;
    hasAutoJoinedRef.current = false;
    setEndOutcome(null);
    setError(null);
    void joinMeeting();
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

  const distributeChatFileAfterUpload = (
    fileUrl: string,
    displayName: string,
    messageType: 'image' | 'file',
    messageId: string
  ) => {
    if (!meetingSessionRef.current) return;
    const senderName = participantType === 'customer' ? customerName : vendorName;
    addChatMessage(
      participantType as 'customer' | 'vendor',
      senderName,
      displayName,
      messageId,
      messageType,
      displayName,
      fileUrl
    );
    const audioVideo = meetingSessionRef.current.audioVideo;
    const chatData: ChatDataMessage = {
      type: 'file',
      id: messageId,
      sender: participantType as 'customer' | 'vendor',
      senderName,
      message: displayName,
      messageType,
      fileName: displayName,
      fileUrl,
      timestamp: new Date().toISOString(),
    };
    const payload = new TextEncoder().encode(JSON.stringify(chatData));
    audioVideo.realtimeSendDataMessage(CHAT_TOPIC, payload, MESSAGE_LIFETIME_MS);
  };

  {/* Handle file upload*/ }
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!meetingSessionRef.current) return;

    if (e.target === fileInputRef.current && fileInputRef.current) {
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

      distributeChatFileAfterUpload(fileUrl, file.name, messageType, messageId);
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

  const broadcastMediaState = (muted: boolean, videoOff: boolean) => {
    const session = meetingSessionRef.current;
    if (!session?.audioVideo) return;
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          sender: participantType,
          muted,
          videoOff,
        })
      );
      session.audioVideo.realtimeSendDataMessage(MEDIA_STATE_TOPIC, payload, MESSAGE_LIFETIME_MS);
    } catch {
      // ignore
    }
  };

  const prevCallStatusRef = useRef<CallStatus | ''>('');

  {/* Toggle mute*/ }
  const toggleMute = () => {
    const next = !isMuted;
    if (meetingSessionRef.current) {
      const audioVideo = meetingSessionRef.current.audioVideo;
      if (next) {
        audioVideo.realtimeMuteLocalAudio();
      } else {
        audioVideo.realtimeUnmuteLocalAudio();
      }
    }
    setIsMuted(next);
    broadcastMediaState(next, isVideoOff);
  };

  {/* Toggle video*/ }
  const toggleVideo = () => {
    const next = !isVideoOff;
    if (meetingSessionRef.current) {
      const audioVideo = meetingSessionRef.current.audioVideo;
      if (next) {
        audioVideo.stopLocalVideoTile();
      } else {
        audioVideo.startLocalVideoTile();
      }
    }
    setIsVideoOff(next);
    broadcastMediaState(isMuted, next);
  };

  const cycleCamera = async () => {
    const session = meetingSessionRef.current;
    if (!session) return;
    try {
      const devices = await session.audioVideo.listVideoInputDevices();
      if (devices.length < 2) {
        toast.message('Only one camera is available on this device.');
        return;
      }
      const current = selectedDevices.videoInput;
      const idx = Math.max(
        0,
        devices.findIndex((d: MediaDeviceInfo) => d.deviceId === current)
      );
      const nextDevice = devices[(idx + 1) % devices.length];
      await session.audioVideo.startVideoInput(nextDevice.deviceId);
      setSelectedDevices((prev) => ({ ...prev, videoInput: nextDevice.deviceId }));
      if (!isVideoOff) {
        session.audioVideo.startLocalVideoTile();
      }
      toast.success('Switched camera');
    } catch (err) {
      console.error('cycleCamera:', err);
      toast.error('Could not switch camera');
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
  const toggleFullScreen = async () => {
    if (typeof document === 'undefined') return;
    if (pseudoFullScreen) {
      setPseudoFullScreen(false);
      setIsFullScreen(false);
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    const el = callRootRef.current || document.documentElement;
    try {
      await el.requestFullscreen();
    } catch {
      setPseudoFullScreen(true);
      setIsFullScreen(true);
    }
  };

  const clampPipOffset = (x: number, y: number) => {
    const stage = videoStageRef.current;
    if (!stage) return { x, y };
    const rect = stage.getBoundingClientRect();
    const pipW = 112;
    const pipH = 144;
    const margin = 12;
    const maxShiftX = Math.max(margin, rect.width - pipW - margin);
    const maxShiftY = Math.max(margin, rect.height - pipH - margin);
    return {
      x: Math.max(-maxShiftX, Math.min(maxShiftX, x)),
      y: Math.max(-maxShiftY, Math.min(maxShiftY, y)),
    };
  };

  const onPipPointerDown = (e: React.PointerEvent) => {
    pipDragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: pipOffset.x,
      originY: pipOffset.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPipPointerMove = (e: React.PointerEvent) => {
    if (!pipDragRef.current.active) return;
    const dx = pipDragRef.current.startX - e.clientX;
    const dy = pipDragRef.current.startY - e.clientY;
    const next = clampPipOffset(pipDragRef.current.originX + dx, pipDragRef.current.originY + dy);
    setPipOffset(next);
  };

  const onPipPointerUp = (e: React.PointerEvent) => {
    pipDragRef.current.active = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    setIsChimeNativeWebView(
      typeof window !== 'undefined' &&
        !!(window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } }).ReactNativeWebView
    );
  }, []);

  {/* Other participant name*/ }
  const otherParticipantName = participantType === 'customer' ? vendorName : customerName;
  const handleJoinTap = async () => {
    const perm = await requestCameraMicrophonePermission();
    if (perm === 'denied') {
      toast.error('Camera/Microphone permission denied. Please allow access and try again.');
      return;
    }
    void joinMeeting();
  };



  //---------------------------useEffect hooks------------------------------//

  {/* Auto-join when SDK is ready (e.g. vendor accepted call or opened video from appointment)*/ }
  useEffect(() => {
    if (
      status !== 'ready' ||
      !bookingId ||
      !participantId ||
      hasAutoJoinedRef.current ||
      requiresUserGestureForMediaPrompt()
    ) return;
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

  useEffect(() => {
    callRemainingRef.current = callRemainingSeconds;
  }, [callRemainingSeconds]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onFs = () => {
      setIsFullScreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) setPseudoFullScreen(false);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

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
    if (status === 'active' && prevCallStatusRef.current !== 'active') {
      broadcastMediaState(isMuted, isVideoOff);
    }
    prevCallStatusRef.current = status;
  }, [status, isMuted, isVideoOff]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
      __warmpawzDeliverChatUpload?: (payload: {
        fileUrl: string;
        fileName: string;
        messageType?: 'image' | 'file';
        messageId?: string;
      }) => void;
    };
    w.__warmpawzDeliverChatUpload = (payload) => {
      if (!payload?.fileUrl) return;
      const messageId = payload.messageId || `file-${Date.now()}`;
      const messageType = payload.messageType || 'image';
      distributeChatFileAfterUpload(payload.fileUrl, payload.fileName || 'Photo', messageType, messageId);
    };
    return () => {
      delete w.__warmpawzDeliverChatUpload;
    };
  }, [participantType, customerName, vendorName]);

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
            onClick={handleJoinTap}
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

  if (status === 'left') {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">You left the call</h2>
          <p className="text-gray-600 mb-1">
            Time remaining:{' '}
            <span className="font-mono font-medium">{formatDuration(callRemainingSeconds)}</span>
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Rejoin to continue the consultation before the slot ends.
          </p>
          <Button
            onClick={handleRejoinCall}
            className="bg-[#FF8C42] hover:bg-[#FF7A2E] px-8 py-3 rounded-xl"
          >
            Rejoin call
          </Button>
        </div>
      </div>
    );
  }

  {/* Ended state*/ }
  if (status === 'ended') {
    const isCustomerNoShow = endOutcome?.teleCompletionStatus === 'customer_no_show';
    const isIncomplete = endOutcome?.teleCompletionStatus === 'incomplete_call';
    const isQualified = endOutcome?.teleCompletionStatus === 'qualified' || endOutcome?.bookingCompleted;
    const headline = endOutcome?.userMessage
      ? endOutcome.userMessage
      : endedByOther
        ? `${otherParticipantName} left the call`
        : 'Call ended';

    return (
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
        <div className="text-center">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isQualified ? 'bg-green-100' : isCustomerNoShow || isIncomplete ? 'bg-amber-100' : 'bg-gray-100'
            }`}
          >
            {isQualified ? (
              <Check className="w-10 h-10 text-green-500" />
            ) : (
              <AlertCircle className={`w-10 h-10 ${isCustomerNoShow ? 'text-amber-600' : 'text-gray-500'}`} />
            )}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{headline}</h2>
          <p className="text-gray-600 mb-1">
            Duration:{' '}
            {formatDuration(getConsultationOverlapSeconds())}
          </p>
          <p className="text-gray-500 text-sm mb-6">
            {isCustomerNoShow
              ? 'The customer did not join. Use Mark Complete only after a qualified consultation.'
              : endedByOther
                ? 'The other participant has disconnected.'
                : isQualified
                  ? 'Thank you for using Warmpawz'
                  : 'Minimum consultation duration was not met for automatic completion.'}
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
              onClick={() => onEndCall?.(getConsultationOverlapSeconds())}
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
    <div
      ref={callRootRef}
      className={`flex flex-col bg-slate-900 overflow-hidden shadow-xl relative ${
        pseudoFullScreen || isFullScreen
          ? 'fixed inset-0 z-[9998] rounded-none h-[100dvh] max-h-[100dvh]'
          : 'rounded-2xl h-[100dvh] max-h-[100dvh] min-h-[100dvh] sm:h-[min(100dvh,920px)] sm:max-h-[min(100dvh,920px)] sm:min-h-0'
      }`}
    >
      {/* Header — wraps on small screens; extra top offset for video so controls never sit under the bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-slate-900/90 to-transparent px-3 sm:px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-2 pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))]">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-medium text-sm truncate">{otherParticipantName}</p>
              <p className="text-slate-400 text-xs truncate">{serviceName}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0 flex-wrap">
            <div className="bg-slate-800/80 backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-white text-sm font-mono">{formatDuration(callRemainingSeconds)}</span>
            </div>

            <button
              type="button"
              onClick={() => void toggleFullScreen()}
              className="min-h-[40px] min-w-[40px] p-2 bg-slate-800/80 backdrop-blur rounded-full hover:bg-slate-700 transition-colors touch-manipulation"
            >
              {isFullScreen || pseudoFullScreen ? (
                <Minimize2 className="w-4 h-4 text-white" />
              ) : (
                <Maximize2 className="w-4 h-4 text-white" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowChat(!showChat)}
              className={`min-h-[40px] min-w-[40px] p-2 rounded-full transition-colors relative touch-manipulation ${showChat ? 'bg-[#FF8C42]' : 'bg-slate-800/80 backdrop-blur hover:bg-slate-700'
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

      <div ref={videoStageRef} className="flex-1 min-h-0 bg-slate-800 relative mt-[max(5.5rem,calc(env(safe-area-inset-top,0px)+4.5rem))] sm:mt-16 mb-0">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
        />

        {remoteMediaState.muted && (
          <div className="absolute top-16 left-4 z-10 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-white text-xs">
            <MicOff className="w-4 h-4" />
            <span>Mic off</span>
          </div>
        )}
        {remoteMediaState.videoOff && (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center bg-slate-900/75 text-white pointer-events-none">
            <VideoOff className="w-14 h-14 opacity-80 mb-2" />
            <p className="text-sm font-medium">Camera off</p>
          </div>
        )}

        {!attendeeStatus.vendorJoined && participantType === 'customer' && (
          <div className="absolute inset-0 z-[4] flex items-center justify-center bg-slate-800">
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <User className="w-10 h-10 text-slate-500" />
              </div>
              <p className="text-slate-400 text-sm">Waiting for {otherParticipantName}...</p>
            </div>
          </div>
        )}
        {!attendeeStatus.customerJoined && participantType === 'vendor' && (
          <div className="absolute inset-0 z-[4] flex items-center justify-center bg-slate-800">
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <User className="w-10 h-10 text-slate-500" />
              </div>
              <p className="text-slate-400 text-sm">Waiting for {otherParticipantName}...</p>
            </div>
          </div>
        )}

        <div
          className="absolute z-10 w-28 h-36 rounded-xl overflow-hidden shadow-2xl border-2 border-slate-600 bg-slate-800 cursor-grab active:cursor-grabbing touch-pan-y"
          style={{
            bottom: `calc(5rem + ${pipOffset.y}px)`,
            right: `calc(1rem + ${pipOffset.x}px)`,
          }}
          onPointerDown={onPipPointerDown}
          onPointerMove={onPipPointerMove}
          onPointerUp={onPipPointerUp}
          onPointerCancel={onPipPointerUp}
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1] pointer-events-none"
          />
          {isVideoOff && (
            <div className="absolute inset-0 bg-slate-800 flex items-center justify-center pointer-events-none">
              <VideoOff className="w-6 h-6 text-slate-500" />
            </div>
          )}
        </div>

        {remoteAudioBlocked && (
          <button
            type="button"
            onClick={retryRemoteAudio}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-amber-500/90 hover:bg-amber-500 text-white px-4 py-2 rounded-full text-sm font-medium z-20"
          >
            Tap to enable sound
          </button>
        )}

        {status === 'reconnecting' && (
          <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center z-30">
            <RotateCcw className="w-10 h-10 text-yellow-400 animate-spin mb-3" />
            <p className="text-white">Reconnecting...</p>
          </div>
        )}
      </div>

      <div className="shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-slate-800/90 backdrop-blur-lg border-t border-slate-700">
        <div className="flex justify-center items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => void cycleCamera()}
            className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-700 text-white hover:bg-slate-600"
            title="Flip camera"
          >
            <SwitchCamera className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={handleEndCallClick}
            className="w-14 h-14 rounded-2xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="w-12 h-12 rounded-2xl bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Audio element for remote audio */}
      <audio ref={audioElementRef} autoPlay />

      {/* Chat Panel — safe-area so header clears notch / status bar (iOS/Android) */}
      {showChat && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-lg flex flex-col min-h-0 pt-[env(safe-area-inset-top,0px)]">
          <div className="px-3 sm:px-4 py-3 border-b border-slate-700 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 min-w-0 shrink-0 pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))]">
            <div className="min-w-0 flex-1">
              <h3 className="text-white font-semibold text-sm sm:text-base truncate">Chat with {otherParticipantName}</h3>
              {isOtherTyping && (
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 min-w-0">
                  <span className="flex gap-0.5 shrink-0">
                    <Circle className="w-1.5 h-1.5 fill-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <Circle className="w-1.5 h-1.5 fill-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <Circle className="w-1.5 h-1.5 fill-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span className="truncate">{otherTypingName} is typing...</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowChat(false)}
              className="min-h-[44px] min-w-[44px] self-end sm:self-center p-2 hover:bg-slate-700 rounded-xl shrink-0 touch-manipulation flex items-center justify-center"
              aria-label="Close chat"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
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

          <div className="p-3 sm:p-4 border-t border-slate-700 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))]">
            <div className="flex gap-2 min-w-0">
              {isChimeNativeWebView ? (
                <button
                  type="button"
                  onClick={() => {
                    const w = window as unknown as {
                      ReactNativeWebView?: { postMessage: (s: string) => void };
                    };
                    w.ReactNativeWebView?.postMessage(
                      JSON.stringify({ type: 'WARMPAWZ_PICK_CHAT_FILE', bookingId })
                    );
                  }}
                  disabled={uploadingFile}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-700 text-white transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploadingFile ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                </button>
              ) : (
                <TouchFilePicker
                  ref={fileInputRef}
                  onFileChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  disabled={uploadingFile}
                  className="h-12 w-12"
                  innerClassName="flex h-full w-full items-center justify-center rounded-xl bg-slate-700 text-white transition-colors hover:bg-slate-600 disabled:opacity-50"
                >
                  {uploadingFile ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                </TouchFilePicker>
              )}
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
