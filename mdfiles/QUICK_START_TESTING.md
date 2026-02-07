# Quick Start Testing Guide

**For:** UAT Testing  
**URL:** https://d2aoyjj8ine0wk.cloudfront.net  
**Credentials:** Phone `123456`, OTP `123456`

---

## 🚀 Quick Test Flows

### 1. GPS Tracking (5 minutes)

1. Login → Book Vet at Home → Pay
2. Vendor: Update status to "in_progress"
3. Customer: Check home page → See "Attention" section
4. Click booking → See "Live Tracking Active" button
5. Click button → See tracking map

**✅ Success:** All steps work

---

### 2. Medical Records (3 minutes)

1. Vendor: Upload medical record
2. Customer: View booking → See "Medical Records" button
3. Click button → See records

**✅ Success:** Records display

---

### 3. Tele Queue (3 minutes)

1. Book tele consultation → Pay
2. See confirmation page → See queue position
3. Wait 10 seconds → See position update

**✅ Success:** Queue position shows and updates

---

### 4. Pharmacy Order (5 minutes)

1. Create pharmacy order
2. See order status page → See "Finding pharmacy..."
3. Wait 10 seconds → See status update
4. Pharmacy accepts → See pharmacy details

**✅ Success:** Status updates correctly

---

## ✅ All Tests Pass = Ready for Production

