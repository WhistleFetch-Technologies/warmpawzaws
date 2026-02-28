/**
 * ============================================================================
 * CUSTOMER STATE MANAGEMENT UTILITIES
 * ============================================================================
 * 
 * Helper functions for managing customer state and onboarding status
 * 
 * Date: 2025-01-12
 * ============================================================================
 */

import { query, select, insert, update } from '../database/rds-connection';

export interface CustomerState {
  status: 'new' | 'onboarding' | 'active' | 'inactive' | 'suspended';
  onboarding_status: 'INIT' | 'PHONE_VERIFIED' | 'PROFILE_PENDING' | 'PET_PENDING' | 'PREFERENCES_PENDING' | 'COMPLETED';
  profile_completed: boolean;
  current_step?: string;
}

/**
 * Get customer state
 */
export async function getCustomerState(customerId: string): Promise<CustomerState | null> {
  try {
    const customers = await select('customers', { id: customerId });
    if (customers.length === 0) {
      return null;
    }

    const customer = customers[0];
    
    // Get identity if exists
    let identity = null;
    if (customer.customer_identity_id) {
      const identities = await select('customer_identity', { id: customer.customer_identity_id });
      identity = identities[0] || null;
    }

    return {
      status: customer.status || 'new',
      onboarding_status: customer.onboarding_status || identity?.onboarding_status || 'INIT',
      profile_completed: customer.profile_completed || false,
      current_step: identity?.current_step || null,
    };
  } catch (error: any) {
    console.error('Error getting customer state:', error);
    return null;
  }
}

/**
 * Create or update customer identity
 */
export async function createOrUpdateCustomerIdentity(
  phone: string,
  customerId?: string,
  email?: string
): Promise<string> {
  try {
    // Check if identity exists
    const existing = await select('customer_identity', { phone });
    
    if (existing.length > 0) {
      const identity = existing[0];
      
      // Update if customer_id is missing
      if (!identity.customer_id && customerId) {
        await update('customer_identity', { id: identity.id }, {
          customer_id: customerId,
          updated_at: new Date().toISOString(),
        });
      }
      
      return identity.id;
    }

    // Create new identity
    const onboardingStatus = customerId ? 'PHONE_VERIFIED' : 'INIT';
    const newIdentities = await insert('customer_identity', {
      phone,
      email,
      customer_id: customerId || null,
      onboarding_status: onboardingStatus,
      current_step: customerId ? 'profile' : null,
    });

    return newIdentities[0].id;
  } catch (error: any) {
    console.error('Error creating customer identity:', error);
    throw error;
  }
}

/**
 * Update customer onboarding status
 */
export async function updateCustomerOnboardingStatus(
  customerId: string,
  newStatus: CustomerState['onboarding_status'],
  currentStep?: string
): Promise<void> {
  try {
    // Update customer table
    await update('customers', { id: customerId }, {
      onboarding_status: newStatus,
      updated_at: new Date().toISOString(),
    });

    // Update identity if exists
    const customers = await select('customers', { id: customerId });
    const customer = customers[0];
    
    if (customer.customer_identity_id) {
      const updateData: any = {
        onboarding_status: newStatus,
        updated_at: new Date().toISOString(),
      };
      
      if (currentStep) {
        updateData.current_step = currentStep;
      }
      
      await update('customer_identity', { id: customer.customer_identity_id }, updateData);
    }

    console.log(`[Customer State] Updated onboarding_status to ${newStatus} for customer ${customerId}`);
  } catch (error: any) {
    console.error('Error updating customer onboarding status:', error);
    throw error;
  }
}

/**
 * Check if customer is new (not completed onboarding)
 */
export async function isNewCustomer(customerId: string): Promise<boolean> {
  const state = await getCustomerState(customerId);
  if (!state) return true;
  
  return state.onboarding_status === 'INIT' || 
         state.onboarding_status === 'PHONE_VERIFIED' ||
         state.status === 'new';
}

/**
 * Check if customer onboarding is complete
 */
export async function isOnboardingComplete(customerId: string): Promise<boolean> {
  const state = await getCustomerState(customerId);
  if (!state) return false;
  
  return state.onboarding_status === 'COMPLETED';
}

/**
 * Update profile completion status
 */
export async function updateProfileCompletion(
  customerId: string,
  completionData: {
    basic_info?: boolean;
    address?: boolean;
    pet_profile?: boolean;
    preferences?: boolean;
  }
): Promise<void> {
  try {
    // Get or create completion record
    let completion = await select('customer_profile_completion', { customer_id: customerId });
    
    if (completion.length === 0) {
      completion = await insert('customer_profile_completion', {
        customer_id: customerId,
        basic_info_completed: false,
        address_completed: false,
        pet_profile_completed: false,
        preferences_completed: false,
        is_profile_complete: false,
      });
    }

    const record = completion[0];
    const now = new Date().toISOString();
    const updateData: any = { updated_at: now };

    // Update flags
    if (completionData.basic_info !== undefined) {
      updateData.basic_info_completed = completionData.basic_info;
      if (completionData.basic_info) {
        updateData.basic_info_completed_at = now;
      }
    }

    if (completionData.address !== undefined) {
      updateData.address_completed = completionData.address;
      if (completionData.address) {
        updateData.address_completed_at = now;
      }
    }

    if (completionData.pet_profile !== undefined) {
      updateData.pet_profile_completed = completionData.pet_profile;
      if (completionData.pet_profile) {
        updateData.pet_profile_completed_at = now;
      }
    }

    if (completionData.preferences !== undefined) {
      updateData.preferences_completed = completionData.preferences;
      if (completionData.preferences) {
        updateData.preferences_completed_at = now;
      }
    }

    // Check if all are complete
    const allComplete = 
      (updateData.basic_info_completed ?? record.basic_info_completed) &&
      (updateData.address_completed ?? record.address_completed) &&
      (updateData.pet_profile_completed ?? record.pet_profile_completed) &&
      (updateData.preferences_completed ?? record.preferences_completed);

    if (allComplete && !record.is_profile_complete) {
      updateData.is_profile_complete = true;
      updateData.profile_completed_at = now;
      
      // Update customer table
      await update('customers', { id: customerId }, {
        profile_completed: true,
        profile_completed_at: now,
        onboarding_status: 'COMPLETED',
        status: 'active',
        updated_at: now,
      });
    }

    await update('customer_profile_completion', { customer_id: customerId }, updateData);
    
    console.log(`[Customer State] Updated profile completion for customer ${customerId}`);
  } catch (error: any) {
    console.error('Error updating profile completion:', error);
    throw error;
  }
}

/**
 * Determine customer state for auth response
 */
export async function getCustomerStateForAuth(customerId: string): Promise<'new' | 'existing'> {
  const state = await getCustomerState(customerId);
  if (!state) return 'new';
  
  if (state.onboarding_status === 'COMPLETED' && state.status === 'active') {
    return 'existing';
  }
  
  return 'new';
}
