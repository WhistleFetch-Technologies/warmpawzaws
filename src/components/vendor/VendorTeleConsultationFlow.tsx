import { useState } from 'react';
import { VendorTeleConsultationConnecting } from './VendorTeleConsultationConnecting';
import { VendorTeleConsultationIncoming } from './VendorTeleConsultationIncoming';
import { VendorVideoCallContainer } from './VendorVideoCallContainer';
import { VendorTeleConsultationEnded } from './VendorTeleConsultationEnded';
import { VendorConsultationNotes } from './VendorConsultationNotes';
import { VendorPrescriptionForm } from './VendorPrescriptionForm';
import { toast } from 'sonner';

interface VendorTeleConsultationFlowProps {
  vendorData: any;
  appointmentData?: {
    id: string;
    customerName: string;
    customerImage?: string;
    petName: string;
    petType: string;
    appointmentTime: string;
    appointmentId: string;
    reason: string;
    customerVideo?: string;
  };
  onBack: () => void;
  initialState?: 'connecting' | 'incoming' | 'active';
}

type ConsultationState = 'connecting' | 'incoming' | 'active' | 'ended';

export function VendorTeleConsultationFlow({ 
  vendorData, 
  appointmentData,
  onBack,
  initialState = 'incoming'
}: VendorTeleConsultationFlowProps) {
  const [state, setState] = useState<ConsultationState>(initialState);
  const [showNotes, setShowNotes] = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);

  // Default appointment data if not provided
  const defaultAppointment = {
    id: 'APT-1234',
    customerName: 'Priya Sharma',
    petName: 'Bruno',
    petType: 'Golden Retriever',
    appointmentTime: '10:30 AM',
    appointmentId: 'APT-1234',
    reason: 'Skin Rash - Follow-up'
  };

  const appointment = appointmentData || defaultAppointment;

  const handleAccept = () => {
    setState('connecting');
    // Simulate connection delay
    setTimeout(() => {
      setState('active');
      toast.success('Call connected!');
    }, 2000);
  };

  const handleDecline = () => {
    toast.info('Call declined');
    onBack();
  };

  const handleCancel = () => {
    toast.info('Call cancelled');
    setState('incoming');
  };

  const handleEndCall = () => {
    setState('ended');
  };

  const handleSaveNotes = async (notes: string) => {
    // Notes are saved in the component itself via API
    toast.success('Notes saved successfully!');
  };

  if (state === 'ended') {
    return (
      <>
        <VendorTeleConsultationEnded
          vendorData={vendorData}
          appointmentData={{
            ...appointment,
            duration: '00:01'
          }}
          onAddNotes={() => setShowNotes(true)}
          onWritePrescription={() => setShowPrescription(true)}
          onBackToDashboard={onBack}
        />
        
        {showNotes && (
          <VendorConsultationNotes
            appointmentData={appointment}
            onClose={() => setShowNotes(false)}
            onSave={handleSaveNotes}
          />
        )}

        {showPrescription && (
          <VendorPrescriptionForm
            bookingId={appointment.id}
            booking={{
              ...appointment,
              vendorType: vendorData?.role || 'vet', // Assuming role is available
              serviceType: 'tele'
            }}
            vendorPhone={vendorData?.phone || '0000000000'}
            onClose={() => setShowPrescription(false)}
            onSuccess={() => {
              setShowPrescription(false);
              toast.success('Prescription sent successfully');
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      {state === 'connecting' && (
        <VendorTeleConsultationConnecting
          vendorData={vendorData}
          customerName={appointment.customerName}
          onCancel={handleCancel}
        />
      )}

      {state === 'incoming' && (
        <VendorTeleConsultationIncoming
          vendorData={vendorData}
          appointmentData={appointment}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />
      )}

      {state === 'active' && (
        <>
          <VendorVideoCallContainer
            bookingId={appointment.id}
            customerName={appointment.customerName}
            customerPhone="0000000000"
            petName={appointment.petName}
            petType={appointment.petType}
            reason={appointment.reason}
            onClose={handleEndCall}
            onOpenNotes={() => setShowNotes(true)}
          />
          
          {showNotes && (
            <VendorConsultationNotes
              appointmentData={appointment}
              onClose={() => setShowNotes(false)}
              onSave={handleSaveNotes}
            />
          )}
        </>
      )}
    </>
  );
}
