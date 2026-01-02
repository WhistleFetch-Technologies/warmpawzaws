import { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Monitor, MonitorOff, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';
import { useVideoCall } from '../../hooks/useVideoCall';

interface VideoCallInterfaceProps {
  bookingId: string;
  customerPhone: string;
  customerName: string;
  vendorName: string;
  petName: string;
  scheduledDate: string;
  scheduledTime: string;
  isInstantConsultation: boolean;
  onClose: () => void;
}

export function VideoCallInterface({
  bookingId,
  customerPhone,
  customerName,
  vendorName,
  petName,
  scheduledDate,
  scheduledTime,
  isInstantConsultation,
  onClose
}: VideoCallInterfaceProps) {
  const [eligibilityStatus, setEligibilityStatus] = useState<'checking' | 'waiting' | 'eligible' | 'expired'>('checking');
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [canJoin, setCanJoin] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const durationIntervalRef = useRef<any>(null);

  const {
    localStream,
    remoteStream,
    connectionStatus,
    error,
    startCall,
    endCall: hookEndCall
  } = useVideoCall({
    bookingId,
    participantType: 'customer',
    customerName,
    customerPhone
  });

  useEffect(() => {
    checkCallEligibility();
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      hookEndCall();
    };
  }, []);

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

  // Handle connection status for duration timer
  useEffect(() => {
    if (connectionStatus === 'connected') {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      toast.success('Connected to video call');
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    }
    
    if (connectionStatus === 'failed') {
      toast.error('Connection failed: ' + (error || 'Unknown error'));
    }
    
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [connectionStatus, error]);

  const checkCallEligibility = async () => {
    try {
      // For instant consultations, allow immediately after payment
      if (isInstantConsultation) {
        setCanJoin(true);
        setEligibilityStatus('eligible');
        startCall();
        return;
      }

      // For scheduled consultations, check if it's within the allowed time window
      const scheduledDateTime = new Date(`${scheduledDate} ${scheduledTime}`);
      const now = new Date();
      
      // Allow joining 5 minutes before scheduled time
      const allowedStartTime = new Date(scheduledDateTime.getTime() - 5 * 60 * 1000);
      
      // Allow joining up to 30 minutes after scheduled time
      const allowedEndTime = new Date(scheduledDateTime.getTime() + 30 * 60 * 1000);

      if (now < allowedStartTime) {
        const minutesUntil = Math.ceil((allowedStartTime.getTime() - now.getTime()) / (1000 * 60));
        setCanJoin(false);
        setEligibilityStatus('waiting');
        toast.info(`Call will be available in ${minutesUntil} minutes`);
        
        // Set timer to enable call when time arrives
        const timeout = setTimeout(() => {
          setCanJoin(true);
          setEligibilityStatus('eligible');
          startCall();
        }, allowedStartTime.getTime() - now.getTime());
        
        return () => clearTimeout(timeout);
      } else if (now > allowedEndTime) {
        setCanJoin(false);
        setEligibilityStatus('expired');
        toast.error('Call window has expired');
        return;
      } else {
        setCanJoin(true);
        setEligibilityStatus('eligible');
        startCall();
      }
    } catch (error) {
      console.error('❌ [VIDEO-CALL] Error checking eligibility:', error);
      toast.error('Failed to check call eligibility');
      setEligibilityStatus('expired');
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const handleEndCall = async () => {
    hookEndCall();
    onClose();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Display logic based on combined state
  const displayStatus = eligibilityStatus === 'eligible' ? connectionStatus : eligibilityStatus;

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center">
      <div className="w-full max-w-[430px] h-screen flex flex-col bg-gray-900">
        {/* Header */}
        <div className="p-4 bg-gray-800">
          <div className="flex items-center justify-between text-white">
            <div>
              <h2 className="font-bold">{vendorName}</h2>
              <p className="text-sm text-gray-400">Consultation for {petName}</p>
            </div>
            <button
              onClick={handleEndCall}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {connectionStatus === 'connected' && (
            <div className="mt-2 text-center text-white font-mono text-sm">
              {formatDuration(callDuration)}
            </div>
          )}
        </div>

        {/* Video Area */}
        <div className="flex-1 relative bg-black">
          {/* Remote Video (Vendor) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Local Video (Customer - Picture in Picture) */}
          <div className="absolute top-4 right-4 w-32 h-40 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
            {!videoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                <VideoOff className="w-8 h-8 text-white" />
              </div>
            )}
          </div>

          {/* Status Overlays */}
          {displayStatus === 'checking' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white">
                <Loader2 className="animate-spin h-12 w-12 mx-auto mb-4 text-[#FF8C42]" />
                <p>Checking call availability...</p>
              </div>
            </div>
          )}

          {displayStatus === 'waiting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white">
                <div className="text-6xl mb-4">⏰</div>
                <p className="text-lg mb-2">Call scheduled for</p>
                <p className="text-2xl font-bold">{scheduledDate} at {scheduledTime}</p>
                <p className="text-sm text-gray-400 mt-4">You can join 5 minutes before the scheduled time</p>
              </div>
            </div>
          )}
          
          {displayStatus === 'expired' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white">
                <div className="text-6xl mb-4">⚠️</div>
                <p className="text-lg mb-2">Call window expired</p>
                <Button onClick={onClose} className="mt-4 bg-[#FF8C42]">Close</Button>
              </div>
            </div>
          )}

          {(displayStatus === 'connecting' || connectionStatus === 'connecting') && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white">
                <div className="animate-pulse text-6xl mb-4">📞</div>
                <p className="text-lg">Connecting to {vendorName}...</p>
                <p className="text-sm text-gray-400 mt-2">Waiting for doctor to join...</p>
              </div>
            </div>
          )}
          
          {!remoteStream && connectionStatus === 'connected' && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-0">
               <div className="text-center text-white">
                 <Loader2 className="animate-spin h-12 w-12 mx-auto mb-4 text-blue-500" />
                 <p className="text-lg">Waiting for video...</p>
               </div>
             </div>
          )}
        </div>

        {/* Controls */}
        {connectionStatus === 'connected' && (
          <div className="p-6 bg-gray-800">
            <div className="flex items-center justify-center gap-4">
              {/* Mute */}
              <button
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  muted ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
              >
                {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              {/* End Call */}
              <button
                onClick={handleEndCall}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg"
              >
                <PhoneOff className="w-7 h-7 text-white" />
              </button>

              {/* Video Toggle */}
              <button
                onClick={toggleVideo}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  !videoEnabled ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
              >
                {videoEnabled ? <VideoIcon className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </button>
            </div>
          </div>
        )}
        
        {/* Cancel/Back button when not connected */}
        {connectionStatus !== 'connected' && (
           <div className="p-6 bg-gray-800 flex justify-center">
              <Button variant="destructive" onClick={handleEndCall} className="rounded-full w-16 h-16 p-0 flex items-center justify-center">
                 <X className="w-8 h-8" />
              </Button>
           </div>
        )}
      </div>
    </div>
  );
}
