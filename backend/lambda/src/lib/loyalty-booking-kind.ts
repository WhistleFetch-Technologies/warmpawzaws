/** Maps a booking + service context to loyalty sheet / action_sources kinds (shared: bookings create + Razorpay verify). */
export type LoyaltyBookingKind = 'grooming' | 'vet_consultation' | 'nutrition_consultation' | 'other';

export function resolveLoyaltyBookingKind(input: {
	bookingServiceType: string;
	serviceCategory?: string | null;
	serviceName?: string | null;
	vendorType?: string | null;
}): LoyaltyBookingKind {
	const cat = String(input.serviceCategory || '').toLowerCase();
	const v = String(input.vendorType || '').toLowerCase();
	const name = String(input.serviceName || '').toLowerCase();
	const st = String(input.bookingServiceType || '').toLowerCase();
	if (cat.includes('groom') || v.includes('groom')) return 'grooming';
	if (cat.includes('nutrition') || cat.includes('diet') || name.includes('nutrition')) return 'nutrition_consultation';
	if (cat.includes('vet') || cat.includes('veterinar') || v.includes('vet') || v.includes('veterinar')) return 'vet_consultation';
	if (
		(st === 'tele' || st === 'online' || st === 'video_consultation' || st === 'tele_consultation') &&
		(name.includes('consult') || name.includes('vet'))
	) {
		return 'vet_consultation';
	}
	return 'other';
}
