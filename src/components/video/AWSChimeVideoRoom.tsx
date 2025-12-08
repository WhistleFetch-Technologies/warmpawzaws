/**
 * AWS Chime Video Consultation Room
 * Complete video + chat integration for tele-health services
 * 
 * Used by:
 * - Veterinarian (tele consultations)
 * - Pet Behaviorist (tele sessions)
 * - Pet Nutritionist (diet consultations)
 * - Pet Insurance (video claims)
 * - Pet Holiday (planning calls)
 * 
 * Features:
 * - Real-time video & audio
 * - In-call chat messaging
 * - Screen sharing
 * - Recording (if enabled)
 * - Connection quality indicators
 */

import { useState, useEffect } from 'react';
import { 
  Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff, 
  MessageCircle, X, Send, Clock, Users 
} from 'lucide-react';
import { useAWSChimeVideo } from '../../hooks/useAWSChimeVideo';
import { useAWSChimeChat } from '../../hooks/useAWSChimeChat';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

interface AWSChimeVideoRoomProps {
  consultationId: string;
  userId: string;
  userName: string;
  userType: 'customer' | 'vendor';
  onCallEnd?: () => void;
}

export function AWSChimeVideoRoom({
  consultationId,
  userId,
  userName,
  userType,
  onCallEnd
}: AWSChimeVideoRoomProps) {
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [callDuration, setCallDuration] = useState(0);

  // AWS Chime Video Hook
  const {
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
  } = useAWSChimeVideo({
    consultationId,
    userId,
    userType,
    onError: (error) => {
      console.error('Chime error:', error);
      alert('Video connection error. Please try again.');
    },
    onMeetingStart: () => {
      console.log('✅ Meeting started');
      // Start duration timer
      const startTime = Date.now();
      const timer = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    },
    onMeetingEnd: () => {
      console.log('📴 Meeting ended');
      onCallEnd?.();
    }
  });

  // AWS Chime Chat Hook
  const {
    messages,
    loading: chatLoading,
    remoteTyping,
    sendMessage,
    sendTypingIndicator
  } = useAWSChimeChat({
    consultationId,
    userId,
    userName,
    userType
  });

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;
    
    await sendMessage(chatMessage);
    setChatMessage('');
    sendTypingIndicator(false);
  };

  // Handle typing
  const handleTyping = (value: string) => {
    setChatMessage(value);
    if (value.length > 0) {
      sendTypingIndicator(true);
    } else {
      sendTypingIndicator(false);
    }
  };

  // Handle end call
  const handleEndCall = async () => {
    if (confirm('Are you sure you want to end this consultation?')) {
      await endCall();
      onCallEnd?.();
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
          {isConnected && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-mono">{formatDuration(callDuration)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span className="text-sm">{attendees.length + 1} participants</span>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative bg-gray-900">
        {/* Remote Video (Main) */}
        <div className="absolute inset-0">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p>Connecting to consultation...</p>
              </div>
            </div>
          )}
        </div>

        {/* Local Video (PiP) */}
        <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <VideoOff className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Screen Share View */}
        {isScreenSharing && (
          <div className="absolute top-4 left-4 w-64 h-48 bg-gray-800 rounded-lg overflow-hidden shadow-lg">
            <video
              ref={screenShareRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
            <div className="absolute top-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-xs text-white">
              Screen Share
            </div>
          </div>
        )}

        {/* Chat Panel */}
        {showChat && (
          <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-xl flex flex-col">
            {/* Chat Header */}
            <div className="bg-[#FF8C42] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                <span className="font-semibold">Chat</span>
              </div>
              <button onClick={() => setShowChat(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === userType ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs rounded-lg p-3 ${
                      msg.senderType === userType
                        ? 'bg-[#FF8C42] text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-xs font-semibold mb-1">{msg.senderName}</p>
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {remoteTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => handleTyping(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                />
                <Button
                  onClick={handleSendMessage}
                  className="bg-[#FF8C42] hover:bg-[#ff7a28]"
                  disabled={!chatMessage.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900 p-6 flex items-center justify-center gap-4">
        {/* Video Toggle */}
        <Button
          onClick={toggleVideo}
          className={`rounded-full w-14 h-14 ${
            isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </Button>

        {/* Audio Toggle */}
        <Button
          onClick={toggleAudio}
          className={`rounded-full w-14 h-14 ${
            isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </Button>

        {/* Screen Share Toggle */}
        <Button
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          className={`rounded-full w-14 h-14 ${
            isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
        </Button>

        {/* Chat Toggle */}
        <Button
          onClick={() => setShowChat(!showChat)}
          className={`rounded-full w-14 h-14 relative ${
            showChat ? 'bg-[#FF8C42] hover:bg-[#ff7a28]' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          <MessageCircle className="w-6 h-6" />
          {messages.length > 0 && !showChat && (
            <div className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
              {messages.filter(m => m.senderType !== userType && !m.read).length || ''}
            </div>
          )}
        </Button>

        {/* End Call */}
        <Button
          onClick={handleEndCall}
          className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700 ml-4"
        >
          <PhoneOff className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
