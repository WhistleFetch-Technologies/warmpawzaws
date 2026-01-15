# 🎓 Pet Training Services - Complete Testing Plan

## Document Information
| Field | Value |
|-------|-------|
| **Document Version** | 1.0 |
| **Created Date** | January 15, 2026 |
| **Vendor Type** | Dog Trainer / Pet Training Academy |
| **Test Customer** | Meera Reddy (Pet: Max - German Shepherd) |
| **Estimated Testing Time** | 4-5 hours |

---

## 📋 TABLE OF CONTENTS
1. [Test Environment Setup](#1-test-environment-setup)
2. [Test Credentials](#2-test-credentials)
3. [Phase 1: Vendor Onboarding](#phase-1-vendor-onboarding)
4. [Phase 2: Vendor Dashboard Setup](#phase-2-vendor-dashboard-setup)
5. [Phase 3: Customer Booking Journey](#phase-3-customer-booking-journey)
6. [Phase 4: Training Session Delivery](#phase-4-training-session-delivery)
7. [Phase 5: Progress Tracking & Packages](#phase-5-progress-tracking--packages)
8. [Phase 6: Post-Service & Certification](#phase-6-post-service--certification)
9. [Edge Cases](#edge-cases)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## 1. Test Environment Setup

### 1.1 URLs
| Application | URL |
|-------------|-----|
| Vendor Web App | `https://vendor.warmpawz.com` |
| Customer Web App | `https://app.warmpawz.com` |
| Admin Panel | `https://admin.warmpawz.com` |

---

## 2. Test Credentials

### 2.1 Vendor Credentials (Trainer)
```
📧 Email: elite.dogtrainer@testmail.com
🔑 Password: Test@Train2026!
📱 Phone: +91 98765 34567
```

### 2.2 Customer Credentials
```
📧 Email: meera.reddy.pet@testmail.com
🔑 Password: Test@Customer2026!
📱 Phone: +91 87654 43210
```

---

## PHASE 1: VENDOR ONBOARDING

### Step 1.1: Registration

**Action:**
1. Go to `https://vendor.warmpawz.com`
2. Click "Register"
3. Select **"Pet Training"** vendor type

---

### Step 1.2: Enter Basic Information

| Field | Value |
|-------|-------|
| Business Name | Elite K9 Training Academy |
| Trainer Name | Rajesh Menon |
| Email | elite.dogtrainer@testmail.com |
| Phone | +91 98765 34567 |
| Password | Test@Train2026! |

**Training Location Options:**
- [x] At Customer's Home
- [x] At Training Facility
- [x] Online (Video Sessions)
- [x] Park/Outdoor

---

### Step 1.3: Training Facility Address

| Field | Value |
|-------|-------|
| Address | Plot 45, Industrial Area |
| City | Hyderabad |
| State | Telangana |
| Pincode | 500032 |
| Facility Features | Indoor arena, Agility course, Fenced yard |

---

### Step 1.4: Upload Documents

| Document | Description |
|----------|-------------|
| ID Proof | Aadhaar/PAN |
| Training Certifications | CCPDT, APDT certifications |
| Business Registration | If applicable |
| Facility Photos | Training area photos |
| Insurance | Professional liability insurance |

---

### Step 1.5: Set Training Specializations

**Training Types:**
- [x] Puppy Training (8 weeks - 6 months)
- [x] Basic Obedience
- [x] Advanced Obedience
- [x] Behavior Modification
- [x] Aggression Management
- [x] Leash Training
- [x] Potty Training
- [x] Socialization
- [x] Agility Training
- [x] Guard Dog Training
- [ ] Service Dog Training
- [x] Trick Training

**Dog Sizes Accepted:**
- [x] All sizes

**Experience:**
| Field | Value |
|-------|-------|
| Years Experience | 10 years |
| Dogs Trained | 2000+ |
| Success Rate | 95% |
| Training Method | Positive Reinforcement |

---

### Step 1.6: Set Training Programs & Pricing

**Individual Sessions:**
| Session Type | Duration | Price (₹) |
|--------------|----------|-----------|
| Consultation/Assessment | 60 mins | 500 |
| Basic Training Session | 60 mins | 800 |
| Advanced Training Session | 60 mins | 1200 |
| Behavior Modification | 90 mins | 1500 |
| Home Visit Session | 60 mins | 1200 |
| Online Video Session | 45 mins | 600 |

**Training Packages:**
| Package Name | Sessions | Duration | Price (₹) | Description |
|--------------|----------|----------|-----------|-------------|
| Puppy Starter | 8 sessions | 4 weeks | 5,000 | Basic commands, socialization |
| Obedience Foundation | 12 sessions | 6 weeks | 8,500 | Complete obedience training |
| Behavior Boot Camp | 16 sessions | 8 weeks | 14,000 | Problem behavior correction |
| Elite Companion | 24 sessions | 12 weeks | 20,000 | Advanced + tricks + agility |
| Board & Train | Full board | 2 weeks | 35,000 | Dog stays at facility |

---

### Step 1.7: Set Availability

| Day | Slot 1 | Slot 2 | Slot 3 |
|-----|--------|--------|--------|
| Mon | 9 AM | 11 AM | 4 PM |
| Tue | 9 AM | 11 AM | 4 PM |
| Wed | 9 AM | 11 AM | 4 PM |
| Thu | 9 AM | 11 AM | 4 PM |
| Fri | 9 AM | 11 AM | 4 PM |
| Sat | 8 AM | 10 AM | 12 PM |
| Sun | 8 AM | 10 AM | - |

---

### Step 1.8: Bank Details & Submit

| Field | Value |
|-------|-------|
| Bank | Kotak Mahindra Bank |
| Account | 1234567890123 |
| IFSC | KKBK0001234 |

Submit for approval.

---

## PHASE 2: VENDOR DASHBOARD SETUP

### Step 2.1: Login & Profile

**Dashboard Features:**
- 📊 Dashboard
- 🎓 Training Sessions
- 📦 Packages
- 📈 Progress Tracking
- 📝 Skill Assessments
- 🏆 Certifications
- 💰 Earnings

---

### Step 2.2: Create Skill Matrix Template

**Action:**
Set up skills to track for each dog:

**Basic Skills:**
| Skill | Proficiency Levels |
|-------|-------------------|
| Sit | Beginner → Intermediate → Advanced → Expert |
| Stay | Beginner → Intermediate → Advanced → Expert |
| Come (Recall) | Beginner → Intermediate → Advanced → Expert |
| Down | Beginner → Intermediate → Advanced → Expert |
| Heel | Beginner → Intermediate → Advanced → Expert |
| Leave It | Beginner → Intermediate → Advanced → Expert |
| Wait | Beginner → Intermediate → Advanced → Expert |

**Advanced Skills:**
| Skill | Proficiency Levels |
|-------|-------------------|
| Off-Leash Control | Beginner → Advanced |
| Distance Commands | Beginner → Advanced |
| Distraction Training | Beginner → Advanced |
| Emergency Stop | Beginner → Advanced |

---

## PHASE 3: CUSTOMER BOOKING JOURNEY

> **Switch to Customer Browser**

### Step 3.1: Customer Login

Login: `meera.reddy.pet@testmail.com` / `Test@Customer2026!`

---

### Step 3.2: Add Pet Profile

| Field | Value |
|-------|-------|
| Pet Name | Max |
| Pet Type | Dog |
| Breed | German Shepherd |
| Age | 10 months |
| Weight | 28 kg |
| Gender | Male |
| Neutered | Yes |

**Behavior Assessment:**
| Field | Value |
|-------|-------|
| Current Training Level | No formal training |
| Behavior Issues | Pulls on leash, jumps on guests |
| Socialization | Good with people, reactive to dogs |
| Commands Known | None consistently |
| Motivation | Food motivated |
| Previous Training | None |

---

### Step 3.3: Search for Trainers

**Action:**
1. Click "Training" category
2. Location: Hyderabad
3. Filter: Behavior Modification, 4+ stars

---

### Step 3.4: View Trainer Profile

**Click "Elite K9 Training Academy"**

**Profile Shows:**
- Trainer photo and credentials
- Training philosophy
- Success stories
- Before/After videos
- Packages and pricing
- Reviews

---

### Step 3.5: Book Assessment Session

**Action:**
1. Click "Book Now"
2. Select: "Consultation/Assessment" - ₹500
3. Select Pet: Max
4. Location: "At Trainer's Facility"
5. Date: Day after tomorrow
6. Time: 9:00 AM

**Pre-Assessment Questions:**
| Question | Answer |
|----------|--------|
| Main goals | Stop leash pulling, stop jumping, improve recall |
| Urgency | Moderate - want to start soon |
| Schedule flexibility | Weekday mornings preferred |
| Budget range | ₹8,000 - ₹15,000 total |

---

### Step 3.6: Pay for Assessment

**Booking Summary:**
```
🎓 Training Assessment
📍 Elite K9 Training Academy
📅 [Date] at 9:00 AM
🐕 Pet: Max (German Shepherd)

Total: ₹618 (₹500 + fees + GST)
```

Complete payment.

---

## PHASE 4: TRAINING SESSION DELIVERY

### Step 4.1: Assessment Day

> **Vendor Side**

**Action:**
1. Customer arrives with Max
2. Click "Start Session"

**Assessment Form:**
| Area | Observation |
|------|-------------|
| Greeting Behavior | Excited, jumps up |
| Leash Behavior | Pulls strongly, no attention to handler |
| Basic Commands | Does not respond to sit/stay |
| Treat Response | Highly food motivated |
| Toy Response | Moderate interest |
| Handler Relationship | Good bond, needs structure |
| Reactivity | Mild dog reactivity, manageable |
| Overall Assessment | Excellent candidate for training |

---

### Step 4.2: Recommend Training Package

**Action:**
1. Based on assessment, recommend package
2. Click "Send Package Recommendation"

**Recommendation to Customer:**
```
📋 Training Plan for Max

Based on our assessment, I recommend the 
"Obedience Foundation" package:

Package: Obedience Foundation
├── 12 Sessions over 6 weeks
├── 2 sessions per week
├── Focus: Leash manners, jumping, recall
├── Includes: Homework assignments
├── Price: ₹8,500

Goals We'll Achieve:
✓ Loose leash walking
✓ No jumping on guests
✓ Reliable recall
✓ Sit, Stay, Down, Come
✓ Basic impulse control

[Accept Package] [Discuss Options]
```

---

### Step 4.3: Customer Purchases Package

> **Customer Side**

**Action:**
1. Customer receives recommendation
2. Reviews package details
3. Clicks "Accept Package"
4. Completes payment: ₹8,500

**Package Activated:**
- 12 sessions credited to account
- Schedule appears for booking
- Session 1 already counts (assessment)

---

### Step 4.4: Schedule Remaining Sessions

**Action:**
Customer or Trainer schedules:

| Session | Date | Time | Focus |
|---------|------|------|-------|
| 2 | Week 1, Day 3 | 9 AM | Sit, Down basics |
| 3 | Week 1, Day 5 | 9 AM | Stay introduction |
| 4 | Week 2, Day 1 | 9 AM | Leash basics |
| ... | ... | ... | ... |
| 12 | Week 6, Day 5 | 9 AM | Graduation test |

---

### Step 4.5: Conduct Training Session

> **Vendor - Session 2**

**Action:**
1. Start session
2. Document progress

**Session Record:**
| Field | Value |
|-------|-------|
| Session # | 2 of 12 |
| Duration | 60 minutes |
| Skills Worked | Sit, Down, Focus (Look at me) |
| Progress | Sit: 80% success, Down: 50% success |
| Behavior Notes | Max is learning quickly, slightly distracted |
| Homework | Practice Sit 10 times daily, 5 min focus exercises |

---

### Step 4.6: Update Skill Matrix

**Action:**
Update Max's progress:

| Skill | Before | After Session 2 |
|-------|--------|-----------------|
| Sit | Beginner | Intermediate (80%) |
| Down | Beginner | Beginner (50%) |
| Focus | None | Beginner (60%) |

---

### Step 4.7: Send Session Summary to Customer

**Customer Receives:**
```
📝 Training Session Summary

Session 2 of 12 Completed! 🎉

Skills Practiced:
├── Sit: ★★★☆☆ Great progress!
├── Down: ★★☆☆☆ Getting there
├── Focus: ★★☆☆☆ Good start

Homework for this week:
1. Practice "Sit" 10 times before meals
2. 5-minute focus exercises with treats
3. Keep sessions short and fun!

📹 [View Training Video Clips]
📅 Next Session: [Date] at 9 AM

[View Full Progress Report]
```

---

## PHASE 5: PROGRESS TRACKING & PACKAGES

### Step 5.1: Customer Views Progress Dashboard

**Customer Dashboard Shows:**
```
🐕 Max's Training Progress

Package: Obedience Foundation
Sessions: 2/12 Completed
Duration: Week 1 of 6

Skill Matrix:
┌─────────────┬─────────────┐
│ Skill       │ Level       │
├─────────────┼─────────────┤
│ Sit         │ ████░░ 80%  │
│ Down        │ ██░░░░ 50%  │
│ Focus       │ ███░░░ 60%  │
│ Stay        │ ░░░░░░ 0%   │
│ Come        │ ░░░░░░ 0%   │
│ Heel        │ ░░░░░░ 0%   │
└─────────────┴─────────────┘

[View Detailed Progress]
[Watch Training Videos]
[View Homework]
```

---

### Step 5.2: View Session History

**Action:**
Click "View Detailed Progress"

**Session Timeline:**
```
Session 1 - Assessment ✓
├── Date: [Date]
├── Focus: Initial evaluation
├── Notes: Excellent candidate
└── [View Details]

Session 2 - Basics ✓
├── Date: [Date]
├── Focus: Sit, Down, Focus
├── Progress: Good
└── [View Details] [Watch Videos]

Session 3 - Upcoming
├── Date: [Date]
├── Focus: Stay introduction
└── [Reschedule]
```

---

### Step 5.3: Midpoint Evaluation (Session 6)

> **Vendor conducts midpoint check**

**Midpoint Report:**
```
📊 Midpoint Progress Report - Max

Sessions Completed: 6 of 12
Timeline: Week 3 of 6

Progress Summary:
├── Sit: ████████░░ 90% ✓ On track
├── Down: ███████░░░ 80% ✓ On track
├── Stay: █████░░░░░ 60% Needs work
├── Focus: ████████░░ 85% ✓ On track
├── Recall: ████░░░░░░ 45% Needs focus
├── Leash: ██████░░░░ 70% Improving

Recommendation: 
Continue current pace. Extra focus on 
Recall in remaining sessions.

[Share with Customer]
```

---

## PHASE 6: POST-SERVICE & CERTIFICATION

### Step 6.1: Final Session - Graduation

> **Session 12**

**Action:**
1. Conduct graduation test
2. Test all skills learned

**Graduation Test Results:**
| Skill | Test Result | Pass/Fail |
|-------|-------------|-----------|
| Sit | 10/10 | ✅ Pass |
| Down | 9/10 | ✅ Pass |
| Stay (30 sec) | 8/10 | ✅ Pass |
| Come (Recall) | 8/10 | ✅ Pass |
| Heel (50m) | 7/10 | ✅ Pass |
| Leave It | 9/10 | ✅ Pass |

**Overall Score: 51/60 (85%) - PASSED! 🎉**

---

### Step 6.2: Generate Graduation Certificate

**Action:**
1. Click "Generate Certificate"
2. Certificate auto-created

**Certificate Details:**
```
🏆 CERTIFICATE OF COMPLETION

This certifies that

MAX
(German Shepherd, owned by Meera Reddy)

has successfully completed the

OBEDIENCE FOUNDATION PROGRAM

at Elite K9 Training Academy

Date: [Date]
Trainer: Rajesh Menon
Score: 85%
Skills: Sit, Down, Stay, Come, Heel, Leave It

[Digital Certificate with QR Code]
```

---

### Step 6.3: Customer Receives Certificate

**Customer Gets:**
- Digital certificate (PDF)
- Shareable badge for social media
- QR code linking to verified certificate
- Before/After video compilation

---

### Step 6.4: Customer Reviews Training

**Review:**
```
⭐⭐⭐⭐⭐ 5/5

"Absolutely amazing transformation! Max went 
from pulling me down the street to walking 
calmly by my side. Rajesh is incredibly 
patient and explains everything clearly. 
The progress tracking helped us stay 
motivated. Worth every rupee! Max is now 
a certified good boy! 🐕🎓"

[Attached: Before/After video]
```

---

### Step 6.5: Offer Continuation Package

**Trainer Sends:**
```
🎓 Congratulations on Graduating!

Max did wonderfully! To continue his 
progress, consider:

Advanced Training Package
├── 8 sessions
├── Off-leash training
├── Advanced tricks
├── Agility introduction
├── Price: ₹6,500

Maintenance Sessions
├── Monthly check-ins
├── Keep skills sharp
├── ₹800/session

[Book Advanced Package]
[Schedule Maintenance]
```

---

## EDGE CASES

### Edge Case 1: Dog Not Progressing

**Scenario:** After 4 sessions, dog shows no improvement

**Steps:**
1. Trainer documents challenges
2. Schedules meeting with owner
3. Adjusts training approach
4. May recommend different methods
5. Package can be extended if needed

---

### Edge Case 2: Owner Not Doing Homework

**Scenario:** Owner doesn't practice between sessions

**Steps:**
1. Trainer notes lack of homework
2. Sends reminder notifications
3. Discusses importance in next session
4. May recommend more frequent sessions
5. Progress report highlights gap

---

### Edge Case 3: Dog Aggression Issue

**Scenario:** Dog shows aggression during training

**Steps:**
1. Trainer stops session safely
2. Documents incident
3. Recommends behavior specialist
4. May refuse to continue
5. Partial refund if safety issue

---

### Edge Case 4: Customer Wants Different Trainer

**Scenario:** Customer not happy with trainer style

**Steps:**
1. Customer contacts support
2. Requests trainer change
3. Unused sessions transferred
4. New trainer assigned
5. New assessment may be needed

---

### Edge Case 5: Package Expiry

**Scenario:** Sessions not used within time limit

**Steps:**
1. Warning at 2 weeks before expiry
2. Offer extension for fee
3. Sessions expire if not used
4. Partial refund if reasonable request

---

### Edge Case 6: Video Session Technical Issues

**Scenario:** Online session has connectivity problems

**Steps:**
1. Try reconnecting
2. Switch to phone call if needed
3. Reschedule if persistent
4. Session doesn't count if <50% completed
5. Document technical issues

---

### Edge Case 7: Board & Train Progress Updates

**Scenario:** Dog at facility for 2-week program

**Steps:**
1. Daily photo/video updates sent
2. Weekly progress calls scheduled
3. Midpoint visit allowed
4. Daily feeding/health logs maintained
5. Graduation event at pickup

---

## TEST COMPLETION CHECKLIST

### Vendor Onboarding
- [ ] Trainer registration complete
- [ ] Specializations set
- [ ] Packages created
- [ ] Skill matrix template set
- [ ] Approved and active

### Customer Booking
- [ ] Pet profile with behavior assessment
- [ ] Assessment session booked
- [ ] Package purchased
- [ ] Sessions scheduled

### Training Delivery
- [ ] Sessions conducted
- [ ] Progress recorded
- [ ] Skill matrix updated
- [ ] Homework assigned
- [ ] Videos shared

### Progress Tracking
- [ ] Customer dashboard shows progress
- [ ] Skill visualization working
- [ ] Session history visible
- [ ] Midpoint evaluation done

### Completion
- [ ] Graduation test conducted
- [ ] Certificate generated
- [ ] Review submitted
- [ ] Continuation offered

---

## NOTES & OBSERVATIONS

| Date | Test Case | Issue Found | Severity | Notes |
|------|-----------|-------------|----------|-------|
| | | | | |

---

**End of Pet Training Testing Plan**

---

*Document prepared for WarmPawz Functional Testing Team*
