'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Video, VideoOff, Phone, PhoneOff, Mic, MicOff, 
  MessageSquare, Settings, Maximize2, Minimize2,
  RotateCcw, User, Clock, Send, X, AlertCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

interface VideoCallViewProps {
  bookingId: string;
  participantType: 'customer' | 'vendor';
  vendorName?: string;
  serviceName?: string;
  onEndCall?: () => void;
}

type CallStatus = 'idle' | 'connecting' | 'active' | 'reconnecting' | 'ended' | 'error';

interface ChatMessage {
  id: string;
  sender: 'customer' | 'vendor';
  message: string;
  timestamp: Date;
}

export function VideoCallView({ 
  bookingId, 
  participantType,
  vendorName = 'Service Provider',
  serviceName = 'Tele Consultation',
  onEndCall 
}: VideoCallViewProps) {
  // Call state
  const [status, setStatus] = useState<CallStatus>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Chat
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // WEBRTC CONFIG
  // ============================================================================
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
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
        }
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (err: any) {
      console.error('Error accessing media devices:', err);
      setError(`Camera/Microphone access denied. Please allow access and try again.`);
      throw err;
    }
  }, []);

  const stopLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, []);

  // ============================================================================
  // CALL FUNCTIONS
  // ============================================================================

  const initializeCall = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);
      
      // Start local media
      await startLocalMedia();
      
      // Create peer connection
      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = pc;
      
      // Add tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }
      
      // Handle remote stream
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };
      
      // Connection state
      pc.onconnectionstatechange = () => {
        switch (pc.connectionState) {
          case 'connected':
            setStatus('active');
            setIsConnected(true);
            break;
          case 'disconnected':
            setStatus('reconnecting');
            break;
          case 'failed':
            setError('Connection failed');
            setStatus('error');
            break;
        }
      };
      
      // Legacy/demo: real video uses ChimeVideoCall + POST /video-call/join (create-on-join).
      // POST /video-call/create requires { bookingId, customerId, vendorId } — not used here.
      // For demo, simulate connection
      setTimeout(() => {
        setStatus('active');
        setIsConnected(true);
      }, 2000);
      
      // Start timer
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
      setStatus('error');
    }
  }, [bookingId, participantType, startLocalMedia]);

  const endCall = useCallback(async () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    stopLocalMedia();
    
    try {
      await apiClient.post(`/video-call/${bookingId}/end`, {
        duration: callDuration
      });
    } catch (e) {
      console.log('End call notification failed');
    }
    
    setStatus('ended');
    setIsConnected(false);
    onEndCall?.();
  }, [bookingId, callDuration, stopLocalMedia, onEndCall]);

  // ============================================================================
  // UTILITIES
  // ============================================================================

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  const sendChatMessage = useCallback(() => {
    if (!newMessage.trim()) return;
    
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender: 'customer',
      message: newMessage.trim(),
      timestamp: new Date(),
    }]);
    setNewMessage('');
  }, [newMessage]);

  // ============================================================================
  // CLEANUP
  // ============================================================================

  useEffect(() => {
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      stopLocalMedia();
      if (peerConnectionRef.current) peerConnectionRef.current.close();
    };
  }, [stopLocalMedia]);

  // ============================================================================
  // RENDER
  // ============================================================================

  // LOADING/CONNECTING
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
        <p className="text-slate-400 text-sm">Setting up your video call with {vendorName}</p>
      </div>
    );
  }

  // ERROR
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
            <Button variant="outline" onClick={onEndCall}>
              Go Back
            </Button>
            <Button 
              onClick={() => {
                setStatus('idle');
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

  // IDLE - Start Call
  if (status === 'idle') {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 shadow-xl">
        <div className="text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-[#FF8C42] to-[#FF6B1A] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#FF8C42]/30">
            <Video className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Ready to Join</h2>
          <p className="text-slate-400 mb-6">{serviceName} with {vendorName}</p>
          
          <Button
            onClick={initializeCall}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-6 rounded-xl font-semibold text-lg shadow-lg shadow-green-500/30"
          >
            <Phone className="w-5 h-5 mr-2" />
            Join Call
          </Button>
          
          <p className="text-slate-500 text-xs mt-6">
            Camera and microphone access will be requested
          </p>
        </div>
      </div>
    );
  }

  // ENDED
  if (status === 'ended') {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <PhoneOff className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Call Ended</h2>
          <p className="text-gray-600 mb-1">Duration: {formatDuration(callDuration)}</p>
          <p className="text-gray-500 text-sm mb-6">Thank you for using Warmpawz</p>
          
          <Button
            onClick={onEndCall}
            className="bg-[#FF8C42] hover:bg-[#FF7A2E] px-6 py-3 rounded-xl"
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  // ACTIVE CALL
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
              <p className="text-white font-medium text-sm">{vendorName}</p>
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
            
            {/* Chat */}
            <button
              onClick={() => setShowChat(!showChat)}
              className={`p-2 rounded-full transition-colors ${
                showChat ? 'bg-[#FF8C42]' : 'bg-slate-800/80 backdrop-blur hover:bg-slate-700'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-white" />
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
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <User className="w-10 h-10 text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm">Waiting for {vendorName}...</p>
          </div>
        </div>

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
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isVideoOff ? 'bg-red-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
          
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isMuted ? 'bg-red-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          
          <button
            onClick={endCall}
            className="w-14 h-14 rounded-2xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
          
          <button className="w-12 h-12 rounded-2xl bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-lg flex flex-col">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-white font-semibold">Chat with {vendorName}</h3>
            <button onClick={() => setShowChat(false)} className="p-2 hover:bg-slate-700 rounded-xl">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No messages yet</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                    msg.sender === 'customer' 
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
          
          <div className="p-4 border-t border-slate-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-slate-700 text-white px-4 py-3 rounded-xl border-0 focus:ring-2 focus:ring-[#FF8C42]"
              />
              <button
                onClick={sendChatMessage}
                disabled={!newMessage.trim()}
                className="w-12 h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] disabled:opacity-50 text-white rounded-xl flex items-center justify-center"
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
