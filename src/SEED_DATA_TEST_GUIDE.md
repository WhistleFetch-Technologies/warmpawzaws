# 🌱 Vendor Seed Data - Complete Testing Guide

## ✅ System Overview

The seed data system is now **fully dynamic** and generates vendor applications based on your role configurations with:
- ✅ Complete document generation (all required documents per role)
- ✅ Base64-encoded sample documents for preview
- ✅ Download functionality for all documents
- ✅ Dynamic form fields based on onboarding rules
- ✅ All vendors use OTP: **123456**

---

## 📋 Pre-Test Checklist

Before seeding data, ensure:
1. ✅ Role configurations are created (via Admin → Catalog & Services)
2. ✅ Each role has `documentRequirements` defined
3. ✅ Each role has `onboardingFields` configured
4. ✅ Backend server is running

---

## 🚀 Step-by-Step Testing Instructions

### **STEP 1: Seed the Data**

1. Navigate to **Admin Portal** → **Vendor Administration**
2. Click the **"🌱 Seed Test Data"** button (green button)
3. Confirm the action
4. ✅ **Expected Result:**
   - Success message: "Created X vendor applications"
   - Console shows: `🎉 Seed data generation complete!`
   - Vendors appear in the pending applications list

---

### **STEP 2: View Pending Applications**

1. Look at the **New Vendor Applications** table
2. ✅ **Verify:**
   - Each vendor shows name, category, progress bar
   - Priority badges (High/Medium/Low) are displayed
   - Phone numbers are unique (+91 9876543210 - +91 9876543236)
   - Action buttons (Approve, Reject, View) are visible

---

### **STEP 3: View Application Details**

1. Click the **Eye icon** (👁️) on any application
2. ✅ **Verify Details Tab:**
   - Full Name displayed correctly
   - Business Name (if applicable)
   - Phone & Email
   - Service Category & Vendor Type
   - Full Address with City, State, Pincode
   - GST/PAN/License numbers (if applicable)
   - Application submission timestamp

---

### **STEP 4: View & Test Documents** ⭐ **CRITICAL TEST**

1. Click on the **"Documents & Certificates"** tab
2. ✅ **Verify Document Display:**
   - All required documents are listed
   - Each document shows:
     - ✅ Document name (e.g., "Aadhar Card - Front")
     - ✅ Category badge (e.g., "Identity Proof")
     - ✅ Document type (e.g., "aadhaar_front")
     - ✅ File name (e.g., "aadhaar_front.jpg")
     - ✅ File size (e.g., "250.5 KB")
   - Each document has **View** and **Download** buttons

3. ✅ **Test Preview Functionality:**
   - Click **"View"** button on any document
   - Document opens in new tab
   - Image displays correctly (base64 encoded)
   - No broken images or errors

4. ✅ **Test Download Functionality:**
   - Click **"Download"** button on any document
   - File downloads with correct name
   - File can be opened (JPG format)
   - Image content is visible

5. ✅ **Verify Document Types:**
   - Documents should include (based on role):
     - Aadhar Card (Front & Back)
     - PAN Card
     - Cancelled Cheque
     - GST Certificate (for business vendors)
     - Professional License (for healthcare/service providers)
     - Police Verification (for home service providers)
     - Address Proof

---

### **STEP 5: Test Approval Flow**

1. From the application detail modal, click **"Approve Application"**
2. Confirm approval
3. ✅ **Expected Result:**
   - Success message appears
   - Modal closes
   - Application disappears from pending list
   - Console shows: `✅ Application approved successfully`
   - Vendor status changes to `approved`

---

### **STEP 6: Test Rejection Flow**

1. Open another application
2. Click **"Reject Application"**
3. Enter rejection reason: "Incomplete documentation"
4. Click **"Confirm Rejection"**
5. ✅ **Expected Result:**
   - Success message appears
   - Modal closes
   - Application disappears from pending list
   - Console shows: `✅ Application rejected successfully`
   - Vendor status changes to `rejected`

---

### **STEP 7: Test Document Re-Upload Request**

1. Open an application with documents
2. Go to **Documents** tab
3. Click **"Request Document Re-upload"**
4. ✅ **Expected Result:**
   - Alert: "✅ Document re-upload request sent successfully!"
   - Modal closes
   - Vendor status changes to `documents_required`

**Then verify on vendor side:**
1. Login as vendor using phone: `+91 9876543210`
2. Use OTP: `123456`
3. ✅ **Verify:**
   - Orange warning banner appears
   - "Re-upload Documents" button visible
   - Form pre-filled with existing data
   - Can upload new documents

---

### **STEP 8: Test Request Clarification**

1. Open an application
2. Click **"Request Clarification"**
3. Enter notes: "Please provide business registration details"
4. Click **"Send Clarification Request"**
5. ✅ **Expected Result:**
   - Request sent successfully
   - Vendor notified (status changes to `clarification_requested`)

---

### **STEP 9: Verify Console Logs** 🔍

Open browser console and verify:
```
🌱 Starting dynamic vendor seed data generation...
📋 Found X role configurations
🎯 Processing role: Veterinarian
   📄 Generating documents for role: Veterinarian
   ✅ Generated 6 documents
   📝 Creating vendor: Dr. Priya Sharma
   ✅ Vendor saved to: vendor:vendor_9876543210
   ✅ Application saved to: vendor:application:APPXXX
🎉 Seed data generation complete!
   Total vendors created: 21
```

---

### **STEP 10: Test Flush & Re-Seed**

1. Click **"🗑️ Flush All"** button
2. Double-confirm deletion
3. ✅ **Verify:**
   - All vendors deleted
   - Pending list empty
   - Console shows: `✅ Cleared X vendor records`

4. Click **"🌱 Seed Test Data"** again
5. ✅ **Verify:**
   - Fresh vendors created
   - All documents present
   - No conflicts or errors

---

## 🎯 Success Criteria

✅ **All Tests Pass If:**
1. Seed creates 3 vendors per role category
2. Each vendor has all required documents
3. Documents can be previewed (open in new tab)
4. Documents can be downloaded
5. Document images display correctly (not broken)
6. Approve/Reject actions work correctly
7. Document re-upload requests work
8. Flush & re-seed works without errors
9. Console logs show no errors
10. All OTP logins use `123456`

---

## 🐛 Common Issues & Fixes

### Issue 1: "No documents uploaded"
**Fix:** Check that role has `documentRequirements` configured

### Issue 2: Documents show but images are broken
**Fix:** Verify base64 encoding in seed-data.tsx

### Issue 3: Download doesn't work
**Fix:** Check browser allows data URI downloads

### Issue 4: Seed fails with "No role configurations"
**Fix:** Create roles first via Catalog & Services admin panel

### Issue 5: Application ID not found
**Fix:** Check that both `vendor:application:${appId}` and `vendor:${vendorId}` are created

---

## 📊 Expected Document Structure

Each document should have:
```json
{
  "type": "aadhaar_front",
  "name": "Aadhar Card - Front",
  "category": "Identity Proof",
  "required": true,
  "preview": "data:image/jpeg;base64,...",
  "fileName": "aadhaar_front.jpg",
  "fileType": "image/jpeg",
  "fileSize": 245678,
  "uploadedAt": "2024-01-15T10:30:00.000Z",
  "status": "uploaded"
}
```

---

## 🔑 Test Credentials

**All Vendor Phones:** +91 9876543210 through +91 9876543236  
**OTP for All:** `123456`  
**Admin Master Key:** `warmpawz2025`

---

## 📝 Test Report Template

Use this to track your testing:

```
[ ] Step 1: Seed Data Created
    - Vendors Created: ___
    - Roles Covered: ___
    
[ ] Step 2: View Applications
    - All vendors visible: Yes/No
    - Data correct: Yes/No
    
[ ] Step 3: View Details
    - All fields populated: Yes/No
    - No missing data: Yes/No
    
[ ] Step 4: View Documents ⭐
    - Document count: ___
    - Preview works: Yes/No
    - Download works: Yes/No
    - Images display: Yes/No
    
[ ] Step 5: Approve Flow
    - Approval successful: Yes/No
    - Status updated: Yes/No
    
[ ] Step 6: Reject Flow
    - Rejection successful: Yes/No
    - Reason recorded: Yes/No
    
[ ] Step 7: Re-upload Request
    - Request sent: Yes/No
    - Vendor notified: Yes/No
    
[ ] Step 8: Clarification
    - Request sent: Yes/No
    - Notes saved: Yes/No
    
[ ] Step 9: Console Logs
    - No errors: Yes/No
    - All logs present: Yes/No
    
[ ] Step 10: Flush & Re-seed
    - Flush successful: Yes/No
    - Re-seed successful: Yes/No
```

---

## 🎉 You're All Set!

The seed data system is now production-ready. You can:
- **Seed vendors with one click**
- **Preview all documents before approving**
- **Download documents for verification**
- **Test approval/rejection workflows**
- **Request document re-uploads**
- **Flush and repeat testing**

All functionality is **fully dynamic** and adapts to your role configurations! 🚀
