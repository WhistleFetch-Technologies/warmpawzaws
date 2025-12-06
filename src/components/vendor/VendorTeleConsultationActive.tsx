import { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Phone, 
  Volume2,
  MessageSquare,
  Share2,
  FlipHorizontal,
  StickyNote,
  Loader2
} from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface VendorTeleConsultationActiveProps {
  vendorData: any;
  appointmentData: {
    customerName: string;
    petName: string;
    petType: string;
    reason: string;
    customerVideo?: string;
  };
  onEndCall: () => void;
  onOpenNotes: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionStatus: string;
  duration?: number;
}

export function VendorTeleConsultationActive({ 
  vendorData, 
  appointmentData,
  onEndCall,
  onOpenNotes,
  localStream,
  remoteStream,
  connectionStatus,
  duration = 0
}: VendorTeleConsultationActiveProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor'>('good');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Handle streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <div className="w-full max-w-[430px] mx-auto bg-black min-h-screen relative">
        {/* Status Bar */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 safe-area-top">
          <span className="text-sm font-semibold text-white">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <div className="flex items-center gap-1">
            <div className="flex gap-0.5">
              <div className="w-1 h-3 bg-white"></div>
              <div className="w-1 h-3 bg-white"></div>
              <div className="w-1 h-3 bg-white"></div>
              <div className="w-1 h-3 bg-white opacity-30"></div>
            </div>
            <div className="w-6 h-3 bg-white rounded-sm"></div>
          </div>
        </div>

        {/* Main Video Area - Customer's Pet */}
        <div className="absolute inset-0 bg-gray-900">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 text-white">
               {connectionStatus === 'connecting' ? (
                  <>
                    <Loader2 className="w-12 h-12 animate-spin mb-4 text-blue-500" />
                    <p className="text-lg">Connecting to customer...</p>
                  </>
               ) : (
                  <>
                    <div className="text-6xl mb-4">🐕</div>
                    <p className="opacity-50">Waiting for video...</p>
                  </>
               )}
            </div>
          )}
        </div>

        {/* Top Header Card */}
        <div className="absolute top-14 left-4 right-4 z-40">
          <div className="bg-gray-800 bg-opacity-80 backdrop-blur-md rounded-2xl p-3 flex items-center justify-between border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-600 border-2 border-white/20">
                <ImageWithFallback 
                  src="/placeholder-avatar.jpg" 
                  alt={appointmentData.customerName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">
                  {appointmentData.customerName}
                </h3>
                <p className="text-white text-xs opacity-80 font-mono">{formatDuration(duration)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-2 py-1 rounded-md flex items-center gap-1 ${
                connectionQuality === 'good' ? 'bg-green-500' :
                connectionQuality === 'fair' ? 'bg-yellow-500' :
                'bg-red-500'
              }`}>
                <div className="flex gap-0.5">
                  <div className="w-0.5 h-2 bg-white"></div>
                  <div className="w-0.5 h-3 bg-white"></div>
                  <div className="w-0.5 h-4 bg-white"></div>
                </div>
                <span className="text-white text-xs font-medium capitalize">
                  {connectionQuality}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Vendor's Small Video (Picture-in-Picture) */}
        <div className="absolute top-32 right-4 z-40">
          <div className="w-28 h-36 bg-gray-800 rounded-2xl overflow-hidden shadow-lg border-2 border-white relative">
            {localStream ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-700">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
            )}
            
            {isVideoOff && (
               <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                 <VideoOff className="w-8 h-8 text-white" />
               </div>
            )}
            
            {/* "You" Badge */}
            <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              You
            </div>
          </div>
        </div>

        {/* Pet Info Overlay */}
        <div className="absolute bottom-48 left-4 right-4 z-40">
          <div className="bg-gray-800 bg-opacity-80 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-white">
                <span className="text-2xl">🐕</span>
              </div>
              <div>
                <h3 className="text-white font-semibold">
                  {appointmentData.petName}
                </h3>
                <p className="text-white text-sm opacity-80 truncate max-w-[120px]">
                  {appointmentData.petType} • {appointmentData.reason}
                </p>
              </div>
            </div>
            <button
              onClick={onOpenNotes}
              className="px-4 py-2 bg-blue-600 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg active:transform active:scale-95"
            >
              <StickyNote className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">Notes</span>
            </button>
          </div>
        </div>

        {/* Bottom Control Panel */}
        <div className="absolute bottom-0 left-0 right-0 z-50 safe-area-bottom">
          <div className="max-w-[430px] mx-auto">
            <div className="bg-white rounded-t-3xl pt-6 pb-8 px-6 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
              {/* Main Controls */}
              <div className="flex items-center justify-center gap-6 mb-6">
                {/* Microphone */}
                <button
                  onClick={toggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors shadow-sm ${
                    isMuted ? 'bg-red-100' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {isMuted ? (
                    <MicOff className="w-6 h-6 text-red-500" />
                  ) : (
                    <Mic className="w-6 h-6 text-gray-700" />
                  )}
                </button>

                {/* End Call */}
                <button
                  onClick={onEndCall}
                  className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg active:transform active:scale-95"
                >
                  <Phone className="w-7 h-7 text-white transform rotate-135" />
                </button>

                {/* Video */}
                <button
                  onClick={toggleVideo}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors shadow-sm ${
                    isVideoOff ? 'bg-red-100' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {isVideoOff ? (
                    <VideoOff className="w-6 h-6 text-red-500" />
                  ) : (
                    <Video className="w-6 h-6 text-gray-700" />
                  )}
                </button>
              </div>

              {/* Secondary Controls */}
              <div className="flex items-center justify-around border-t border-gray-200 pt-4">
                {/* Flip Camera */}
                <button className="flex flex-col items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
                    <FlipHorizontal className="w-5 h-5 text-gray-700" />
                  </div>
                  <span className="text-[10px] text-gray-600 font-medium">Flip</span>
                </button>

                {/* Speaker */}
                <button className="flex flex-col items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
                    <Volume2 className="w-5 h-5 text-gray-700" />
                  </div>
                  <span className="text-[10px] text-gray-600 font-medium">Speaker</span>
                </button>

                {/* Chat */}
                <button className="flex flex-col items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-gray-700" />
                  </div>
                  <span className="text-[10px] text-gray-600 font-medium">Chat</span>
                </button>

                {/* Share */}
                <button className="flex flex-col items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-gray-700" />
                  </div>
                  <span className="text-[10px] text-gray-600 font-medium">Share</span>
                </button>
              </div>

              {/* Home Indicator */}
              <div className="h-1 w-32 bg-gray-300 rounded-full mx-auto mt-6"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
