import { randomUUID } from 'crypto';

export function isWithinVideoCallWindow(booking: any): { allowed: boolean; reason?: string } {
    if (booking.status === 'completed') {
        return { allowed: false, reason: 'Video call is not allowed after the appointment is completed.' };
    }
    return { allowed: true };
}

/** Configurable MediaRegion for global users. CHIME_MEDIA_REGION > AWS_REGION > ap-south-1 */
export function getMediaRegion(): string {
    return process.env.CHIME_MEDIA_REGION || process.env.AWS_REGION || 'ap-south-1';
}


export /** Generate correlation ID for structured logging */
    function vidcorId(): string {
    return randomUUID().slice(0, 8);
}

/**
 * Calculate vendor earnings details (commission rate, commission amount, and vendor amount)
 * @param commissionRate - The commission rate as a percentage (e.g., 20 for 20%)
 * @param totalAmount - The total booking amount
 * @returns Object containing commissionRate, commissionAmount, and vendorAmount
 */
export function calculateVendorEarnings(
    commissionRate: number,
    totalAmount: number
): { commissionRate: number; commissionAmount: number; vendorAmount: number } {
    const parsedTotalAmount = parseFloat(String(totalAmount || '0'));
    const commissionAmount = Math.round((parsedTotalAmount * commissionRate / 100) * 100) / 100;
    const vendorAmount = Math.round((parsedTotalAmount - commissionAmount) * 100) / 100;

    return {
        commissionRate,
        commissionAmount,
        vendorAmount,
    };
}