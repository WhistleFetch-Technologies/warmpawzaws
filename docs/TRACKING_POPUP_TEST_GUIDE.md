# GPS Tracking Popup - Testing Guide

## Quick Test Steps

### 1. Vendor Side (Start Travel)
1. Open vendor dashboard
2. Navigate to a confirmed booking
3. Click "Start Travel" button
4. Verify:
   - ✅ Tracker opens on vendor side
   - ✅ API call to `/tracking/start` succeeds
   - ✅ Session created in database
   - ✅ Booking status updated to 'traveling'

### 2. Customer Side (Receive Popup)
1. Open customer home screen
2. Wait for polling (max 30 seconds)
3. Verify:
   - ✅ Popup appears automatically
   - ✅ Shows "GPS Tracker - Live Navigation" header
   - ✅ Displays vendor/staff name
   - ✅ Shows ETA (e.g., "15 min")
   - ✅ Shows distance (e.g., "5.2 km away")
   - ✅ Displays service purpose
   - ✅ Shows appointment details
   - ✅ Shows vendor/staff phone number
   - ✅ Shows qualifications (if staff)
   - ✅ Shows profile photo (if available)

### 3. Real-time Updates
1. Keep popup open
2. Wait 10 seconds
3. Verify:
   - ✅ ETA updates automatically
   - ✅ Distance updates
   - ✅ Location updates on map
   - ✅ Status changes (started → in_transit → arrived)

### 4. Mobile Optimization
1. Test on mobile device or responsive mode
2. Verify:
   - ✅ Popup fits screen (max-width: 430px)
   - ✅ Text is readable
   - ✅ Buttons are tappable
   - ✅ Map displays correctly
   - ✅ No horizontal scrolling

## API Endpoints to Test

### POST /tracking/start
```bash
curl -X POST https://api.warmpawz.com/tracking/start \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "test-booking-123",
    "vendorId": "test-vendor-456",
    "startLatitude": 19.0760,
    "startLongitude": 72.8777
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "session": {
    "id": "session-id",
    "bookingId": "test-booking-123",
    "status": "started",
    "estimatedEtaMinutes": 15,
    "distanceKm": 5.2
  },
  "message": "Tracking started. Customer has been notified."
}
```

### GET /tracking/booking/:bookingId/status
```bash
curl https://api.warmpawz.com/tracking/booking/test-booking-123/status
```

**Expected Response:**
```json
{
  "success": true,
  "isTracking": true,
  "tracking": {
    "id": "session-id",
    "status": "in_transit",
    "currentLocation": {
      "latitude": 19.0800,
      "longitude": 72.8800
    },
    "estimatedEtaMinutes": 12,
    "distanceKm": 4.5,
    "vendorName": "Pet Care Services",
    "bookingDetails": {
      "serviceName": "Grooming",
      "appointmentDate": "2026-01-28",
      "appointmentTime": "14:00",
      "purpose": "Full grooming service"
    },
    "vendorDetails": {
      "name": "Pet Care Services",
      "phone": "+919611377119",
      "photo": "https://..."
    },
    "staffDetails": {
      "name": "John Doe",
      "phone": "+919611377120",
      "qualifications": "Certified Pet Groomer",
      "photo": "https://..."
    }
  }
}
```

## Common Issues & Solutions

### Issue: Popup doesn't appear
**Check:**
1. Booking status is 'traveling' (not just 'in_progress')
2. Polling is working (check browser console)
3. API endpoint `/tracking/booking/:bookingId/status` returns success
4. `activeTrackingSession` state is set correctly

**Solution:**
- Verify booking status update in database
- Check customer home screen polling logs
- Ensure endpoint returns `isTracking: true`

### Issue: Missing vendor/staff details
**Check:**
1. Backend includes `vendorDetails` and `staffDetails` in response
2. Staff record exists in database
3. Vendor has phone number

**Solution:**
- Verify `/tracking/booking/:bookingId/status` response structure
- Check database for staff/vendor records
- Ensure staff_id is set in tracking session

### Issue: ETA not updating
**Check:**
1. Popup polling interval (should be 10 seconds)
2. Location updates are being sent from vendor app
3. ETA calculation endpoint is working

**Solution:**
- Check popup polling logs
- Verify vendor app sends location updates
- Test ETA calculation endpoint directly

### Issue: Map not displaying
**Check:**
1. Google Maps API key is configured
2. API key has proper permissions
3. Current location is available

**Solution:**
- Verify API key in environment variables
- Check Google Maps API quota
- Ensure location data is valid

## Performance Metrics

### Expected Performance
- **Popup appearance:** < 30 seconds after vendor starts travel
- **Update interval:** 10 seconds
- **API response time:** < 500ms
- **Map load time:** < 2 seconds

### Monitoring
- Check browser console for API calls
- Monitor network tab for polling requests
- Verify response times in API logs

## Browser Compatibility

### Tested Browsers
- ✅ Chrome (Desktop & Mobile)
- ✅ Safari (Desktop & Mobile)
- ✅ Firefox (Desktop)
- ✅ Edge (Desktop)

### Mobile Devices
- ✅ iOS Safari
- ✅ Android Chrome
- ✅ React Native apps

## Security Considerations

1. **Authentication:** All endpoints require valid auth token
2. **Authorization:** Customers can only view their own bookings
3. **Data Privacy:** Location data is encrypted in transit
4. **Rate Limiting:** Polling intervals prevent abuse

## Next Steps

1. Run synthetic test script: `npx tsx scripts/test-tracking-flow.ts`
2. Test with real booking data
3. Monitor production logs
4. Collect user feedback
5. Optimize based on metrics
