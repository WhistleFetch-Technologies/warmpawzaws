export interface TeleCallNotificationProps {
    callType: 'incoming' | 'outgoing' | 'customer_waiting';
    customer: {
        id: string;
        name: string;
        photo?: string;
        phone?: string;
    };
    bookingId: string;
    meetingId?: string;
    serviceName?: string;
    petName?: string;
    onAccept: (bookingId: string, meetingId?: string) => void;
    onReject: () => void;
    onDismiss?: () => void;
}
