# AWS Chime SDK Setup Guide

## Overview
This guide covers the setup and configuration of AWS Chime SDK for video calling and chat integration in the Warmpawz Customer Mobile App.

## Implementation Approach

**Hybrid Architecture**: Since AWS Chime SDK JavaScript is primarily designed for web browsers, we use a hybrid approach:
- **AWS Chime SDK JS**: Meeting management, attendee management, and signaling
- **react-native-webrtc**: Actual video/audio stream handling in React Native
- **Backend API**: Creates Chime meetings and manages WebRTC signaling

This approach provides the best of both worlds: Chime SDK's robust meeting management with React Native's native WebRTC capabilities.

## Installed Packages

### Core Dependencies
- **amazon-chime-sdk-js** (^3.29.0): AWS Chime SDK JavaScript library for meeting management and signaling
- **react-native-webrtc** (^124.0.7): WebRTC implementation for React Native (video/audio streams)
- **react-native-permissions** (^4.0.0): Already installed - handles camera/microphone permissions

## Components Created

### 1. ChimeService (`src/services/chimeService.ts`)
- Centralized service for AWS Chime SDK operations
- Handles meeting creation/joining via backend API
- Stores meeting configuration
- Chat message sending/receiving
- Note: Actual video/audio streams are handled by WebRTC in React Native components

### 2. VideoCallScreen (`src/components/video/VideoCallScreen.tsx`)
- Full-screen video calling interface
- Uses `react-native-webrtc` for local and remote video streams
- WebRTC peer connection management
- Mute/unmute controls (via WebRTC track enable/disable)
- Video on/off toggle (via WebRTC track enable/disable)
- End call functionality
- Connection status indicators
- Signaling integration with backend

### 3. ChatPanel (`src/components/video/ChatPanel.tsx`)
- Real-time chat interface
- Message sending/receiving
- Auto-scroll to latest messages
- Message polling (every 2 seconds)
- Typing indicators support (ready for enhancement)

### 4. CommunicationHub (`src/components/video/CommunicationHub.tsx`)
- Combined video and chat interface
- Modal presentation
- Mode switching (video/chat)
- Chat overlay on video calls

## Backend API Endpoints Required

The following endpoints need to be implemented in your backend:

### 1. Create/Join Meeting
```
POST /video/meeting/create
Body: {
  bookingId: string,
  userId: string,
  userName: string
}
Response: {
  meetingId: string,
  attendeeId: string,
  joinToken: string,
  region?: string
}
```

### 2. WebRTC Signaling - Send Offer
```
POST /video/signal/offer
Body: {
  meetingId: string,
  offer: RTCSessionDescription,
  userId: string,
  userName: string
}
Response: {
  success: boolean
}
```

### 3. WebRTC Signaling - Get Answer
```
GET /video/signal/answer?meetingId={meetingId}&userId={userId}
Response: {
  answer: RTCSessionDescription
}
```

### 4. WebRTC Signaling - Send ICE Candidate
```
POST /video/signal/ice
Body: {
  meetingId: string,
  candidate: RTCIceCandidate,
  userId: string
}
Response: {
  success: boolean
}
```

### 5. Leave Meeting
```
POST /video/meeting/leave
Body: {
  meetingId: string,
  attendeeId: string
}
Response: {
  success: boolean
}
```

### 6. Send Chat Message
```
POST /video/chat/send
Body: {
  meetingId: string,
  message: string,
  senderId: string,
  senderName: string
}
Response: {
  messageId: string
}
```

### 7. Get Chat Messages
```
GET /video/chat/messages?meetingId={meetingId}
Response: {
  messages: ChimeChatMessage[]
}
```

## Android Configuration

### Permissions (AndroidManifest.xml)
Add the following permissions to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### Gradle Configuration
The `react-native-webrtc` package should automatically configure Gradle. If you encounter issues, ensure:

1. `android/build.gradle` includes:
```gradle
allprojects {
    repositories {
        maven { url "https://jitpack.io" }
    }
}
```

2. `android/app/build.gradle` includes:
```gradle
android {
    compileSdkVersion 33
    // ... other config
}
```

## iOS Configuration

### Permissions (Info.plist)
Add the following to `ios/WarmpawzCustomer/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>We need access to your camera for video consultations</string>
<key>NSMicrophoneUsageDescription</key>
<string>We need access to your microphone for video consultations</string>
```

### Podfile
Run the following to install iOS dependencies:

```bash
cd ios
pod install
```

## Usage Example

```typescript
import CommunicationHub from './src/components/video/CommunicationHub';

// In your component
<CommunicationHub
  mode="video" // or "chat"
  bookingId="booking_123"
  userId="user_456"
  userName="John Doe"
  otherUserName="Dr. Sarah Wilson"
  userType="customer"
  onClose={() => navigation.goBack()}
  onBookFollowUp={() => {/* handle follow-up */}}
/>
```

## Navigation Integration

Add to your navigation stack:

```typescript
<Stack.Screen 
  name="VideoCall" 
  component={CommunicationHub}
  options={{ headerShown: false, presentation: 'fullScreenModal' }}
/>
```

## Important Notes

1. **Hybrid Architecture**: This implementation uses a hybrid approach:
   - AWS Chime SDK JS for meeting management (create/join meetings, manage attendees)
   - WebRTC (react-native-webrtc) for actual video/audio streams
   - Backend API for signaling (offer/answer/ICE candidates)

2. **WebRTC Stream Handling**: The `VideoCallScreen` component uses `react-native-webrtc` directly for video streams. The Chime SDK is used primarily for meeting orchestration via the backend.

3. **Permissions**: Always request camera and microphone permissions before initializing a video call. The `VideoCallScreen` component handles this automatically using `react-native-permissions`.

4. **Backend Integration**: Ensure your backend Lambda functions are configured to:
   - Create Chime meetings using AWS SDK
   - Handle WebRTC signaling (offer/answer/ICE candidates)
   - Manage chat messages
   - The web app's existing implementation can serve as a reference

5. **Testing**: Test video calls on real devices. Simulators may not support camera/microphone access.

6. **Error Handling**: The service includes error handling, but you may want to add retry logic for network failures.

7. **Native Bridges (Future Enhancement)**: For a more native experience, consider creating native bridges to the iOS/Android Chime SDKs, which would provide better performance and native UI integration.

## Next Steps

1. Implement backend API endpoints for meeting creation and chat
2. Test video calling on physical devices
3. Add reconnection logic for dropped connections
4. Implement screen sharing (if needed)
5. Add recording functionality (if needed)
6. Enhance chat with typing indicators and read receipts

## Troubleshooting

### Video not showing
- Check camera permissions
- Verify WebRTC stream is properly initialized
- Check network connectivity

### Audio issues
- Check microphone permissions
- Verify audio device selection
- Check device volume settings

### Connection failures
- Verify AWS credentials and IAM permissions
- Check backend Lambda function logs
- Ensure meeting region matches configuration

