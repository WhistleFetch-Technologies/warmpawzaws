# 🐾 WarmPawz - Complete Functional Testing Plans

## Master Index & Quick Reference Guide

---

## 📁 Testing Plan Files

| # | Vendor Type | File Name | Test Customer | Test Pet |
|---|-------------|-----------|---------------|----------|
| 1 | 🏥 Veterinary | `01_VETERINARY_TESTING_PLAN.md` | Priya Sharma | Bruno (Golden Retriever) |
| 2 | ✂️ Grooming | `02_GROOMER_TESTING_PLAN.md` | Ananya Patel | Muffin (Persian Cat) |
| 3 | 🚶 Walking | `03_WALKER_TESTING_PLAN.md` | Vikram Singh | Rocky (Labrador) |
| 4 | 🎓 Training | `04_TRAINER_TESTING_PLAN.md` | Meera Reddy | Max (German Shepherd) |
| 5 | 💊 Pharmacy | `05_PHARMACY_TESTING_PLAN.md` | Arun Krishnan | Buddy (Beagle) |
| 6 | 🥗 Nutrition | `06_NUTRITIONIST_TESTING_PLAN.md` | Deepa Nambiar | Luna (Indie Dog) |
| 7 | 🛒 E-commerce | `07_ECOMMERCE_TESTING_PLAN.md` | Rahul Gupta | Charlie (Pomeranian) |

---

## 🌐 Test Environment URLs

| Application | URL | Purpose |
|-------------|-----|---------|
| Vendor Portal | `https://vendor.warmpawz.com` | All vendor logins |
| Customer App | `https://app.warmpawz.com` | All customer logins |
| Admin Panel | `https://admin.warmpawz.com` | Admin approvals, support |

---

## 🔐 Quick Reference - All Test Credentials

### Vendor Credentials

| Vendor Type | Email | Password |
|-------------|-------|----------|
| Veterinary | dr.pawcare.vet@testmail.com | Test@Vet2026! |
| Grooming | pawspa.grooming@testmail.com | Test@Groom2026! |
| Walking | happypaws.walker@testmail.com | Test@Walker2026! |
| Training | elite.dogtrainer@testmail.com | Test@Train2026! |
| Pharmacy | petmeds.pharmacy@testmail.com | Test@Pharma2026! |
| Nutrition | freshpaws.nutrition@testmail.com | Test@Nutri2026! |
| E-commerce | pawsome.store@testmail.com | Test@Store2026! |

### Customer Credentials

| Customer | Email | Password | Pet |
|----------|-------|----------|-----|
| Priya Sharma | priya.sharma.pet@testmail.com | Test@Customer2026! | Bruno |
| Ananya Patel | ananya.patel.pet@testmail.com | Test@Customer2026! | Muffin |
| Vikram Singh | vikram.singh.pet@testmail.com | Test@Customer2026! | Rocky |
| Meera Reddy | meera.reddy.pet@testmail.com | Test@Customer2026! | Max |
| Arun Krishnan | arun.krishnan.pet@testmail.com | Test@Customer2026! | Buddy |
| Deepa Nambiar | deepa.nambiar.pet@testmail.com | Test@Customer2026! | Luna |
| Rahul Gupta | rahul.gupta.pet@testmail.com | Test@Customer2026! | Charlie |

### Test Payment Cards

| Card Type | Number | Expiry | CVV | Result |
|-----------|--------|--------|-----|--------|
| Success | 4111 1111 1111 1111 | 12/28 | 123 | ✅ Approved |
| Decline | 4000 0000 0000 0002 | 12/28 | 123 | ❌ Declined |

---

## 📋 Testing Phases Overview

Each testing plan follows a consistent structure:

### Phase 1: Vendor Onboarding
- Registration with all required fields
- Document upload (KYC)
- Service/product configuration
- Pricing setup
- Bank details
- Admin approval

### Phase 2: Vendor Dashboard Setup
- Profile completion
- Feature configuration
- Scheduling/inventory setup
- Additional settings

### Phase 3: Customer Booking/Order Journey
- Customer login
- Pet profile creation
- Service discovery
- Booking/ordering flow
- Payment processing
- Confirmation

### Phase 4: Service Delivery
- Vendor notification
- Check-in/processing
- Service execution
- Real-time updates (where applicable)
- Completion

### Phase 5: Payment & Revenue
- Earnings visibility
- Commission calculation
- Settlement tracking
- Transaction history

### Phase 6: Post-Service Actions
- Customer review
- Vendor response
- Re-booking/repeat orders
- Subscription management (where applicable)

### Edge Cases
- Cancellations
- No-shows
- Refunds
- Special scenarios

---

## ⏱️ Estimated Testing Times

| Vendor Type | Estimated Time | Priority |
|-------------|----------------|----------|
| Veterinary | 4-5 hours | High |
| Grooming | 4-5 hours | High |
| Walking | 4-5 hours | High |
| Training | 4-5 hours | Medium |
| Pharmacy | 4-5 hours | High |
| Nutrition | 4-5 hours | Medium |
| E-commerce | 4-5 hours | High |

**Total Estimated Testing Time: 28-35 hours**

---

## 🔄 Testing Order Recommendation

For comprehensive testing, follow this order:

1. **Start with E-commerce** - Tests basic shop functionality
2. **Then Veterinary** - Tests service booking + prescriptions
3. **Then Pharmacy** - Tests prescription ordering (links to Vet)
4. **Then Grooming** - Tests appointment booking
5. **Then Walking** - Tests GPS tracking features
6. **Then Training** - Tests progress tracking & packages
7. **Finally Nutrition** - Tests subscription & meal plans

This order allows testing cross-functional features like prescription-to-pharmacy flow.

---

## 🛠️ Pre-Testing Checklist

Before starting testing, ensure:

- [ ] Browser is updated (Chrome recommended)
- [ ] Cache cleared
- [ ] Two browser windows ready (Vendor + Customer)
- [ ] Notepad ready for issue logging
- [ ] Screenshot tool ready
- [ ] Test environment URLs accessible
- [ ] Test credentials work

---

## 📝 Issue Reporting Template

When you find an issue, document it as follows:

```
Issue ID: [VENDOR TYPE]-[PHASE]-[NUMBER]
Example: VET-P3-001

Date: [Date]
Tester: [Your Name]
Vendor Type: [e.g., Veterinary]
Phase: [e.g., Customer Booking]
Step: [e.g., Step 3.7 - Payment]

Issue Description:
[Describe what happened]

Expected Behavior:
[What should have happened]

Actual Behavior:
[What actually happened]

Screenshots:
[Attach screenshots]

Severity: 
[ ] Critical - Blocks testing
[ ] High - Major feature broken
[ ] Medium - Feature works but has issues
[ ] Low - Minor UI/cosmetic issue

Environment:
Browser: Chrome 120
OS: Windows 11 / macOS

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]
```

---

## 📊 Test Completion Tracker

Use this to track overall progress:

| Vendor | Onboarding | Dashboard | Booking | Delivery | Payment | Post-Service | Edge Cases | Status |
|--------|------------|-----------|---------|----------|---------|--------------|------------|--------|
| Vet | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Not Started |
| Groomer | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Not Started |
| Walker | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Not Started |
| Trainer | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Not Started |
| Pharmacy | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Not Started |
| Nutrition | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Not Started |
| E-commerce | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Not Started |

Legend: ⬜ = Not Started, 🔄 = In Progress, ✅ = Passed, ❌ = Failed

---

## 📞 Support Contacts

For testing support:
- Testing Team Lead: [Name]
- Developer Support: [Name]
- Environment Issues: [Name]

---

## 📅 Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 15, 2026 | AI Assistant | Initial creation of all 7 testing plans |

---

**Happy Testing! 🐾**

*If you find any issues with the testing plans themselves, please report them to the testing team lead.*
