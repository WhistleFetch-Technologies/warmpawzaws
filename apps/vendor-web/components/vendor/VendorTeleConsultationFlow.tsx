'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, Video, VideoOff, Mic, MicOff, Phone, PhoneOff, 
  MessageSquare, Settings, ScreenShare, ScreenShareOff,
  Maximize2, Minimize2, Copy, Check, Clock, User, Camera,
  Volume2, VolumeX, RotateCcw, Send, X, FileText, Pill
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface VendorTeleConsultationFlowProps {
  vendorId: string;
  bookingId?: string;
  vendorData?: any;
  bookingData?: any;
  onBack: () => void;
}

type CallStatus = 'idle' | 'waiting' | 'connecting' | 'active' | 'reconnecting' | 'ended';

interface ChatMessage {
  id: string;
  sender: 'vendor' | 'customer';
  message: string;
  timestamp: Date;
}

export function VendorTeleConsultationFlow({ 
  vendorId, 
  bookingId, 
  vendorData,
  bookingData,
  onBack 
}: VendorTeleConsultationFlowProps) {
  // Call state
  const [status, setStatus] = useState<CallStatus>('idle');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Refs for media
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  // Room/session ID
  const [roomId, setRoomId] = useState<string>('');
  const [copied, setCopied] = useState(false);
  
  // Customer info from booking
  const customerName = bookingData?.customerName || 'Patient';
  const petName = bookingData?.petName || 'Pet';
  const serviceName = bookingData?.serviceName || 'Tele Consultation';
  
  // ============================================================================
  // WEBRTC CONFIGURATION
  // ============================================================================
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  };

  // ============================================================================
  // MEDIA FUNCTIONS
  // ============================================================================
  
  const startLocalMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (err: any) {
      console.error('Error accessing media devices:', err);
      setError(`Camera/Microphone access denied: ${err.message}`);
      throw err;
    }
  }, []);

  const stopLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  }, []);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      
      // Restore camera
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        screenStreamRef.current = screenStream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        // Replace video track in peer connection
        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender && screenStream.getVideoTracks()[0]) {
            await videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
          }
        }
        
        setIsScreenSharing(true);
        
        // Handle when user stops sharing via browser UI
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (localStreamRef.current && localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        };
      } catch (err) {
        console.error('Screen share error:', err);
      }
    }
  }, [isScreenSharing]);

  // ============================================================================
  // CALL FUNCTIONS
  // ============================================================================

  const generateRoomId = () => {
    return `room_${bookingId || Date.now()}_${Math.random().toString(36).substring(7)}`;
  };

  const startCall = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);
      
      // Generate room ID
      const newRoomId = generateRoomId();
      setRoomId(newRoomId);
      
      // Start local media
      await startLocalMedia();
      
      // Create peer connection
      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = pc;
      
      // Add local tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }
      
      // Handle incoming remote stream
      pc.ontrack = (event) => {
        console.log('Remote track received:', event.track.kind);
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };
      
      // ICE candidate handling
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          // In production, send to signaling server
          console.log('ICE candidate:', event.candidate);
        }
      };
      
      // Connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        switch (pc.connectionState) {
          case 'connected':
            setStatus('active');
            break;
          case 'disconnected':
            setStatus('reconnecting');
            break;
          case 'failed':
            setError('Connection failed. Please try again.');
            setStatus('ended');
            break;
        }
      };
      
      // Notify backend about call start (using standard endpoint)
      try {
        await apiClient.post('/video-call/create-meeting', {
          bookingId,
          vendorId,
          roomId: newRoomId,
        });
      } catch (e) {
        console.log('Backend notification failed (may not be implemented)');
      }
      
      // For demo: simulate connection after delay
      setTimeout(() => {
        setStatus('active');
      }, 2000);
      
      // Start call timer
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      
    } catch (err: any) {
      console.error('Error starting call:', err);
      setError(err.message || 'Failed to start call');
      setStatus('idle');
    }
  }, [bookingId, vendorId, startLocalMedia]);

  const endCall = useCallback(async () => {
    // Stop timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Stop all media
    stopLocalMedia();
    
    // Notify backend
    try {
      await apiClient.post(`/video-call/${bookingId}/end`, {
        vendorId,
        duration: callDuration,
      });
    } catch (e) {
      console.log('Backend notification failed');
    }
    
    setStatus('ended');
  }, [bookingId, vendorId, callDuration, stopLocalMedia]);

  // ============================================================================
  // CHAT FUNCTIONS
  // ============================================================================

  const sendChatMessage = useCallback(() => {
    if (!newMessage.trim()) return;
    
    const message: ChatMessage = {
      id: Date.now().toString(),
      sender: 'vendor',
      message: newMessage.trim(),
      timestamp: new Date(),
    };
    
    setChatMessages(prev => [...prev, message]);
    setNewMessage('');
    
    // Send to backend/signaling
    // In production, this would go through WebSocket
  }, [newMessage]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  // ============================================================================
  // CLEANUP
  // ============================================================================

  useEffect(() => {
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      stopLocalMedia();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [stopLocalMedia]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 vendor-app-column flex flex-col relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#FF8C42]/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 bg-slate-800/80 backdrop-blur-lg text-white p-4 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-3">
          <button 
            onClick={status === 'active' ? undefined : onBack} 
            className={`p-2 rounded-xl transition-colors ${
              status === 'active' 
                ? 'bg-slate-700/50 cursor-not-allowed' 
                : 'hover:bg-slate-700 active:bg-slate-600'
            }`}
            disabled={status === 'active'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Teleconsultation</h1>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              {status === 'idle' && '● Ready to connect'}
              {status === 'waiting' && '○ Waiting for patient...'}
              {status === 'connecting' && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                  Connecting...
                </span>
              )}
              {status === 'active' && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  In session • {formatDuration(callDuration)}
                </span>
              )}
              {status === 'reconnecting' && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                  Reconnecting...
                </span>
              )}
              {status === 'ended' && '● Session ended'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {status === 'active' && (
            <button 
              onClick={toggleFullScreen}
              className="p-2 hover:bg-slate-700 rounded-xl transition-colors"
            >
              {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          )}
          <button 
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded-xl transition-colors relative ${
              showChat ? 'bg-[#FF8C42] text-white' : 'hover:bg-slate-700'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            {chatMessages.length > 0 && !showChat && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">
                {chatMessages.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Patient Info Bar */}
      {(status === 'active' || status === 'connecting') && (
        <div className="relative z-10 bg-slate-800/60 backdrop-blur px-4 py-3 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-white text-sm">{customerName}</p>
                <p className="text-xs text-slate-400">🐾 {petName} • {serviceName}</p>
              </div>
            </div>
            {roomId && (
              <button 
                onClick={copyRoomId}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-xs text-slate-300 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Room ID'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Video Area */}
      <div className="flex-1 relative">
        {/* IDLE STATE */}
        {status === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
            <div className="w-32 h-32 bg-gradient-to-br from-[#FF8C42] to-[#FF6B1A] rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-[#FF8C42]/30">
              <Video className="w-16 h-16 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 text-center">Ready to Consult</h2>
            <p className="text-slate-400 text-center mb-8 max-w-xs">
              {bookingId 
                ? `Booking #${bookingId.substring(0, 8)}` 
                : 'Start a video consultation with your patient'}
            </p>
            
            {error && (
              <div className="mb-6 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm text-center max-w-xs">
                {error}
              </div>
            )}
            
            <Button
              onClick={startCall}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-10 py-6 rounded-2xl font-bold text-lg shadow-xl shadow-green-500/30 transition-all hover:scale-105"
            >
              <Phone className="w-6 h-6 mr-3" />
              Start Consultation
            </Button>
            
            <p className="text-slate-500 text-xs mt-6">
              Camera and microphone access required
            </p>
          </div>
        )}

        {/* CONNECTING STATE */}
        {status === 'connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative mb-8">
              <div className="w-24 h-24 border-4 border-[#FF8C42]/30 rounded-full"></div>
              <div className="absolute inset-0 w-24 h-24 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Video className="w-10 h-10 text-[#FF8C42]" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Connecting...</h3>
            <p className="text-slate-400 text-sm">Setting up video connection</p>
          </div>
        )}

        {/* ACTIVE CALL STATE */}
        {status === 'active' && (
          <div className="absolute inset-0">
            {/* Remote Video (Large) */}
            <div className="absolute inset-0 bg-slate-800">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Placeholder when no remote video */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-12 h-12 text-slate-500" />
                  </div>
                  <p className="text-slate-400 text-sm">Waiting for patient video...</p>
                </div>
              </div>
            </div>
            
            {/* Local Video (PIP) */}
            <div className="absolute bottom-28 right-4 w-32 h-44 rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-600 bg-slate-800">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {!videoEnabled && (
                <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                  <VideoOff className="w-8 h-8 text-slate-500" />
                </div>
              )}
              {isScreenSharing && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-blue-500 rounded text-xs text-white">
                  Sharing
                </div>
              )}
            </div>
            
            {/* Call Timer Overlay */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur px-4 py-2 rounded-full">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-white font-mono text-sm">{formatDuration(callDuration)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ENDED STATE */}
        {status === 'ended' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
            <div className="w-24 h-24 bg-slate-700 rounded-3xl flex items-center justify-center mb-6">
              <PhoneOff className="w-12 h-12 text-slate-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Call Ended</h2>
            <p className="text-slate-400 mb-2">Duration: {formatDuration(callDuration)}</p>
            <p className="text-slate-500 text-sm mb-8">Session with {customerName}</p>
            
            <div className="flex gap-3 mb-6">
              <Button
                variant="outline"
                className="border-slate-600 text-white hover:bg-slate-700"
                onClick={() => {/* Add prescription */}}
              >
                <Pill className="w-4 h-4 mr-2" />
                Add Prescription
              </Button>
              <Button
                variant="outline"
                className="border-slate-600 text-white hover:bg-slate-700"
                onClick={() => {/* Add notes */}}
              >
                <FileText className="w-4 h-4 mr-2" />
                Add Notes
              </Button>
            </div>
            
            <Button
              onClick={onBack}
              className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white px-8 py-4 rounded-xl font-semibold"
            >
              Back to Dashboard
            </Button>
          </div>
        )}

        {/* RECONNECTING STATE */}
        {status === 'reconnecting' && (
          <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center">
            <RotateCcw className="w-12 h-12 text-yellow-400 animate-spin mb-4" />
            <p className="text-white font-medium">Reconnecting...</p>
            <p className="text-slate-400 text-sm">Please wait</p>
          </div>
        )}
      </div>

      {/* Controls */}
      {(status === 'active' || status === 'connecting') && (
        <div className="relative z-10 bg-slate-800/90 backdrop-blur-lg p-6 border-t border-slate-700">
          <div className="flex justify-center items-center gap-4">
            {/* Video Toggle */}
            <button
              onClick={toggleVideo}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                videoEnabled 
                  ? 'bg-slate-700 text-white hover:bg-slate-600' 
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>
            
            {/* Audio Toggle */}
            <button
              onClick={toggleAudio}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                audioEnabled 
                  ? 'bg-slate-700 text-white hover:bg-slate-600' 
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </button>
            
            {/* End Call */}
            <button
              onClick={endCall}
              className="w-16 h-16 rounded-2xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-xl shadow-red-500/30 hover:scale-105"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            
            {/* Screen Share */}
            <button
              onClick={toggleScreenShare}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                isScreenSharing 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              {isScreenSharing ? <ScreenShareOff className="w-6 h-6" /> : <ScreenShare className="w-6 h-6" />}
            </button>
            
            {/* Settings */}
            <button
              className="w-14 h-14 rounded-2xl bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center transition-all shadow-lg"
            >
              <Settings className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {showChat && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-lg flex flex-col min-h-0 pt-[env(safe-area-inset-top,0px)]">
          {/* Chat Header — same layout pattern as VendorChatModal (mobile-safe + horizontal safe area) */}
          <div className="py-3 border-b border-slate-700 flex items-center gap-3 min-w-0 shrink-0 pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] sm:pl-4 sm:pr-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-[#FF8C42]" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-sm sm:text-base truncate">
                Chat with {customerName}
              </h3>
              {bookingId && (
                <p className="text-slate-400 text-xs truncate mt-0.5">
                  Booking #{bookingId.length > 10 ? `${bookingId.slice(0, 8)}…` : bookingId}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowChat(false)}
              className="p-2 hover:bg-slate-700 rounded-xl shrink-0 touch-manipulation"
              aria-label="Close chat"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No messages yet</p>
                <p className="text-sm">Send a message to start chatting</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex ${msg.sender === 'vendor' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                    msg.sender === 'vendor' 
                      ? 'bg-[#FF8C42] text-white rounded-br-none' 
                      : 'bg-slate-700 text-white rounded-bl-none'
                  }`}>
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-[10px] opacity-70 mt-1">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Chat Input */}
          <div className="p-3 sm:p-4 border-t border-slate-700 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex gap-2 min-w-0">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Type a message..."
                className="flex-1 min-w-0 bg-slate-700 text-white px-3 sm:px-4 py-3 rounded-xl border-0 focus:ring-2 focus:ring-[#FF8C42] placeholder:text-slate-400 text-base sm:text-sm"
              />
              <button
                type="button"
                onClick={sendChatMessage}
                disabled={!newMessage.trim()}
                className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 bg-[#FF8C42] hover:bg-[#FF7A2E] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors touch-manipulation"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
