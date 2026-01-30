"use client";

import { useState, useEffect, useRef } from 'react';
import { X, Send, Phone, Video, MessageCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Message {
  id: string;
  senderId: string;
  senderType: 'customer' | 'vendor';
  content: string;
  timestamp: string;
  isRead: boolean;
}

interface CommunicationHubProps {
  mode?: 'video' | 'chat';
  bookingId: string;
  userId?: string;
  userName?: string;
  otherUserName?: string;
  userType?: string;
  onClose?: () => void;
  onStartVideoCall?: (bookingId: string) => void; // ✅ P2P Video Call from chat
  serviceStyle?: string; // ✅ To show video call button only for tele consultations
}

export function CommunicationHub({ mode, bookingId, userId, userName, otherUserName, userType, onClose, onStartVideoCall, serviceStyle }: CommunicationHubProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    // Poll for new messages every 5 seconds
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [bookingId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const response = await apiClient.get(`/chat/${bookingId}/messages`) as any;
      if (response.success && response.messages) {
        setMessages(response.messages);
      }
    } catch (error) {
      console.log('Chat not available for this booking');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const response = await apiClient.post(`/chat/${bookingId}/send`, {
        message: newMessage.trim(),
        senderType: userType || 'vendor',
        senderId: userId,
      }) as any;

      if (response.success) {
        setNewMessage('');
        loadMessages();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Video call state
  const [videoCallState, setVideoCallState] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize local video when in video mode
  useEffect(() => {
    if (mode === 'video') {
      initializeLocalVideo();
    }
    return () => {
      // Cleanup video stream on unmount
      if (localVideoRef.current?.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mode]);

  const initializeLocalVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      // Simulate connection after 2 seconds
      setTimeout(() => setVideoCallState('connected'), 2000);
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const toggleMute = () => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getVideoTracks().forEach(track => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = () => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setVideoCallState('ended');
    onClose?.();
  };

  if (mode === 'video') {
    return (
      <div className="fixed inset-0 bg-black z-[60] flex flex-col">
        {/* Remote Video (placeholder - would be peer video in real WebRTC) */}
        <div className="flex-1 relative bg-gradient-to-br from-gray-800 to-gray-900">
          <div className="absolute inset-0 flex items-center justify-center">
            {videoCallState === 'connecting' ? (
              <div className="text-center text-white">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <span className="text-4xl font-bold">{(otherUserName || 'C')[0].toUpperCase()}</span>
                </div>
                <p className="text-xl font-medium mb-2">Calling {otherUserName}...</p>
                <p className="text-gray-400 text-sm">Ringing...</p>
              </div>
            ) : (
              <div className="text-center text-white">
                <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-5xl font-bold">{(otherUserName || 'C')[0].toUpperCase()}</span>
                </div>
                <p className="text-xl font-medium mb-1">{otherUserName || 'Customer'}</p>
                <p className="text-green-400 text-sm">Connected</p>
              </div>
            )}
          </div>

          {/* Local Video (Picture-in-Picture) */}
          <div className="absolute bottom-4 right-4 w-32 h-44 bg-gray-700 rounded-xl overflow-hidden shadow-lg">
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline
              className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
            />
            {isVideoOff && (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">{userName?.[0] || 'V'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Call Duration */}
          {videoCallState === 'connected' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full">
              <p className="text-white text-sm font-medium">00:00</p>
            </div>
          )}
        </div>

        {/* Call Controls */}
        <div className="bg-gray-900 p-6">
          <div className="flex items-center justify-center gap-6">
            <button 
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              {isMuted ? (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            
            <button 
              onClick={toggleVideo}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isVideoOff ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              {isVideoOff ? (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
              ) : (
                <Video className="w-6 h-6 text-white" />
              )}
            </button>
            
            <button 
              onClick={endCall}
              className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
            >
              <Phone className="w-7 h-7 text-white transform rotate-135" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B1A] text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold">{otherUserName || 'Customer'}</h3>
            <p className="text-xs text-white/80">Booking #{bookingId.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* ✅ P2P VIDEO CALL: Start video call button for tele consultations */}
          {(serviceStyle === 'tele' || serviceStyle === 'online') && onStartVideoCall && (
            <button 
              onClick={() => onStartVideoCall(bookingId)}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-green-500 transition-colors"
              title="Start Video Call"
            >
              <Video className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 bg-gray-100 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-3 border-[#FF8C42] border-t-transparent rounded-full"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className={`flex ${msg.senderType === (userType || 'vendor') ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] p-3 rounded-2xl ${
                    msg.senderType === (userType || 'vendor')
                      ? 'bg-[#FF8C42] text-white rounded-br-md'
                      : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <p className={`text-xs mt-1 ${
                    msg.senderType === (userType || 'vendor') ? 'text-white/70' : 'text-gray-400'
                  }`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="w-12 h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white rounded-full flex items-center justify-center disabled:opacity-50 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
