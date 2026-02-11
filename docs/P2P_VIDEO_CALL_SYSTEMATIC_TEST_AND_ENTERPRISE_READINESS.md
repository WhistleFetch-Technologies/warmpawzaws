# P2P Video Call: Systematic Testing & Enterprise Readiness Report

**Date:** 2026-02-11  
**Scope:** Voice/video streaming, layout, infrastructure, enterprise-grade readiness

---

## 1. Systematic Testing Checklist

### 1.1 Voice Streaming (Both Sides)

| Check | Implementation | Status |
|-------|----------------|--------|
| Local mic captured | `startAudioInput(deviceId)` in `setupMediaDevices` | ✅ |
| Local audio sent to Chime | `realtimeUnmuteLocalAudio()` after `audioVideo.start()` | ✅ |
| Remote audio received | `bindAudioElement(audioElementRef.current)` | ✅ |
| Remote audio played | `<audio ref={audioElementRef} autoPlay />` (no `muted`) | ✅ |
| Audio element bound before remote audio | `useEffect` rebinds on `status` change when element mounts | ✅ |
| Audio output device selection | `chooseAudioOutput(deviceId)` for speakers | ✅ |
| Permission priming (mobile) | `primeDevicePermissions()` before device list | ✅ |

**Potential risk:** Browser autoplay policy can block remote audio if the `<audio>` element’s `play()` runs without a user gesture. The user has clicked "Join", so the first play should be allowed. If the element is rebound later (e.g. on status change), `play()` may be blocked. Current code uses `playPromise.catch(() => {})`—failures are swallowed, so the user may get no remote audio without a clear error.

### 1.2 Video Streaming (Both Sides)

| Check | Implementation | Status |
|-------|----------------|--------|
| Local camera captured | `startVideoInput(deviceId)` in `setupMediaDevices` | ✅ |
| Local video tile started | `startLocalVideoTile()` in observer + fallback after `start()` | ✅ |
| Local video bound to element | `bindVideoElement(tileId, localVideoRef)` in `videoTileDidUpdate` | ✅ |
| Remote video received | `videoTileDidUpdate` when `!tileState.localTile && !tileState.isContent` | ✅ |
| Remote video bound to element | `bindVideoElement(tileId, remoteVideoRef)` | ✅ |
| Video elements have `playsInline` | Both `<video>` elements | ✅ |
| Local video muted (no echo) | `muted` on local video element | ✅ |

### 1.3 Layout: Large = Other, Small = Self

| Check | Implementation | Status |
|-------|----------------|--------|
| Remote (other) = large | `aspect-[4/3]` container, `remoteVideoRef` full `w-full h-full` | ✅ |
| Local (self) = small PIP | `w-28 h-36` (7rem × 9rem), `bottom-20 right-4` | ✅ |
| PIP overlay | `absolute` over main video area | ✅ |
| Placeholder when remote not joined | "Waiting for {otherParticipantName}..." | ✅ |

Layout matches expected UX: large area for the other participant, small PIP for self.

### 1.4 Refs and Dual Rendering

- **Waiting state:** `localVideoRef` → full-width local preview; `audioElementRef` present.
- **Active state:** `localVideoRef` → PIP; `remoteVideoRef` → main area; `audioElementRef` present.
- `useEffect` on `status` rebinds audio and video when DOM changes. `lastLocalTileIdRef` and `lastRemoteTileIdRef` hold tile IDs across re-renders. ✅

---

## 2. Infrastructure Audit

### 2.1 Backend (Lambda + Chime)

| Component | Current State | Notes |
|-----------|---------------|-------|
| Chime SDK Meetings | `@aws-sdk/client-chime-sdk-meetings` | ✅ |
| MediaRegion | `ap-south-1` (via `process.env.AWS_REGION`) | Single region |
| MediaPlacement | Returned by Chime (AudioHostUrl, SignalingUrl, TurnControlUrl, etc.) | ✅ Chime-provided |
| TURN/ICE | Chime-managed via MediaPlacement | ✅ No custom config needed |
| Create-on-join | Supported when no session exists | ✅ |
| Session persistence | `video_call_sessions` table | ✅ |

### 2.2 Chime SDK Client (Frontend)

| Component | Current State | Notes |
|-----------|---------------|-------|
| SDK version | `amazon-chime-sdk-js ^3.0.0` (resolved ~3.30.0) | ✅ |
| Import | Dynamic `import('amazon-chime-sdk-js')` | ✅ Code-splitting friendly |
| Device controller | `DefaultDeviceController` | ✅ |
| Logger | `ConsoleLogger` with `LogLevel.WARN` | ✅ |

### 2.3 Infra Gaps

1. **Single MediaRegion** – All calls use `ap-south-1`. For global users, latency may be high; no region selection or failover.
2. **No Chime retries** – Backend CreateMeeting/CreateAttendee/GetMeeting calls have no retry/backoff.
3. **No structured call metrics** – No logging of join success/failure, duration, or quality.
4. **Meeting expiry** – Chime meetings can expire; backend recreates on GetMeeting failure, but there is no explicit handling of expired meetings for in-flight calls.

---

## 3. Enterprise Readiness Assessment

### 3.1 Functional Readiness

| Capability | Status | Notes |
|------------|--------|-------|
| 1:1 P2P voice | ✅ | Mic → Chime → remote audio out |
| 1:1 P2P video | ✅ | Camera → Chime → remote video out |
| Layout (large other, small self) | ✅ | Correct UX |
| Mute/unmute | ✅ | `realtimeMuteLocalAudio` / `realtimeUnmuteLocalAudio` |
| Video on/off | ✅ | `startLocalVideoTile` / `stopLocalVideoTile` |
| Device switching | ✅ | Settings panel with device dropdowns |
| Screen share | ✅ | `startContentShareFromScreenCapture` |
| In-call chat | ✅ | Chime data messages |
| Reconnection UX | ✅ | `reconnecting` state and toast |
| Permission priming | ✅ | Helps mobile/desktop device discovery |

### 3.2 Gaps for Enterprise Use

| Gap | Severity | Recommendation |
|-----|----------|----------------|
| Remote audio autoplay | Medium | Trigger `audioElement.play()` from a user gesture when possible; surface errors instead of silently catching. |
| No call quality metrics | Medium | Add WebRTC stats (packet loss, jitter, RTT) and optional telemetry. |
| Single region | Medium | Support configurable MediaRegion or nearest-region selection for global users. |
| No health check | Low | Add `/video-call/health` or equivalent to probe Chime availability. |
| Limited observability | Low | Structured logs for create/join/end with correlation IDs. |
| No rate limiting | Low | Guard create/join/notify-ready against abuse. |
| Attendee leave not subscribed | Low | `attendeeIdDidLeave` is defined but not passed to `realtimeSubscribeToAttendeeIdPresence`; fix if leave events are needed. |

### 3.3 Security & Reliability

| Area | Status | Notes |
|------|--------|-------|
| Auth | ✅ | Join uses participantId from auth context; backend validates booking. |
| HTTPS | ✅ | Assumed for API and Chime endpoints. |
| CORS | ✅ | API Gateway/backend configured for frontend origins. |
| CSP | ⚠️ | Chime may require `connect-src`, `script-src`, `worker-src` etc.; verify CSP if used. |
| Meeting expiry recovery | ✅ | Backend creates new meeting when GetMeeting fails. |

---

## 4. Improvements for Seamless Operation

### 4.1 High Impact

1. **Remote audio play on user gesture**
   - Ensure `bindAudioElement` + `play()` run in a path triggered by user interaction.
   - If `play()` fails, show a non-blocking message (e.g. "Tap to enable sound") and retry on next user interaction.

2. **Structured logging**
   - Log video-call lifecycle: create, join, end, errors.
   - Include `bookingId`, `participantType`, duration, and error codes for debugging.

### 4.2 Medium Impact

3. **Configurable MediaRegion**
   - Use `AWS_REGION` or a dedicated `CHIME_MEDIA_REGION` env var.
   - Consider region selection based on user locale or geo.

4. **Backend retries**
   - Add retry with backoff for Chime `CreateMeetingCommand`, `CreateAttendeeCommand`, `GetMeetingCommand`.

5. **Subscribe to attendee leave**
   - If the Chime SDK supports it, subscribe to leave events to update UI (e.g. "Other participant left").

### 4.3 Lower Impact

6. **Call quality indicator**
   - Optional: use Chime’s `getMediaStats()` or WebRTC stats to show connection quality.

7. **Health endpoint**
   - Add a lightweight endpoint that checks Chime connectivity for monitoring.

---

## 5. Verification Commands

```bash
# Run forensic video call E2E (code trace + optional live API test)
API_BASE=https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com \
TEST_BOOKING_ID=<uuid> TEST_VENDOR_ID=<uuid> TEST_CUSTOMER_ID=<uuid> \
npx ts-node scripts/forensic-video-call-e2e.ts
```

### Manual Test Matrix

| Scenario | Vendor | Customer | Expected |
|----------|--------|----------|----------|
| Vendor starts, customer joins | Sees customer video + hears customer | Sees vendor video + hears vendor | ✅ |
| Customer starts, vendor joins | Sees customer video + hears customer | Sees vendor video + hears vendor | ✅ |
| Layout | Remote large, self small PIP | Remote large, self small PIP | ✅ |
| Mute | Vendor mutes → customer hears nothing | — | ✅ |
| Video off | Vendor turns off → customer sees placeholder | — | ✅ |
| Device switch | Change mic/camera in Settings | — | ✅ |
| Mobile vendor | No stuck "Loading", joins call | — | ✅ |
| Incognito/deep link | — | May fail if no participantId in URL | ⚠️ |

---

## 6. Summary

| Area | Verdict |
|------|---------|
| Voice streaming | ✅ Implemented; watch for autoplay on some browsers |
| Video streaming | ✅ Implemented correctly |
| Layout | ✅ Remote large, self small PIP |
| Infrastructure | ✅ Chime + backend wired; single region, no custom TURN |
| Enterprise readiness | ⚠️ Solid base; add observability, retries, and region/config options for full readiness |

The P2P video call flow is functionally complete with correct layout and streaming logic. For enterprise-grade use, prioritize structured logging, remote-audio autoplay handling, configurable MediaRegion, and backend retries.
