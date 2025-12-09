# ✅ DEPLOYMENT CHECKLIST - AWS Integrations

**Platform:** Warmpawz Multi-Vendor Pet Marketplace  
**Date:** December 9, 2025  
**Version:** 1.0.0  

---

## 🎯 **PRE-DEPLOYMENT CHECKLIST**

### **1. Code Review** ✓
- [x] All files created/modified
- [x] TypeScript types defined
- [x] No console.log in production code
- [x] Error handling implemented
- [x] Loading states added
- [x] Toast notifications configured

### **2. Security Audit** ✓
- [x] Password protection implemented (`Warmpawz2025`)
- [x] Credentials stored in KV store (encrypted)
- [x] No secrets in frontend code
- [x] All inputs validated
- [x] XSS prevention in place
- [x] HTTPS enforced

### **3. Documentation** ✓
- [x] Technical documentation complete
- [x] Admin quick start guide written
- [x] Architecture diagrams created
- [x] API endpoints documented
- [x] Troubleshooting guide included

---

## 🔧 **AWS SETUP CHECKLIST**

### **AWS Account Setup:**
- [ ] AWS account created/accessed
- [ ] Billing alerts configured
- [ ] Budget set ($50/month recommended)
- [ ] Root account MFA enabled

### **IAM User Creation:**
- [ ] Create IAM user: `warmpawz-backend`
- [ ] Generate access keys
- [ ] Save Access Key ID
- [ ] Save Secret Access Key
- [ ] Download CSV backup

### **IAM Permissions:**
- [ ] Attach S3 permissions
  ```json
  {
    "Effect": "Allow",
    "Action": [
      "s3:PutObject",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:CreateBucket"
    ],
    "Resource": "*"
  }
  ```
- [ ] Attach SNS permissions
  ```json
  {
    "Effect": "Allow",
    "Action": [
      "sns:Publish",
      "sns:CreateTopic",
      "sns:Subscribe"
    ],
    "Resource": "*"
  }
  ```
- [ ] Attach SQS permissions
- [ ] Attach Chime SDK permissions
- [ ] Attach Bedrock permissions

### **S3 Bucket Setup:**
- [ ] Create bucket: `warmpawz-media-prod`
- [ ] Region: `ap-south-1`
- [ ] Enable versioning
- [ ] Configure CORS:
  ```json
  [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["https://warmpawz.com"],
      "ExposeHeaders": []
    }
  ]
  ```
- [ ] Set up lifecycle rules (optional)
- [ ] Enable CloudFront CDN (optional)

### **SNS Setup:**
- [ ] Request production SMS quota increase
- [ ] Verify origination number: `+91XXXXXXXXXX`
- [ ] Configure SMS sender ID
- [ ] Verify email address: `noreply@warmpawz.com`
- [ ] Set up email domain (SES)
- [ ] Test SMS delivery
- [ ] Test email delivery

### **SQS Setup:**
- [ ] Create queue: `warmpawz-jobs-prod`
- [ ] Set visibility timeout: 300 seconds
- [ ] Enable dead letter queue
- [ ] Configure queue policy
- [ ] Test message sending

### **Chime SDK Setup:**
- [ ] Enable Chime SDK in account
- [ ] Region: `us-east-1` (required)
- [ ] Test meeting creation
- [ ] Configure attendee limits

### **Bedrock Setup:**
- [ ] Request model access (Claude)
- [ ] Region: `us-east-1`
- [ ] Enable model: `anthropic.claude-v2`
- [ ] Test API call
- [ ] Configure quotas

---

## 💳 **PAYMENT GATEWAY SETUP**

### **Razorpay:**
- [ ] Create Razorpay account
- [ ] Complete KYC verification
- [ ] Generate API keys
  - [ ] Key ID: `rzp_live_xxxxx`
  - [ ] Key Secret: `xxxxx`
- [ ] Generate webhook secret
- [ ] Configure webhook URL:
  ```
  https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/payments/razorpay/webhook
  ```
- [ ] Test payment flow
- [ ] Verify bank account validation API access
- [ ] Configure settlement period
- [ ] Set commission percentage

### **Stripe (Optional):**
- [ ] Create Stripe account
- [ ] Get publishable key
- [ ] Get secret key
- [ ] Configure webhooks
- [ ] Test payment

### **Paytm (Optional):**
- [ ] Create Paytm merchant account
- [ ] Get merchant ID
- [ ] Get merchant key
- [ ] Test payment

---

## 🗺️ **GOOGLE MAPS SETUP**

### **Google Cloud Console:**
- [ ] Create/access Google Cloud project
- [ ] Enable billing
- [ ] Enable required APIs:
  - [ ] Maps JavaScript API
  - [ ] Places API
  - [ ] Geocoding API
  - [ ] Directions API
  - [ ] Distance Matrix API

### **API Key Configuration:**
- [ ] Create API key
- [ ] Copy key: `AIza...`
- [ ] Restrict API key to:
  - [ ] HTTP referrers: `https://warmpawz.com/*`
  - [ ] IP addresses (backend): Your server IPs
- [ ] Set usage quotas
- [ ] Enable quota alerts

---

## 🚚 **LOGISTICS SETUP**

### **Shiprocket:**
- [ ] Create Shiprocket account
- [ ] Complete merchant verification
- [ ] Add warehouse address
- [ ] Get API credentials
- [ ] Configure auto AWB
- [ ] Configure auto pickup
- [ ] Test shipment creation

### **Delhivery (Optional):**
- [ ] Create account
- [ ] Get API key
- [ ] Configure warehouse

### **BlueDart (Optional):**
- [ ] Create account
- [ ] Get credentials
- [ ] Test integration

---

## 🗄️ **BACKEND DEPLOYMENT**

### **Supabase Setup:**
- [ ] Verify Supabase project is running
- [ ] Check KV store is accessible
- [ ] Verify Edge Functions deployed
- [ ] Test all endpoints:
  ```bash
  # Test AWS settings endpoint
  curl https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/settings/aws
  
  # Test Google Maps endpoint
  curl https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/settings/google-maps
  
  # Test Payment Gateway endpoint
  curl https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/settings/payment-gateway
  ```

### **Environment Variables:**
- [ ] No hardcoded credentials
- [ ] All secrets in KV store
- [ ] Backup credentials stored securely

---

## 🎨 **FRONTEND DEPLOYMENT**

### **Build & Test:**
- [ ] Run build locally
  ```bash
  npm run build
  ```
- [ ] No build errors
- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] Test in development
- [ ] Test in production mode

### **Vercel Deployment:**
- [ ] Deploy to Vercel
- [ ] Verify deployment URL
- [ ] Test all pages load
- [ ] Test platform settings page
- [ ] Verify password dialog works

---

## ⚙️ **INITIAL CONFIGURATION**

### **Admin Portal Setup:**
- [ ] Log in to admin portal
- [ ] Navigate to Platform Settings
- [ ] Click "Enable Edit Mode"
- [ ] Enter passcode: `Warmpawz2025`

### **AWS Configuration:**
- [ ] Enter AWS Access Key ID
- [ ] Enter AWS Secret Access Key
- [ ] Set default region: `ap-south-1`
- [ ] Enable S3
  - [ ] Bucket: `warmpawz-media-prod`
  - [ ] Region: `ap-south-1`
- [ ] Enable SNS
  - [ ] SMS number: `+91XXXXXXXXXX`
  - [ ] Email: `noreply@warmpawz.com`
  - [ ] Region: `ap-south-1`
- [ ] Enable SQS (if needed)
- [ ] Enable Chime SDK
  - [ ] Region: `us-east-1`
- [ ] Enable Bedrock AI
  - [ ] Region: `us-east-1`
  - [ ] Model: `anthropic.claude-v2`
- [ ] Click "Save All Changes"
- [ ] Verify success toast

### **Razorpay Configuration:**
- [ ] Switch to Razorpay tab
- [ ] Enable bank verification
- [ ] Enter Key ID
- [ ] Enter Key Secret
- [ ] Save settings

### **Google Maps Configuration:**
- [ ] Switch to Maps tab
- [ ] Enable Google Maps
- [ ] Enter API key
- [ ] Set region: `IN`
- [ ] Save settings

### **Verify Persistence:**
- [ ] Refresh page
- [ ] Verify all settings retained
- [ ] Verify edit mode locked
- [ ] Check console for errors

---

## 🧪 **TESTING PHASE**

### **Functional Testing:**

**1. S3 Upload Test:**
- [ ] Upload test image
- [ ] Verify appears in S3 bucket
- [ ] Verify URL is accessible
- [ ] Test different file types (JPG, PNG, PDF)
- [ ] Test file size limits

**2. SNS SMS Test:**
- [ ] Trigger OTP flow
- [ ] Verify SMS received
- [ ] Check delivery time (<30 seconds)
- [ ] Test international numbers
- [ ] Check SMS format

**3. SNS Email Test:**
- [ ] Trigger notification
- [ ] Verify email received
- [ ] Check spam folder
- [ ] Verify email formatting
- [ ] Test attachments

**4. Chime Video Test:**
- [ ] Create test meeting
- [ ] Join from desktop
- [ ] Join from mobile
- [ ] Test video quality
- [ ] Test audio quality
- [ ] Test screen sharing

**5. Bedrock AI Test:**
- [ ] Trigger symptom checker
- [ ] Verify AI response
- [ ] Check response time
- [ ] Test different queries
- [ ] Verify token usage

**6. Google Maps Test:**
- [ ] Test address autocomplete
- [ ] Verify suggestions appear
- [ ] Test distance calculation
- [ ] Test routing
- [ ] Check pin accuracy

**7. Razorpay Test:**
- [ ] Test payment creation
- [ ] Verify webhook delivery
- [ ] Test bank verification
- [ ] Check IFSC validation
- [ ] Verify payout calculation

**8. Settings Persistence:**
- [ ] Modify settings
- [ ] Save changes
- [ ] Refresh page
- [ ] Verify all persisted
- [ ] Check timestamps

### **Security Testing:**
- [ ] Test with wrong passcode
- [ ] Verify edit lock works
- [ ] Test XSS prevention
- [ ] Check CORS configuration
- [ ] Verify HTTPS enforcement
- [ ] Test rate limiting

### **Performance Testing:**
- [ ] Page load time (<2 seconds)
- [ ] Settings save time (<1 second)
- [ ] Upload speed acceptable
- [ ] API response time (<500ms)
- [ ] No memory leaks

### **Error Handling:**
- [ ] Test network failure
- [ ] Test invalid credentials
- [ ] Test quota exceeded
- [ ] Test timeout scenarios
- [ ] Verify error messages

---

## 📊 **MONITORING SETUP**

### **AWS CloudWatch:**
- [ ] Set up dashboards
- [ ] Configure alarms:
  - [ ] S3 storage >80% of budget
  - [ ] SNS messages >1000/day
  - [ ] SQS queue depth >100
  - [ ] API errors >10/hour
- [ ] Enable logs
- [ ] Set up metrics

### **Cost Monitoring:**
- [ ] Enable AWS Cost Explorer
- [ ] Set budget alerts
- [ ] Configure spending limits
- [ ] Review daily costs
- [ ] Set up monthly reports

### **Application Monitoring:**
- [ ] Set up error tracking (Sentry)
- [ ] Configure performance monitoring
- [ ] Enable user analytics
- [ ] Track key metrics
- [ ] Set up alerts

---

## 🚀 **GO-LIVE CHECKLIST**

### **Final Verification:**
- [ ] All tests passed
- [ ] No critical errors
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Documentation complete
- [ ] Team trained
- [ ] Backup plan ready
- [ ] Rollback plan documented

### **Communication:**
- [ ] Notify stakeholders
- [ ] Update status page
- [ ] Prepare support team
- [ ] Document known issues
- [ ] Set up support channels

### **Launch:**
- [ ] Switch to production mode
- [ ] Enable for all users
- [ ] Monitor closely (24 hours)
- [ ] Address issues immediately
- [ ] Collect feedback

---

## 📅 **POST-DEPLOYMENT**

### **Day 1:**
- [ ] Monitor error logs every hour
- [ ] Check AWS costs
- [ ] Verify all features working
- [ ] Address critical issues
- [ ] Gather user feedback
- [ ] Document any issues

### **Week 1:**
- [ ] Daily error log review
- [ ] Check cost trends
- [ ] Optimize as needed
- [ ] Fix reported bugs
- [ ] Update documentation
- [ ] Team retrospective

### **Month 1:**
- [ ] Weekly cost review
- [ ] Performance optimization
- [ ] Security audit
- [ ] Feature usage analysis
- [ ] Scale planning
- [ ] Documentation updates

---

## 🔄 **MAINTENANCE SCHEDULE**

### **Daily:**
- [ ] Check error logs
- [ ] Monitor critical alerts
- [ ] Verify backups
- [ ] Check service status

### **Weekly:**
- [ ] Review AWS costs
- [ ] Check storage usage
- [ ] Review security logs
- [ ] Update documentation

### **Monthly:**
- [ ] Security audit
- [ ] Performance review
- [ ] Cost optimization
- [ ] Credential rotation
- [ ] Backup verification

### **Quarterly:**
- [ ] Major security audit
- [ ] Infrastructure review
- [ ] Disaster recovery test
- [ ] Team training
- [ ] Architecture review

### **Annually:**
- [ ] Full security audit
- [ ] Penetration testing
- [ ] Cost analysis
- [ ] Technology updates
- [ ] Strategy planning

---

## 🆘 **EMERGENCY PROCEDURES**

### **Service Outage:**
1. Check AWS service health
2. Verify credentials valid
3. Check quotas not exceeded
4. Review recent changes
5. Contact AWS support if needed
6. Enable fallback services
7. Notify users
8. Document incident

### **Security Breach:**
1. Immediately rotate all credentials
2. Review access logs
3. Identify compromised systems
4. Isolate affected components
5. Notify security team
6. File incident report
7. Implement fixes
8. Post-mortem analysis

### **Cost Spike:**
1. Check AWS Cost Explorer
2. Identify spike source
3. Disable unnecessary services
4. Review usage patterns
5. Optimize configurations
6. Set up alerts
7. Budget adjustment

---

## ✅ **SIGN-OFF**

### **Deployment Team:**
- [ ] Backend Engineer: _______________
- [ ] Frontend Engineer: _______________
- [ ] DevOps Engineer: _______________
- [ ] QA Engineer: _______________
- [ ] Security Engineer: _______________
- [ ] Product Manager: _______________

### **Approval:**
- [ ] Technical Lead: _______________
- [ ] CTO: _______________
- [ ] Date: _______________

---

## 📝 **NOTES**

```
Additional notes, observations, or issues encountered during deployment:

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

```

---

**Deployment Status:** ⏳ **PENDING**  
**Last Updated:** December 9, 2025  
**Checklist Version:** 1.0.0  

**🚀 Ready to Deploy! Follow this checklist step-by-step for successful launch.**

---

**Post-Deployment Status Update:**

- [ ] Deployment Successful ✅
- [ ] Partial Deployment (Issues: _______________)
- [ ] Deployment Failed (Reason: _______________)

**Date Deployed:** _______________  
**Deployed By:** _______________  
**Production URL:** _______________  

🎉 **Congratulations on successful deployment!**
