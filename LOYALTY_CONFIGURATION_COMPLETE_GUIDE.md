# Loyalty System - Complete Configuration Guide
## How to Configure Loyalty with Segments

**Date:** 2026-01-13  
**Status:** ✅ **FULLY FUNCTIONAL**

---

## 🎯 Understanding the Two Systems

### System 1: Basic Loyalty Rules (General Earning/Redemption)
**Location:** Loyalty → Rules Tab

**Purpose:** Define general points earning and redemption rates for ALL customers.

**What it does:**
- Sets base earning rate (e.g., 1 point per ₹1)
- Sets redemption rate (e.g., 100 points = ₹1)
- Applies to ALL customers (no targeting)

**Example:**
```
Rule: "Standard Loyalty Program"
- Points per Rupee: 1.0
- Redemption Rate: 100 (100 points = ₹1)
- Min Points to Redeem: 100
```

**When to use:** For general loyalty program that applies to everyone.

---

### System 2: Action-Based Rules (WITH Segments) ⭐
**Location:** Loyalty → Action Rules Tab

**Purpose:** Define specific action rewards that CAN target segments.

**What it does:**
- Awards points for specific actions (buy_medicine, book_grooming, etc.)
- CAN target specific customer segments
- Supports different point calculation types (fixed, percentage, per_amount)
- Supports frequency limits (one_time, recurring, unlimited, etc.)

**Example:**
```
Action Rule: "Buy Medicine - Gold Tier"
- Action: buy_medicine
- Points: 20 points per ₹100
- Segments: ["Gold Medicine Buyers"]
- Frequency: unlimited
```

**When to use:** For targeted rewards to specific customer groups.

---

## 🔗 How Segments Link to Action Rules

### Step-by-Step Configuration

#### Step 1: Create Segments
1. Go to **Loyalty → Segments Tab**
2. Click **"Create Segment"**
3. Fill in criteria:
   - **Service Categories:** Medicine, Grooming, etc.
   - **Customer Tiers:** gold, platinum, etc.
   - **Purchase History:** Min/max purchases, amounts
   - **Registration Date:** Before/after dates
   - **Pet Count:** Min/max pets
   - **Location:** Cities, states, pincodes
   - **Vendor IDs:** Specific vendors
   - **Service Types:** at_vendor, at_home, online
   - **Special Flags:** First purchase, birthday month, has pet profile, has health records
4. Set **Match Type:** All (AND) or Any (OR)
5. Set **Priority:** Higher = evaluated first
6. Save → Get segment ID

#### Step 2: Create Action Rule with Segment
1. Go to **Loyalty → Action Rules Tab**
2. Click **"Create Action Rule"**
3. Fill in:
   - **Action Name:** buy_medicine, book_grooming, etc.
   - **Category:** loyalty or referral_rewards
   - **User Type:** customer, vendor, or both
   - **Points Type:** fixed, percentage, or per_amount
   - **Points Value:** Amount of points
   - **Base Amount:** (if per_amount or percentage)
4. **⭐ KEY STEP: Select Segments**
   - Scroll to "Target Segments" section
   - Check boxes for segments you want to target
   - Rule will ONLY apply to customers in selected segments
5. Set frequency, priority, description
6. Save

#### Step 3: System Behavior
When a customer performs an action:
1. System checks: Is customer in required segment(s)? ✅
2. System checks: Do other conditions match? ✅
3. If ALL match → Award points according to rule
4. If ANY don't match → No points awarded

---

## 📊 Complete Segment Criteria Reference

### All Available Criteria (Now in UI)

#### 1. Service Categories
```json
{
  "service_categories": ["Medicine", "Grooming", "Veterinary"]
}
```
**UI:** Text input (comma-separated)

#### 2. Customer Tiers
```json
{
  "customer_tiers": ["gold", "platinum", "diamond"]
}
```
**UI:** Text input (comma-separated)

#### 3. Purchase History (Complete)
```json
{
  "purchase_history": {
    "min_purchases": 5,
    "max_purchases": 100,
    "min_amount": 10000,
    "max_amount": 100000
  }
}
```
**UI:** 4 number inputs (Min/Max Purchases, Min/Max Amount)

#### 4. Registration Date
```json
{
  "registration_date": {
    "after": "2023-01-01",
    "before": "2024-01-01"
  }
}
```
**UI:** 2 date pickers (Registered After, Registered Before)

#### 5. Pet Count
```json
{
  "pet_count": {
    "min": 1,
    "max": 5
  }
}
```
**UI:** 2 number inputs (Min Pets, Max Pets)

#### 6. Location (Complete)
```json
{
  "location": {
    "cities": ["Mumbai", "Delhi", "Bangalore"],
    "states": ["Maharashtra", "Karnataka"],
    "pincodes": ["400001", "560001"]
  }
}
```
**UI:** 3 text inputs (Cities, States, Pincodes - comma-separated)

#### 7. Vendor IDs
```json
{
  "vendor_ids": ["vendor-uuid-1", "vendor-uuid-2"]
}
```
**UI:** Text input (comma-separated UUIDs)

#### 8. Service Types
```json
{
  "service_types": ["at_vendor", "at_home", "online"]
}
```
**UI:** Text input (comma-separated)

#### 9. Special Flags
```json
{
  "first_purchase": true,
  "birthday_month": true,
  "has_pet_profile": true,
  "has_health_records": true
}
```
**UI:** 4 checkboxes

---

## 🎨 Real-World Configuration Examples

### Example 1: "2x Points for Gold Tier Customers Buying Medicine"

#### Step 1: Create Segment
```
Segment Name: "Gold Medicine Buyers"
Type: Customer
Criteria:
  - Customer Tiers: gold
  - Service Categories: Medicine
Match Type: All (AND)
Priority: 150
```

#### Step 2: Create Action Rule
```
Action Name: buy_medicine_gold_tier
Category: loyalty
Points Type: per_amount
Points Value: 20 (2x normal rate of 10)
Base Amount: 100
Segments: [Select "Gold Medicine Buyers"]
Frequency: unlimited
```

**Result:** Gold tier customers buying medicine earn 20 points per ₹100 (2x normal rate)

---

### Example 2: "Welcome Bonus for First-Time Buyers in Mumbai"

#### Step 1: Create Segment
```
Segment Name: "Mumbai First-Time Buyers"
Type: Customer
Criteria:
  - First Purchase: true
  - Location Cities: Mumbai
Match Type: All (AND)
Priority: 200
```

#### Step 2: Create Action Rule
```
Action Name: first_purchase_mumbai
Category: loyalty
Points Type: fixed
Points Value: 500
Segments: [Select "Mumbai First-Time Buyers"]
Frequency: one_time
```

**Result:** First-time buyers in Mumbai get 500 bonus points on first purchase

---

### Example 3: "Birthday Month Double Points for Platinum Customers"

#### Step 1: Create Segment
```
Segment Name: "Platinum Birthday Customers"
Type: Customer
Criteria:
  - Customer Tiers: platinum
  - Birthday Month: true
Match Type: All (AND)
Priority: 250
```

#### Step 2: Create Action Rule
```
Action Name: birthday_platinum_double
Category: loyalty
Points Type: per_amount
Points Value: 20 (2x normal)
Base Amount: 100
Segments: [Select "Platinum Birthday Customers"]
Frequency: monthly_limit
Frequency Limit: 1
```

**Result:** Platinum customers get 2x points during their birthday month (once per month)

---

## 🔍 Visibility Features

### In Segments Tab
- **"Used By" Column:** Shows which action rules use each segment
- **Delete Protection:** Cannot delete segments that are used by rules
- **Full Criteria Display:** Shows all criteria in readable format

### In Action Rules Tab
- **"Segments" Column:** Shows which segments are targeted
- **Segment Selection:** Multi-select checkbox list in create/edit form
- **Visual Indicators:** Link icon shows segment connection

---

## ✅ What's Now Available

### Segment Form - Complete Criteria
- ✅ Service Categories
- ✅ Customer Tiers
- ✅ Purchase History (min/max purchases, min/max amounts)
- ✅ Registration Date (before/after)
- ✅ Pet Count (min/max)
- ✅ Location (cities, states, pincodes)
- ✅ Vendor IDs
- ✅ Service Types
- ✅ First Purchase
- ✅ Birthday Month
- ✅ Has Pet Profile
- ✅ Has Health Records

### Action Rules Management
- ✅ Full CRUD for action rules
- ✅ Segment selection (multi-select)
- ✅ Points calculation types (fixed, percentage, per_amount)
- ✅ Frequency controls
- ✅ Priority management
- ✅ Visual segment linking

### Relationship Visibility
- ✅ See which rules use which segments
- ✅ See which segments are linked to rules
- ✅ Delete protection (can't delete segments in use)

---

## 🚀 Quick Start Guide

### For CPO: Setting Up a Targeted Campaign

1. **Define Your Target Audience** (Create Segment)
   - Who? (tiers, location, purchase history)
   - What? (categories, service types)
   - When? (registration date, birthday month)

2. **Define the Reward** (Create Action Rule)
   - What action? (buy_medicine, book_grooming)
   - How many points? (fixed, percentage, per_amount)
   - Link to segment? (select segment from list)

3. **Test & Activate**
   - Create segment → Verify criteria
   - Create rule → Link segment
   - Activate both
   - Monitor results

---

**Last Updated:** 2026-01-13  
**Status:** ✅ Production Ready - All Features Implemented
