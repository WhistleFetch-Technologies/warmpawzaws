# Instant Video Calling Flow - Analysis & Fix

## Current Flow (Broken - Missing Payment)

1. ✅ Mode Selection (Instant vs Scheduled)
2. ✅ Service Selection
3. ✅ Pet Selection
4. ❌ **MISSING: Payment Step**
5. ✅ Join Queue (without payment)
6. ✅ Wait for Provider Acceptance
7. ✅ Booking Created Automatically
8. ✅ Video Call Started

## Required Flow (Per User Requirements)

1. ✅ List services & service providers
2. ✅ Display problems/needs on top with filter/search
3. ✅ List instantly available doctors/nutritionists (staff and solo providers)
4. ✅ Horizontal scroll bar with speciality and experience
5. ✅ Schedule check and availability check (available in next 5 min)
6. ✅ Select pet profile
7. ❌ **MISSING: Make a payment** ← **STOPS HERE**
8. ✅ Assign first available doctor from list
9. ✅ Notify staff/solo/nutritionist
10. ✅ Notification created on customer home
11. ✅ Start instant video calling and chat interface
12. ✅ Complete consulting
13. ✅ Update prescription by vendor
14. ✅ Chat open till next followup date

## Issue Identified

**Problem:** Payment step is missing in the instant tele consultation flow. Users join the queue without payment, and payment should happen BEFORE joining the queue.

**Current Code Flow:**
- `TeleConsultationRouter.tsx`: instant-service → instant-pet → instant-queue
- `InstantTeleQueue.tsx`: Joins queue directly without payment
- Payment only exists in scheduled booking flow

## Solution Required

Add payment step between pet selection and queue joining:

1. **instant-pet** → **instant-payment** → **instant-queue**

## Implementation Plan

1. Add `instant-payment` step to `TeleConsultationRouter`
2. Create payment component for instant tele consultation
3. After payment success, then join queue
4. Pass payment information to queue join request
5. Create booking with payment reference after queue acceptance

## Files to Modify

1. `apps/customer-web/components/customer/vet/TeleConsultationRouter.tsx`
   - Add `instant-payment` to FlowStep type
   - Add payment step handler
   - Integrate UniversalPaymentPage

2. `apps/customer-web/components/customer/InstantTeleQueue.tsx`
   - Accept payment information in props
   - Pass payment reference when joining queue

3. Backend: `backend/lambda/src/endpoints/instant-tele-queue.ts`
   - Accept payment reference in join-queue
   - Create booking with payment after acceptance
