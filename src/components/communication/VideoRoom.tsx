import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Users, Settings, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface VideoRoomProps {
  channelId: string;
  userName: string;
  userType: 'customer' | 'vendor';
  onEndCall: () => void;
  onToggleChat: () => void;
}

export function VideoRoom({ channelId, userName, userType, onEndCall, onToggleChat }: VideoRoomProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<any[]>([
    { id: 'me', name: userName, isMuted: false, isVideoOff: false }
  ]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Simulate connection to AWS Chime / WebRTC
    const timer = setTimeout(() => {
      console.log('AWS Chime: Creating meeting session...');
      setConnectionStatus('connected');
      // Simulate other participant joining
      setTimeout(() => {
        console.log('AWS Chime: Attendee joined', userType === 'customer' ? 'Dr. Sarah Wilson' : 'John Doe');
        setParticipants(prev => [
          ...prev,
          { 
            id: 'other', 
            name: userType === 'customer' ? 'Dr. Sarah Wilson' : 'John Doe', 
            isMuted: false, 
            isVideoOff: false 
          }
        ]);
        toast.info(`${userType === 'customer' ? 'Dr. Sarah Wilson' : 'John Doe'} joined the call`);
      }, 2000);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (videoRef.current && !isVideoOff) {
      // Request camera access
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error('Error accessing media devices:', err);
          toast.error('Could not access camera/microphone');
        });
    } else if (videoRef.current) {
      // Stop tracks
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }
  }, [isVideoOff]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // In real app, would toggle audio track
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
  };

  const toggleScreenShare = () => {
    setIsScreenSharing(!isScreenSharing);
    toast.info(isScreenSharing ? 'Stopped screen sharing' : 'Started screen sharing');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 relative overflow-hidden rounded-xl">
      {/* Main Video Area */}
      <div className="flex-1 relative p-4 flex items-center justify-center">
        {connectionStatus === 'connecting' && (
          <div className="text-white flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p>Connecting to secure room...</p>
          </div>
        )}

        {connectionStatus === 'connected' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl h-full">
            {/* Remote Video */}
            <div className="bg-slate-800 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-700">
              {participants.find(p => p.id === 'other') ? (
                <img 
                  src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400&h=400" 
                  alt="Remote User" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-slate-400 flex flex-col items-center">
                  <div className="animate-pulse bg-slate-700 rounded-full h-20 w-20 mb-4"></div>
                  <p>Waiting for other participant...</p>
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
                {userType === 'customer' ? 'Dr. Sarah Wilson' : 'John Doe'}
              </div>
            </div>

            {/* Local Video */}
            <div className="bg-slate-800 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-700">
              {!isVideoOff ? (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  className="w-full h-full object-cover" 
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-slate-800">
                  <div className="h-24 w-24 rounded-full bg-slate-700 flex items-center justify-center">
                    <span className="text-2xl text-white">{userName.charAt(0)}</span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full text-white text-sm flex items-center gap-2">
                You {isMuted && <MicOff className="w-3 h-3 text-red-400" />}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="bg-slate-800 p-4 flex items-center justify-center gap-4 z-10">
        <Button 
          variant={isMuted ? "destructive" : "secondary"} 
          size="icon" 
          className="rounded-full h-12 w-12"
          onClick={toggleMute}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>
        
        <Button 
          variant={isVideoOff ? "destructive" : "secondary"} 
          size="icon" 
          className="rounded-full h-12 w-12"
          onClick={toggleVideo}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </Button>

        <Button 
          variant="destructive" 
          size="icon" 
          className="rounded-full h-14 w-14 mx-4 hover:bg-red-700"
          onClick={onEndCall}
        >
          <PhoneOff className="w-6 h-6" />
        </Button>

        <Button 
          variant={isScreenSharing ? "default" : "secondary"} 
          size="icon" 
          className="rounded-full h-12 w-12"
          onClick={toggleScreenShare}
        >
          <Share2 className="w-5 h-5" />
        </Button>

        <Button 
          variant="secondary" 
          size="icon" 
          className="rounded-full h-12 w-12 relative"
          onClick={onToggleChat}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-slate-800"></span>
        </Button>
      </div>
    </div>
  );
}