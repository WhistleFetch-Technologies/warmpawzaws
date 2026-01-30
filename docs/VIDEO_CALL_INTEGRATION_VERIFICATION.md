# Video Call Integration Verification

## Overview

The video call system uses AWS Chime SDK for tele consultations. This document verifies the integration.

## Components

### 1. VideoPageClient (`app/video/[bookingId]/VideoPageClient.tsx`)
- **Purpose**: Main page component that handles video call lifecycle
- **Route**: `/video/[bookingId]`
- **Responsibilities**:
  - Loads call data from API
  - Manages call states (idle, joining, in_call, ended)
  - Handles joining the meeting
  - Renders appropriate UI for each state

### 2. VideoCallInterface (`components/customer/video/VideoCallInterface.tsx`)
- **Purpose**: AWS Chime SDK integration component
- **Used When**: Call status is 'in_call' and meeting credentials are available
- **Responsibilities**:
  - Initializes AWS Chime SDK
  - Sets up audio/video streams
  - Manages meeting session
  - Handles controls (mute, video toggle, end call)

### 3. ChimeVideoCall (`components/customer/booking/ChimeVideoCall.tsx`)
- **Purpose**: Alternative/legacy Chime implementation
- **Status**: May be used in other flows

## Integration Flow

### Navigation Path
1. **TeleConsultationRouter** calls: `onNavigate('video-call', { bookingId, meetingId? })`
2. **Navigation System** should route to: `/video/[bookingId]`
3. **VideoPageClient** receives `bookingId` from route params
4. **VideoPageClient** loads call data and initializes call
5. **VideoCallInterface** is rendered when meeting credentials are available

### Current Implementation

#### ✅ Navigation
- `handlePaymentSuccess` (specific provider): `onNavigate('video-call', { bookingId })`
- `handleQueueAccepted` (auto-assign): `onNavigate('video-call', { bookingId, meetingId })`
- **Status**: ✅ Navigation calls are correct

#### ✅ Route Setup
- Route exists: `/app/video/[bookingId]/page.tsx`
- Component: `VideoPageClient`
- **Status**: ✅ Route is set up correctly

#### ⚠️ Navigation Handler
- Need to verify how `onNavigate('video-call', ...)` is handled
- Should route to `/video/${bookingId}`
- **Status**: ⚠️ Need to verify navigation system

#### ✅ VideoPageClient Flow
1. Loads call data: `GET /video-call/${bookingId}`
2. Shows waiting screen if `callStatus === 'idle'`
3. User clicks "Join Video Call"
4. Calls: `POST /video-call/join` with `bookingId`, `participantId`, `participantType`
5. Receives meeting credentials
6. Renders `VideoCallInterface` with credentials

#### ✅ VideoCallInterface Integration
- Dynamically imports AWS Chime SDK: `import('amazon-chime-sdk-js')`
- Creates `MeetingSessionConfiguration` with:
  - `meetingId`
  - `attendeeId`
  - `joinToken`
- Creates `DefaultMeetingSession`
- Sets up audio/video streams
- **Status**: ✅ AWS Chime SDK integration is correct

## Issues Found

### Issue 1: Navigation System Not Verified
**Problem**: `onNavigate('video-call', { bookingId })` may not route correctly.

**Check Needed**:
- How does the navigation system handle 'video-call'?
- Does it convert to `/video/${bookingId}`?
- Or does it use a different routing mechanism?

**Expected Behavior**:
```typescript
// Should route to:
router.push(`/video/${bookingId}`)
// Or
window.location.href = `/video/${bookingId}`
```

### Issue 2: Meeting Credentials Flow
**Current Flow**:
1. VideoPageClient calls `POST /video-call/join`
2. Receives response with meeting credentials
3. Passes to VideoCallInterface

**Potential Issue**:
- VideoPageClient expects `attendee_id`, `join_token` in response
- But response structure may differ
- Need to verify API response format

**Check**:
```typescript
// VideoPageClient expects:
{
  meeting_id: string,
  attendee_id: string,
  join_token: string
}

// But API might return:
{
  meeting: { meetingId, ... },
  attendee: { attendeeId, joinToken, ... }
}
```

### Issue 3: VideoCallInterface Props
**Current Props**:
- `bookingId`
- `meetingId`
- `attendeeId`
- `joinToken`

**Issue**: VideoPageClient may not have all these values when rendering VideoCallInterface.

**Check Line 276-291**:
```typescript
if (callStatus === 'in_call' && callData?.meeting_id && callData?.attendee_id && callData?.join_token) {
  return (
    <VideoCallInterface
      bookingId={bookingId}
      meetingId={callData.meeting_id}
      attendeeId={callData.attendee_id}
      joinToken={callData.join_token}
      ...
    />
  );
}
```

**Status**: ✅ Conditional rendering ensures all props are available

## Verification Checklist

### ✅ Working
- [x] Route `/video/[bookingId]` exists
- [x] VideoPageClient component exists
- [x] VideoCallInterface component exists
- [x] AWS Chime SDK import is correct
- [x] Meeting session initialization is correct
- [x] Audio/video setup is correct
- [x] Navigation calls are correct

### ⚠️ Needs Verification
- [ ] Navigation system routes 'video-call' correctly
- [ ] API endpoint `/video-call/join` returns correct format
- [ ] Meeting credentials are passed correctly
- [ ] VideoCallInterface receives all required props
- [ ] AWS Chime SDK loads correctly in browser
- [ ] Video streams work correctly

### ❓ To Test
- [ ] End-to-end flow: Payment → Video Call
- [ ] End-to-end flow: Queue Accepted → Video Call
- [ ] Video call actually connects
- [ ] Audio/video controls work
- [ ] End call functionality works

## Recommended Fixes

### Fix 1: Verify Navigation Handler
Check how `onNavigate` is implemented in the parent component/router.

**If using Next.js router**:
```typescript
const handleNavigate = (screen: string, data?: any) => {
  if (screen === 'video-call') {
    router.push(`/video/${data.bookingId}`);
  }
  // ... other routes
};
```

**If using window.location**:
```typescript
const handleNavigate = (screen: string, data?: any) => {
  if (screen === 'video-call') {
    window.location.href = `/video/${data.bookingId}`;
  }
  // ... other routes
};
```

### Fix 2: Verify API Response Format
Check backend endpoint `/video-call/join` response format.

**Expected**:
```json
{
  "success": true,
  "meeting": {
    "meetingId": "...",
    "mediaRegion": "..."
  },
  "attendee": {
    "attendeeId": "...",
    "joinToken": "..."
  }
}
```

**Or**:
```json
{
  "success": true,
  "meeting_id": "...",
  "attendee_id": "...",
  "join_token": "..."
}
```

### Fix 3: Add Error Handling
Add better error handling for:
- Chime SDK load failures
- Meeting join failures
- Network errors
- Missing credentials

## Testing Steps

1. **Test Navigation**:
   - Complete payment for specific provider
   - Verify navigation to `/video/[bookingId]`
   - Check URL is correct

2. **Test Video Page Load**:
   - Verify VideoPageClient loads
   - Check call data is fetched
   - Verify waiting screen appears

3. **Test Join Call**:
   - Click "Join Video Call"
   - Verify API call to `/video-call/join`
   - Check response contains meeting credentials
   - Verify VideoCallInterface renders

4. **Test Chime Integration**:
   - Verify AWS Chime SDK loads
   - Check meeting session initializes
   - Verify local video appears
   - Check remote video appears when provider joins

5. **Test Controls**:
   - Test mute/unmute
   - Test video on/off
   - Test end call
   - Verify call duration tracking

## Summary

**Status**: ⚠️ Integration structure is correct, but needs verification of:
1. Navigation routing
2. API response format
3. End-to-end functionality

**Next Steps**:
1. Verify navigation handler implementation
2. Test API endpoints
3. Test end-to-end flow
4. Fix any issues found
