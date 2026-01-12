/**
 * LOYALTY SYSTEM HELPER FUNCTIONS
 * Utilities for awarding points and showing notifications
 */

import { toast } from 'sonner@2.0.3';

const API_BASE = typeof window !== 'undefined' 
  ? `https://${(window as any).SUPABASE_PROJECT_ID || 'placeholder'}.supabase.co/functions/v1/make-server-3dd53475`
  : '';

const API_KEY = typeof window !== 'undefined'
  ? (window as any).SUPABASE_ANON_KEY || ''
  : '';

/**
 * Award loyalty points for a customer action
 * Shows toast notification on success
 */
export async function awardLoyaltyPoints({
  userId,
  userType = 'customer',
  actionKey,
  amount,
  metadata = {},
  showToast = true
}: {
  userId: string;
  userType?: 'customer' | 'vendor';
  actionKey: string;
  amount?: number;
  metadata?: Record<string, any>;
  showToast?: boolean;
}): Promise<{ success: boolean; points?: number; error?: string }> {
  try {
    console.log(`🎁 [LOYALTY] Awarding points for ${actionKey} to ${userId}`);

    const response = await fetch(`${API_BASE}/loyalty/process-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        userId,
        userType,
        actionKey,
        amount,
        metadata
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ [LOYALTY] Failed to award points:', errorData);
      return { success: false, error: errorData.error };
    }

    const data = await response.json();
    console.log('✅ [LOYALTY] Points awarded:', data);

    // Show success toast
    if (showToast && data.pointsAwarded > 0) {
      toast.success(
        `🎉 You earned ${data.pointsAwarded} Pawints!`,
        {
          description: getPointsDescription(actionKey, data.pointsAwarded),
          duration: 4000
        }
      );
    }

    return { 
      success: true, 
      points: data.pointsAwarded 
    };
  } catch (error: any) {
    console.error('❌ [LOYALTY] Exception:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user-friendly description for points earned
 */
function getPointsDescription(actionKey: string, points: number): string {
  const descriptions: Record<string, string> = {
    'signup': 'Welcome bonus!',
    'complete_profile': 'Profile completion bonus!',
    'update_health_record': 'Health record updated!',
    'spend_medicine': 'Medicine purchase reward!',
    'refer_friend': 'Friend referral bonus!',
    'buy_insurance': 'Insurance purchase reward!',
    'renew_insurance': 'Insurance renewal reward!',
    'spend_grooming': 'Grooming service reward!',
    'spend_vet': 'Vet consultation reward!',
    'spend_food': 'Food purchase reward!',
    'post_review': 'Thank you for your review!',
    'birthday_booking': 'Birthday special bonus!',
  };

  return descriptions[actionKey] || `Earned ${points} Pawints!`;
}

/**
 * Award points for booking completion
 * Automatically selects the right action key based on service type
 */
export async function awardBookingCompletionPoints({
  userId,
  bookingAmount,
  serviceType,
  bookingId,
  showToast = true
}: {
  userId: string;
  bookingAmount: number;
  serviceType: string;
  bookingId: string;
  showToast?: boolean;
}): Promise<{ success: boolean; points?: number }> {
  // Map service types to action keys
  const serviceToActionKey: Record<string, string> = {
    'grooming': 'spend_grooming',
    'vet': 'spend_vet',
    'veterinary': 'spend_vet',
    'walking': 'spend_vet', // Use vet rate for other services
    'boarding': 'spend_vet',
    'training': 'spend_vet',
  };

  const actionKey = serviceToActionKey[serviceType.toLowerCase()] || 'spend_vet';

  return awardLoyaltyPoints({
    userId,
    userType: 'customer',
    actionKey,
    amount: bookingAmount,
    metadata: { bookingId, serviceType },
    showToast
  });
}

/**
 * Award points for medicine purchase
 */
export async function awardMedicinePurchasePoints({
  userId,
  orderAmount,
  orderId,
  showToast = true
}: {
  userId: string;
  orderAmount: number;
  orderId: string;
  showToast?: boolean;
}): Promise<{ success: boolean; points?: number }> {
  return awardLoyaltyPoints({
    userId,
    userType: 'customer',
    actionKey: 'spend_medicine',
    amount: orderAmount,
    metadata: { orderId },
    showToast
  });
}

/**
 * Award points for insurance purchase
 */
export async function awardInsurancePurchasePoints({
  userId,
  premiumAmount,
  policyId,
  isRenewal = false,
  showToast = true
}: {
  userId: string;
  premiumAmount: number;
  policyId: string;
  isRenewal?: boolean;
  showToast?: boolean;
}): Promise<{ success: boolean; points?: number }> {
  return awardLoyaltyPoints({
    userId,
    userType: 'customer',
    actionKey: isRenewal ? 'renew_insurance' : 'buy_insurance',
    amount: premiumAmount,
    metadata: { policyId, isRenewal },
    showToast
  });
}

/**
 * Award points for posting a review
 */
export async function awardReviewPoints({
  userId,
  reviewId,
  bookingId,
  showToast = true
}: {
  userId: string;
  reviewId: string;
  bookingId?: string;
  showToast?: boolean;
}): Promise<{ success: boolean; points?: number }> {
  return awardLoyaltyPoints({
    userId,
    userType: 'customer',
    actionKey: 'post_review',
    metadata: { reviewId, bookingId },
    showToast
  });
}

/**
 * Award points for profile completion
 */
export async function awardProfileCompletionPoints({
  userId,
  showToast = true
}: {
  userId: string;
  showToast?: boolean;
}): Promise<{ success: boolean; points?: number }> {
  return awardLoyaltyPoints({
    userId,
    userType: 'customer',
    actionKey: 'complete_profile',
    showToast
  });
}

/**
 * Award points for food purchase
 */
export async function awardFoodPurchasePoints({
  userId,
  orderAmount,
  orderId,
  showToast = true
}: {
  userId: string;
  orderAmount: number;
  orderId: string;
  showToast?: boolean;
}): Promise<{ success: boolean; points?: number }> {
  return awardLoyaltyPoints({
    userId,
    userType: 'customer',
    actionKey: 'spend_food',
    amount: orderAmount,
    metadata: { orderId },
    showToast
  });
}

/**
 * Check if user can earn points for an action
 * (Check frequency limits, etc.)
 */
export async function canEarnPoints({
  userId,
  userType = 'customer',
  actionKey
}: {
  userId: string;
  userType?: 'customer' | 'vendor';
  actionKey: string;
}): Promise<boolean> {
  try {
    // For now, optimistically assume they can earn
    // The backend will validate frequency limits
    return true;
  } catch {
    return false;
  }
}

export default {
  awardLoyaltyPoints,
  awardBookingCompletionPoints,
  awardMedicinePurchasePoints,
  awardInsurancePurchasePoints,
  awardReviewPoints,
  awardProfileCompletionPoints,
  awardFoodPurchasePoints,
  canEarnPoints
};
