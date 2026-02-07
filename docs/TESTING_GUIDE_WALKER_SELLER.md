# 🧪 Testing Guide: Walker & Seller Onboarding

**Date:** January 15, 2026  
**Purpose:** Comprehensive testing guide for walker and seller role onboarding flows

---

## 📋 Pre-Testing Checklist

### Environment Setup
- [ ] Backend API is running and accessible
- [ ] Frontend application is running
- [ ] Database is accessible
- [ ] Google Maps API key is configured (for location pinning)
- [ ] File upload endpoint is working
- [ ] Test phone numbers available for vendor registration

### Test Accounts
- [ ] Create test walker account (phone: `+91-9876543210`)
- [ ] Create test seller account (phone: `+91-9876543211`)
- [ ] Admin account for approval testing

---

## 🐾 Walker Onboarding Testing

### Test Case 1: Basic Walker Onboarding Flow

**Steps:**
1. Navigate to vendor registration page
2. Enter phone number: `+91-9876543210`
3. Select role: **Walker** or **Pet Walker**
4. Verify role-specific fields appear
5. Fill in all required fields
6. Submit form
7. Verify submission success

**Expected Results:**
- ✅ Walker role is available in role selection
- ✅ Role-specific fields appear after role selection
- ✅ All 10 walker-specific fields are visible
- ✅ Form validates all required fields
- ✅ Submission succeeds

---

### Test Case 2: Walker Field Validation

#### 2.1 GPS Tracking Field
**Steps:**
1. Navigate to walker onboarding form
2. Find "Enable GPS Tracking" checkbox
3. Verify default is checked (true)
4. Uncheck and verify it can be unchecked
5. Leave unchecked and submit
6. Verify form accepts unchecked value

**Expected Results:**
- ✅ Checkbox defaults to checked
- ✅ Can be toggled on/off
- ✅ Form accepts both checked and unchecked states

#### 2.2 Service Radius Field
**Steps:**
1. Find "Maximum Service Radius (km)" field
2. Enter value: `0` → Should show error (min: 1)
3. Enter value: `51` → Should show error (max: 50)
4. Enter value: `5` → Should accept
5. Leave empty → Should show required error
6. Enter value: `25` → Should accept

**Expected Results:**
- ✅ Validates minimum value (1 km)
- ✅ Validates maximum value (50 km)
- ✅ Shows error for invalid values
- ✅ Accepts valid values (1-50)

#### 2.3 Maximum Dogs Per Walk
**Steps:**
1. Find "Maximum Dogs Per Walk" field
2. Enter value: `0` → Should show error (min: 1)
3. Enter value: `11` → Should show error (max: 10)
4. Enter value: `3` → Should accept
5. Leave empty → Should show required error

**Expected Results:**
- ✅ Validates minimum value (1)
- ✅ Validates maximum value (10)
- ✅ Shows error for invalid values
- ✅ Accepts valid values (1-10)

#### 2.4 Walk Durations (Multiselect)
**Steps:**
1. Find "Available Walk Durations" multiselect
2. Verify default selection: `30 minutes`
3. Click to open selection interface
4. Select multiple durations: `20`, `30`, `45`
5. Verify selected items appear as chips
6. Remove one chip (click X)
7. Verify chip is removed
8. Leave empty → Should show required error
9. Select at least one → Should accept

**Expected Results:**
- ✅ Default value is `30 minutes`
- ✅ Can select multiple options
- ✅ Selected items display as chips
- ✅ Can remove selected items
- ✅ Validates at least one selection required
- ✅ UI is intuitive and responsive

#### 2.5 Experience Level
**Steps:**
1. Find "Years of Experience" dropdown
2. Click to open dropdown
3. Verify options:
   - Less than 1 year
   - 1-2 years
   - 3-5 years
   - 5+ years
4. Select an option
5. Leave empty → Should show required error

**Expected Results:**
- ✅ Dropdown shows all 4 options
- ✅ Can select any option
- ✅ Validates required field

#### 2.6 Dog Size Preferences (Multiselect)
**Steps:**
1. Find "Dog Sizes You Can Handle" multiselect
2. Select multiple sizes: `Small`, `Medium`, `Large`
3. Verify chips appear
4. Remove one chip
5. Leave empty → Should show required error
6. Select at least one → Should accept

**Expected Results:**
- ✅ Can select multiple sizes
- ✅ Validates at least one selection required
- ✅ UI works correctly

#### 2.7 Emergency Contact Fields
**Steps:**
1. Find "Emergency Contact Name" field
2. Enter name: `John Doe`
3. Leave empty → Should show required error
4. Find "Emergency Contact Phone" field
5. Enter phone: `9876543210`
6. Enter invalid phone: `123` → Should show error
7. Leave empty → Should show required error

**Expected Results:**
- ✅ Both fields are required
- ✅ Phone validates format
- ✅ Shows appropriate error messages

#### 2.8 Document Uploads
**Steps:**
1. Find "Background Check Certificate" file upload
2. Click upload area
3. Select a PDF file → Should upload and show preview
4. Remove file → Should clear
5. Leave empty → Should show required error
6. Repeat for "Insurance Certificate"

**Expected Results:**
- ✅ File upload works
- ✅ Shows preview after upload
- ✅ Can remove uploaded file
- ✅ Validates required documents
- ✅ Accepts PDF, JPG, PNG formats

---

### Test Case 3: Walker Form Submission

**Steps:**
1. Fill in all common fields (business name, address, etc.)
2. Fill in all walker-specific fields:
   - GPS Tracking: ✅ (checked)
   - Service Radius: `5`
   - Max Dogs: `3`
   - Walk Durations: `20`, `30`, `45`
   - Experience: `3-5 years`
   - Dog Sizes: `Small`, `Medium`, `Large`
   - Emergency Contact Name: `John Doe`
   - Emergency Contact Phone: `9876543210`
   - Background Check: Upload PDF
   - Insurance Certificate: Upload PDF
3. Pin location on map
4. Accept terms and conditions
5. Click "Submit"

**Expected Results:**
- ✅ All fields validate correctly
- ✅ File uploads succeed
- ✅ Form submits successfully
- ✅ Success message appears
- ✅ Application is created with status `DRAFT` or `PENDING`

---

## 🛍️ Seller/E-commerce Onboarding Testing

### Test Case 4: Basic Seller Onboarding Flow

**Steps:**
1. Navigate to vendor registration page
2. Enter phone number: `+91-9876543211`
3. Select role: **Seller** or **E-commerce** or **Pet Products Store**
4. Verify role-specific fields appear
5. Fill in all required fields
6. Submit form
7. Verify submission success

**Expected Results:**
- ✅ Seller role is available in role selection
- ✅ Role-specific fields appear after role selection
- ✅ All 9 seller-specific fields are visible
- ✅ Form validates all required fields
- ✅ Submission succeeds

---

### Test Case 5: Seller Field Validation

#### 5.1 Business Type
**Steps:**
1. Find "Business Type" dropdown
2. Verify options:
   - Individual seller
   - Small business
   - Retail store
   - Online store
   - Manufacturer
3. Select an option
4. Leave empty → Should show required error

**Expected Results:**
- ✅ Dropdown shows all 5 options
- ✅ Can select any option
- ✅ Validates required field

#### 5.2 Product Categories (Multiselect)
**Steps:**
1. Find "Product Categories You Sell" multiselect
2. Verify 14 categories are available
3. Select multiple categories: `Pet Food & Treats`, `Toys & Accessories`, `Grooming Products`
4. Verify chips appear
5. Remove one chip
6. Leave empty → Should show required error (min: 1)
7. Select at least one → Should accept

**Expected Results:**
- ✅ All 14 categories are available
- ✅ Can select multiple categories
- ✅ Validates minimum 1 selection required
- ✅ UI works correctly

#### 5.3 Shipping Options (Multiselect)
**Steps:**
1. Find "Shipping Methods Offered" multiselect
2. Verify default selection: `Standard shipping`
3. Select multiple options: `Standard shipping`, `Express shipping`, `Same-day delivery`
4. Verify chips appear
5. Leave empty → Should show required error
6. Select at least one → Should accept

**Expected Results:**
- ✅ Default value is `Standard shipping`
- ✅ Can select multiple options
- ✅ Validates minimum 1 selection required

#### 5.4 Shipping Radius
**Steps:**
1. Find "Local Delivery Radius (km)" field
2. Enter value: `-1` → Should show error (min: 0)
3. Enter value: `101` → Should show error (max: 100)
4. Enter value: `0` → Should accept (shipping only)
5. Enter value: `25` → Should accept
6. Leave empty → Should show required error

**Expected Results:**
- ✅ Validates minimum value (0)
- ✅ Validates maximum value (100)
- ✅ Accepts 0 (shipping only)
- ✅ Accepts valid values (0-100)

#### 5.5 Inventory Management
**Steps:**
1. Find "Inventory Management System" dropdown
2. Verify options: `Manual`, `Automated`, `Third-party integration`
3. Verify default: `Manual`
4. Select different option
5. Leave empty → Should show required error

**Expected Results:**
- ✅ Dropdown shows all 3 options
- ✅ Default is `Manual`
- ✅ Can select any option
- ✅ Validates required field

#### 5.6 Return Policy
**Steps:**
1. Find "Return Policy" textarea
2. Enter text: `Short text` (less than 50 chars) → Should show error
3. Enter text: `This is a comprehensive return policy that describes our terms and conditions for returns and refunds.` (50+ chars) → Should accept
4. Leave empty → Should show required error

**Expected Results:**
- ✅ Validates minimum length (50 characters)
- ✅ Shows error for short text
- ✅ Accepts text with 50+ characters
- ✅ Validates required field

#### 5.7 GST/VAT Number
**Steps:**
1. Find "GST/VAT Registration Number" field
2. Enter a GST number
3. Leave empty → Should accept (optional field)

**Expected Results:**
- ✅ Field is optional (not required)
- ✅ Can enter GST/VAT number
- ✅ No validation errors when empty

#### 5.8 Payment Methods (Multiselect)
**Steps:**
1. Find "Payment Methods Accepted" multiselect
2. Verify default selections: `UPI`, `Credit/Debit card`
3. Select additional methods: `Cash on delivery`, `Net banking`
4. Verify chips appear
5. Remove one chip
6. Leave empty → Should show required error
7. Select at least one → Should accept

**Expected Results:**
- ✅ Default values are `UPI` and `Credit/Debit card`
- ✅ Can select multiple methods
- ✅ Validates minimum 1 selection required

#### 5.9 Product Catalog Upload
**Steps:**
1. Find "Product Catalog (PDF or images)" file upload
2. Click upload area
3. Select a PDF file → Should upload and show preview
4. Select a ZIP file → Should upload
5. Select an image (JPG) → Should upload
6. Remove file → Should clear
7. Leave empty → Should show required error

**Expected Results:**
- ✅ File upload works
- ✅ Accepts PDF, ZIP, JPG, PNG formats
- ✅ Shows preview after upload
- ✅ Can remove uploaded file
- ✅ Validates required document
- ✅ Validates file size (max 10MB - backend)

---

### Test Case 6: Seller Form Submission

**Steps:**
1. Fill in all common fields (business name, address, etc.)
2. Fill in all seller-specific fields:
   - Business Type: `Online store`
   - Product Categories: `Pet Food & Treats`, `Toys & Accessories`, `Health & Wellness`
   - Shipping Options: `Standard shipping`, `Express shipping`
   - Shipping Radius: `25`
   - Inventory Management: `Automated`
   - Return Policy: `We offer a 7-day return policy. Items must be unused and in original packaging. Refunds will be processed within 5-7 business days.`
   - GST/VAT Number: `29ABCDE1234F1Z5` (optional)
   - Payment Methods: `UPI`, `Credit/Debit card`, `Cash on delivery`
   - Product Catalog: Upload PDF
3. Pin location on map
4. Accept terms and conditions
5. Click "Submit"

**Expected Results:**
- ✅ All fields validate correctly
- ✅ File upload succeeds
- ✅ Form submits successfully
- ✅ Success message appears
- ✅ Application is created with status `DRAFT` or `PENDING`

---

## 🔍 Edge Cases & Error Scenarios

### Test Case 7: Network Errors
**Steps:**
1. Disconnect internet
2. Try to submit form
3. Reconnect internet
4. Try to submit again

**Expected Results:**
- ✅ Shows appropriate error message
- ✅ Form data is preserved
- ✅ Can retry submission after reconnection

### Test Case 8: File Upload Errors
**Steps:**
1. Try to upload file > 10MB
2. Try to upload unsupported file type
3. Try to upload corrupted file

**Expected Results:**
- ✅ Shows file size error
- ✅ Shows file type error
- ✅ Handles corrupted files gracefully

### Test Case 9: Form Data Persistence
**Steps:**
1. Fill in form partially
2. Refresh page
3. Verify form data is restored (if implemented)

**Expected Results:**
- ✅ Form data persists (if localStorage implemented)
- ✅ Or form resets (acceptable behavior)

### Test Case 10: Concurrent Submissions
**Steps:**
1. Fill in form
2. Click submit multiple times rapidly
3. Verify only one submission occurs

**Expected Results:**
- ✅ Prevents duplicate submissions
- ✅ Shows loading state during submission
- ✅ Disables submit button while processing

---

## ✅ Success Criteria

### Walker Onboarding
- [ ] All 10 walker-specific fields are visible
- [ ] All validations work correctly
- [ ] Multiselect fields work properly
- [ ] File uploads succeed
- [ ] Form submission succeeds
- [ ] Application is created in database

### Seller Onboarding
- [ ] All 9 seller-specific fields are visible
- [ ] All validations work correctly
- [ ] Multiselect fields work properly
- [ ] File uploads succeed
- [ ] Form submission succeeds
- [ ] Application is created in database

### General
- [ ] No console errors
- [ ] No network errors (except intentional tests)
- [ ] UI is responsive and intuitive
- [ ] Error messages are clear and helpful
- [ ] Success messages appear after submission

---

## 🐛 Known Issues to Watch For

1. **Multiselect Default Values**
   - Verify default values are pre-selected
   - Verify they can be changed

2. **File Upload Size**
   - Backend may need to validate 10MB limit
   - Frontend should show appropriate error

3. **Location Pinning**
   - Requires Google Maps API key
   - Should handle API key missing gracefully

4. **Form Validation**
   - All required fields should be validated
   - Error messages should be clear

---

## 📝 Test Results Template

```
Test Case: [Number] - [Name]
Date: [Date]
Tester: [Name]
Status: ✅ Pass / ❌ Fail / ⚠️ Partial

Steps Taken:
1. [Step]
2. [Step]
...

Expected Results:
- [Result]
- [Result]

Actual Results:
- [Result]
- [Result]

Issues Found:
- [Issue description]

Screenshots: [Attach if applicable]
```

---

## 🚀 Post-Testing Actions

1. **Document Issues**
   - Create bug reports for any issues found
   - Include screenshots and steps to reproduce

2. **Verify Database**
   - Check that application data is stored correctly
   - Verify role-specific fields are in `application_payload`

3. **Test Admin Approval**
   - Verify admin can see role-specific fields
   - Verify admin can approve/reject applications

4. **Test Edit Mode**
   - Verify vendors can edit their applications
   - Verify role-specific fields are pre-filled

---

**Last Updated:** January 15, 2026
