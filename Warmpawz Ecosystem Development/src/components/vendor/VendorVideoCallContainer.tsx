import React, { useEffect, useState } from 'react';
import { useVideoCall } from '../../hooks/useVideoCall';
import { VendorTeleConsultationActive } from './VendorTeleConsultationActive';
import { toast } from 'sonner@2.0.3';

interface VendorVideoCallContainerProps {
  bookingId: string;
  customerName: string;
  customerPhone: string;
  petName: string;
  petType: string;
  reason: string;
  onClose: () => void;
  onOpenNotes?: () => void;
}

export function VendorVideoCallContainer({
  bookingId,
  customerName,
  customerPhone,
  petName,
  petType,
  reason,
  onClose,
  onOpenNotes
}: VendorVideoCallContainerProps) {
  const [duration, setDuration] = useState(0);
  
  const {
    localStream,
    remoteStream,
    connectionStatus,
    error,
    startCall,
    endCall
  } = useVideoCall({
    bookingId,
    participantType: 'vendor',
    customerName,
    customerPhone
  });

  useEffect(() => {
    // Auto start call
    startCall();
    
    return () => {
      endCall();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (error) {
      toast.error(`Call error: ${error}`);
    }
  }, [error]);

  useEffect(() => {
    let interval: any;
    if (connectionStatus === 'connected') {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      toast.success('Connected to customer');
    }
    return () => clearInterval(interval);
  }, [connectionStatus]);

  const handleEndCall = () => {
    endCall();
    onClose();
  };

  return (
    <VendorTeleConsultationActive
      vendorData={{}} // Placeholder
      appointmentData={{
        customerName,
        petName,
        petType,
        reason
      }}
      onEndCall={handleEndCall}
      onOpenNotes={onOpenNotes || (() => toast.info('Notes feature coming soon'))}
      localStream={localStream}
      remoteStream={remoteStream}
      connectionStatus={connectionStatus}
      duration={duration}
    />
  );
}
