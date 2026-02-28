/**
 * ============================================================================
 * CARE PLANS ENDPOINTS - AI-POWERED PLAN GENERATION
 * ============================================================================
 * 
 * Handles pet care plan generation and management:
 * - POST /crm/plans/generate - Generate care plan using AI or templates
 * - GET /crm/plans/:planId - Get plan details
 * - PUT /crm/plans/:planId - Update plan
 * - POST /crm/plans/:planId/items/:itemId/complete - Mark item as complete
 * - GET /crm/plans/templates - Get available templates
 * - POST /crm/plans/templates - Create template
 * 
 * Date: 2026-01-28
 * Related: Complete Plan feature in Support/CRM
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import { invokeBedrock } from '../utils/bedrock-client';
import { withRetry } from '../utils/error-recovery';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

interface PlanGenerationRequest {
  ticketId?: string;
  customerId: string;
  petId: string;
  planType: 'wellness' | 'treatment' | 'nutrition' | 'training' | 'general';
  generationMethod: 'ai' | 'template' | 'manual';
  templateId?: string;
  context?: string; // Additional context from ticket
}

interface PlanItem {
  type: 'medication' | 'exercise' | 'diet' | 'checkup' | 'training' | 'grooming' | 'other';
  title: string;
  description: string;
  scheduledDate?: string;
  orderIndex: number;
}

export function registerCarePlansEndpoints(app: Hono) {
  /**
   * POST /crm/plans/generate
   * Generate a care plan using AI, template, or manual creation
   */
  app.post('/crm/plans/generate', async (c) => {
    try {
      const body: PlanGenerationRequest = await c.req.json();
      const { ticketId, customerId, petId, planType, generationMethod, templateId, context } = body;

      // Validation
      if (!customerId || !petId || !planType) {
        return c.json({ 
          success: false,
          error: 'customerId, petId, and planType are required' 
        }, 400);
      }

      // Fetch customer and pet info
      const customers = await select('customers', { id: customerId });
      if (customers.length === 0) {
        return c.json({ success: false, error: 'Customer not found' }, 404);
      }

      const pets = await select('pets', { id: petId });
      if (pets.length === 0) {
        return c.json({ success: false, error: 'Pet not found' }, 404);
      }

      const customer = customers[0];
      const pet = pets[0];

      let planData: any = {};
      let planItems: PlanItem[] = [];
      let aiGenerated = false;

      // Generate plan based on method
      if (generationMethod === 'ai') {
        // AI Generation using Bedrock
        aiGenerated = true;
        const generatedPlan = await generateAIPlan({
          customer,
          pet,
          planType,
          context: context || '',
          ticketId,
        });
        
        planData = generatedPlan.planData;
        planItems = generatedPlan.items;
      } else if (generationMethod === 'template' && templateId) {
        // Use template
        const templates = await select('care_plan_templates', { id: templateId });
        if (templates.length === 0) {
          return c.json({ success: false, error: 'Template not found' }, 404);
        }

        const template = templates[0];
        planData = template.template_data || {};
        planItems = planData.items || [];
      } else {
        // Manual - create empty plan
        planData = {
          planType,
          durationDays: 30,
        };
        planItems = [];
      }

      // Create plan title
      const planTitle = planData.title || `${planType.charAt(0).toUpperCase() + planType.slice(1)} Plan for ${pet.name || 'Pet'}`;
      const planDescription = planData.description || `Comprehensive ${planType} care plan`;

      // Insert plan
      const plan = await insert('pet_care_plans', {
        customer_id: customerId,
        pet_id: petId,
        ticket_id: ticketId || null,
        plan_type: planType,
        title: planTitle,
        description: planDescription,
        duration_days: planData.durationDays || 30,
        status: 'draft',
        ai_generated: aiGenerated,
        plan_data: planData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const planId = plan[0].id;

      // Insert plan items
      const insertedItems = [];
      for (let i = 0; i < planItems.length; i++) {
        const item = planItems[i];
        const scheduledDate = item.scheduledDate 
          ? new Date(item.scheduledDate).toISOString().split('T')[0]
          : null;

        const inserted = await insert('care_plan_items', {
          plan_id: planId,
          item_type: item.type,
          title: item.title,
          description: item.description,
          scheduled_date: scheduledDate,
          order_index: item.orderIndex || i + 1,
          completed: false,
          created_at: new Date().toISOString(),
        });

        insertedItems.push(inserted[0]);
      }

      return c.json({
        success: true,
        plan: {
          ...plan[0],
          items: insertedItems,
        },
        message: 'Care plan generated successfully',
      });
    } catch (error: any) {
      console.error('Error generating care plan:', error);
      return c.json({ 
        success: false,
        error: error.message || 'Failed to generate care plan' 
      }, 500);
    }
  });

  /**
   * GET /crm/plans/templates
   * Get available plan templates
   * NOTE: This route MUST be registered before /crm/plans/:planId to avoid conflict
   */
  app.get('/crm/plans/templates', async (c) => {
    try {
      const planType = c.req.query('planType');
      const petType = c.req.query('petType');

      let filters: any = { is_active: true };
      if (planType) filters.plan_type = planType;
      if (petType) filters.pet_type = petType;

      const templates = await select('care_plan_templates', filters);

      return c.json({
        success: true,
        templates: templates.map(t => ({
          id: t.id,
          name: t.name,
          planType: t.plan_type,
          petType: t.pet_type,
          condition: t.condition,
          description: t.description,
          templateData: t.template_data,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      return c.json({ 
        success: false,
        error: error.message || 'Failed to fetch templates' 
      }, 500);
    }
  });

  /**
   * GET /crm/plans/:planId
   * Get plan details with items
   */
  app.get('/crm/plans/:planId', async (c) => {
    try {
      const planId = c.req.param('planId');
      
      const plans = await select('pet_care_plans', { id: planId });
      if (plans.length === 0) {
        return c.json({ success: false, error: 'Plan not found' }, 404);
      }

      const plan = plans[0];

      // Get plan items
      const items = await query(
        `SELECT * FROM care_plan_items WHERE plan_id = $1 ORDER BY order_index ASC, created_at ASC`,
        [planId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        plan: {
          ...plan,
          items: items.rows || [],
        },
      });
    } catch (error: any) {
      console.error('Error fetching plan:', error);
      return c.json({ 
        success: false,
        error: error.message || 'Failed to fetch plan' 
      }, 500);
    }
  });

  /**
   * PUT /crm/plans/:planId
   * Update plan
   */
  app.put('/crm/plans/:planId', async (c) => {
    try {
      const planId = c.req.param('planId');
      const body = await c.req.json();

      const plans = await select('pet_care_plans', { id: planId });
      if (plans.length === 0) {
        return c.json({ success: false, error: 'Plan not found' }, 404);
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (body.title) updateData.title = body.title;
      if (body.description) updateData.description = body.description;
      if (body.status) updateData.status = body.status;
      if (body.duration_days) updateData.duration_days = body.duration_days;
      if (body.plan_data) updateData.plan_data = body.plan_data;

      await update('pet_care_plans', { id: planId }, updateData);

      const updatedPlans = await select('pet_care_plans', { id: planId });

      return c.json({
        success: true,
        plan: updatedPlans[0],
        message: 'Plan updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating plan:', error);
      return c.json({ 
        success: false,
        error: error.message || 'Failed to update plan' 
      }, 500);
    }
  });

  /**
   * POST /crm/plans/:planId/items/:itemId/complete
   * Mark plan item as complete
   */
  app.post('/crm/plans/:planId/items/:itemId/complete', async (c) => {
    try {
      const { planId, itemId } = c.req.param();
      const body = await c.req.json();

      const items = await select('care_plan_items', { id: itemId, plan_id: planId });
      if (items.length === 0) {
        return c.json({ success: false, error: 'Plan item not found' }, 404);
      }

      await update(
        'care_plan_items',
        { id: itemId },
        {
          completed: true,
          completed_at: new Date().toISOString(),
          notes: body.notes || null,
        }
      );

      const updatedItems = await select('care_plan_items', { id: itemId });

      return c.json({
        success: true,
        item: updatedItems[0],
        message: 'Plan item marked as complete',
      });
    } catch (error: any) {
      console.error('Error completing plan item:', error);
      return c.json({ 
        success: false,
        error: error.message || 'Failed to complete plan item' 
      }, 500);
    }
  });
}

/**
 * Generate AI plan using Bedrock
 */
async function generateAIPlan(params: {
  customer: any;
  pet: any;
  planType: string;
  context: string;
  ticketId?: string;
}): Promise<{ planData: any; items: PlanItem[] }> {
  const { customer, pet, planType, context, ticketId } = params;

  // Build system prompt
  const systemPrompt = `You are a veterinary care plan assistant. Generate a comprehensive ${planType} care plan for a pet.

PET INFORMATION:
- Name: ${pet.name || 'Unknown'}
- Species: ${pet.species || 'Unknown'}
- Breed: ${pet.breed || 'Unknown'}
- Age: ${pet.age_years || 'Unknown'} years
- Gender: ${pet.gender || 'Unknown'}

CUSTOMER INFORMATION:
- Name: ${customer.full_name || customer.first_name || 'Unknown'}
- Phone: ${customer.phone || 'Unknown'}

ADDITIONAL CONTEXT:
${context || 'No additional context provided'}

Generate a structured ${planType} care plan with:
1. A clear title
2. A brief description
3. Duration in days (typically 7-90 days)
4. A list of care items with:
   - Type (medication, exercise, diet, checkup, training, grooming, or other)
   - Title (brief, actionable)
   - Description (detailed instructions)
   - Suggested schedule (when applicable)

Return ONLY valid JSON in this exact format:
{
  "title": "Plan title here",
  "description": "Plan description here",
  "durationDays": 30,
  "items": [
    {
      "type": "medication",
      "title": "Item title",
      "description": "Detailed description",
      "orderIndex": 1
    }
  ]
}`;

  try {
    const completion = await withRetry(
      () => invokeBedrock(
        `Generate a ${planType} care plan for ${pet.name || 'this pet'}. ${context}`,
        systemPrompt,
        {
          maxTokens: 2048,
          temperature: 0.3, // Lower temperature for more structured output
          topP: 0.9,
        }
      ),
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        retryableErrors: ['Bedrock invocation failed', 'ETIMEDOUT', 'ECONNRESET'],
      }
    );

    // Extract JSON from response
    const jsonMatch = completion.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        planData: {
          title: parsed.title,
          description: parsed.description,
          durationDays: parsed.durationDays || 30,
          aiPrompt: systemPrompt,
          aiResponse: completion,
        },
        items: parsed.items || [],
      };
    }

    // Fallback if JSON parsing fails
    throw new Error('Failed to parse AI response as JSON');
  } catch (error: any) {
    console.error('AI plan generation failed:', error);
    
    // Return fallback plan
    return {
      planData: {
        title: `${planType.charAt(0).toUpperCase() + planType.slice(1)} Plan`,
        description: `Generated ${planType} care plan`,
        durationDays: 30,
        aiError: error.message,
      },
      items: [
        {
          type: 'checkup',
          title: 'Schedule consultation',
          description: 'Consult with veterinarian for personalized care plan',
          orderIndex: 1,
        },
      ],
    };
  }
}
