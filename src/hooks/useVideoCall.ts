import { useState, useEffect, useRef, useCallback } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface UseVideoCallProps {
  bookingId: string;
  participantType: 'customer' | 'vendor';
  customerName?: string;
  customerPhone?: string;
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed';

export function useVideoCall({ bookingId, participantType, customerName, customerPhone }: UseVideoCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const pollingInterval = useRef<any>(null);
  
  // ICE Servers configuration
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  // Initialize Peer Connection
  const initializePeerConnection = useCallback(() => {
    if (peerConnection.current) return peerConnection.current;
    
    console.log('Creating RTCPeerConnection');
    const pc = new RTCPeerConnection(rtcConfig);
    
    pc.onicecandidate = async (event) => {
      if (event.candidate && roomId) {
        try {
          await fetch(`${API_BASE}/video/signal/ice-candidate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify({
              roomId,
              candidate: event.candidate,
              participantType
            })
          });
        } catch (err) {
          console.error('Error sending ICE candidate:', err);
        }
      }
    };

    pc.ontrack = (event) => {
      console.log('Remote track received');
      setRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      switch (pc.connectionState) {
        case 'connected':
          setConnectionStatus('connected');
          break;
        case 'disconnected':
        case 'failed':
        case 'closed':
          setConnectionStatus('disconnected');
          break;
        default:
          setConnectionStatus('connecting');
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [roomId, participantType]);

  // Start/Join Call
  const startCall = useCallback(async () => {
    setConnectionStatus('connecting');
    setError(null);

    try {
      // 1. Get User Media
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);

      // 2. Join/Create Room
      const roomRes = await fetch(`${API_BASE}/video/room/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          bookingId,
          customerName,
          customerPhone,
          participantType
        })
      });
      
      const roomData = await roomRes.json();
      if (!roomData.success) throw new Error(roomData.error || 'Failed to create room');
      
      const currentRoomId = roomData.roomId;
      setRoomId(currentRoomId);

      // 3. Initialize PC and Add Tracks
      const pc = initializePeerConnection();
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // 4. Signaling Logic
      if (participantType === 'customer') {
        // Caller: Create Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        await fetch(`${API_BASE}/video/signal/offer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            roomId: currentRoomId,
            offer,
            participantType
          })
        });
        
        console.log('Offer sent, waiting for answer...');
      } else {
        // Callee: Wait for Offer (handled in polling)
        console.log('Waiting for offer...');
      }

      // 5. Start Polling
      startPolling(currentRoomId, pc);

    } catch (err) {
      console.error('Error starting call:', err);
      setError(String(err));
      setConnectionStatus('failed');
    }
  }, [bookingId, customerName, customerPhone, participantType, initializePeerConnection]);

  const startPolling = (currentRoomId: string, pc: RTCPeerConnection) => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);

    pollingInterval.current = setInterval(async () => {
      try {
        // Poll for remote description (Answer if caller, Offer if callee)
        if (pc.signalingState === 'stable' && participantType === 'vendor') {
          // Vendor waiting for offer
          const res = await fetch(`${API_BASE}/video/signal/offer/${currentRoomId}`, {
             headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          });
          const data = await res.json();
          
          if (data.success && data.offer && !pc.remoteDescription) {
             console.log('Offer received');
             await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
             
             const answer = await pc.createAnswer();
             await pc.setLocalDescription(answer);
             
             await fetch(`${API_BASE}/video/signal/answer`, {
               method: 'POST',
               headers: {
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${publicAnonKey}`
               },
               body: JSON.stringify({
                 roomId: currentRoomId,
                 answer,
                 participantType
               })
             });
          }
        } else if (pc.signalingState === 'have-local-offer' && participantType === 'customer') {
          // Customer waiting for answer
          const res = await fetch(`${API_BASE}/video/signal/answer/${currentRoomId}`, {
             headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          });
          const data = await res.json();
          
          if (data.success && data.answer && !pc.remoteDescription) {
            console.log('Answer received');
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          }
        }

        // Poll for ICE Candidates
        const res = await fetch(`${API_BASE}/video/signal/ice-candidates/${currentRoomId}/${participantType}`, {
           headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        });
        const data = await res.json();
        
        if (data.success && data.candidates) {
           for (const c of data.candidates) {
             // We need a mechanism to avoid adding same candidate twice. 
             // Ideally candidates are removed from server or we keep track.
             // For simplicity, catching 'duplicate' errors (which won't throw explicitly but we can just add)
             try {
                await pc.addIceCandidate(new RTCIceCandidate(c.candidate));
             } catch (e) {
               // Ignore errors for existing candidates
             }
           }
        }

      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
  };

  const endCall = useCallback(async () => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (roomId) {
       try {
         await fetch(`${API_BASE}/video/room/${roomId}/end`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify({
              participantType,
              duration: 0 // TODO: Calculate duration
            })
          });
       } catch (e) {
         console.error('Error ending room:', e);
       }
    }

    setConnectionStatus('disconnected');
    setRemoteStream(null);
  }, [roomId, localStream, participantType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      if (peerConnection.current) peerConnection.current.close();
    };
  }, []);

  return {
    localStream,
    remoteStream,
    connectionStatus,
    error,
    startCall,
    endCall,
    roomId
  };
}
