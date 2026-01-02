# Batch 2 - Test Plan
**Date:** 2025-01-28  
**Status:** Ready for Testing

---

## 🧪 TESTING CHECKLIST

### 1. ChatScreen ✅
**Test Cases:**
- [ ] Navigate to ChatScreen from BookingDetail
- [ ] Load message history
- [ ] Send a message
- [ ] Receive real-time messages via WebSocket
- [ ] Mark messages as read
- [ ] Back navigation works
- [ ] Error handling for failed API calls
- [ ] Loading states display correctly

**Navigation Test:**
```typescript
handleNavigate('Chat', {
  bookingId: 'test-booking-123',
  customerId: 'test-customer-456',
  customerName: 'Test Customer'
});
```

---

### 2. VideoCallScreen ✅
**Test Cases:**
- [ ] Navigate to VideoCallScreen
- [ ] Initiate a new call
- [ ] Answer an incoming call (with callId)
- [ ] Mute/unmute audio
- [ ] Toggle video on/off
- [ ] End call functionality
- [ ] Call duration timer works
- [ ] Connection status displays correctly
- [ ] Error handling for call failures

**Navigation Test:**
```typescript
handleNavigate('VideoCall', {
  bookingId: 'test-booking-123',
  customerId: 'test-customer-456',
  customerName: 'Test Customer'
});
```

---

### 3. NotificationCenterScreen ✅
**Test Cases:**
- [ ] Navigate to NotificationCenterScreen
- [ ] Load notifications (all/unread/read)
- [ ] Filter notifications by type
- [ ] Mark single notification as read
- [ ] Mark all notifications as read
- [ ] Unread count badge displays correctly
- [ ] Tap notification navigates to relevant screen
- [ ] Pull to refresh works
- [ ] Empty state displays when no notifications

**Navigation Test:**
```typescript
handleNavigate('NotificationCenter');
```

---

### 4. EmergencyAlertScreen ✅
**Test Cases:**
- [ ] Navigate to EmergencyAlertScreen
- [ ] Select emergency type
- [ ] Enter description in TextInput
- [ ] Submit emergency report
- [ ] Validation works (requires type and description)
- [ ] Success alert displays
- [ ] Error handling for failed reports
- [ ] Back navigation works

**Navigation Test:**
```typescript
handleNavigate('EmergencyAlert', {
  bookingId: 'test-booking-123' // optional
});
```

---

### 5. LiveTrackingDashboard ✅
**Test Cases:**
- [ ] Navigate to LiveTrackingDashboard
- [ ] Load active trackings
- [ ] Display map with tracking routes
- [ ] Select different tracking from list
- [ ] Map updates when tracking selected
- [ ] Auto-refresh every 5 seconds
- [ ] Empty state when no active trackings
- [ ] Tap booking navigates to BookingDetail

**Navigation Test:**
```typescript
handleNavigate('LiveTrackingDashboard');
```

---

### 6. LocationSharingScreen ✅
**Test Cases:**
- [ ] Navigate to LocationSharingScreen
- [ ] Request location permission
- [ ] Toggle location sharing on/off
- [ ] Map displays current location
- [ ] Location updates every 5 seconds
- [ ] Status indicator shows sharing state
- [ ] Stop sharing works correctly
- [ ] Error handling for permission denied

**Navigation Test:**
```typescript
handleNavigate('LocationSharing', {
  bookingId: 'test-booking-123',
  customerId: 'test-customer-456'
});
```

---

### 7. RouteOptimizationScreen ✅
**Test Cases:**
- [ ] Navigate to RouteOptimizationScreen
- [ ] Pass multiple booking IDs
- [ ] Optimize route button works
- [ ] Map displays optimized route
- [ ] Waypoints show on map
- [ ] Distance and time estimates display
- [ ] Error handling for < 2 bookings
- [ ] Loading state during optimization

**Navigation Test:**
```typescript
handleNavigate('RouteOptimization', {
  bookingIds: ['booking-1', 'booking-2', 'booking-3']
});
```

---

### 8. RealTimeUpdatesScreen ✅
**Test Cases:**
- [ ] Navigate to RealTimeUpdatesScreen
- [ ] WebSocket connects successfully
- [ ] Connection status indicator works
- [ ] Receive real-time updates
- [ ] Updates display in list
- [ ] Tap update navigates to relevant screen
- [ ] Reconnection works after disconnect
- [ ] Empty state displays correctly

**Navigation Test:**
```typescript
handleNavigate('RealTimeUpdates');
```

---

### 9. ConnectionStatusScreen ✅
**Test Cases:**
- [ ] Navigate to ConnectionStatusScreen
- [ ] Display connection status (online/offline)
- [ ] Show connection type (WiFi/Cellular)
- [ ] Display WiFi network name (if connected)
- [ ] Display cellular generation (if on cellular)
- [ ] Show signal strength
- [ ] Internet reachable status
- [ ] Updates in real-time when connection changes

**Navigation Test:**
```typescript
handleNavigate('ConnectionStatus');
```

---

### 10. OfflineModeScreen ✅
**Test Cases:**
- [ ] Navigate to OfflineModeScreen
- [ ] Display online/offline status
- [ ] Show pending actions count
- [ ] Display last sync timestamp
- [ ] List pending actions
- [ ] Sync button works (when online)
- [ ] Clear pending actions works
- [ ] Actions queue when offline
- [ ] Auto-sync when connection restored

**Navigation Test:**
```typescript
handleNavigate('OfflineMode');
```

---

## 🔗 INTEGRATION TESTS

### From BookingDetailScreen
- [ ] Chat button navigates to ChatScreen
- [ ] Video Call button navigates to VideoCallScreen
- [ ] Share Location button navigates to LocationSharingScreen
- [ ] Emergency button navigates to EmergencyAlertScreen

### From VendorDashboardScreen
- [ ] Live Tracking button navigates to LiveTrackingDashboard
- [ ] Notifications button navigates to NotificationCenterScreen
- [ ] Real-Time Updates button navigates to RealTimeUpdatesScreen
- [ ] Connection Status button navigates to ConnectionStatusScreen
- [ ] Offline Mode button navigates to OfflineModeScreen

---

## 🐛 COMMON ISSUES TO CHECK

1. **Navigation:**
   - All screens navigate correctly
   - Back button works on all screens
   - Data passes correctly between screens

2. **API Integration:**
   - All API calls use correct endpoints
   - Error handling works
   - Loading states display

3. **Permissions:**
   - Location permissions requested correctly
   - Camera/microphone permissions (for video calls)
   - Notification permissions

4. **WebSocket:**
   - Connection establishes
   - Reconnection works
   - Messages received correctly

5. **State Management:**
   - Data persists correctly
   - Updates reflect in UI
   - No memory leaks

---

## ✅ TEST EXECUTION

**Status:** Ready for manual testing

**Next Steps:**
1. Run app: `npm run ios` or `npm run android`
2. Navigate to each screen
3. Test all functionality
4. Document any issues
5. Fix gaps found
6. Re-test fixes
7. Proceed to Batch 3 when all tests pass

