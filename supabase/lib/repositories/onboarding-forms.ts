/**
 * ============================================================================
 * ONBOARDING FORMS REPOSITORY
 * ============================================================================
 * 
 * Repository for onboarding form data access.
 * Replaces: onboarding:form:* KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";

export interface OnboardingForm {
  id: string;
  role_id: string;
  role_name: string;
  version: number;
  status: 'draft' | 'active' | 'archived';
  form_data: any; // JSONB field containing sections, documentSections, metadata, notes
  created_at: string;
  updated_at: string;
}

export interface CreateOnboardingFormInput {
  id?: string;
  role_id: string;
  role_name: string;
  version: number;
  status: 'draft' | 'active' | 'archived';
  form_data: any;
}

export class OnboardingFormsRepository {
  private client = getDbClient();

  /**
   * Find active form by role ID
   */
  async findActiveByRoleId(roleId: string): Promise<OnboardingForm | null> {
    const result = await selectQuery<OnboardingForm>(
      "onboarding_forms",
      { role_id: roleId, status: 'active' },
      { orderBy: "version", orderDirection: "desc", limit: 1 }
    );
    return result[0] || null;
  }

  /**
   * Find form by ID
   */
  async findById(formId: string): Promise<OnboardingForm | null> {
    const result = await selectQuery<OnboardingForm>(
      "onboarding_forms",
      { id: formId },
      { limit: 1 }
    );
    return result[0] || null;
  }

  /**
   * Find all forms (with optional filters)
   */
  async findAll(filters?: { roleId?: string; status?: string }): Promise<OnboardingForm[]> {
    const conditions: any = {};
    if (filters?.roleId) {
      conditions.role_id = filters.roleId;
    }
    if (filters?.status) {
      conditions.status = filters.status;
    }
    
    return await selectQuery<OnboardingForm>(
      "onboarding_forms",
      conditions,
      { orderBy: "updated_at", orderDirection: "desc" }
    );
  }

  /**
   * Find all versions for a role
   */
  async findVersionsByRoleId(roleId: string): Promise<OnboardingForm[]> {
    return await selectQuery<OnboardingForm>(
      "onboarding_forms",
      { role_id: roleId },
      { orderBy: "version", orderDirection: "desc" }
    );
  }

  /**
   * Create or update form
   */
  async upsert(input: CreateOnboardingFormInput): Promise<OnboardingForm> {
    // If status is active, archive previous active forms for this role
    if (input.status === 'active') {
      const existingActive = await this.findActiveByRoleId(input.role_id);
      if (existingActive && existingActive.id !== input.id) {
        await updateQuery<OnboardingForm>(
          "onboarding_forms",
          { role_id: input.role_id, status: 'active' },
          { status: 'draft', updated_at: new Date().toISOString() }
        );
      }
    }

    // Check if form exists
    const existing = input.id ? await this.findById(input.id) : null;
    
    if (existing) {
      // Update existing form
      const result = await updateQuery<OnboardingForm>(
        "onboarding_forms",
        { id: input.id! },
        {
          role_name: input.role_name,
          version: input.version,
          status: input.status,
          form_data: input.form_data,
          updated_at: new Date().toISOString()
        }
      );
      return result[0];
    } else {
      // Create new form
      const formId = input.id || `form_${input.role_id}_${Date.now()}`;
      const result = await insertQuery<OnboardingForm>(
        "onboarding_forms",
        {
          id: formId,
          role_id: input.role_id,
          role_name: input.role_name,
          version: input.version,
          status: input.status,
          form_data: input.form_data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      );
      return result[0];
    }
  }

  /**
   * Archive a form
   */
  async archive(roleId: string): Promise<OnboardingForm> {
    const activeForm = await this.findActiveByRoleId(roleId);
    if (!activeForm) {
      throw new Error(`No active form found for role: ${roleId}`);
    }

    const result = await updateQuery<OnboardingForm>(
      "onboarding_forms",
      { id: activeForm.id },
      {
        status: 'archived',
        updated_at: new Date().toISOString()
      }
    );
    return result[0];
  }
}

let repositoryInstance: OnboardingFormsRepository | null = null;

export function getOnboardingFormsRepository(): OnboardingFormsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new OnboardingFormsRepository();
  }
  return repositoryInstance;
}

