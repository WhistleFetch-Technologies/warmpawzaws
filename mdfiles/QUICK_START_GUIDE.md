# 🚀 Quick Start Guide - GPS Tracking & Instant Tele Queue

## ✅ Implementation Status: 100% Complete

All features have been implemented and integrated. Follow these steps to get started.

---

## 📋 Step 1: Database Migration (REQUIRED)

**Run this command to create the required tables:**

```bash
psql -h <your-db-host> -U <username> -d warmpawz_db \
  -f backend/lambda/src/database/schemas/instant-tele-queue.sql
```

**Verify tables were created:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('staff_tele_availability', 'tele_queue');
```

---

## 🔧 Step 2: Verify Backend Registration

The endpoints are already registered in `backend/lambda/src/handler/index.ts` (line 286):
```typescript
registerInstantTeleQueueEndpoints(app); // ✅ Already added
```

**No action needed** - just rebuild and deploy the backend.

---

## 📱 Step 3: Access the Features

### For Vendors/Staff:

1. **Login to Vendor Dashboard** → `/staff/login`
2. **View Dashboard** → See "Instant Tele Consultation" widget
3. **Click "Instant Tele"** menu item or widget button
4. **Toggle "Available Now"** to start accepting instant consultations
5. **Manage Queue** → Accept, skip, or remove customers

### For Customers:

1. **Navigate to Vet Services** (from customer home)
2. **Click "Tele Consultation"** tile
3. **Redirected to** `/booking/tele`
4. **Select a Provider** → Choose service → Join Queue
5. **Track Status** → See your position and wait time in real-time

---

## 🧪 Step 4: Test the Features

### Test Instant Tele Queue:

**Staff Side:**
```
1. Login as staff member
2. Go to Dashboard → Click "Instant Tele"
3. Toggle "Available Now"
4. Verify you appear in customer search
```

**Customer Side:**
```
1. Navigate to Vet Services → Tele Consultation
2. Select a provider (should see staff who toggled available)
3. Select service and join queue
4. Verify queue position updates in real-time
5. Staff accepts → Booking created automatically
```

### Test GPS Tracking:

```
1. Create at_home booking
2. Staff starts service → GPS tracking auto-starts
3. Customer views booking → See live tracking
4. Verify location updates appear every 2 seconds
5. Verify route is recorded
```

---

## 🔍 Step 5: Monitor & Debug

### Check Logs:

```bash
# Backend logs (Lambda)
# Check CloudWatch for:
# - GPS tracking SSE connections
# - Queue operations
# - Staff availability toggles

# Frontend logs (Browser Console)
# - SSE connection status
# - Queue updates
# - GPS location updates
```

### Common Issues:

**Queue not updating:**
- Check SSE connection in browser DevTools Network tab
- Verify API base URL in localStorage: `api_base_url`
- Check CORS settings in backend

**Staff can't toggle available:**
- Verify staff mobile is verified: `mobile_verified = true`
- Check staff has tele services enabled
- Verify `staff_tele_availability` table exists

**GPS tracking not working:**
- Verify booking `service_type = 'at_home'`
- Check GPS tracking session was created
- Verify SSE endpoint `/gps-tracking/booking/:bookingId/stream` is accessible

---

## 📚 Documentation Files

- **`GPS_TRACKING_AND_INSTANT_TELE_QUEUE_IMPLEMENTATION.md`** - Technical details
- **`NEXT_STEPS_IMPLEMENTATION_GUIDE.md`** - Detailed integration guide
- **`INTEGRATION_COMPLETE_SUMMARY.md`** - File listing and status

---

## ✨ Features Ready to Use

### ✅ Instant Tele Queue:
- Provider availability toggle
- Customer queue joining
- Real-time queue updates (SSE)
- Queue management (accept/skip/remove)
- Automatic booking creation

### ✅ GPS Tracking:
- Real-time location streaming
- Route visualization
- ETA calculation
- Distance tracking
- Status updates

---

## 🎯 What's Next?

1. ✅ **Run database migration** (Step 1 above)
2. ✅ **Deploy backend** (rebuild Lambda function)
3. ✅ **Deploy frontend** (rebuild Next.js apps)
4. ✅ **Test features** (Step 4 above)
5. ✅ **Monitor production** (Step 5 above)

**Everything is ready! Just run the migration and deploy!** 🚀

---

## 📞 Need Help?

Check these files for detailed information:
- Implementation details: `GPS_TRACKING_AND_INSTANT_TELE_QUEUE_IMPLEMENTATION.md`
- Step-by-step guide: `NEXT_STEPS_IMPLEMENTATION_GUIDE.md`
- API endpoints: `backend/lambda/src/endpoints/instant-tele-queue.ts`
