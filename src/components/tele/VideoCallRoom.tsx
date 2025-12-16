import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  MessageSquare, 
  Send, 
  Maximize2, 
  Minimize2,
  Settings,
  MoreVertical,
  User
} from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface Message {
  id: string;
  senderId: string;
  senderType: 'customer' | 'staff';
  message: string;
  timestamp: string;
}

interface VideoCallRoomProps {
  sessionId: string;
  token: string; // Or bookingId acting as token for simulation
  staffName: string;
  staffPhoto?: string;
  userName: string;
  onEndCall: () => void;
}

export function VideoCallRoom({
  sessionId,
  token,
  staffName,
  staffPhoto,
  userName,
  onEndCall
}: VideoCallRoomProps) {
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('connecting');

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Simulate connection
  useEffect(() => {
    const timer = setTimeout(() => {
      setConnectionStatus('connected');
      toast.success('Connected to secure line');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (connectionStatus === 'connected') {
        setDuration(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  // Poll for messages (simulation)
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${BASE_URL}/tele-session/${sessionId}/chat`,
          {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );
        if (response.ok) {
          const data = await response.json();
          if (data.messages) {
            setMessages(data.messages);
          }
        }
      } catch (error) {
        console.error('Chat polling error:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId, connectionStatus]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, showChat]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim()) return;

    // Optimistic update
    const tempMsg: Message = {
      id: Date.now().toString(),
      senderId: 'current-user', // In real app, use actual ID
      senderType: 'customer',
      message: newMessage,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setNewMessage('');

    try {
      await fetch(
        `${BASE_URL}/tele-session/${sessionId}/chat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            senderId: 'current-user', // Mock
            senderType: 'customer',
            message: tempMsg.message
          })
        }
      );
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Failed to send message');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={videoContainerRef}
      className={`relative bg-gray-900 overflow-hidden ${isFullscreen ? 'h-screen w-screen' : 'h-[600px] w-full rounded-2xl shadow-2xl'}`}
    >
      {/* Main Video Area (Remote) */}
      <div className="absolute inset-0 flex items-center justify-center">
        {connectionStatus === 'connecting' && (
          <div className="text-center text-white">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium">Connecting to Dr. {staffName}...</p>
          </div>
        )}
        
        {connectionStatus === 'connected' && (
          <div className="relative w-full h-full bg-gray-800">
            {/* Simulation of remote video - usually this would be a <video> element */}
            <div className="absolute inset-0 flex items-center justify-center text-gray-600">
              {staffPhoto ? (
                <img src={staffPhoto} alt={staffName} className="w-full h-full object-cover opacity-80" />
              ) : (
                <div className="flex flex-col items-center">
                  <User className="w-32 h-32 text-gray-500 mb-4" />
                  <p className="text-white text-xl">{staffName}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Self View (PIP) */}
      <div className="absolute top-4 right-4 w-48 h-36 bg-black rounded-xl border border-gray-700 shadow-lg overflow-hidden z-20">
        {videoOn ? (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
             {/* Local video placeholder */}
             <div className="text-white text-xs">You</div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <VideoOff className="w-8 h-8 text-gray-500" />
          </div>
        )}
        <div className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-0.5 rounded">
          {userName}
        </div>
      </div>

      {/* Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent z-30">
        <div className="flex items-center justify-between">
          {/* Duration & Status */}
          <div className="flex items-center gap-4 text-white">
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-800/50 rounded-full backdrop-blur-sm">
              <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              <span className="text-sm font-medium">{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMicOn(!micOn)}
              className={`p-4 rounded-full transition-colors ${micOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
            >
              {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </button>
            
            <button
              onClick={() => setVideoOn(!videoOn)}
              className={`p-4 rounded-full transition-colors ${videoOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
            >
              {videoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>

            <button
              onClick={onEndCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>

          {/* Secondary Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChat(!showChat)}
              className={`p-3 rounded-full transition-colors ${showChat ? 'bg-orange-600 text-white' : 'bg-gray-700/50 text-white hover:bg-gray-700'}`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-3 rounded-full bg-gray-700/50 text-white hover:bg-gray-700 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Chat Sidebar */}
      {showChat && (
        <div className="absolute top-0 right-0 bottom-16 w-80 bg-black/80 backdrop-blur-md border-l border-white/10 flex flex-col z-20 animate-in slide-in-from-right">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-white font-medium">Chat</h3>
            <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-white">
              <Settings className="w-4 h-4" />
            </button>
          </div>

          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.map((msg) => {
              const isMe = msg.senderType === 'customer';
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    isMe 
                      ? 'bg-orange-600 text-white rounded-br-none' 
                      : 'bg-gray-700 text-white rounded-bl-none'
                  }`}>
                    <p className="text-sm">{msg.message}</p>
                    <span className="text-[10px] opacity-70 mt-1 block">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10">
            <div className="relative">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-gray-800 text-white rounded-full pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 border border-transparent"
              />
              <button 
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-orange-600 text-white rounded-full hover:bg-orange-700"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
