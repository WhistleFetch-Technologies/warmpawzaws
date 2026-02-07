'use client';

/**
 * ============================================================================
 * VIDEO CALL INTERFACE COMPONENT
 * ============================================================================
 * 
 * Full-screen video call UI using AWS Chime SDK
 * - Local and remote video streams
 * - Audio/video toggle controls
 * - Real-time chat via Chime Data Messages
 * - End call functionality
 * - Connection status indicators
 * 
 * Phase: Phase 3 - Video Call Integration
 * Date: 2026-01-28
 * Updated: 2026-01-27 - Fixed SDK initialization with proper MediaPlacement
 * Updated: 2026-01-27 - Added real-time chat via Chime Data Messages
 * ============================================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Loader2, AlertCircle, RotateCcw, MessageSquare, Send, X, Circle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

// Chat data message topics
const CHAT_TOPIC = 'chat-message';
const TYPING_TOPIC = 'typing-indicator';
const MESSAGE_LIFETIME_MS = 300000; // 5 minutes

interface ChatMessage {
  id: string;
  sender: 'customer' | 'vendor' | 'system';
  senderName: string;
  message: string;
  timestamp: Date;
  persisted?: boolean;
}

interface ChatDataMessage {
  type: 'message';
  id: string;
  sender: 'customer' | 'vendor';
  senderName: string;
  message: string;
  timestamp: string;
}

interface TypingDataMessage {
  type: 'typing';
  sender: 'customer' | 'vendor';
  senderName: string;
  isTyping: boolean;
}

// Types for Chime SDK meeting data
interface ChimeMeetingData {
  MeetingId: string;
  MediaPlacement: {
    AudioHostUrl: string;
    AudioFallbackUrl: string;
    SignalingUrl: string;
    TurnControlUrl: string;
    ScreenDataUrl?: string;
    ScreenViewingUrl?: string;
    ScreenSharingUrl?: string;
    EventIngestionUrl?: string;
  };
  MediaRegion: string;
}

interface ChimeAttendeeData {
  AttendeeId: string;
  JoinToken: string;
  ExternalUserId?: string;
}

interface VideoCallInterfaceProps {
  bookingId: string;
  // Option 1: Pass full meeting data (preferred)
  meeting?: ChimeMeetingData;
  attendee?: ChimeAttendeeData;
  // Option 2: Legacy props (will trigger credential fetch)
  meetingId?: string;
  attendeeId?: string;
  joinToken?: string;
  // Common props
  participantType?: 'customer' | 'vendor';
  participantId?: string;
  onEndCall: () => void;
  vendorName?: string;
}

export function VideoCallInterface({
  bookingId,
  meeting: meetingProp,
  attendee: attendeeProp,
  meetingId: legacyMeetingId,
  attendeeId: legacyAttendeeId,
  joinToken: legacyJoinToken,
  participantType = 'customer',
  participantId,
  onEndCall,
  vendorName = 'Provider',
}: VideoCallInterfaceProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'fetching'>('fetching');
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  // Store fetched credentials
  const [meetingData, setMeetingData] = useState<ChimeMeetingData | null>(meetingProp || null);
  const [attendeeData, setAttendeeData] = useState<ChimeAttendeeData | null>(attendeeProp || null);

  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [otherTypingName, setOtherTypingName] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const meetingSessionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const initializationAttempted = useRef(false);

  // Customer name (for chat)
  const customerName = 'Customer';

  // Fetch meeting credentials from backend if not provided
  const fetchMeetingCredentials = useCallback(async (retryCount = 0): Promise<{ meeting: ChimeMeetingData; attendee: ChimeAttendeeData }> => {
    const MAX_RETRIES = 2;
    
    try {
      setConnectionStatus('fetching');
      
      const response = await apiClient.post<{
        success: boolean;
        meeting: ChimeMeetingData;
        attendee: ChimeAttendeeData;
        meetingId: string;
        error?: string;
        session?: { id: string; status: string };
      }>('/video-call/join', {
        bookingId,
        participantId: participantId || bookingId,
        participantType,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to get meeting credentials from server');
      }

      if (!response.meeting || !response.attendee) {
        throw new Error('Invalid response: missing meeting or attendee data');
      }

      // Validate required fields - MediaPlacement is essential for Chime SDK
      if (!response.meeting.MediaPlacement) {
        throw new Error('Invalid meeting data: MediaPlacement is missing. The meeting may have expired.');
      }

      if (!response.meeting.MediaPlacement.AudioHostUrl || !response.meeting.MediaPlacement.SignalingUrl) {
        throw new Error('Invalid meeting data: MediaPlacement is incomplete');
      }

      if (!response.attendee.AttendeeId || !response.attendee.JoinToken) {
        throw new Error('Invalid attendee data: AttendeeId or JoinToken is missing');
      }

      setMeetingData(response.meeting);
      setAttendeeData(response.attendee);
      
      console.log('✅ Meeting credentials fetched successfully');
      return { meeting: response.meeting, attendee: response.attendee };
    } catch (err: any) {
      console.error('Error fetching meeting credentials:', err);
      
      // Retry on network errors
      if (retryCount < MAX_RETRIES && (err.code === 'network' || err.message?.includes('fetch'))) {
        console.log(`Retrying credential fetch (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return fetchMeetingCredentials(retryCount + 1);
      }
      
      // Provide user-friendly error messages
      let errorMessage = err.message || 'Failed to fetch meeting credentials';
      if (err.status === 404) {
        errorMessage = 'Meeting not found. Please ask the other participant to start the call first.';
      } else if (err.status === 400) {
        errorMessage = err.message || 'Unable to join this meeting. It may not be scheduled yet.';
      } else if (err.code === 'network' || err.code === 'offline') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      }
      
      throw new Error(errorMessage);
    }
  }, [bookingId, participantId, participantType]);

  // Load Chime SDK dynamically with retry support
  const loadChimeSDK = useCallback(async (retryCount = 0): Promise<typeof import('amazon-chime-sdk-js')> => {
    const MAX_RETRIES = 2;
    
    try {
      // Dynamically import AWS Chime SDK from npm package
      const ChimeSDK = await import('amazon-chime-sdk-js');
      
      // Validate SDK loaded correctly
      if (!ChimeSDK || !ChimeSDK.DefaultMeetingSession) {
        throw new Error('SDK modules not available');
      }
      
      setSdkLoaded(true);
      console.log('✅ AWS Chime SDK loaded successfully');
      return ChimeSDK;
    } catch (err: any) {
      console.error('Error loading Chime SDK:', err);
      
      // Retry on failure
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying SDK load (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return loadChimeSDK(retryCount + 1);
      }
      
      throw new Error('Failed to load video call SDK. Please check your internet connection and try again.');
    }
  }, []);

  useEffect(() => {
    if (initializationAttempted.current) return;
    initializationAttempted.current = true;
    
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
      setError(null);

      // Step 1: Load the Chime SDK
      setConnectionStatus('fetching');
      const ChimeSDK = await loadChimeSDK();
      
      const {
        DefaultMeetingSession,
        MeetingSessionConfiguration,
        ConsoleLogger,
        LogLevel,
        DefaultDeviceController,
      } = ChimeSDK;

      // Step 2: Get meeting credentials (fetch from backend if not provided as props)
      let meeting = meetingProp || meetingData;
      let attendee = attendeeProp || attendeeData;

      if (!meeting || !attendee || !meeting.MediaPlacement) {
        // Legacy props provided - construct meeting data or fetch from backend
        if (legacyMeetingId && legacyAttendeeId && legacyJoinToken) {
          // We have legacy props but need MediaPlacement - must fetch from backend
          console.log('Legacy props provided without MediaPlacement, fetching full credentials...');
        }
        
        const credentials = await fetchMeetingCredentials();
        meeting = credentials.meeting;
        attendee = credentials.attendee;
      }

      if (!meeting || !attendee) {
        throw new Error('Failed to obtain meeting credentials');
      }

      // Validate MediaPlacement exists
      if (!meeting.MediaPlacement || !meeting.MediaPlacement.AudioHostUrl) {
        throw new Error('Invalid meeting data: MediaPlacement is incomplete');
      }

      setConnectionStatus('connecting');

      // Step 3: Create logger
      const logger = new ConsoleLogger('VideoCallInterface', LogLevel.INFO);

      // Step 4: Create device controller
      const deviceController = new DefaultDeviceController(logger);

      // Step 5: Create meeting session configuration with PROPER structure
      // The MeetingSessionConfiguration constructor expects:
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

      // Step 6: Create meeting session
      const meetingSession = new DefaultMeetingSession(
        configuration,
        logger,
        deviceController
      );

      meetingSessionRef.current = meetingSession;

      // Step 7: Set up audio/video
      await setupAudioVideo(meetingSession);

      setConnectionStatus('connected');
      setIsConnecting(false);
      toast.success('Connected to video call');
    } catch (err: any) {
      console.error('Error initializing Chime meeting:', err);
      setError(err.message || 'Failed to initialize video call');
      setConnectionStatus('disconnected');
      setIsConnecting(false);
      toast.error(err.message || 'Failed to connect to video call');
    }
  };

  const retryConnection = () => {
    setError(null);
    initializationAttempted.current = false;
    initializeChimeMeeting();
  };

  const setupAudioVideo = async (meetingSession: any) => {
    try {
      const audioVideo = meetingSession.audioVideo;

      // Set up audio video observer FIRST
      const observer = {
        audioVideoDidStart: () => {
          console.log('Audio/Video started');
        },
        audioVideoDidStop: (sessionStatus: any) => {
          console.log('Audio/Video stopped:', sessionStatus?.statusCode?.());
          if (connectionStatus !== 'disconnected') {
            setConnectionStatus('disconnected');
          }
        },
        audioVideoDidStartConnecting: (reconnecting: boolean) => {
          if (reconnecting) {
            console.log('Reconnecting...');
          }
        },
        videoTileDidUpdate: (tileState: any) => {
          // Handle local video tile
          if (tileState.localTile && localVideoRef.current) {
            audioVideo.bindVideoElement(tileState.tileId, localVideoRef.current);
          } 
          // Handle remote video tile
          else if (!tileState.localTile && !tileState.isContent && remoteVideoRef.current) {
            audioVideo.bindVideoElement(tileState.tileId, remoteVideoRef.current);
          }
        },
        videoTileWasRemoved: (tileId: number) => {
          console.log('Video tile removed:', tileId);
        },
      };

      audioVideo.addObserver(observer);

      // =========================================================================
      // REAL-TIME CHAT VIA DATA MESSAGES
      // =========================================================================
      audioVideo.realtimeSubscribeToReceiveDataMessage((dataMessage: any) => {
        try {
          const topic = dataMessage.topic;
          const data = JSON.parse(new TextDecoder().decode(dataMessage.data));
          
          if (topic === CHAT_TOPIC) {
            handleReceivedChatMessage(data as ChatDataMessage);
          } else if (topic === TYPING_TOPIC) {
            handleReceivedTypingIndicator(data as TypingDataMessage);
          }
        } catch (err) {
          console.error('Error processing data message:', err);
        }
      });

      // Get available devices and select first ones
      try {
        const audioInputDevices = await audioVideo.listAudioInputDevices();
        const videoInputDevices = await audioVideo.listVideoInputDevices();
        const audioOutputDevices = await audioVideo.listAudioOutputDevices();

        if (audioInputDevices.length > 0) {
          await audioVideo.startAudioInput(audioInputDevices[0].deviceId);
        }

        if (audioOutputDevices.length > 0) {
          await audioVideo.chooseAudioOutput(audioOutputDevices[0].deviceId);
        }

        if (videoInputDevices.length > 0) {
          await audioVideo.startVideoInput(videoInputDevices[0].deviceId);
        }
      } catch (deviceErr: any) {
        console.warn('Error setting up devices:', deviceErr);
        toast.error('Camera or microphone access denied. Please allow access and try again.');
      }

      // Bind audio element for remote audio
      if (audioElementRef.current) {
        audioVideo.bindAudioElement(audioElementRef.current);
      }

      // Start audio/video session
      audioVideo.start();

      // Start local video tile after session starts
      audioVideo.startLocalVideoTile();

    } catch (err: any) {
      console.error('Error setting up audio/video:', err);
      throw new Error('Failed to set up camera and microphone: ' + (err.message || 'Unknown error'));
    }
  };

  // ============================================================================
  // CHAT FUNCTIONS
  // ============================================================================

  const handleReceivedChatMessage = (data: ChatDataMessage) => {
    if (data.sender === participantType) return;
    
    const newMsg: ChatMessage = {
      id: data.id,
      sender: data.sender,
      senderName: data.senderName,
      message: data.message,
      timestamp: new Date(data.timestamp),
    };
    
    setChatMessages(prev => {
      if (prev.some(m => m.id === data.id)) return prev;
      return [...prev, newMsg];
    });
    
    if (!showChat) {
      setUnreadCount(prev => prev + 1);
    }
    
    setIsOtherTyping(false);
  };

  const handleReceivedTypingIndicator = (data: TypingDataMessage) => {
    if (data.sender === participantType) return;
    
    setIsOtherTyping(data.isTyping);
    setOtherTypingName(data.senderName);
    
    if (data.isTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsOtherTyping(false);
      }, 3000);
    }
  };

  const addChatMessage = (sender: 'customer' | 'vendor' | 'system', senderName: string, message: string, id?: string) => {
    const newMsg: ChatMessage = {
      id: id || Date.now().toString(),
      sender,
      senderName,
      message,
      timestamp: new Date(),
    };
    
    setChatMessages(prev => [...prev, newMsg]);
    
    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    }, 100);
    
    return newMsg;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !meetingSessionRef.current) return;

    const senderName = participantType === 'customer' ? customerName : vendorName;
    const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageText = newMessage.trim();
    const timestamp = new Date();
    
    addChatMessage(participantType as 'customer' | 'vendor', senderName, messageText, messageId);
    setNewMessage('');
    
    try {
      const audioVideo = meetingSessionRef.current.audioVideo;
      
      const chatData: ChatDataMessage = {
        type: 'message',
        id: messageId,
        sender: participantType as 'customer' | 'vendor',
        senderName,
        message: messageText,
        timestamp: timestamp.toISOString(),
      };
      
      const payload = new TextEncoder().encode(JSON.stringify(chatData));
      audioVideo.realtimeSendDataMessage(CHAT_TOPIC, payload, MESSAGE_LIFETIME_MS);
    } catch (err) {
      console.error('Error sending chat message:', err);
      toast.error('Failed to send message');
    }
    
    // Persist to backend
    try {
      await apiClient.post(`/chat/${bookingId}/send`, {
        message: messageText,
        senderType: participantType,
        senderId: participantId,
        senderName,
      });
      
      setChatMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, persisted: true } : msg
        )
      );
    } catch (err) {
      // Silent fail - message was still sent via Chime
    }
  };

  const sendTypingIndicator = (isTyping: boolean) => {
    if (!meetingSessionRef.current) return;
    
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
      audioVideo.realtimeSendDataMessage(TYPING_TOPIC, payload, 3000);
    } catch (err) {
      // Ignore
    }
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    if (value.length > 0) {
      sendTypingIndicator(true);
    }
  };

  // Clear unread when chat opens
  useEffect(() => {
    if (showChat) {
      setUnreadCount(0);
    }
  }, [showChat]);

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

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
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
          <div className="flex gap-3 justify-center">
            <Button 
              onClick={retryConnection} 
              variant="outline"
              className="border-[#FF8C42] text-[#FF8C42]"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={onEndCall} className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white">
              Close
            </Button>
          </div>
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
        {(connectionStatus === 'connecting' || connectionStatus === 'fetching') && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
              <p className="text-lg">
                {connectionStatus === 'fetching' 
                  ? 'Preparing video call...' 
                  : `Connecting to ${vendorName}...`
                }
              </p>
              <p className="text-sm text-gray-300 mt-2">
                {connectionStatus === 'fetching' 
                  ? 'Loading video call SDK and credentials' 
                  : 'Setting up audio and video'
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden audio element for remote audio */}
      <audio ref={audioElementRef} autoPlay />

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

      {/* Chat Toggle Button */}
      <button
        onClick={() => setShowChat(!showChat)}
        className={`absolute top-4 right-40 p-3 rounded-full transition-colors relative ${
          showChat ? 'bg-[#FF8C42]' : 'bg-black/50 hover:bg-black/70'
        }`}
      >
        <MessageSquare className="w-5 h-5 text-white" />
        {unreadCount > 0 && !showChat && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

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

      {/* Chat Panel (Slide-in from right) */}
      {showChat && (
        <div className="absolute top-0 right-0 bottom-0 w-full sm:w-96 bg-slate-900/95 backdrop-blur-lg flex flex-col z-50 animate-slide-in-right">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold">Chat with {vendorName}</h3>
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
                  <div key={msg.id} className={`flex ${
                    msg.sender === 'system' ? 'justify-center' :
                    msg.sender === participantType ? 'justify-end' : 'justify-start'
                  }`}>
                    {msg.sender === 'system' ? (
                      <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
                        {msg.message}
                      </span>
                    ) : (
                      <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                        msg.sender === participantType 
                          ? 'bg-[#FF8C42] text-white rounded-br-none' 
                          : 'bg-slate-700 text-white rounded-bl-none'
                      }`}>
                        {msg.sender !== participantType && (
                          <p className="text-[10px] font-medium opacity-80 mb-0.5">{msg.senderName}</p>
                        )}
                        <p className="text-sm">{msg.message}</p>
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

      {/* Add animation styles */}
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
