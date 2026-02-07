# Loyalty System Complete Configuration Guide
## CPO Perspective: Understanding the Two-Tier Loyalty System

**Date:** 2026-01-13  
**Status:** ✅ **COMPREHENSIVE GUIDE**

---

## 🎯 Overview

The Warmpawz loyalty system has **TWO separate but complementary rule systems**:

1. **Basic Loyalty Rules** (`loyalty_rules`) - General earning/redemption rates
2. **Action-Based Rules** (`loyalty_action_rules`) - Specific action rewards that CAN use segments

---

## 📋 System 1: Basic Loyalty Rules

### Purpose
Define **general** points earning and redemption rates for all customers.

### Table: `loyalty_rules`
```sql
- id: UUID
- rule_name: TEXT (e.g., "Standard Loyalty Program")
- points_per_rupee: NUMERIC (e.g., 1.0 = 1 point per ₹1)
- redemption_rate: NUMERIC (e.g., 100 = 100 points per ₹1 redeemed)
- min_redemption_points: INTEGER (minimum points needed to redeem)
- max_redemption_per_transaction: INTEGER (optional)
- expiry_days: INTEGER (optional, points expiry)
- is_active: BOOLEAN
```

### How It Works
- **Applies to ALL customers** (no segmentation)
- Used for general purchase-based point earning
- Example: "Earn 1 point per ₹1 spent on any purchase"

### UI Location
- **Admin → Loyalty → Rules Tab**
- Create/Edit basic earning/redemption rules

### Example Configuration
```json
{
  "name": "Standard Loyalty Program",
  "points_per_rupee": 1.0,
  "redemption_rate": 100,
  "min_points_to_redeem": 100,
  "max_redemption_per_transaction": 5000,
  "expiry_days": 365,
  "is_active": true
}
```

---

## 📋 System 2: Action-Based Rules (WITH Segments)

### Purpose
Define **specific action rewards** that can target segments.

### Table: `loyalty_action_rules`
```sql
- id: UUID
- action_name: TEXT (e.g., "buy_medicine", "book_grooming")
- action_category: TEXT ('loyalty' | 'referral_rewards')
- user_type: TEXT ('customer' | 'vendor' | 'both')
- points_type: TEXT ('fixed' | 'percentage' | 'per_amount')
- points_value: NUMERIC
- base_amount: NUMERIC (for percentage/per_amount)
- min_amount: NUMERIC
- max_points_per_transaction: INTEGER
- frequency_type: TEXT ('one_time' | 'recurring' | 'unlimited' | 'monthly_limit' | 'yearly_limit')
- frequency_limit: INTEGER
- frequency_period: TEXT ('day' | 'week' | 'month' | 'year')
- conditions: JSONB (CAN include segment_ids!)
- multiplier_conditions: JSONB
- is_active: BOOLEAN
- priority: INTEGER
```

### How Segments Link to Action Rules

**In `conditions` JSONB:**
```json
{
  "segment_ids": ["segment-uuid-1", "segment-uuid-2"],
  "service_categories": ["Medicine"],
  "customer_tiers": ["gold"],
  "first_purchase": true,
  "birthday_month": true
}
```

**Rule Evaluation:**
1. Check if customer belongs to required segments (`segment_ids`)
2. Check other conditions (categories, tiers, etc.)
3. If ALL conditions match → Award points

### Example Action Rule with Segment
```json
{
  "action_name": "buy_medicine",
  "action_category": "loyalty",
  "user_type": "customer",
  "points_type": "per_amount",
  "points_value": 10,
  "base_amount": 100,
  "conditions": {
    "segment_ids": ["medicine-buyers-segment-id"],
    "service_categories": ["Medicine"]
  },
  "frequency_type": "unlimited",
  "is_active": true,
  "priority": 100
}
```

**Meaning:** "Customers in 'Medicine Buyers' segment earn 10 points per ₹100 spent on Medicine"

---

## 🔗 How Segments Link to Rules

### Step 1: Create Segments
1. Go to **Loyalty → Segments Tab**
2. Click **"Create Segment"**
3. Define criteria (categories, tiers, purchase history, location, etc.)
4. Save segment → Get segment ID

### Step 2: Use Segments in Action Rules
1. Create/Edit action rule (currently via API or database)
2. In `conditions.segment_ids`, add segment UUIDs
3. Rule will ONLY apply to customers in those segments

### Current Limitation
- ❌ **No UI for `loyalty_action_rules`** (only API/database)
- ✅ Segments can be created via UI
- ✅ Segments are evaluated correctly by backend

---

## 📊 Complete Segment Criteria Reference

### Available Criteria (All Supported by Backend)

#### 1. Service Categories
```json
{
  "service_categories": ["Medicine", "Grooming", "Veterinary"]
}
```
**Meaning:** Customer has purchased from these categories

#### 2. Customer Tiers
```json
{
  "customer_tiers": ["gold", "platinum", "diamond"]
}
```
**Meaning:** Customer belongs to these loyalty tiers

#### 3. Purchase History
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
**Meaning:** Customer has made X purchases totaling Y amount

#### 4. Registration Date
```json
{
  "registration_date": {
    "before": "2024-01-01",
    "after": "2023-01-01"
  }
}
```
**Meaning:** Customer registered between these dates

#### 5. Pet Count
```json
{
  "pet_count": {
    "min": 1,
    "max": 5
  }
}
```
**Meaning:** Customer has between X and Y pets

#### 6. Location
```json
{
  "location": {
    "cities": ["Mumbai", "Delhi", "Bangalore"],
    "states": ["Maharashtra", "Karnataka"],
    "pincodes": ["400001", "560001"]
  }
}
```
**Meaning:** Customer is located in these areas

#### 7. Vendor IDs
```json
{
  "vendor_ids": ["vendor-uuid-1", "vendor-uuid-2"]
}
```
**Meaning:** Customer has purchased from these specific vendors

#### 8. Service Types
```json
{
  "service_types": ["at_vendor", "at_home", "online"]
}
```
**Meaning:** Customer has used these service delivery types

#### 9. Special Flags
```json
{
  "first_purchase": true,
  "birthday_month": true,
  "has_pet_profile": true,
  "has_health_records": true
}
```
**Meaning:** Customer meets these special conditions

---

## 🎨 Complete Configuration Flow

### Scenario: "Give 2x points to Gold Tier customers buying Medicine"

#### Step 1: Create Segment
```json
POST /admin/loyalty-segments
{
  "segment_name": "Gold Medicine Buyers",
  "segment_type": "customer",
  "description": "Gold tier customers who buy medicine",
  "criteria": {
    "customer_tiers": ["gold"],
    "service_categories": ["Medicine"]
  },
  "match_type": "all",
  "is_active": true,
  "priority": 150
}
```

#### Step 2: Create Action Rule (via API)
```json
POST /admin/loyalty-action-rules
{
  "action_name": "buy_medicine_gold_tier",
  "action_category": "loyalty",
  "user_type": "customer",
  "points_type": "per_amount",
  "points_value": 20,  // 2x normal rate (10 points per ₹100)
  "base_amount": 100,
  "conditions": {
    "segment_ids": ["gold-medicine-buyers-segment-id"],
    "service_categories": ["Medicine"]
  },
  "frequency_type": "unlimited",
  "is_active": true,
  "priority": 200
}
```

#### Step 3: System Behavior
- Customer buys ₹500 of Medicine
- System checks: Is customer in "Gold Medicine Buyers" segment? ✅
- System checks: Is purchase from Medicine category? ✅
- System awards: 20 points per ₹100 = **100 points** (2x normal rate)

---

## 🔍 What's Missing in Current UI

### 1. Segment Form - Missing Criteria
Currently shows:
- ✅ Service Categories
- ✅ Customer Tiers
- ✅ Purchase History (min only)
- ✅ Service Types
- ✅ First Purchase
- ✅ Birthday Month

**Missing:**
- ❌ Registration Date (before/after)
- ❌ Pet Count (min/max)
- ❌ Location (cities, states, pincodes)
- ❌ Vendor IDs
- ❌ Purchase History (max_purchases, max_amount)
- ❌ Has Pet Profile
- ❌ Has Health Records

### 2. Rules Form - No Segment Selection
- ❌ Cannot select segments when creating rules
- ❌ Cannot see which segments a rule uses
- ❌ No UI for `loyalty_action_rules` (only `loyalty_rules`)

### 3. Visibility - No Link Display
- ❌ Cannot see which rules use which segments
- ❌ Cannot see which segments are assigned to customers
- ❌ No "Used By" indicator on segments

---

## 🚀 Next Steps to Complete the System

1. **Enhance Segment Form** - Add all missing criteria fields
2. **Add Action Rules UI** - Create UI for `loyalty_action_rules` management
3. **Link Segments to Rules** - Add segment selector in action rules form
4. **Show Relationships** - Display which rules use which segments
5. **Customer Segment View** - Show which segments a customer belongs to

---

**Last Updated:** 2026-01-13  
**Status:** Guide Complete - Implementation Needed
