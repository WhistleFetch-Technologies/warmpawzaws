# 🔐 Staff Login Creation Guide - Warmpawz

## 📱 **Complete Staff Creation & Login Flow**

---

## **PART 1: Creating Staff (Clinic Owner)**

### Step 1: Login as Clinic Owner
```
URL: https://your-app.com/vendor-login
Phone: 9876543210 (your clinic's main number)
OTP: 1234 (in development)
```

### Step 2: Navigate to Doctor Management
After login, you'll see the clinic dashboard:
- Bottom navigation bar has 5 tabs
- Click on **"Doctors"** tab (second icon)
- OR click **"Manage Doctors"** card from dashboard

### Step 3: Add New Staff
Click the **"+ Add Doctor"** button (orange button at top right)

A modal/form will appear with the following fields:

#### ✅ **Mandatory Fields**:
```
Full Name: Dr. Sarah Johnson
Phone: 9123456789        ← THIS IS THE LOGIN PHONE NUMBER
Email: sarah@example.com
Specializations: Cardiology, Surgery, Emergency Care
Degree: BVSc, MVSc (Cardiology)
Photo: [Upload button]   ← Must upload a photo
```

#### Optional Fields:
```
Experience: 8 (years)
Consultation Fee: 1500
Bio: Dr. Sarah specializes in pet cardiology...
```

### Step 4: Save
- Click **"Add Doctor"** / **"Save"** button
- Toast notification: ✅ "Doctor added successfully"
- Doctor appears in the list

---

## **PART 2: Staff Login**

### Step 1: Staff Goes to Login Page
```
URL: https://your-app.com/vendor-login
```

### Step 2: Enter Phone Number
```
Phone Number: 9123456789   ← The phone number clinic owner added
```

**What Happens**:
- System checks: Is this a vendor or staff?
- Finds: This is **Dr. Sarah Johnson** from **Happy Paws Clinic**
- Shows: "Login as: Dr. Sarah Johnson (Happy Paws Clinic)"

### Step 3: Request OTP
- Click **"Send OTP"**
- OTP sent to phone (in development, any 4 digits work)

### Step 4: Enter OTP
```
OTP: 1234
```

### Step 5: Login Success!
- Redirected to **Staff Dashboard**
- Shows only Dr. Sarah's appointments
- Can manage personal schedule
- Can view personal analytics

---

## 🔄 **Auto-Migration for Existing Doctors**

If you already have doctors in the old system, they'll be **automatically migrated** when you first open Doctor Management:

### What Happens:
```
1. Clinic owner opens Doctor Management
2. System detects old doctor records
3. Auto-migrates to new staff format
4. Toast: "Migrated 3 doctors to new system"
5. All old doctors can now login with their phones
```

### Migrated Data:
- ✅ Name, phone, email
- ✅ Specializations, qualifications
- ✅ Experience, fees
- ✅ Appointment history
- ✅ Stats (completed appointments, ratings)

### ⚠️ May Need Manual Update:
- Photo (if missing in old system)
- Phone number (if missing)
- Degree (if not specified)

---

## 🎯 **Login Comparison**

### **Clinic Owner Login**
```
Login Type: Clinic Account
Phone: 9876543210 (clinic main number)
Access Level: FULL ADMIN

Dashboard Shows:
✅ All appointments from all doctors
✅ Cumulative clinic statistics
✅ Manage all doctors
✅ Clinic settings
✅ All bookings

Bottom Tabs:
- Home
- Doctors (manage staff)
- Bookings
- Calendar
- Reporting (analytics)
```

### **Staff/Doctor Login**
```
Login Type: Staff Account
Phone: 9123456789 (individual doctor number)
Access Level: PERSONAL ONLY

Dashboard Shows:
✅ Only their own appointments
✅ Personal statistics
✅ Configure personal services
✅ Manage personal schedule
✅ Personal analytics

Bottom Tabs:
- Home (their appointments)
- Services (configure their services)
- Schedule (their availability)
- Bookings (their bookings only)
- Reporting (personal analytics)
```

---

## 🧪 **Testing Staff Login**

### Test Scenario 1: Create and Login
```
1. Login as clinic owner (9876543210)
2. Go to Doctors tab
3. Click "+ Add Doctor"
4. Fill form:
   - Name: Dr. Test Doctor
   - Phone: 9999999999
   - Email: test@test.com
   - Specializations: General Practice
   - Degree: BVSc
   - Upload photo
5. Save
6. Logout
7. Go to vendor login
8. Enter: 9999999999
9. System shows: "Login as: Dr. Test Doctor"
10. Send OTP
11. Enter OTP
12. Should see Staff Dashboard!
```

### Test Scenario 2: Staff Appointments
```
1. Login as staff (9999999999)
2. Should see only appointments assigned to them
3. Clinic owner sees ALL appointments
4. Staff sees ONLY their appointments
```

### Test Scenario 3: Service Configuration
```
1. Login as staff (9999999999)
2. Go to "Services" tab
3. Configure which services they offer
4. Set their own schedule
5. Customers can now book with this specific doctor
```

---

## 🚨 **Common Issues & Solutions**

### Issue 1: "Phone number not found"
**Problem**: Staff phone not added to system
**Solution**: Clinic owner must add staff through Doctor Management first

### Issue 2: "Photo required"
**Problem**: Staff created without photo
**Solution**: Edit staff record and upload photo

### Issue 3: "Degree required"
**Problem**: Staff created without degree
**Solution**: Edit staff record and add degree

### Issue 4: Staff sees all appointments
**Problem**: Logged in as clinic owner, not staff
**Solution**: Logout and login with staff's individual phone number

### Issue 5: Staff can't login
**Problem**: Phone number not 10 digits or incorrect
**Solution**: Clinic owner should verify and update phone number

---

## 📊 **Staff Management Features**

### What Clinic Owners Can Do:
- ✅ Add unlimited staff
- ✅ Edit staff details
- ✅ Deactivate/activate staff
- ✅ View staff performance analytics
- ✅ See cumulative appointments
- ✅ Manage staff schedules

### What Staff Can Do:
- ✅ Login with their phone
- ✅ View their appointments only
- ✅ Configure their services
- ✅ Set their availability
- ✅ View their analytics
- ✅ Complete consultations
- ✅ Add prescriptions
- ✅ Chat with customers

### What Staff CANNOT Do:
- ❌ View other doctors' appointments
- ❌ Add/remove other staff
- ❌ Access clinic settings
- ❌ View clinic-wide analytics
- ❌ Modify clinic details

---

## 🔐 **Security Features**

### Phone-Based Authentication:
- Each staff has unique phone number
- OTP verification for every login
- Session management
- Auto-logout on inactivity

### Access Control:
- Staff can only see their data
- Clinic owner sees everything
- Role-based permissions
- Appointment isolation

### Data Privacy:
- Staff appointments are filtered server-side
- No cross-staff data exposure
- Audit logs for all actions
- Secure API endpoints

---

## 📱 **Mobile App Behavior**

### Responsive Design:
- All modals max 430px width
- Mobile-first design
- Touch-optimized buttons
- Swipe gestures

### Staff App Features:
- Push notifications (appointments)
- Quick appointment view
- One-tap consultation start
- Fast prescription entry
- Mobile-optimized chat

---

## 🎯 **Quick Reference**

### Add Staff:
```
Clinic Login → Doctors Tab → + Add Doctor → Fill Form → Save
```

### Staff Login:
```
Vendor Login → Enter Staff Phone → OTP → Staff Dashboard
```

### Check Staff Appointments:
```
Staff Login → Home Tab (shows only their appointments)
```

### Edit Staff:
```
Clinic Login → Doctors Tab → Click Staff Card → Edit → Save
```

### Deactivate Staff:
```
Clinic Login → Doctors Tab → Click Staff → Set Inactive
```

---

## 📞 **Support**

### If Staff Can't Login:
1. Verify phone number is correct (10 digits)
2. Check staff is marked as "active"
3. Verify photo and degree are uploaded
4. Try resending OTP
5. Contact clinic owner to verify account

### If Appointments Don't Show:
1. Verify logged in as staff (not clinic owner)
2. Check appointment is assigned to that staff
3. Verify date range filter
4. Refresh the page

---

**Created**: November 20, 2024  
**System**: Warmpawz Staff Authentication  
**Version**: Priority 1 Implementation  
