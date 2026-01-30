import { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff, MessageSquare, User, Clock, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface TeleConsultationCallProps {
  bookingId: string;
  teleSessionId: string;
  staffName: string;
  staffPhoto?: string;
  customerId: string;
  onEndCall: () => void;
}

export function TeleConsultationCall({
  bookingId,
  teleSessionId,
  staffName,
  staffPhoto,
  customerId,
  onEndCall
}: TeleConsultationCallProps) {
  const [callStatus, setCallStatus] = useState<'ringing' | 'active' | 'ended'>('ringing');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [duration, setDuration] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const durationIntervalRef = useRef<any>(null);
  const heartbeatIntervalRef = useRef<any>(null);

  useEffect(() => {
    // Initialize call
    initializeCall();
    
    // Poll for call status
    const statusInterval = setInterval(checkCallStatus, 2000);
    
    return () => {
      clearInterval(statusInterval);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      stopLocalStream();
    };
  }, []);

  useEffect(() => {
    if (callStatus === 'active') {
      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      // Start heartbeat
      heartbeatIntervalRef.current = setInterval(sendHeartbeat, 30000); // Every 30s
      
      // Initialize local media stream
      initializeLocalStream();
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }
  }, [callStatus]);

  const initializeCall = async () => {
    console.log('📱 [TELE] Initializing call...');
    // In a real implementation, this would connect to WebRTC signaling server
    // For now, we just poll the backend for status
  };

  const checkCallStatus = async () => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/tele-session/${teleSessionId}`,
        {
          headers: {
            Authorization: (getAuthHeaders().Authorization || ""),
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          setCallStatus(data.session.callStatus);
          
          if (data.session.messages) {
            setChatMessages(data.session.messages);
          }
        }
      }
    } catch (error) {
      console.error('❌ [TELE] Error checking call status:', error);
    }
  };

  const initializeLocalStream = async () => {
    try {
      console.log('🎥 [TELE] Requesting media permissions...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled,
        audio: audioEnabled
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      console.log('✅ [TELE] Local stream initialized');
      
      // In a real implementation, this stream would be sent via WebRTC
      // to the remote peer (the staff member)
      
    } catch (error) {
      console.error('❌ [TELE] Error accessing media devices:', error);
      alert('Unable to access camera/microphone. Please check permissions.');
    }
  };

  const stopLocalStream = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const toggleVideo = () => {
    setVideoEnabled(!videoEnabled);
    
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
      }
    }
  };

  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
    
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
      }
    }
  };

  const endCall = async () => {
    try {
      console.log('📱 [TELE] Ending call...');
      
      const response = await fetch(
        `${getApiBaseUrl()}/tele-session/${teleSessionId}/end`,
        {
          method: 'POST',
          headers: {
            Authorization: (getAuthHeaders().Authorization || ""),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endedBy: 'customer'
          }),
        }
      );

      if (response.ok) {
        setCallStatus('ended');
        stopLocalStream();
        onEndCall();
      }
    } catch (error) {
      console.error('❌ [TELE] Error ending call:', error);
    }
  };

  const sendHeartbeat = async () => {
    try {
      await fetch(
        `${getApiBaseUrl()}/tele-session/${teleSessionId}/heartbeat`,
        {
          method: 'PUT',
          headers: {
            Authorization: (getAuthHeaders().Authorization || ""),
          },
        }
      );
    } catch (error) {
      console.error('❌ [TELE] Heartbeat error:', error);
    }
  };

  const sendChatMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/tele-session/${teleSessionId}/chat`,
        {
          method: 'POST',
          headers: {
            Authorization: (getAuthHeaders().Authorization || ""),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            senderId: customerId,
            senderType: 'customer',
            message: newMessage
          }),
        }
      );

      if (response.ok) {
        setNewMessage('');
        checkCallStatus(); // Refresh messages
      }
    } catch (error) {
      console.error('❌ [TELE] Error sending message:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (callStatus === 'ringing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] max-w-[430px] mx-auto flex items-center justify-center p-6">
        <Card className="w-full p-8 text-center bg-white/95 backdrop-blur">
          {staffPhoto ? (
            <img 
              src={staffPhoto}
              alt={staffName}
              className="w-24 h-24 rounded-full object-cover mx-auto mb-4 ring-4 ring-white"
            />
          ) : (
            <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-full mx-auto mb-4 flex items-center justify-center ring-4 ring-white">
              <User className="w-12 h-12 text-white" />
            </div>
          )}
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Calling {staffName}...</h2>
          <p className="text-gray-600 mb-6">Waiting for the provider to answer</p>
          
          <div className="flex justify-center mb-6">
            <div className="animate-pulse flex space-x-2">
              <div className="w-3 h-3 bg-[#FF8C42] rounded-full"></div>
              <div className="w-3 h-3 bg-[#FF8C42] rounded-full animation-delay-200"></div>
              <div className="w-3 h-3 bg-[#FF8C42] rounded-full animation-delay-400"></div>
            </div>
          </div>
          
          <Button
            onClick={endCall}
            className="bg-red-500 hover:bg-red-600 text-white w-16 h-16 rounded-full"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'min-h-screen'} bg-gray-900 max-w-[430px] mx-auto flex flex-col`}>
      {/* Remote Video (Staff) */}
      <div className="flex-1 relative bg-gray-800">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Placeholder if no remote video */}
        {!remoteVideoRef.current?.srcObject && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
            {staffPhoto ? (
              <img 
                src={staffPhoto}
                alt={staffName}
                className="w-32 h-32 rounded-full object-cover ring-4 ring-white/20"
              />
            ) : (
              <div className="w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center ring-4 ring-white/20">
                <User className="w-16 h-16 text-white" />
              </div>
            )}
          </div>
        )}
        
        {/* Staff Name & Duration Overlay */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full">
            <p className="text-white text-sm font-medium">{staffName}</p>
          </div>
          
          <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-mono">{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          {isFullscreen ? (
            <Minimize2 className="w-5 h-5 text-white" />
          ) : (
            <Maximize2 className="w-5 h-5 text-white" />
          )}
        </button>

        {/* Local Video (Customer) - Picture in Picture */}
        <div className="absolute bottom-4 right-4 w-32 h-48 rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {!videoEnabled && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-900 p-6">
        <div className="flex items-center justify-center gap-4">
          {/* Video Toggle */}
          <button
            onClick={toggleVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              videoEnabled 
                ? 'bg-gray-700 hover:bg-gray-600' 
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {videoEnabled ? (
              <Video className="w-6 h-6 text-white" />
            ) : (
              <VideoOff className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Audio Toggle */}
          <button
            onClick={toggleAudio}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              audioEnabled 
                ? 'bg-gray-700 hover:bg-gray-600' 
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {audioEnabled ? (
              <Mic className="w-6 h-6 text-white" />
            ) : (
              <MicOff className="w-6 h-6 text-white" />
            )}
          </button>

          {/* End Call */}
          <button
            onClick={endCall}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>

          {/* Chat Toggle */}
          <button
            onClick={() => setShowChat(!showChat)}
            className="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center relative"
          >
            <MessageSquare className="w-6 h-6 text-white" />
            {chatMessages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF8C42] rounded-full text-white text-xs flex items-center justify-center">
                {chatMessages.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Chat Sidebar */}
      {showChat && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl flex flex-col max-w-[430px]">
          <div className="bg-[#FF8C42] px-4 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold">Chat</h3>
            <button onClick={() => setShowChat(false)}>
              <MessageSquare className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderType === 'customer' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    msg.senderType === 'customer'
                      ? 'bg-[#FF8C42] text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              />
              <Button
                onClick={sendChatMessage}
                className="bg-[#FF8C42] hover:bg-[#ff7a28] rounded-full"
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
