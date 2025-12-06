# 🌐 Warmpawz - External Tester Access Guide

## 🎯 Quick Start for External Testers

### Step 1: Access the Application
**You will receive a URL that looks like one of these:**
```
Option A: Figma Make Preview URL
https://[figma-make-domain]/preview/[project-id]

Option B: Custom Deployment URL (if deployed externally)
https://warmpawz-uat.vercel.app
https://warmpawz-uat.netlify.app
```

⚠️ **Important:** This URL will be provided by the project owner. If you haven't received it, please contact them.

---

## 📱 Quick Test (30 seconds)

### Test Account: Returning User
1. Open the app URL
2. Enter phone: **9611377119**
3. Click "Continue"
4. Enter OTP: **123456**
5. Click "Verify Code"
6. ✅ **You should see:** Home screen with 2 pets (Bruno & Luna)

### Test Account: New User
1. Open the app URL
2. Enter any 10-digit phone: **9876543210**
3. Click "Continue"
4. Enter OTP: **123456**
5. Click "Verify Code"
6. ✅ **You should see:** Welcome screen with journey options

---

## 🖥️ Supported Devices & Browsers

### ✅ Recommended
- **Mobile:** iPhone (Safari), Android (Chrome)
- **Desktop:** Chrome, Edge, Firefox, Safari
- **Screen Size:** Best viewed at 430px width (mobile)

### ⚠️ Browser Requirements
- JavaScript: Enabled
- Cookies: Enabled
- Pop-ups: Allowed

---

## 🔐 UAT Test Mode

**All phone numbers work with fixed OTP: 123456**

This is for testing only. In production:
- Real OTP will be sent via SMS
- OTP will expire after 5 minutes
- Maximum 3 attempts allowed

---

## 📊 What to Test

### Critical Flows (Must Test)
1. ✅ **Login** - Can you login successfully?
2. ✅ **Onboarding** - Can you complete profile setup?
3. ✅ **Add Pet** - Can you add a pet?
4. ✅ **Browse Services** - Can you see services?
5. ✅ **State Persistence** - Does it remember you after refresh?

### Optional Tests
- Browse different service categories
- View vendor profiles
- Navigate through the app
- Check mobile responsiveness

---

## 🐛 How to Report Issues

### Quick Issue Report
Send to project owner with:
1. **Screenshot** of the issue
2. **Steps to reproduce**
   - "I clicked X"
   - "Then I did Y"
   - "Expected Z but got W"
3. **Your device**: iPhone 14 / Samsung Galaxy S21 / Desktop Chrome
4. **Phone number used**: 9611377119 or 9876543210

### Issue Severity Guide
- 🔴 **Critical:** App crashes, cannot login, data loss
- 🟡 **High:** Feature doesn't work, major UI issues
- 🟢 **Low:** Minor text issues, small styling problems

---

## ⚡ Troubleshooting

### Issue: "Page not loading"
- ✅ Check internet connection
- ✅ Try refreshing (Ctrl+R or Cmd+R)
- ✅ Try incognito/private mode
- ✅ Clear browser cache

### Issue: "OTP not working"
- ✅ Use: **123456** (fixed for testing)
- ✅ Make sure you're entering 6 digits
- ✅ Try again after 1 minute

### Issue: "Stuck on loading screen"
- ✅ Wait 10 seconds
- ✅ Refresh the page
- ✅ Try a different browser
- ✅ Report to project owner

### Issue: "Can't see my data after refresh"
- ✅ Make sure you completed onboarding
- ✅ Try logging in again
- ✅ Check if cookies are enabled

---

## 📞 Support Contact

**Project Owner:** [To be provided]  
**Email:** [To be provided]  
**Response Time:** Within 24 hours

---

## ✨ Testing Tips

1. **Mobile is key** - This is a mobile-first app. Test on your phone!
2. **Be thorough** - Try to break it! That's how we improve.
3. **Be specific** - "It doesn't work" → "When I click X, nothing happens"
4. **Use real scenarios** - Imagine you're actually booking a service

---

## 📸 Screenshot Guide

### How to Take Screenshots

**iPhone:**
- Press Power + Volume Up

**Android:**
- Press Power + Volume Down

**Desktop:**
- Windows: Windows Key + Shift + S
- Mac: Cmd + Shift + 4

**Where to send:**
- Email to project owner
- Upload to shared folder
- Send via WhatsApp/Slack

---

## 🎉 Thank You!

Your testing helps make Warmpawz better for all pet parents! 🐾

**Testing Phase:** UAT  
**Duration:** [To be provided]  
**Version:** 1.0  
**Last Updated:** November 18, 2025

---

## 📋 Quick Reference Card

```
╔════════════════════════════════════════╗
║       WARMPAWZ UAT TEST ACCESS         ║
╠════════════════════════════════════════╣
║ URL: [Provided by project owner]      ║
║                                        ║
║ Test Account 1 (Existing User):       ║
║ Phone: 9611377119                     ║
║ OTP: 123456                           ║
║ Expected: Home screen with pets       ║
║                                        ║
║ Test Account 2 (New User):            ║
║ Phone: Any 10-digit number            ║
║ OTP: 123456                           ║
║ Expected: Onboarding flow             ║
║                                        ║
║ Support: [Contact info]               ║
╚════════════════════════════════════════╝
```

Print this card or save it on your phone! 📱
