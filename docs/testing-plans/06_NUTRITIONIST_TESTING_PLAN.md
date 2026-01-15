# 🥗 Pet Nutritionist Services - Complete Testing Plan

## Document Information
| Field | Value |
|-------|-------|
| **Document Version** | 1.0 |
| **Created Date** | January 15, 2026 |
| **Vendor Type** | Pet Nutritionist / Fresh Food Provider |
| **Test Customer** | Deepa Nambiar (Pet: Luna - Indie Dog) |
| **Estimated Testing Time** | 4-5 hours |

---

## 📋 TABLE OF CONTENTS
1. [Test Environment Setup](#1-test-environment-setup)
2. [Test Credentials](#2-test-credentials)
3. [Phase 1: Vendor Onboarding](#phase-1-vendor-onboarding)
4. [Phase 2: Menu & Meal Plan Setup](#phase-2-menu--meal-plan-setup)
5. [Phase 3: Customer Consultation & Order](#phase-3-customer-consultation--order)
6. [Phase 4: Meal Preparation & Delivery](#phase-4-meal-preparation--delivery)
7. [Phase 5: Subscription Management](#phase-5-subscription-management)
8. [Phase 6: Health Tracking & Adjustments](#phase-6-health-tracking--adjustments)
9. [Edge Cases](#edge-cases)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## 1. Test Environment Setup

### 1.1 URLs
| Application | URL |
|-------------|-----|
| Vendor Web App | `https://vendor.warmpawz.com` |
| Customer Web App | `https://app.warmpawz.com` |

---

## 2. Test Credentials

### 2.1 Vendor Credentials (Nutritionist)
```
📧 Email: freshpaws.nutrition@testmail.com
🔑 Password: Test@Nutri2026!
📱 Phone: +91 98765 45678
```

### 2.2 Customer Credentials
```
📧 Email: deepa.nambiar.pet@testmail.com
🔑 Password: Test@Customer2026!
📱 Phone: +91 87654 56789
```

---

## PHASE 1: VENDOR ONBOARDING

### Step 1.1: Registration

**Action:**
1. Go to `https://vendor.warmpawz.com`
2. Select **"Pet Nutrition"** vendor type

---

### Step 1.2: Enter Basic Information

| Field | Value |
|-------|-------|
| Business Name | FreshPaws Kitchen |
| Owner Name | Chef Priya Sharma |
| Email | freshpaws.nutrition@testmail.com |
| Phone | +91 98765 45678 |
| Password | Test@Nutri2026! |

**Business Type:**
- [x] Fresh Pet Food Kitchen
- [x] Nutrition Consultation
- [ ] Raw Diet Specialist
- [x] Therapeutic Diets

---

### Step 1.3: Kitchen/Facility Address

| Field | Value |
|-------|-------|
| Address | Unit 8, Food Court Complex |
| Area | Indiranagar |
| City | Bangalore |
| State | Karnataka |
| Pincode | 560038 |

**Delivery Radius:** 20 km

---

### Step 1.4: Upload Documents

| Document | Description |
|----------|-------------|
| FSSAI License | Food safety certification |
| Kitchen Photos | Hygienic preparation area |
| Nutritionist Certification | Pet nutrition qualification |
| Business Registration | Shop establishment |
| GST Certificate | For invoicing |

---

### Step 1.5: Nutritionist Credentials

| Field | Value |
|-------|-------|
| Qualification | Certified Pet Nutritionist |
| Certification Body | APNC (Association of Pet Nutrition Consultants) |
| Years Experience | 5 years |
| Pets Served | 1000+ dogs, 500+ cats |
| Specializations | Weight management, Allergies, Senior pets |

---

### Step 1.6: Services Offered

**Services:**
- [x] Free Diet Consultation (Online)
- [x] Custom Meal Plans
- [x] Fresh Cooked Meals
- [x] Raw Meal Options
- [x] Therapeutic Diets
- [x] Weight Loss Programs
- [x] Allergy-Friendly Meals
- [x] Senior Pet Nutrition
- [x] Puppy/Kitten Growth Formulas

---

### Step 1.7: Bank Details & Submit

| Field | Value |
|-------|-------|
| Bank | SBI |
| Account | 30123456789 |
| IFSC | SBIN0001234 |

Submit for approval.

---

## PHASE 2: MENU & MEAL PLAN SETUP

### Step 2.1: Create Meal Categories

| Category | Description |
|----------|-------------|
| Regular Adult | Standard adult dog/cat food |
| Puppy Growth | High protein for growing pups |
| Senior Care | Easy to digest for older pets |
| Weight Management | Low calorie options |
| Allergy-Free | Limited ingredient diets |
| Therapeutic | Condition-specific meals |

---

### Step 2.2: Create Meal Items

**Sample Menu - Dogs:**

| Meal Name | Category | Ingredients | Price/Day | Calories |
|-----------|----------|-------------|-----------|----------|
| Chicken & Rice Bowl | Regular | Chicken, rice, vegetables, egg | ₹180 | 450 kcal |
| Lamb & Quinoa Feast | Regular | Lamb, quinoa, sweet potato | ₹220 | 500 kcal |
| Turkey & Veggie Lite | Weight Mgmt | Turkey, pumpkin, green beans | ₹200 | 350 kcal |
| Salmon & Brown Rice | Allergy-Free | Salmon, brown rice, spinach | ₹250 | 480 kcal |
| Senior Comfort Bowl | Senior | Chicken, oatmeal, carrots | ₹190 | 380 kcal |
| Puppy Power Bowl | Puppy | Chicken, rice, egg, calcium | ₹200 | 550 kcal |

**Sample Menu - Cats:**

| Meal Name | Category | Price/Day | Calories |
|-----------|----------|-----------|----------|
| Chicken Purrfection | Regular | ₹150 | 250 kcal |
| Fish Fiesta | Regular | ₹180 | 280 kcal |
| Turkey Trim | Weight Mgmt | ₹170 | 200 kcal |

---

### Step 2.3: Create Subscription Plans

| Plan | Meals/Week | Discount | Price/Week |
|------|------------|----------|------------|
| Starter | 3 meals | 5% | ₹513 |
| Regular | 5 meals | 10% | ₹810 |
| Premium | 7 meals (daily) | 15% | ₹1,071 |
| Full Month | 30 meals | 20% | ₹4,320 |

---

### Step 2.4: Set Delivery Schedule

| Day | Preparation Cutoff | Delivery Times |
|-----|-------------------|----------------|
| Mon-Sat | 6:00 PM previous day | 7-9 AM, 5-7 PM |
| Sunday | Saturday 2:00 PM | 8-10 AM only |

---

## PHASE 3: CUSTOMER CONSULTATION & ORDER

> **Switch to Customer Browser**

### Step 3.1: Customer Login

Login: `deepa.nambiar.pet@testmail.com` / `Test@Customer2026!`

---

### Step 3.2: Add Pet Profile

| Field | Value |
|-------|-------|
| Pet Name | Luna |
| Pet Type | Dog |
| Breed | Indie Dog |
| Age | 3 years |
| Weight | 18 kg |
| Target Weight | 16 kg (slightly overweight) |
| Activity Level | Moderate |
| Spayed | Yes |

**Health & Diet Info:**
| Field | Value |
|-------|-------|
| Current Diet | Commercial kibble |
| Allergies | Chicken (suspected) |
| Health Conditions | None |
| Digestive Issues | Occasional loose stool |
| Eating Habits | Fast eater |
| Food Preferences | Loves fish, vegetables |

---

### Step 3.3: Request Nutrition Consultation

**Action:**
1. Go to "Nutrition" category
2. Find "FreshPaws Kitchen"
3. Click "Get Free Consultation"

**Consultation Form:**
| Question | Answer |
|----------|--------|
| Main goals | Weight loss, better digestion |
| Budget range | ₹4,000-6,000/month |
| Preferred proteins | Fish, lamb (no chicken) |
| Delivery preference | Every 3 days |
| Start date | Next Monday |

---

### Step 3.4: Nutritionist Reviews Request

> **Vendor Side**

**Notification:**
```
🔔 New Consultation Request!

Customer: Deepa Nambiar
Pet: Luna (Indie Dog, 3 yrs, 18 kg)

Goals:
- Weight loss (target: 16 kg)
- Better digestion
- Chicken allergy

Budget: ₹4,000-6,000/month

[View Full Profile] [Create Plan]
```

---

### Step 3.5: Create Custom Meal Plan

**Action:**
1. Click "Create Plan"
2. Design meal plan for Luna:

**Luna's Custom Meal Plan:**
```
🐕 Personalized Nutrition Plan for Luna

Current Weight: 18 kg
Target Weight: 16 kg
Timeline: 8 weeks

Daily Caloric Needs: 650 kcal (reduced for weight loss)
Protein Source: Fish, Lamb (Chicken-free)

Weekly Meal Schedule:
┌─────────┬─────────────────────────┬─────────┐
│ Day     │ Meal                    │ Calories│
├─────────┼─────────────────────────┼─────────┤
│ Monday  │ Salmon & Brown Rice     │ 480 kcal│
│ Tuesday │ Lamb & Quinoa Feast     │ 500 kcal│
│ Wednesday│ Fish & Veggie Lite     │ 400 kcal│
│ Thursday│ Lamb & Sweet Potato     │ 480 kcal│
│ Friday  │ Salmon & Veggie Bowl    │ 420 kcal│
│ Saturday│ Lamb & Quinoa Feast     │ 500 kcal│
│ Sunday  │ Fish & Pumpkin Lite     │ 380 kcal│
└─────────┴─────────────────────────┴─────────┘

Supplements Included:
- Omega-3 fish oil (for coat & digestion)
- Probiotics (for gut health)

Feeding Instructions:
- Split into 2 meals: Morning (60%) & Evening (40%)
- Use slow feeder bowl
- No treats during weight loss phase

Weekly Cost: ₹1,400
Monthly Cost: ₹5,600

[Send to Customer]
```

---

### Step 3.6: Customer Reviews Plan

> **Customer Receives:**
```
📋 Your Custom Meal Plan is Ready!

FreshPaws Kitchen has created a 
personalized plan for Luna.

Plan Highlights:
✓ Chicken-free (allergy safe)
✓ Weight loss focused
✓ 7 meals/week variety
✓ Supplements included

Cost: ₹5,600/month (₹1,400/week)

[View Full Plan] [Accept] [Request Changes]
```

**Action:**
Customer clicks "Accept"

---

### Step 3.7: Subscribe to Meal Plan

**Action:**
1. Select subscription type: Monthly
2. Select delivery frequency: Every 3 days
3. Select delivery time: Evening (5-7 PM)
4. Enter/confirm delivery address
5. Pay for first month: ₹5,600

**Payment Confirmation:**
```
✅ Subscription Activated!

Plan: Luna's Weight Loss Plan
Duration: Monthly (auto-renews)
First Delivery: Monday, [Date]

Deliveries Scheduled:
- Monday 5-7 PM ✓
- Thursday 5-7 PM ✓
- Sunday 8-10 AM ✓

[View Schedule] [Manage Subscription]
```

---

## PHASE 4: MEAL PREPARATION & DELIVERY

### Step 4.1: Vendor Receives Order

> **Vendor Dashboard**

**Orders View:**
```
📦 Upcoming Orders

Monday Delivery (10 orders):
├── Luna (Deepa) - Salmon & Brown Rice + Lamb Quinoa + Fish Veggie
├── [Other orders...]

Preparation Status:
├── Ingredients Ready: ✓
├── Prep Started: ⏳
└── Packaging: ⏳
```

---

### Step 4.2: Prepare Meals

**Action:**
1. Go to "Orders" → "Today's Preparation"
2. Select Luna's order
3. Follow preparation checklist:

**Preparation Checklist:**
- [ ] Source ingredients (fresh fish, lamb)
- [ ] Cook meals according to recipe
- [ ] Portion based on Luna's plan (180g per meal)
- [ ] Add supplements (Omega-3, probiotics)
- [ ] Package in fresh containers
- [ ] Label with:
  - Pet name
  - Meal name
  - Date prepared
  - Reheating instructions
  - Expiry date

4. Mark as "Ready for Delivery"

---

### Step 4.3: Dispatch Delivery

**Action:**
1. Assign to delivery person
2. Pack with ice packs (for freshness)
3. Dispatch order

**Customer Notified:**
```
🍲 Fresh Meals on the Way!

Your delivery for Luna is being delivered.
Contents: 3 meals (Mon, Tue, Wed)

Estimated Arrival: 5:30 PM
Delivery Person: Sunil

[Track Delivery]
```

---

### Step 4.4: Customer Receives Delivery

**Package Contains:**
- 3 meal containers (labeled)
- Feeding instructions card
- Supplement sachets
- Storage instructions
- Next delivery reminder

**Customer Actions:**
1. Receives package
2. Checks contents
3. Stores in refrigerator
4. Confirms delivery in app

---

## PHASE 5: SUBSCRIPTION MANAGEMENT

### Step 5.1: View Subscription Dashboard

**Customer Dashboard:**
```
🍲 Luna's Meal Subscription

Current Plan: Weight Loss (Monthly)
Status: Active
Next Billing: [Date]
Next Delivery: Thursday, [Date]

This Month:
├── Meals Delivered: 9/30
├── Days Remaining: 21
└── Amount Paid: ₹5,600

[Pause Subscription] [Skip Next Delivery]
[Change Plan] [Cancel]
```

---

### Step 5.2: Skip a Delivery

**Action:**
1. Customer going on vacation
2. Clicks "Skip Next Delivery"
3. Selects Thursday delivery to skip
4. Confirms skip

**Result:**
- Thursday delivery cancelled
- Meals credited to next delivery
- Or refund processed (based on policy)

---

### Step 5.3: Pause Subscription

**Action:**
1. Click "Pause Subscription"
2. Select pause duration: 1 week
3. Select resume date
4. Confirm pause

**Result:**
```
⏸️ Subscription Paused

Paused Until: [Date]
Auto-resumes: [Date]
Next Delivery After Resume: [Date]

Billing paused accordingly.
```

---

### Step 5.4: Modify Meal Preferences

**Action:**
1. Click "Change Plan"
2. Request modification:
   - Add variety: Include duck
   - Change delivery time: Morning
3. Submit request

**Nutritionist Reviews:**
- Approves duck addition
- Updates meal rotation
- Notifies customer

---

## PHASE 6: HEALTH TRACKING & ADJUSTMENTS

### Step 6.1: Log Pet's Weight

**Action (Customer):**
Weekly weight logging

| Week | Weight | Change |
|------|--------|--------|
| Week 0 | 18.0 kg | - |
| Week 2 | 17.6 kg | -0.4 kg |
| Week 4 | 17.2 kg | -0.4 kg |
| Week 6 | 16.8 kg | -0.4 kg |
| Week 8 | 16.3 kg | -0.5 kg |

---

### Step 6.2: Progress Dashboard

**Customer Sees:**
```
📊 Luna's Progress

Weight Journey:
18.0 kg → 16.3 kg (-1.7 kg in 8 weeks!)
Target: 16.0 kg (Almost there! 🎉)

Trend: 📉 Healthy weight loss

Health Notes:
- Coat looking shinier
- Energy levels improved
- Digestion normalized

[Log New Weight] [Add Health Note] [Share with Vet]
```

---

### Step 6.3: Nutritionist Reviews Progress

> **Vendor Side**

**Notification:**
```
📈 Client Progress Update

Luna (Deepa Nambiar)
8-week check-in

Weight: 18.0 → 16.3 kg (-1.7 kg)
Target: 16.0 kg

Status: Excellent progress! ✓

Recommendation: 
Gradually transition to maintenance diet.

[Send Update to Customer] [Adjust Plan]
```

---

### Step 6.4: Adjust to Maintenance Plan

**Action:**
1. Nutritionist creates maintenance plan
2. Increases calories slightly (700 kcal/day)
3. Adds more variety
4. Sends to customer

**Customer Receives:**
```
🎉 Congratulations! Luna is almost at target!

Based on her amazing progress, we're 
transitioning to a Maintenance Plan:

Changes:
- Slightly increased portions
- More meal variety
- Treat allowance added

New Monthly Cost: ₹5,200

[Accept New Plan] [Keep Current Plan]
```

---

## EDGE CASES

### Edge Case 1: Allergy Reaction Reported

**Scenario:** Customer reports allergic reaction after meal

**Steps:**
1. Customer reports issue immediately
2. Specifies meal and symptoms
3. Nutritionist reviews ingredients
4. Identifies potential allergen
5. Updates pet profile with new allergy
6. Adjusts all future meals
7. Affected meals replaced/refunded

---

### Edge Case 2: Delivery Spoilage

**Scenario:** Food arrives warm/spoiled

**Steps:**
1. Customer refuses delivery or reports issue
2. Photos required for documentation
3. Full replacement scheduled
4. Delivery process reviewed
5. Ice pack protocols checked

---

### Edge Case 3: Pet Refuses Food

**Scenario:** Pet won't eat new food

**Steps:**
1. Customer reports refusal
2. Nutritionist consults (was transition gradual?)
3. Alternative proteins suggested
4. Trial meals sent
5. Plan adjusted based on acceptance

---

### Edge Case 4: Emergency Diet Change

**Scenario:** Vet prescribes therapeutic diet (e.g., kidney disease)

**Steps:**
1. Customer provides vet prescription
2. Nutritionist creates therapeutic plan
3. Works with vet on requirements
4. Specialized meals prepared
5. Premium pricing may apply

---

### Edge Case 5: Subscription Payment Failed

**Scenario:** Auto-renewal payment fails

**Steps:**
1. Customer notified
2. Grace period (3 days)
3. Delivery paused if not resolved
4. Retry payment option
5. Subscription cancelled after X failures

---

### Edge Case 6: Delivery Address Change

**Scenario:** Customer moving to new address

**Steps:**
1. Customer updates address
2. System checks serviceability
3. If in range: Address updated
4. If out of range: Alternative options
5. Delivery schedule may change

---

### Edge Case 7: Pet Health Emergency

**Scenario:** Pet hospitalized, needs to stop meals

**Steps:**
1. Customer reports emergency
2. Immediate pause activated
3. No cancellation fees
4. Remaining balance refunded/credited
5. Resume when pet recovers

---

### Edge Case 8: Multiple Pets, Different Needs

**Scenario:** 2 dogs with different diets

**Steps:**
1. Create separate plans per pet
2. Consolidated deliveries
3. Clearly labeled meals
4. Combined billing option
5. Individual tracking per pet

---

## TROUBLESHOOTING GUIDE

### Problem: Meals Don't Match Order

**Solutions:**
1. Check labels against order
2. Report discrepancy immediately
3. Replacement dispatched
4. Quality check at kitchen

---

### Problem: Food Storage Issues

**Customer Guidance:**
- Store in refrigerator (3-4 days)
- Freeze for longer storage (30 days)
- Thaw in fridge overnight
- Serve at room temperature

---

### Problem: Pet Has Digestive Upset

**Solutions:**
1. Transition more gradually (mix with old food)
2. Reduce portion sizes initially
3. Contact nutritionist for guidance
4. May need different protein source

---

## TEST COMPLETION CHECKLIST

### Vendor Onboarding
- [ ] Kitchen registration complete
- [ ] Menu items created
- [ ] Subscription plans set up
- [ ] Delivery schedule configured
- [ ] Approved and active

### Customer Journey
- [ ] Pet profile with health details
- [ ] Consultation requested
- [ ] Custom plan received
- [ ] Subscription purchased
- [ ] First delivery received

### Subscription Management
- [ ] Skip delivery tested
- [ ] Pause subscription tested
- [ ] Modify preferences tested
- [ ] Cancel and refund tested

### Health Tracking
- [ ] Weight logging working
- [ ] Progress visualization showing
- [ ] Plan adjustments processed
- [ ] Maintenance transition tested

### Edge Cases
- [ ] Allergy reaction handling
- [ ] Spoilage report tested
- [ ] Food refusal handled
- [ ] Payment failure tested

---

## NOTES & OBSERVATIONS

| Date | Test Case | Issue Found | Severity | Notes |
|------|-----------|-------------|----------|-------|
| | | | | |

---

**End of Pet Nutritionist Testing Plan**

---

*Document prepared for WarmPawz Functional Testing Team*
