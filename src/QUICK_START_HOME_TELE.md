# 🚀 Quick Start Guide - Home & Tele Services

## ✅ What's Ready Now

1. **Service Style Management** - Staff can control which service styles they offer
2. **Home Services Backend** - Complete tracking, walker sessions, OTP completion
3. **Tele-Consultation Backend** - Video call management, chat, OTP completion
4. **Emergency Reassignment** - Automatic broadcast to nearby staff
5. **Staff UI** - Service Style Manager with distance/tele controls

---

## 🧪 Test It Now!

### **Step 1: Staff Login & Enable Service Styles**

1. **Login as any staff member** (e.g., Dr. Vikram Bhat)
2. **Go to Dashboard**
3. **Click "Service Styles (Home/Center/Tele)" button** in header
4. **You'll see 3 cards**:
   - 🏥 At Center (default enabled)
   - 🏠 At Home (toggle to enable)
   - 📱 Tele Consultation (toggle to enable)

5. **Enable Home Services**:
   - Toggle the switch
   - Adjust distance slider (default 10km)
   - Staff will now appear for home bookings within radius

6. **Enable Tele Services**:
   - Toggle the switch
   - Enable video calling
   - Enable chat
   - Set max session duration
   - Staff will now appear for tele consultations

---

### **Step 2: Test Home Service Flow (API)**

**Scenario**: Customer books home grooming, staff travels and completes

```bash
# 1. Accept booking
curl -X POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/booking_12345/accept \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{"staffId":"staff_67890"}'

# Response:
{
  "success": true,
  "booking": {
    "id": "booking_12345",
    "status": "accepted",
    "acceptedAt": "2025-11-27T10:00:00Z"
  }
}

# 2. Start travel
curl -X POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/booking_12345/start-travel \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "staff_67890",
    "currentLocation": {
      "latitude": 12.9716,
      "longitude": 77.5946
    }
  }'

# Response:
{
  "success": true,
  "trackingSession": {
    "id": "track_xyz123",
    "status": "traveling",
    "currentLocation": { "latitude": 12.9716, "longitude": 77.5946 }
  }
}

# 3. Update location (call every 10-30 seconds while traveling)
curl -X PUT https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/tracking/track_xyz123/location \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{"latitude": 12.9800, "longitude": 77.6000}'

# Response:
{
  "success": true,
  "currentLocation": { "latitude": 12.9800, "longitude": 77.6000 },
  "estimatedTimeToArrival": 8,  // minutes
  "distanceToDestination": 2.5   // km
}

# 4. Mark arrived
curl -X POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/booking_12345/mark-arrived \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{"staffId": "staff_67890"}'

# Response:
{
  "success": true,
  "booking": {
    "status": "in_progress",
    "arrivedAt": "2025-11-27T10:15:00Z"
  }
}

# 5. Complete with OTP
curl -X POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/booking_12345/complete-with-otp \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "staff_67890",
    "otp": "1234",
    "notes": "Grooming completed successfully. Pet was well-behaved."
  }'

# Response:
{
  "success": true,
  "booking": {
    "status": "completed",
    "completedAt": "2025-11-27T11:00:00Z",
    "earningsReleased": true,
    "staffEarnings": 1200
  },
  "message": "Service completed successfully. Earnings released."
}
```

---

### **Step 3: Test Walker Session (With START & END OTP)**

```bash
# 1. Accept booking & travel (same as above)
# ... accept and start-travel steps ...

# 2. Mark arrived
curl -X POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/booking_walk123/mark-arrived \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{"staffId": "staff_67890"}'

# 3. Start walking session with START OTP
curl -X POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/booking_walk123/start-session-with-otp \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "staff_67890",
    "otp": "5555"
  }'

# Response:
{
  "success": true,
  "walkerSession": {
    "id": "walker_abc789",
    "status": "active",
    "startTime": "2025-11-27T10:30:00Z",
    "distanceWalked": 0
  }
}

# 4. Update walker location (every 10 seconds during walk)
curl -X PUT https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/walker-session/walker_abc789/location \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{"latitude": 12.9850, "longitude": 77.6100}'

# Response:
{
  "success": true,
  "distanceWalked": "1.25",  // km
  "duration": 15              // minutes
}

# 5. Complete with END OTP
curl -X POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/booking_walk123/complete-with-otp \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "staff_67890",
    "otp": "9999"
  }'

# Response:
{
  "success": true,
  "booking": {
    "status": "completed",
    "walkerSessionId": "walker_abc789"
  },
  "message": "Service completed successfully. Earnings released."
}

# 6. Get walker session report
curl https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/walker-session/walker_abc789 \
  -H "Authorization: Bearer {publicAnonKey}"

# Response:
{
  "success": true,
  "session": {
    "id": "walker_abc789",
    "status": "completed",
    "distanceWalked": 2.5,   // km
    "duration": 35,          // minutes
    "route": [
      { "latitude": 12.9716, "longitude": 77.5946, "timestamp": "..." },
      { "latitude": 12.9850, "longitude": 77.6100, "timestamp": "..." },
      // ... all points ...
    ],
    "startTime": "2025-11-27T10:30:00Z",
    "endTime": "2025-11-27T11:05:00Z"
  }
}
```

---

### **Step 4: Test Tele-Consultation (Video Call)**

```bash
# 1. Customer starts video call
curl -X POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/booking_tele456/start-video-call \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{"customerId": "customer_123"}'

# Response:
{
  "success": true,
  "teleSession": {
    "id": "tele_def456",
    "callStatus": "ringing",
    "initiatedAt": "2025-11-27T10:00:00Z"
  },
  "message": "Call initiated. Waiting for staff to accept."
}

# 2. Staff accepts call
curl -X POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/tele-session/tele_def456/accept \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{"staffId": "staff_67890"}'

# Response:
{
  "success": true,
  "session": {
    "callStatus": "active",
    "acceptedAt": "2025-11-27T10:01:00Z"
  },
  "message": "Call accepted. Consultation started."
}

# 3. Send chat message during call
curl -X POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/tele-session/tele_def456/chat \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{
    "senderId": "staff_67890",
    "senderType": "staff",
    "message": "Please show me the affected area"
  }'

# 4. Update call duration (heartbeat every 10 seconds)
curl -X PUT https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/tele-session/tele_def456/heartbeat \
  -H "Authorization: Bearer {publicAnonKey}"

# Response:
{
  "success": true,
  "duration": 120,  // seconds
  "callStatus": "active"
}

# 5. End call
curl -X POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/tele-session/tele_def456/end \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{"endedBy": "staff"}'

# Response:
{
  "success": true,
  "duration": 300,  // 5 minutes
  "message": "Call ended. Provide OTP to complete consultation."
}

# 6. Complete with OTP
curl -X POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/booking_tele456/complete-with-otp \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "staff_67890",
    "otp": "7777",
    "prescriptionNotes": "Prescribed antibiotic for skin infection. Apply twice daily for 7 days."
  }'
```

---

### **Step 5: Test Emergency Reassignment**

```bash
# 1. Staff rejects booking
curl -X POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/booking_urgent999/reject-and-reassign \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "staff_original",
    "reason": "Emergency came up"
  }'

# Response:
{
  "success": true,
  "booking": {
    "status": "pending_reassignment",
    "broadcastedTo": ["staff_nearby1", "staff_nearby2", "staff_nearby3"]
  },
  "nearbyStaffCount": 3,
  "message": "Broadcasted to 3 nearby staff"
}

# 2. Nearby staff accepts reassignment
curl -X POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/booking_urgent999/accept-reassignment \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{"staffId": "staff_nearby1"}'

# Response:
{
  "success": true,
  "booking": {
    "assignedStaffId": "staff_nearby1",
    "status": "accepted",
    "reassigned": true
  },
  "message": "Booking reassigned successfully"
}
```

---

## 📱 Staff UI Testing

### **Test Service Style Manager**

1. Login as staff
2. Dashboard → Click "Service Styles" button
3. **Test At Home**:
   - Toggle ON
   - Move distance slider to 20km
   - Should see "Active - You'll receive home service bookings"
   - Should see "within 20km of your location"

4. **Test Tele**:
   - Toggle ON
   - Toggle video calling ON
   - Toggle chat ON
   - Move session duration to 30 minutes
   - Should see "Active - Customers can book video consultations"

5. **Test Toggles**:
   - Toggle OFF any style
   - Should see switch move to left
   - Green badge should disappear
   - Toast should say "X disabled"

---

## ✅ Verification Checklist

### **Backend**
- [ ] Service style preferences save correctly
- [ ] Location tracking calculates distance accurately
- [ ] Walker session records route points
- [ ] Tele session tracks duration correctly
- [ ] OTP verification works for START and END
- [ ] Earnings release after OTP completion
- [ ] Emergency reassignment finds nearby staff (5km)
- [ ] Chat messages save and retrieve correctly

### **Staff UI**
- [ ] Service Style Manager loads without errors
- [ ] Toggles work smoothly
- [ ] Distance slider updates in real-time
- [ ] Toast notifications appear
- [ ] Settings persist after page refresh
- [ ] Mobile-responsive design

### **Data Integrity**
- [ ] Tracking sessions preserve location history
- [ ] Walker sessions calculate correct distance
- [ ] Tele sessions preserve chat history
- [ ] Bookings update status correctly
- [ ] Earnings records created properly

---

## 🐛 Common Issues & Solutions

### **Issue 1: "Preferences not found"**
**Solution**: Preferences are created on first fetch. Reload the page.

### **Issue 2: "Invalid OTP"**
**Solution**: Ensure the booking has `startOtp` or `endOtp` field set before verification.

### **Issue 3: "No nearby staff available"**
**Solution**: 
- Ensure staff has enabled home services
- Ensure staff is within 5km
- Ensure staff has the required services active

### **Issue 4: Location not updating**
**Solution**: 
- Check staff location is being updated via `PUT /staff/:staffId/location`
- Verify latitude/longitude are valid numbers

### **Issue 5: Tracking session not found**
**Solution**: Ensure `start-travel` was called successfully and returned `trackingSessionId`

---

## 📊 What to Check

### **In Browser Console**
```
✅ [STYLE] Fetching style preferences for staff: staff_xxxxx
✅ [STYLE] Preferences updated for staff staff_xxxxx
✅ [HOME] Staff staff_xxxxx accepting booking booking_xxxxx
✅ [HOME] Travel started for booking booking_xxxxx
✅ [WALKER] Session started: walker_xxxxx
✅ [TELE] Video call initiated: tele_xxxxx
✅ [EARNINGS] Released ₹1200 to staff staff_xxxxx
```

### **In Server Logs**
```
🎨 [STYLE] Updating style preferences for staff: staff_xxxxx
🚗 [HOME] Staff staff_xxxxx starting travel for booking booking_xxxxx
📍 [HOME] Staff arrived, booking booking_xxxxx now in progress
🐕 [WALKER] Starting session for booking booking_xxxxx with OTP
📱 [TELE] Customer customer_xxxxx starting video call
💰 [EARNINGS] Releasing earnings for booking booking_xxxxx
```

---

## 🎯 Next Steps

1. **Test current implementation** ✅
2. **Verify all endpoints work** ✅
3. **Build customer-facing UI**:
   - Home Service Booking Flow
   - Live Staff Tracker
   - Walker Session Viewer
   - Tele-Consultation Interface
4. **Integrate video call component**
5. **Add push notifications**
6. **Implement Google Maps visualization**

---

## 💡 Pro Tips

1. **Test with real locations**: Use actual lat/long for accurate distance calculations
2. **Simulate movement**: Update location every 10-30 seconds for smooth tracking
3. **Check OTPs**: Generate unique OTPs for each booking: `Math.floor(1000 + Math.random() * 9000)`
4. **Monitor earnings**: Verify 80/20 split (staff/platform)
5. **Test edge cases**: What if OTP is wrong? What if no nearby staff?

---

**Status**: ✅ Ready for Testing
**Estimated Test Time**: 30-45 minutes
**Priority**: Test service style manager first, then API flows
