// Data message payload structure
export interface ChatDataMessage {
    type: 'message' | 'file';
    id: string;
    sender: 'customer' | 'vendor';
    senderName: string;
    message: string;
    messageType?: 'text' | 'file' | 'image';
    fileName?: string;
    fileUrl?: string;
    timestamp: string;
}

export interface TypingDataMessage {
    type: 'typing';
    sender: 'customer' | 'vendor';
    senderName: string;
    isTyping: boolean;
}

export interface AttendeeStatus {
    customerJoined: boolean;
    vendorJoined: boolean;
}

export interface ChimeMeetingData {
    MeetingId: string;
    MediaPlacement: {
        AudioHostUrl: string;
        AudioFallbackUrl: string;
        SignalingUrl: string;
        TurnControlUrl: string;
        ScreenDataUrl?: string;
        ScreenViewingUrl?: string;
        ScreenSharingUrl?: string;
        EventIngestionUrl?: string;
    };
    MediaRegion: string;
}

export interface ChimeAttendeeData {
    AttendeeId: string;
    JoinToken: string;
    ExternalUserId?: string;
}

export interface ChimeVideoCallProps {
    bookingId: string;
    participantType: 'customer' | 'vendor' | 'staff';
    participantId: string;
    vendorName?: string;
    customerName?: string;
    serviceName?: string;
    onEndCall?: (duration: number) => void;
    onPrescriptionUpload?: () => void;
}

export type CallStatus = 'loading' | 'ready' | 'waiting' | 'connecting' | 'active' | 'reconnecting' | 'left' | 'ended' | 'error';

export interface ChatMessage {
    id: string;
    sender: 'customer' | 'vendor' | 'system';
    senderName: string;
    message: string;
    messageType?: 'text' | 'file' | 'image';
    fileName?: string;
    fileUrl?: string;
    timestamp: Date;
    persisted?: boolean; // Whether this message has been saved to backend
}
