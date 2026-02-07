# 📚 Figma Customer App Integration Master Index
## Complete Documentation & Prompt System (Customer App Only)

**Date:** January 2026  
**Status:** Ready for Use  
**Focus:** Customer App Only - No Vendor Screens  
**Purpose:** Central index for all customer app Figma UI integration documentation

---

## 🎯 QUICK START GUIDE

### For Figma Designers:
1. Read: **Vet Service Dashboard prompt** (design dashboard)
2. Read: **Vet Booking Flows prompt** (design clinic/tele/home flows)
3. Read: **Universal Booking Flows prompt** (design at_center/at_home/tele flows)
4. Save designs to: `/Users/ketan/Documents/Figma UI Customer APP/`
5. Export code with API annotations

### For Developers (Cursor):
1. Receive Figma UI code
2. Read: **Cursor Integration Prompt** (integrate code)
3. Follow: **Navigation Documentation** (wire up navigation)
4. Apply: **Final Polishing** (enhance and optimize)

---

## 📁 DOCUMENT STRUCTURE

### 1. Figma Design Prompts (For Figma AI/Designers)

#### Vet Service Dashboard
**File:** `FIGMA_CUSTOMER_APP_VET_SERVICE_DASHBOARD.md`

**Screen:**
- Vet Service Dashboard (main landing page for vet services)

**Save Location:** `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/Vet Service Dashboard.fig`

---

#### Vet Booking Flows
**File:** `FIGMA_CUSTOMER_APP_VET_BOOKING_FLOWS.md`

**Screens:**
- Clinic Visit: Clinic List → Clinic Profile → Doctor Details → Booking Flow
- Tele Consultation: Mode Selection → (Instant/Scheduled flows)
- Home Visit: Provider Discovery → Provider Profile → Booking Flow

**Save Location:** `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/`

---

#### Universal Booking Flows
**File:** `FIGMA_CUSTOMER_APP_UNIVERSAL_BOOKING_FLOWS.md`

**Screens:**
- Service Style Selection (at_center/at_home/tele)
- At Center Booking Flow
- At Home Booking Flow (with address selection)
- Tele Consultation Booking Flow
- Payment Screen (universal)
- Booking Confirmation (universal)

**Save Location:** `/Users/ketan/Documents/Figma UI Customer APP/Universal Booking Flows/`

---

### 2. Integration Documentation (For Cursor/Developers)

#### Cursor Integration Prompt
**File:** `CURSOR_INTEGRATION_CUSTOMER_APP_ONLY.md`

**Purpose:** Guide Cursor AI to integrate Figma-generated customer app UI code

**Key Sections:**
- Integration workflow (customer app only)
- API integration patterns
- Navigation integration patterns
- Common issues and solutions
- File location rules

**Use When:** You receive UI code from Figma and need to integrate it

---

#### Navigation Documentation
**File:** `NAVIGATION_DOCUMENTATION_CUSTOMER_APP.md`

**Purpose:** Complete navigation structure for customer app

**Key Sections:**
- Vet service flow navigation maps
- Universal booking flow navigation
- Navigation handlers
- Next.js route mapping
- Parameter definitions

**Use When:** Wiring up navigation between screens

---

### 3. Enhancement Documentation

#### Final Polishing & Enhancement
**File:** `FINAL_POLISHING_AND_ENHANCEMENT_PROJECT.md`

**Purpose:** Comprehensive polishing guide after integration

**Key Sections:**
- Design polishing
- Performance optimization
- UX enhancement
- Accessibility
- Testing

**Use When:** After all screens are integrated and need polishing

---

## 🔄 COMPLETE WORKFLOW

### Phase 1: Design (Figma)
1. **Read Prompts:**
   - Vet Dashboard: `FIGMA_CUSTOMER_APP_VET_SERVICE_DASHBOARD.md`
   - Vet Booking: `FIGMA_CUSTOMER_APP_VET_BOOKING_FLOWS.md`
   - Universal Booking: `FIGMA_CUSTOMER_APP_UNIVERSAL_BOOKING_FLOWS.md`

2. **Generate Screens:**
   - Use Figma AI or manual design
   - Follow exact design specifications
   - Include API contract annotations
   - Include navigation handler notes
   - Use exact code from CustomerHomeComplete.tsx as reference

3. **Save Designs:**
   - Location: `/Users/ketan/Documents/Figma UI Customer APP/`
   - Organize by flow folders
   - Name files: `Screen Name.fig`

4. **Export Code:**
   - Export as React/TypeScript components
   - Include API annotations in comments
   - Include navigation notes

---

### Phase 2: Integration (Cursor)
1. **Receive Figma Code:**
   - Get React/TypeScript component code
   - Review API contract annotations
   - Review navigation handler notes

2. **Read Integration Guide:**
   - `CURSOR_INTEGRATION_CUSTOMER_APP_ONLY.md`
   - Follow step-by-step integration process
   - Replace placeholder API calls
   - Wire up navigation handlers

3. **Reference Navigation:**
   - `NAVIGATION_DOCUMENTATION_CUSTOMER_APP.md`
   - Use correct navigation handlers
   - Map to Next.js routes

4. **Test Integration:**
   - Verify API calls work
   - Verify navigation works
   - Verify design matches
   - Test error states
   - Test loading states

---

### Phase 3: Enhancement (Cursor)
1. **Apply Polishing:**
   - `FINAL_POLISHING_AND_ENHANCEMENT_PROJECT.md`
   - Design consistency audit
   - Performance optimization
   - UX enhancement
   - Accessibility improvements

2. **Testing:**
   - Component testing
   - Integration testing
   - E2E testing
   - Cross-browser testing

3. **Deployment:**
   - Final checklist
   - Performance metrics
   - Error monitoring
   - Analytics setup

---

## 📋 DESIGN SYSTEM REFERENCE

### Exact Values (DO NOT DEVIATE)

**Colors:**
- Header Gradient: `#FF8C42` → `#FF7A35` → `#FF6B35` (bg-gradient-to-br)
- Primary Orange: `#FF8C42`
- Background: `#FFFFFF`
- Text White: `#FFFFFF`
- Text White Secondary: `rgba(255, 255, 255, 0.65)` (65% opacity)

**Typography:**
- Header H1: `text-lg font-bold tracking-tight` (18px)
- Header Subtitle: `text-xs font-normal tracking-wide` (12px)
- Body: `text-base` (16px)

**Icons:**
- Library: Lucide React (2D icons ONLY)
- Size: 18px-24px (header), 16px-20px (content)
- Stroke: 2px
- **NO 3D ICONS, NO CUSTOM ILLUSTRATIONS**

**Spacing:**
- Header Padding: `px-4 pt-4 pb-4`
- Content Padding: `px-4` or `px-6`
- Footer Space: `pb-24`

---

## 🔗 RELATED DOCUMENTS

### Design System
- `CUSTOMER_WEB_DESIGN_STRATEGY.md` - Design philosophy
- `CUSTOMER_WEB_DESIGN_IMPLEMENTATION_GUIDE.md` - Implementation guide

### API Documentation
- `packages/api-contracts/src/` - API contract definitions
- `docs/API_ENDPOINTS.md` - Complete API endpoint list

### Gap Analysis
- `COMPREHENSIVE_SYSTEM_AUDIT_AND_GAP_ANALYSIS.md` - Complete flow analysis

---

## ✅ CHECKLIST FOR EACH SCREEN

### Design Phase (Figma):
- [ ] Header matches CustomerHomeComplete.tsx exactly
- [ ] Content area: `bg-white rounded-t-[24px] -mt-3 pt-4 pb-24`
- [ ] Footer: StandardizedFooter component
- [ ] Icons: Lucide React 2D only (no 3D, no custom)
- [ ] Colors: Exact hex values
- [ ] Typography: Exact sizes/weights
- [ ] Spacing: Exact padding/gaps
- [ ] API contracts: Annotated in comments
- [ ] Navigation: Handlers defined
- [ ] Loading states: Designed
- [ ] Error states: Designed
- [ ] Success states: Designed

### Integration Phase (Cursor):
- [ ] Component file created in correct location
- [ ] API calls replaced with `apiClient`
- [ ] Navigation wired up
- [ ] Imports fixed (StandardizedHeader, StandardizedFooter)
- [ ] Error handling added
- [ ] Loading states implemented
- [ ] Design matches exactly
- [ ] No breaking changes
- [ ] Tests passing

---

## 🚨 CRITICAL REMINDERS

### DO NOT:
- ❌ Use 3D icons (only 2D Lucide React)
- ❌ Deviate from color values
- ❌ Change header/footer structure
- ❌ Break existing API integrations
- ❌ Modify existing navigation patterns
- ❌ Skip API contract annotations
- ❌ Skip navigation handler definitions
- ❌ Include vendor screens (customer app only)

### DO:
- ✅ Match customer home design exactly
- ✅ Use exact color hex values
- ✅ Use Lucide React icons only
- ✅ Include API annotations
- ✅ Define navigation handlers
- ✅ Test before integration
- ✅ Follow file location rules
- ✅ Maintain code quality
- ✅ Use StandardizedHeader and StandardizedFooter

---

## 📊 PROGRESS TRACKING

### Design Phase:
- [ ] Vet Service Dashboard designed
- [ ] Vet Clinic Visit flow designed
- [ ] Vet Tele Consultation flow designed
- [ ] Vet Home Visit flow designed
- [ ] Universal Booking flows designed
- [ ] All screens exported with code

### Integration Phase:
- [ ] Vet Dashboard integrated
- [ ] Vet Clinic flow integrated
- [ ] Vet Tele flow integrated
- [ ] Vet Home flow integrated
- [ ] Universal Booking flows integrated
- [ ] All navigation wired up
- [ ] All API calls working

### Enhancement Phase:
- [ ] Design polishing complete
- [ ] Performance optimized
- [ ] UX enhanced
- [ ] Accessibility improved
- [ ] Testing complete
- [ ] Documentation updated

---

**Last Updated:** January 2026  
**Version:** 1.0.0  
**Status:** Ready for Use  
**Focus:** Customer App Only

---

**End of Master Index (Customer App Only)**
