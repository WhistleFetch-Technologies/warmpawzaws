interface VideoCallProps {
    bookingId: string;
    participantType: 'customer' | 'vendor';
    onEndCall?: () => void;
    onError?: (error: string) => void;
}
export declare function VideoCall({ bookingId, participantType, onEndCall, onError }: VideoCallProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=VideoCall.d.ts.map