# Complete Plan Feature - Implementation Plan

## Overview
The "Complete Plan" feature in Support/CRM allows support agents to generate comprehensive pet care plans for customers. This document outlines the implementation strategy.

## Current State Analysis

### ✅ What Exists:
1. **Support CRM UI** (`apps/admin-web/app/support/page.tsx`)
   - Ticket management system
   - Agent assignment
   - Refund processing
   - Customer communication

2. **Marketing Dashboard UI Config** (`apps/admin-web/app/marketing/page.tsx`)
   - Dashboard button configuration per role
   - UI for enabling/disabling buttons
   - Launch phase and rollout percentage controls
   - **"Complete Plan" button already included in defaults** ✅

3. **Backend UI Dashboard Config Endpoint** (`backend/lambda/src/endpoints/ui-dashboard-config.ts`) ✅ NEW
   - GET `/config/ui/dashboard?roleId=xxx` - Get dashboard buttons
   - PUT `/config/ui/dashboard` - Update dashboard buttons
   - Includes "Complete Plan" button in default buttons

4. **AI Chatbot** (`backend/lambda/src/endpoints/ai-chatbot.ts`)
   - AWS Bedrock integration
   - Intent classification
   - Context-aware responses
   - Agent handoff capability

5. **Nutrition Plans** (`apps/vendor-web/app/nutrition/plans/page.tsx`)
   - Meal plan management (vendor-side)
   - Plan creation/editing

### ❌ What's Still Missing:
1. **Plan Generation Backend Endpoint** - Generate care plans using AI
2. **Plan Storage Database Tables** - Store generated plans
3. **Support/CRM Integration** - Link Complete Plan button to plan generation
4. **Plan Templates** - Reusable plan structures
5. **Customer-Facing Plan View** - Display plans to customers

---

## Implementation Plan

### Phase 1: Database Schema & Backend Foundation

#### 1.1 Database Tables
```sql
-- Pet Care Plans Table
CREATE TABLE pet_care_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  pet_id UUID REFERENCES pets(id),
  ticket_id UUID REFERENCES support_tickets(id), -- Link to support ticket
  plan_type VARCHAR(50) NOT NULL, -- 'wellness', 'treatment', 'nutrition', 'training'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration_days INTEGER,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'completed', 'cancelled'
  created_by UUID, -- Support agent ID
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  ai_generated BOOLEAN DEFAULT false,
  plan_data JSONB -- Stores structured plan details
);

-- Plan Items/Steps
CREATE TABLE care_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES pet_care_plans(id) ON DELETE CASCADE,
  item_type VARCHAR(50), -- 'medication', 'exercise', 'diet', 'checkup', 'training'
  title VARCHAR(255),
  description TEXT,
  scheduled_date DATE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  notes TEXT,
  order_index INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Plan Templates (for reusable plans)
CREATE TABLE care_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  plan_type VARCHAR(50),
  pet_type VARCHAR(50), -- 'dog', 'cat', etc.
  condition VARCHAR(255), -- 'post-surgery', 'weight-loss', 'puppy-care'
  template_data JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 1.2 Backend Endpoints (`backend/lambda/src/endpoints/care-plans.ts`)

```typescript
// POST /crm/plans/generate
// Generate a care plan using AI or templates
{
  ticketId: string;
  customerId: string;
  petId: string;
  planType: 'wellness' | 'treatment' | 'nutrition' | 'training';
  useAI?: boolean; // Use AI generation vs template
  context?: string; // Additional context from ticket
}

// GET /crm/plans/:planId
// Get plan details

// PUT /crm/plans/:planId
// Update plan

// POST /crm/plans/:planId/items/:itemId/complete
// Mark plan item as complete

// GET /crm/plans/templates
// Get available plan templates

// POST /crm/plans/templates
// Create new template
```

#### 1.3 AI Plan Generation Logic

**Integration with AWS Bedrock:**
- Use existing `invokeBedrock` utility
- Create specialized prompt for care plan generation
- Input: Pet info, customer context, ticket details, plan type
- Output: Structured JSON plan with items, schedule, recommendations

**Prompt Template:**
```
You are a veterinary care plan assistant. Generate a comprehensive {planType} care plan for:
- Pet: {petName}, {breed}, {age} years old
- Condition/Context: {ticketDescription}
- Customer needs: {customerContext}

Generate a structured plan with:
1. Overview and goals
2. Daily/weekly schedule
3. Specific care items (medications, exercises, diet, checkups)
4. Duration and milestones
5. Important notes and warnings

Return as JSON matching this schema: {schema}
```

---

### Phase 2: Frontend UI Components

#### 2.1 Complete Plan Button in Ticket Detail View

**Location:** `apps/admin-web/app/support/page.tsx`

Add button in ticket action area (around line 650):
```tsx
<Button
  variant="outline"
  className="text-purple-600 border-purple-200 hover:bg-purple-50"
  onClick={() => setShowPlanModal(true)}
>
  <FileCheck className="w-4 h-4 mr-2" />
  Complete Plan
</Button>
```

#### 2.2 Plan Generation Modal Component

**New File:** `apps/admin-web/components/admin/support/CompletePlanModal.tsx`

Features:
- Select plan type (wellness, treatment, nutrition, training)
- Choose pet (if customer has multiple)
- Option: Use AI generation vs template
- Preview generated plan
- Edit before saving
- Save and send to customer

#### 2.3 Plan View Component

**New File:** `apps/admin-web/components/admin/support/CarePlanView.tsx`

Features:
- Display plan details
- Show plan items/timeline
- Mark items as complete
- Add notes
- Send updates to customer

#### 2.4 Plan Templates Management

**New File:** `apps/admin-web/components/admin/support/PlanTemplatesManager.tsx`

Features:
- View/create/edit templates
- Template categories
- Reusable plan structures

---

### Phase 3: Integration & Workflow

#### 3.1 Support Ticket → Plan Flow

1. **Agent opens ticket** → Sees "Complete Plan" button
2. **Clicks button** → Modal opens with:
   - Customer/pet info pre-filled
   - Ticket context included
   - Plan type selector
3. **Selects plan type** → Options:
   - **AI Generate**: Uses Bedrock to create custom plan
   - **Use Template**: Selects from pre-made templates
   - **Manual**: Agent creates plan manually
4. **Review & Edit** → Agent can modify generated plan
5. **Save Plan** → Plan saved, linked to ticket
6. **Send to Customer** → Plan shared via notification/email

#### 3.2 Plan Execution Tracking

- Customer receives plan via app/email
- Plan items tracked in system
- Reminders sent for scheduled items
- Progress visible to support agent
- Customer can mark items complete
- Agent can update plan as needed

---

### Phase 4: AI Enhancement

#### 4.1 Context-Aware Plan Generation

**Input Context:**
- Pet medical history (from `medical_records` table)
- Previous bookings/services
- Current health status
- Customer preferences
- Ticket conversation history

**AI Model Selection:**
- Use Claude Sonnet 3.5 or similar for structured output
- Temperature: 0.3 (more deterministic)
- Max tokens: 2048
- Response format: JSON schema validation

#### 4.2 Plan Personalization

- Adapt to pet breed/size
- Consider customer lifestyle (from questionnaire)
- Factor in previous care history
- Adjust for seasonal needs
- Include vendor recommendations

---

### Phase 5: Customer-Facing Features

#### 5.1 Customer App Integration

**Mobile App:** `apps/WarmpawzCustomer/src/screens/care/CarePlanScreen.tsx`

Features:
- View assigned care plans
- See plan timeline/schedule
- Mark items as complete
- Add notes/photos
- Request plan updates
- Contact support

#### 5.2 Web App Integration

**Customer Web:** `apps/customer-web/components/customer/CarePlanView.tsx`

Same features as mobile, optimized for web.

---

## Technical Implementation Details

### Backend Structure

```
backend/lambda/src/endpoints/
├── care-plans.ts (NEW)
│   ├── generatePlan() - AI/template generation
│   ├── getPlan() - Fetch plan details
│   ├── updatePlan() - Modify plan
│   ├── completeItem() - Mark item done
│   └── getTemplates() - List templates
```

### Frontend Structure

```
apps/admin-web/
├── components/admin/support/
│   ├── CompletePlanModal.tsx (NEW)
│   ├── CarePlanView.tsx (NEW)
│   ├── PlanTemplatesManager.tsx (NEW)
│   └── PlanItemCard.tsx (NEW)
```

### Database Migrations

```
db/migrations/
└── XXX_create_care_plans_tables.sql (NEW)
```

---

## API Contracts

### Generate Plan Request
```typescript
interface GeneratePlanRequest {
  ticketId: string;
  customerId: string;
  petId: string;
  planType: 'wellness' | 'treatment' | 'nutrition' | 'training';
  generationMethod: 'ai' | 'template' | 'manual';
  templateId?: string; // If using template
  context?: string; // Additional notes
}
```

### Plan Response
```typescript
interface CarePlan {
  id: string;
  customerId: string;
  petId: string;
  ticketId: string;
  planType: string;
  title: string;
  description: string;
  durationDays: number;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  items: PlanItem[];
  createdAt: string;
  aiGenerated: boolean;
}

interface PlanItem {
  id: string;
  type: 'medication' | 'exercise' | 'diet' | 'checkup' | 'training';
  title: string;
  description: string;
  scheduledDate?: string;
  completed: boolean;
  notes?: string;
  orderIndex: number;
}
```

---

## Testing Strategy

### Unit Tests
- Plan generation logic
- AI prompt construction
- Template matching
- Plan validation

### Integration Tests
- End-to-end plan creation flow
- AI generation with mock Bedrock
- Database operations
- API endpoints

### E2E Tests
- Support agent creates plan
- Customer views plan
- Item completion tracking
- Plan updates

---

## Deployment Checklist

- [ ] Database migrations applied
- [ ] Backend endpoints deployed
- [ ] Frontend components added
- [ ] AI Bedrock integration tested
- [ ] Plan templates seeded
- [ ] Customer app updated
- [ ] Notifications configured
- [ ] Documentation updated

---

## Future Enhancements

1. **Plan Analytics**
   - Track plan completion rates
   - Measure customer satisfaction
   - Identify effective plan patterns

2. **Automated Reminders**
   - SMS/Email for scheduled items
   - Push notifications
   - Escalation for missed items

3. **Vendor Integration**
   - Link plans to vendor services
   - Auto-book appointments
   - Track service completion

4. **Plan Marketplace**
   - Community-contributed templates
   - Veterinarian-verified plans
   - Popular plan recommendations

---

## Estimated Timeline

- **Phase 1** (Backend): 1-2 weeks
- **Phase 2** (Frontend UI): 1-2 weeks
- **Phase 3** (Integration): 1 week
- **Phase 4** (AI Enhancement): 1-2 weeks
- **Phase 5** (Customer Features): 1-2 weeks

**Total: 5-9 weeks** (depending on team size and complexity)

---

## Next Steps

1. **Confirm Requirements**: Verify with stakeholders what "Complete Plan" should do
2. **Design Review**: Review UI/UX mockups
3. **Database Migration**: Create migration script
4. **Backend Implementation**: Start with plan generation endpoint
5. **Frontend Integration**: Add UI components to Support/CRM
6. **Testing**: Comprehensive testing before release
7. **Documentation**: Update user guides and API docs

---

## Questions to Resolve

1. Where exactly is the "Complete Plan" UI visible? (screenshot would help)
2. What should happen when agent clicks it?
3. Should plans be automatically sent to customers or require approval?
4. What plan types are needed initially?
5. Should AI generation be default or optional?
6. Do we need plan templates immediately or can we start with AI-only?
