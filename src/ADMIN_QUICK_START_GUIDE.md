# 🚀 ADMIN QUICK START GUIDE - Platform Settings

**Warmpawz Multi-Vendor Pet Marketplace**  
**Last Updated:** December 9, 2025

---

## 🔑 **ADMIN PASSCODE**

```
Warmpawz2025
```

**⚠️ IMPORTANT:** This passcode is required to edit ANY platform settings. Keep it secure!

---

## 📍 **HOW TO ACCESS SETTINGS**

1. Log in to Admin Portal
2. Click **"Platform Settings"** from main menu
3. You'll see 3 tabs:
   - **Cloud & Maps** (AWS, Google Maps)
   - **Payment Gateway** (Razorpay, Stripe, Paytm)
   - **Logistics Integration** (Shiprocket, Delhivery, BlueDart)

---

## 🔓 **HOW TO EDIT SETTINGS**

### **Step-by-Step:**

1. **Click "Enable Edit Mode"** button (top of page)
2. **Enter passcode** in dialog: `Warmpawz2025`
3. **Click "Unlock Settings"**
4. **Make your changes** (all fields now editable)
5. **Click "Save All Changes"** (orange button)
6. **Wait for success message** ✅
7. Settings automatically lock again

### **To Cancel Changes:**
- Click **"Cancel"** button
- All changes will be discarded
- Settings revert to last saved state

---

## ☁️ **AWS SERVICES SETUP**

### **1. AWS IAM Credentials (Required First)**

**Where:** Cloud & Maps tab → AWS Services → IAM & Auth section

**What You Need:**
- AWS Access Key ID (starts with `AKIA` or `ASIA`)
- AWS Secret Access Key
- Region (default: `ap-south-1` for India)

**How to Get:**
1. Log in to AWS Console
2. Go to IAM → Users
3. Create new user: `warmpawz-backend`
4. Attach policy: S3, SNS, SQS, Chime, Bedrock permissions
5. Generate access keys
6. Copy Access Key ID and Secret Access Key
7. Paste into Platform Settings

---

### **2. Amazon S3 - Media Storage**

**Purpose:** Store ALL photos, videos, documents

**Enable Steps:**
1. Enable edit mode
2. Toggle **"Amazon S3 Storage"** ON
3. Enter **Bucket Name:** `warmpawz-media-prod`
4. Enter **Region:** `ap-south-1`
5. Save changes

**What Gets Stored:**
- Product photos
- Pet photos
- Vendor documents (certificates, licenses)
- Facility photos
- Videos
- Catalog images

---

### **3. Amazon SNS - SMS & Email**

**Purpose:** Send OTP, notifications, order updates

**Enable Steps:**
1. Enable edit mode
2. Toggle **"Amazon SNS"** ON
3. Enter **SMS Number:** `+91XXXXXXXXXX` (your verified number)
4. Enter **Email:** `noreply@warmpawz.com`
5. Enter **Region:** `ap-south-1`
6. Save changes

**What Gets Sent:**
- OTP for vendor registration
- Booking confirmations
- Order status updates
- Promotional messages

---

### **4. AWS Chime - Video Calls**

**Purpose:** Video consultations, voice calls

**Enable Steps:**
1. Enable edit mode
2. Toggle **"Amazon Chime SDK"** ON
3. Enter **Region:** `us-east-1` (Chime only works here)
4. Save changes

**Features:**
- Vet video consultations
- Voice calls
- Mating & Dating video chats

---

### **5. AWS Bedrock - AI**

**Purpose:** Smart recommendations, symptom checker

**Enable Steps:**
1. Enable edit mode
2. Toggle **"AWS Bedrock AI"** ON
3. Enter **Model ID:** `anthropic.claude-v2`
4. Enter **Region:** `us-east-1`
5. Save changes

**Features:**
- Pet symptom checker
- Smart product recommendations
- Chatbot assistance

---

## 💳 **RAZORPAY SETUP**

### **Bank Verification**

**Where:** Cloud & Maps tab → Razorpay tab

**Enable Steps:**
1. Enable edit mode
2. Toggle **"Razorpay Bank Verification"** ON
3. Enter **Key ID:** Your Razorpay key (starts with `rzp_`)
4. Enter **Key Secret:** Your Razorpay secret key
5. Save changes

**What It Does:**
- Verifies vendor bank accounts during onboarding
- Checks IFSC code validity
- Validates account numbers
- Prevents fraud

---

## 🗺️ **GOOGLE MAPS SETUP**

**Where:** Cloud & Maps tab → Google Maps tab

**Enable Steps:**
1. Enable edit mode
2. Toggle **"Google Maps Platform"** ON
3. Enter **API Key:** Your Google Maps API key (starts with `AIza`)
4. Enter **Region:** `IN` (for India)
5. Save changes

**What It Does:**
- Address autocomplete
- Distance calculation
- Delivery routing
- Store locator

**How to Get API Key:**
1. Go to Google Cloud Console
2. Enable Maps JavaScript API
3. Enable Geocoding API
4. Enable Places API
5. Create credentials → API Key
6. Restrict to your domain

---

## 💰 **PAYMENT GATEWAY SETUP**

**Where:** Payment Gateway tab

### **Razorpay**
1. Enable edit mode
2. Click **Razorpay** tab
3. Toggle **Enable** ON
4. Enter **Key ID**
5. Enter **Key Secret**
6. Enter **Webhook Secret**
7. Set **Commission %** (default: 15%)
8. Set **Settlement Period** (default: 3 days)
9. Save settings

### **Stripe**
1. Click **Stripe** tab
2. Toggle Enable ON
3. Enter Publishable Key
4. Enter Secret Key
5. Save settings

### **Paytm**
1. Click **Paytm** tab
2. Toggle Enable ON
3. Enter Merchant ID
4. Enter Merchant Key
5. Save settings

---

## 🚚 **LOGISTICS SETUP**

**Where:** Logistics Integration tab

### **Shiprocket**
1. Enable edit mode
2. Toggle **Enable** ON
3. Enter **Email**
4. Enter **Password**
5. Enable **Auto AWB** (automatic waybill)
6. Enable **Auto Pickup**
7. Save settings

### **Other Providers**
- Delhivery
- BlueDart
(Similar steps as Shiprocket)

---

## 📋 **QUICK CHECKLIST**

### **Day 1 Setup (Essential):**
- [ ] Configure AWS IAM Credentials
- [ ] Enable S3 (for media storage)
- [ ] Enable SNS (for OTP/notifications)
- [ ] Configure Razorpay (for payments)
- [ ] Enable Google Maps (for addresses)

### **Week 1 Setup (Important):**
- [ ] Enable AWS Chime (for video)
- [ ] Enable Razorpay Bank Verification
- [ ] Configure Shiprocket (for deliveries)
- [ ] Set Commission & Settlement rules

### **Month 1 Setup (Optional):**
- [ ] Enable AWS Bedrock (for AI features)
- [ ] Configure Stripe/Paytm (backup gateways)
- [ ] Add Delhivery/BlueDart (backup logistics)
- [ ] Set up AWS SQS (for job queues)

---

## 🚨 **COMMON ISSUES**

### **"Failed to save settings"**
**Solution:**
1. Check internet connection
2. Verify you entered passcode correctly
3. Try again after 30 seconds
4. Clear browser cache

### **"Invalid Access Key ID"**
**Solution:**
1. Verify key starts with `AKIA` or `ASIA`
2. No spaces before/after key
3. Check if key is active in AWS Console
4. Generate new key if needed

### **"S3 uploads not working"**
**Solution:**
1. Verify bucket name is correct
2. Check bucket exists in AWS
3. Verify IAM user has S3 permissions
4. Check region matches

### **"SNS not sending SMS"**
**Solution:**
1. Verify phone number format: `+91XXXXXXXXXX`
2. Check number is verified in AWS SNS
3. Check AWS SNS quotas
4. Verify region is correct

### **"Google Maps not loading"**
**Solution:**
1. Verify API key is correct
2. Check billing is enabled in Google Cloud
3. Verify APIs are enabled (Maps, Places, Geocoding)
4. Check domain restrictions

---

## 🔒 **SECURITY BEST PRACTICES**

### **DO:**
✅ Change passcode after initial setup  
✅ Use strong AWS credentials  
✅ Enable MFA on AWS account  
✅ Restrict API keys to specific domains  
✅ Rotate credentials every 90 days  
✅ Monitor AWS costs regularly  
✅ Keep backups of settings  

### **DON'T:**
❌ Share passcode with unauthorized users  
❌ Commit credentials to git  
❌ Use same credentials across environments  
❌ Ignore AWS cost alerts  
❌ Disable services without testing  
❌ Modify settings without backup  

---

## 💡 **PRO TIPS**

1. **Test in Staging First:**
   - Always test new settings in staging before production
   - Verify uploads, SMS, emails work

2. **Monitor Costs:**
   - Check AWS billing dashboard weekly
   - Set up cost alerts
   - Disable unused services

3. **Keep Documentation:**
   - Document all credential sources
   - Note when settings were changed
   - Keep audit trail

4. **Regular Backups:**
   - Export settings monthly
   - Keep offline backup of credentials
   - Document recovery procedures

5. **Service Dependencies:**
   - S3 required for media uploads
   - SNS required for OTP/notifications
   - Maps required for address autocomplete
   - Razorpay required for payments

---

## 📊 **SERVICE STATUS CHECK**

After configuring, verify:

### **AWS S3:**
- [ ] Upload test image
- [ ] Verify image URL works
- [ ] Check image appears in S3 bucket

### **AWS SNS:**
- [ ] Send test OTP
- [ ] Verify SMS delivery
- [ ] Check email notifications

### **Google Maps:**
- [ ] Test address autocomplete
- [ ] Verify suggestions appear
- [ ] Check distance calculations

### **Razorpay:**
- [ ] Create test payment
- [ ] Verify webhook works
- [ ] Check settlement period

### **Shiprocket:**
- [ ] Create test shipment
- [ ] Verify AWB generated
- [ ] Check tracking works

---

## 🆘 **EMERGENCY CONTACTS**

### **Technical Issues:**
- Platform Support: support@warmpawz.com
- AWS Support: Your AWS TAM
- Razorpay Support: support@razorpay.com
- Google Maps Support: maps-support@google.com

### **Critical Failures:**
1. Disable affected service immediately
2. Enable fallback service if available
3. Contact technical support
4. Document issue and resolution

---

## ✅ **SUCCESS INDICATORS**

Your setup is successful when:

✅ All toggles are green (enabled)  
✅ Test uploads go to S3  
✅ OTP SMS arrives within 30 seconds  
✅ Address autocomplete works  
✅ Test payments process successfully  
✅ Video calls connect  
✅ Bank verification works  
✅ No console errors  
✅ Settings persist after page refresh  

---

## 🎓 **TRAINING CHECKLIST**

- [ ] Admin knows how to access settings
- [ ] Admin can unlock with passcode
- [ ] Admin tested each service
- [ ] Admin knows how to troubleshoot
- [ ] Admin documented credentials
- [ ] Admin set up monitoring
- [ ] Admin tested emergency procedures

---

## 📞 **NEXT STEPS**

After setup complete:

1. **Week 1:**
   - Monitor service usage
   - Check error logs daily
   - Verify all features working
   - Train backup admin

2. **Month 1:**
   - Review AWS costs
   - Optimize configurations
   - Enable optional services
   - Document any issues

3. **Ongoing:**
   - Monthly credential review
   - Quarterly cost optimization
   - Annual security audit
   - Continuous monitoring

---

**Status:** Ready for Production 🚀  
**Support Available:** 24/7  
**Documentation Version:** 1.0.0  

**Remember:** When in doubt, contact support BEFORE making changes!

🐾 **Happy Managing!**
