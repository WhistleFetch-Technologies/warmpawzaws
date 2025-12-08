# Debug Overlay - Quick Reference Guide

## 🐛 What is the Debug Overlay?

A developer-only panel that displays real-time vendor configuration, role settings, capabilities, and published content for quick validation and debugging.

---

## 🔑 How to Access

### **Method 1: Keyboard Shortcut**
```
Press: Ctrl + Shift + D
```
This toggles the overlay on/off.

### **Method 2: Bug Button**
When overlay is hidden, a purple floating button appears in bottom-right corner:
```
┌────┐
│ 🐛 │  ← Click to show overlay
└────┘
```

---

## 👀 Who Can See It?

- **Development Mode**: All users (when `import.meta.env.DEV = true`)
- **Production**: Only users with `role='admin'`
- **Regular Users**: Overlay is completely hidden

---

## 📊 Sections Overview

### **1. Quick Info (Always Visible)**
```
┌────────────────────────────────────────────┐
│ Vendor ID:      vendor_123         [Copy]  │
│ Business Name:  Downtown Vet Clinic        │
│ Role ID:        role_veterinarian  [Copy]  │
└────────────────────────────────────────────┘
```

**What to check:**
- ✅ Vendor ID matches expected
- ✅ Role ID is correct
- 🔧 Click copy icons to paste into support tickets

---

### **2. Role Configuration**
```
┌────────────────────────────────────────────┐
│ 🛡️ Role Configuration            [▼]      │
├────────────────────────────────────────────┤
│ Role Name: Veterinarian                    │
│ Vendor Types: [veterinary]                 │
│ Service Styles: [at_center][at_home][tele]│
│ Centre Management: [Enabled]               │
│ Staff Management: [Enabled]                │
│                                            │
│ [Copy Full JSON]                           │
└────────────────────────────────────────────┘
```

**What to check:**
- ✅ vendorTypes match expected categories
- ✅ serviceStyles determine what can be published
- ✅ centreManagementEnabled affects UI tabs
- ✅ staffManagementEnabled controls staff access

**Common Issues:**
```
❌ Tele services not showing?
   → Check serviceStyles includes 'tele'

❌ Cannot access Centres tab?
   → Check centreManagementEnabled: true

❌ Staff menu hidden?
   → Check staffManagementEnabled: true
```

---

### **3. Resolved Capabilities**
```
┌────────────────────────────────────────────┐
│ ⚙️ Resolved Capabilities          [▼]     │
├────────────────────────────────────────────┤
│ Manage Centres         ✅ Enabled          │
│ Manage Staff           ✅ Enabled          │
│ Publish Services       ✅ Enabled          │
│ Create Packages        ❌ Disabled         │
│ Offer Home Services    ✅ Enabled          │
│ Offer Tele Services    ✅ Enabled          │
│ Offer Centre Services  ✅ Enabled          │
└────────────────────────────────────────────┘
```

**What to check:**
- ✅ Each capability shows correct state
- 🔍 Green = Enabled, Red = Disabled
- 💡 Hover for explanation

**Capability Rules:**
```
canManageCentres:
  = roleConfiguration.centreManagementEnabled

canManageStaff:
  = roleConfiguration.staffManagementEnabled

canCreatePackages:
  = vendor.centres.length > 0 
    AND roleConfiguration.customPackagesEnabled

canOfferHomeServices:
  = roleConfiguration.serviceStyles.includes('at_home')

canOfferTeleServices:
  = roleConfiguration.serviceStyles.includes('tele')

canOfferCentreServices:
  = roleConfiguration.serviceStyles.includes('at_center')
```

---

### **4. Published Services**
```
┌────────────────────────────────────────────┐
│ 📦 Published Services (3)        [▼]       │
├────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐   │
│ │ Basic Consultation       [at_center] │   │
│ │ Veterinary                           │   │
│ │ Base Price: ₹800                     │   │
│ │ Publish Level: vendor                │   │
│ └──────────────────────────────────────┘   │
│                                            │
│ ┌──────────────────────────────────────┐   │
│ │ Home Visit              [at_home] 🧭  │   │
│ │ Veterinary                           │   │
│ │ Base Price: ₹1200                    │   │
│ │ Publish Level: vendor                │   │
│ │ ✅ GPS Required                       │   │
│ └──────────────────────────────────────┘   │
│                                            │
│ [Copy Services JSON]                       │
└────────────────────────────────────────────┘
```

**What to check:**
- ✅ Services published at correct level (vendor vs centre)
- ✅ GPS badge shows for home services
- ✅ Service styles match roleConfiguration
- ✅ Pricing is correct

**Common Issues:**
```
❌ Service not showing to customers?
   → Check publishLevel and centres array
   
❌ GPS not enforced?
   → Check serviceStyle='at_home' → GPS Required badge
   
❌ Wrong price displayed?
   → Check priceOverride for centre-level services
```

---

### **5. Centres**
```
┌────────────────────────────────────────────┐
│ 🏢 Centres (2)                    [▼]      │
├────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐   │
│ │ Downtown Clinic                      │   │
│ │ 123 Main St, Downtown                │   │
│ │ Max Concurrent: 5                    │   │
│ │ Lat: 40.7580, Lng: -73.9855         │   │
│ └──────────────────────────────────────┘   │
│                                            │
│ ┌──────────────────────────────────────┐   │
│ │ Uptown Branch                        │   │
│ │ 456 Park Ave, Uptown                 │   │
│ │ Max Concurrent: 3                    │   │
│ │ Lat: 40.7850, Lng: -73.9620         │   │
│ └──────────────────────────────────────┘   │
│                                            │
│ [Copy Centres JSON]                        │
└────────────────────────────────────────────┘
```

**What to check:**
- ✅ centres.length > 0 enables custom packages
- ✅ maxConcurrentBookings set for concurrency validation
- ✅ Coordinates valid for location-based features

**Common Issues:**
```
❌ Custom packages blocked?
   → Check centres.length > 0
   
❌ Cannot publish at centre level?
   → Check centre IDs match
   
❌ Concurrency errors?
   → Check maxConcurrentBookings limits
```

---

### **6. Staff**
```
┌────────────────────────────────────────────┐
│ 👥 Staff (3)                      [▼]      │
├────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐   │
│ │ Dr. Sarah Johnson                    │   │
│ │ Role: Veterinarian                   │   │
│ │ Email: sarah@clinic.com              │   │
│ │ [Dermatology] [Surgery]              │   │
│ └──────────────────────────────────────┘   │
│                                            │
│ [Copy Staff JSON]                          │
└────────────────────────────────────────────┘
```

**What to check:**
- ✅ Staff members loaded correctly
- ✅ Roles and specializations set
- ✅ Email addresses valid

**Common Issues:**
```
❌ Staff section empty?
   → Check staffManagementEnabled: true
   
❌ Cannot assign services to staff?
   → Check staff IDs match service assignments
```

---

## 🔧 Common Debugging Workflows

### **Workflow 1: "Why can't I see Centres tab?"**

```
Step 1: Open Debug Overlay (Ctrl+Shift+D)

Step 2: Check Role Configuration section
  ├─ Is centreManagementEnabled: true?
  │  ├─ YES → Go to Step 3
  │  └─ NO → Contact admin to update role
  
Step 3: Check Resolved Capabilities section
  ├─ Is "Manage Centres" Enabled?
  │  ├─ YES → Check browser console for errors
  │  └─ NO → Check role configuration JSON
  
Step 4: Copy Role Configuration JSON
  ├─ Click [Copy Full JSON] button
  └─ Share with support team
```

---

### **Workflow 2: "Service not showing to customers"**

```
Step 1: Open Debug Overlay

Step 2: Go to Published Services section
  ├─ Is service in the list?
  │  ├─ YES → Go to Step 3
  │  └─ NO → Service not published, check catalog
  
Step 3: Check service details
  ├─ publishLevel: 'vendor' or 'centre'?
  ├─ If 'centre', which centres selected?
  └─ Is GPS Required for at_home services?
  
Step 4: Compare with customer filter
  ├─ Customer searching for 'tele' services?
  ├─ Does serviceStyle match?
  └─ Is customer in service area (for home)?
```

---

### **Workflow 3: "Custom packages button disabled"**

```
Step 1: Open Debug Overlay

Step 2: Check Centres section
  ├─ How many centres? _____
  │  ├─ 0 → Cannot create packages (need centres)
  │  └─ >0 → Go to Step 3
  
Step 3: Check Resolved Capabilities
  ├─ Is "Create Custom Packages" Enabled?
  │  ├─ YES → Check publish level selection
  │  └─ NO → centres.length = 0
  
Step 4: Solution
  ├─ If no centres: Add centres first
  ├─ If centres exist: Select "Centre Level" in publish form
  └─ Custom packages only work at centre level
```

---

### **Workflow 4: "GPS tracking not working"**

```
Step 1: Open Debug Overlay

Step 2: Check Published Services
  ├─ Find the home service
  ├─ Does it show "GPS Required" badge?
  │  ├─ YES → GPS configured correctly
  │  └─ NO → Service not marked as at_home
  
Step 3: Check service details
  ├─ serviceStyle: 'at_home'? _____
  ├─ gpsTracking.enabled: true? _____
  └─ gpsTracking.mandatory: true? _____
  
Step 4: If GPS not showing
  ├─ serviceStyle must be 'at_home'
  ├─ GPS automatically required (non-toggleable)
  └─ Re-publish service if needed
```

---

## 💡 Pro Tips

### **Tip 1: Quick Copy for Support Tickets**
```
1. Open Debug Overlay
2. Navigate to relevant section
3. Click [Copy Full JSON] button
4. Paste into support ticket

Example:
"My custom packages are blocked. Here's my config:
{
  "roleId": "role_groomer",
  "centres": [],  ← This is the problem!
  ...
}"
```

---

### **Tip 2: Compare Expected vs Actual**
```
Expected (from requirements):
{
  "serviceStyles": ["at_home", "tele"],
  "centreManagementEnabled": true
}

Actual (from Debug Overlay):
{
  "serviceStyles": ["at_home"],  ← Missing 'tele'!
  "centreManagementEnabled": false  ← Wrong!
}

Action: Contact admin to update role configuration
```

---

### **Tip 3: Validate After Changes**
```
Made a change? Verify in Debug Overlay:

1. Publish a service
   → Refresh Debug Overlay
   → Check "Published Services" section
   → Confirm service appears

2. Add a centre
   → Refresh page
   → Open Debug Overlay
   → Check "Centres" section
   → Confirm centre listed
   → Check "Create Packages" capability enabled

3. Update role
   → Log out and log back in
   → Open Debug Overlay
   → Verify new capabilities
```

---

## 🚨 Troubleshooting

### **Overlay Not Appearing?**

```
Check 1: Are you in development mode?
  ├─ Look for import.meta.env.DEV = true
  └─ Or check currentUser.role = 'admin'

Check 2: Is the script loaded?
  ├─ Open browser console
  ├─ Look for "Debug Overlay loaded" message
  └─ Check for JavaScript errors

Check 3: Try keyboard shortcut
  ├─ Press Ctrl+Shift+D
  └─ Should toggle on/off
```

---

### **Data Not Updating?**

```
Solution 1: Refresh the page
  ├─ Debug overlay loads data on mount
  └─ Changes require page refresh

Solution 2: Check browser console
  ├─ Look for API errors
  └─ Verify network requests succeeded

Solution 3: Clear cache
  ├─ Hard refresh: Ctrl+Shift+R
  └─ Clear browser cache
```

---

### **Copy Button Not Working?**

```
Check: Browser permissions
  ├─ Clipboard access required
  ├─ Grant permission if prompted
  └─ Try in different browser if blocked
```

---

## 📸 Visual Reference

```
Debug Overlay Layout:
┌───────────────────────────────────────┐
│ 🐛 Debug Overlay            [X]       │  ← Header (sticky)
├───────────────────────────────────────┤
│ Quick Info (always visible)           │
│ ├─ Vendor ID: ...                     │
│ ├─ Business Name: ...                 │
│ └─ Role ID: ...                       │
├───────────────────────────────────────┤
│ 🛡️ Role Configuration      [▼]        │  ← Collapsible
│ ⚙️ Resolved Capabilities    [▼]        │  ← Collapsible
│ 📦 Published Services       [▼]        │  ← Collapsible
│ 🏢 Centres                  [▼]        │  ← Collapsible
│ 👥 Staff                    [▼]        │  ← Collapsible
├───────────────────────────────────────┤
│ 💡 How to Use               [▼]        │  ← Help section
└───────────────────────────────────────┘
```

---

## 🎯 Quick Validation Checklist

Use this before reporting issues:

```
□ Debug overlay opens with Ctrl+Shift+D
□ Vendor ID matches expected
□ Role ID is correct
□ Service styles include needed types
□ Centre/Staff management enabled if needed
□ Capabilities show correct state
□ Published services appear in list
□ Centres count matches expected
□ GPS Required badge shows for home services
□ All JSON copy buttons work
```

---

## 📞 Still Need Help?

After checking Debug Overlay:

```
1. Copy relevant JSON section
2. Take screenshot of overlay
3. Note expected vs actual behavior
4. Contact support with:
   ├─ Vendor ID
   ├─ Role ID
   ├─ Screenshot
   ├─ JSON config
   └─ Steps to reproduce
```

---

## ✨ Summary

**The Debug Overlay is your first stop for:**
- ✅ Validating role configuration
- ✅ Checking resolved capabilities
- ✅ Confirming published services
- ✅ Verifying centre setup
- ✅ Debugging permission issues
- ✅ Quick support ticket data

**Remember: Ctrl+Shift+D to toggle!** 🐛

