'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function VideoCall({ bookingId, participantType, onEndCall, onError }) {
    const [isConnecting, setIsConnecting] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [callDuration, setCallDuration] = useState(0);
    const [meetingInfo, setMeetingInfo] = useState(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const durationIntervalRef = useRef(null);
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    useEffect(() => {
        initializeCall();
        return () => {
            cleanup();
        };
    }, [bookingId]);
    const initializeCall = async () => {
        try {
            setIsConnecting(true);
            // In production, this would call AWS Chime SDK APIs
            // For now, we'll simulate the connection
            // Request camera and microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            setLocalStream(stream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            // Simulate meeting info from backend
            // In production: await apiClient.post('/video-call/join', { bookingId, participantType })
            setMeetingInfo({
                meetingId: `meeting-${bookingId}`,
                attendeeId: `${participantType}-${Date.now()}`,
            });
            // Simulate connection delay
            setTimeout(() => {
                setIsConnecting(false);
                setIsConnected(true);
                startDurationTimer();
            }, 2000);
        }
        catch (err) {
            console.error('Error initializing call:', err);
            const errorMsg = err.message || 'Failed to start video call';
            if (onError)
                onError(errorMsg);
            setIsConnecting(false);
        }
    };
    const startDurationTimer = () => {
        durationIntervalRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    };
    const cleanup = () => {
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop());
        }
    };
    // ============================================================================
    // ACTIONS
    // ============================================================================
    const handleToggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = isMuted;
            });
            setIsMuted(!isMuted);
        }
    };
    const handleToggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = isVideoOff;
            });
            setIsVideoOff(!isVideoOff);
        }
    };
    const handleEndCall = async () => {
        try {
            // In production: await apiClient.post('/video-call/end', { bookingId, meetingId: meetingInfo?.meetingId })
            cleanup();
            if (onEndCall)
                onEndCall();
        }
        catch (err) {
            console.error('Error ending call:', err);
            if (onError)
                onError(err.message || 'Failed to end call');
        }
    };
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    // ============================================================================
    // RENDER
    // ============================================================================
    if (isConnecting) {
        return (_jsx("div", { className: "fixed inset-0 bg-black flex items-center justify-center z-50", children: _jsxs("div", { className: "text-center text-white", children: [_jsx("div", { className: "animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4" }), _jsx("p", { className: "text-xl", children: "Connecting to call..." }), _jsx("p", { className: "text-gray-400 mt-2", children: "Please wait" })] }) }));
    }
    return (_jsxs("div", { className: "fixed inset-0 bg-black flex flex-col z-50", children: [_jsxs("div", { className: "flex-1 relative", children: [_jsx("video", { ref: remoteVideoRef, autoPlay: true, playsInline: true, className: "w-full h-full object-cover" }), _jsxs("div", { className: "absolute top-4 left-4 bg-black/50 rounded-lg px-4 py-2 text-white", children: [_jsxs("p", { className: "text-sm", children: ["Call Duration: ", formatDuration(callDuration)] }), meetingInfo && (_jsxs("p", { className: "text-xs text-gray-300", children: ["Meeting: ", meetingInfo.meetingId] }))] }), isConnected && (_jsx("div", { className: "absolute top-4 right-4 bg-green-500 rounded-full px-3 py-1 text-white text-sm", children: "\u25CF Connected" }))] }), _jsxs("div", { className: "absolute bottom-24 right-4 w-48 h-36 bg-gray-900 rounded-lg overflow-hidden border-2 border-white", children: [_jsx("video", { ref: localVideoRef, autoPlay: true, playsInline: true, muted: true, className: "w-full h-full object-cover" }), isVideoOff && (_jsx("div", { className: "absolute inset-0 bg-gray-800 flex items-center justify-center", children: _jsx("div", { className: "w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center", children: _jsx("span", { className: "text-2xl text-white", children: participantType === 'customer' ? '👤' : '🏪' }) }) }))] }), _jsx("div", { className: "absolute bottom-0 left-0 right-0 bg-black/80 p-6", children: _jsxs("div", { className: "flex items-center justify-center gap-4", children: [_jsx("button", { onClick: handleToggleMute, className: `w-14 h-14 rounded-full flex items-center justify-center transition ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'} text-white`, children: isMuted ? '🔇' : '🎤' }), _jsx("button", { onClick: handleToggleVideo, className: `w-14 h-14 rounded-full flex items-center justify-center transition ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'} text-white`, children: isVideoOff ? '📷' : '📹' }), _jsx("button", { onClick: handleEndCall, className: "w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition", children: "\uD83D\uDCDE" })] }) }), _jsxs("div", { className: "absolute top-20 left-4 bg-black/50 rounded-lg p-4 text-white text-sm max-w-xs", children: [_jsx("p", { className: "font-medium mb-2", children: "Video Call Tips:" }), _jsxs("ul", { className: "space-y-1 text-gray-300", children: [_jsx("li", { children: "\u2022 Ensure good lighting" }), _jsx("li", { children: "\u2022 Use headphones to avoid echo" }), _jsx("li", { children: "\u2022 Check your internet connection" }), _jsx("li", { children: "\u2022 Click controls to mute/unmute" })] })] })] }));
}
