# ⚡ AWS Chime Quick Start Guide
## Get Video Consultations Running in 15 Minutes

**For:** Developers deploying Warmpawz video consultations  
**Time:** ~15 minutes  
**Difficulty:** Easy

---

## 🚀 STEP 1: Install Package (2 minutes)

```bash
cd your-warmpawz-project
npm install amazon-chime-sdk-js
```

✅ **Done!** Package installed.

---

## 🔑 STEP 2: AWS Setup (5 minutes)

### A. Create IAM User

1. Login to https://console.aws.amazon.com
2. Navigate to **IAM** → **Users** → **Add users**
3. Username: `warmpawz-chime`
4. Access type: ✅ **Programmatic access**
5. Attach policies:
   - ✅ `AmazonChimeSDK`
   - ✅ `AmazonChimeSDKMessaging`
6. Click **Create user**
7. **Save these credentials:**
   ```
   Access Key ID: AKIA...
   Secret Access Key: abcd...
   ```

✅ **Done!** AWS credentials created.

---

## ⚙️ STEP 3: Admin Portal Config (3 minutes)

1. Login to **Admin Portal**
2. Go to **Platform Settings** → **Cloud & Maps**
3. Scroll to **AWS Credentials** section
4. Enter:
   ```
   Access Key ID: AKIA... (from Step 2)
   Secret Access Key: abcd... (from Step 2)
   Region: us-east-1
   ```
5. Click **Save**
6. Scroll to **AWS Chime SDK** section
7. Toggle **Enable AWS Chime** → **ON**
8. Click **Save**

✅ **Done!** AWS Chime enabled.

---

## 🧪 STEP 4: Test It (5 minutes)

### A. Test Backend

```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/video/config \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Expected:**
```json
{
  "success": true,
  "enabled": true,
  "region": "us-east-1"
}
```

### B. Create Test Consultation

```bash
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/video/consultation/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "bookingId": "test_123",
    "vendorId": "vendor_1",
    "customerId": "customer_1",
    "customerName": "Test Customer",
    "vendorName": "Test Vendor"
  }'
```

**Expected:**
```json
{
  "success": true,
  "consultation": {
    "id": "chime_consult_...",
    "meeting": { "meetingId": "..." }
  }
}
```

✅ **Done!** Backend working.

### C. Test Frontend

Add to your tele-consultation screen:

```typescript
import { AWSChimeVideoRoom } from './components/video/AWSChimeVideoRoom';

function TeleConsultation({ consultationId }) {
  return (
    <AWSChimeVideoRoom
      consultationId={consultationId}
      userId={currentUser.id}
      userName={currentUser.name}
      userType="customer"
      onCallEnd={() => navigate('/bookings')}
    />
  );
}
```

✅ **Done!** Video consultations working!

---

## 📱 USAGE

### For Customer Booking Flow:

```typescript
// After payment success
const createConsultation = async () => {
  const res = await fetch('/make-server-3dd53475/video/consultation/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      bookingId: booking.id,
      vendorId: selectedVendor.id,
      customerId: currentCustomer.id,
      customerName: currentCustomer.name,
      vendorName: selectedVendor.businessName
    })
  });
  
  const data = await res.json();
  return data.consultation.id;
};

// When joining
<AWSChimeVideoRoom
  consultationId={consultationId}
  userId={customer.id}
  userName={customer.name}
  userType="customer"
  onCallEnd={() => navigate('/my-bookings')}
/>
```

### For Vendor Joining:

```typescript
<AWSChimeVideoRoom
  consultationId={consultationId}
  userId={vendor.id}
  userName={vendor.businessName}
  userType="vendor"
  onCallEnd={() => navigate('/dashboard')}
/>
```

---

## 🎯 Which Vendor Roles Get Video?

**6 Tele-Service Roles:**
1. ✅ Veterinarian (tele consultations)
2. ✅ Pet Behaviorist (remote sessions)
3. ✅ Pet Nutritionist (diet consultations)
4. ✅ Pet Clinic (tele consultations)
5. ✅ Pet Insurance (video claims)
6. ✅ Pet Holiday (planning calls)

**All others:** at_home or at_center only (no video needed)

---

## 🎨 Features Included

- ✅ HD Video & Audio
- ✅ In-Call Chat
- ✅ Screen Sharing
- ✅ Typing Indicators
- ✅ Connection Status
- ✅ Call Duration Timer
- ✅ Participant Count
- ✅ Beautiful UI

---

## 🐛 Troubleshooting

### "AWS Chime is not enabled"
→ Check Admin Portal → Platform Settings → AWS Chime toggle

### "AWS credentials not configured"
→ Check Admin Portal → AWS Credentials section

### Video not showing
→ Check browser camera permissions

### High latency
→ Use AWS region closest to your users

---

## 📊 Cost

**~$0.10 per 30-minute consultation**

**Monthly (100 consultations):** ~$10

**Very affordable!** Costs scale with usage.

---

## 🔒 Security

- ✅ All AWS calls happen server-side
- ✅ JWT authentication required
- ✅ User access validation
- ✅ Meeting tokens auto-expire
- ✅ Automatic cleanup

---

## 📞 Need Help?

**Documentation:**
- Full guide: `/AWS_CHIME_DEPLOYMENT_GUIDE.md`
- Status: `/COMPLETE_INTEGRATION_STATUS.md`

**AWS Docs:**
- https://docs.aws.amazon.com/chime-sdk/

**Code Files:**
- Backend: `/supabase/functions/server/aws-chime-video-integration.tsx`
- Hook: `/hooks/useAWSChimeVideo.ts`
- Component: `/components/video/AWSChimeVideoRoom.tsx`

---

## ✅ Checklist

- [ ] `npm install amazon-chime-sdk-js`
- [ ] AWS IAM user created
- [ ] Credentials in Admin Portal
- [ ] AWS Chime enabled
- [ ] Backend test passed
- [ ] Frontend test passed
- [ ] Video call working
- [ ] Chat working
- [ ] Screen share working

---

**That's it!** 🎉

You now have production-ready video consultations with chat for all tele-health services!

---

**Time to Complete:** ~15 minutes  
**Difficulty:** Easy  
**Status:** Production Ready ✅
