export function mapPublicEvent(e: Record<string, unknown>) {
  const venue = typeof e.venue === 'object' && e.venue ? (e.venue as Record<string, unknown>) : {};
  return {
    id: String(e.id || ''),
    title: String(e.name || ''),
    name: String(e.name || ''),
    description: String(e.description || ''),
    category: e.category || 'other',
    organizer_name: e.vendor_name || 'Warmpawz',
    organizer_type: e.vendor_id ? 'vendor' : 'admin',
    venue: venue.name || venue.address || '',
    address: venue.address || '',
    city: e.vendor_city || venue.city || '',
    start_date: String(e.event_date || ''),
    end_date: String(e.end_date || e.event_date || ''),
    start_time: String(e.start_time || ''),
    end_time: String(e.end_time || ''),
    image_url: e.image_url || undefined,
    registration_required: e.registration_required || false,
    registration_fee: e.price_per_booking != null ? Number(e.price_per_booking) : e.fees ? Number(e.fees) : 0,
    max_participants: e.max_attendees != null ? Number(e.max_attendees) : undefined,
    registered_count: e.current_attendees != null ? Number(e.current_attendees) : 0,
    is_featured: false,
    status: e.status === 'published' ? 'upcoming' : e.status || 'draft',
    approval_status: e.approval_status,
    tags: Array.isArray(e.tags) ? e.tags : [],
    inclusions: e.inclusions || [],
    exclusions: e.exclusions || [],
    terms_and_conditions: e.terms_and_conditions,
    cancellation_policy: e.cancellation_policy,
    refund_policy: e.refund_policy,
    registration_rules: e.registration_rules || {},
    vendor_id: e.vendor_id ? String(e.vendor_id) : undefined,
    vendor_name: e.vendor_name || undefined,
  };
}

export function mapAdminEvent(e: Record<string, unknown>) {
  const venue = typeof e.venue === 'object' && e.venue ? (e.venue as Record<string, unknown>) : {};
  return {
    id: String(e.id || ''),
    title: String(e.name || ''),
    name: String(e.name || ''),
    description: String(e.description || ''),
    start_date: String(e.event_date || ''),
    end_date: String(e.end_date || e.event_date || ''),
    start_time: String(e.start_time || ''),
    end_time: String(e.end_time || ''),
    location: venue.address || JSON.stringify(venue),
    max_participants: e.max_attendees != null ? Number(e.max_attendees) : undefined,
    current_participants: e.current_attendees != null ? Number(e.current_attendees) : 0,
    status: e.status || 'draft',
    category: e.category || 'other',
    vendor_id: e.vendor_id ? String(e.vendor_id) : undefined,
    vendor_name: e.vendor_name || undefined,
    image_url: e.image_url || undefined,
    fees: e.fees != null ? Number(e.fees) : e.price_per_booking != null ? Number(e.price_per_booking) : undefined,
    tags: Array.isArray(e.tags) ? e.tags : [],
    created_at: String(e.created_at || new Date().toISOString()),
    approval_status: e.approval_status || 'pending',
    created_by: e.created_by || 'vendor',
    rejection_reason: e.rejection_reason || undefined,
    reviewed_at: e.reviewed_at || undefined,
  };
}

export function prefillDeclarations(pet: Record<string, unknown>): {
  vaccinated: boolean | null;
  social: boolean | null;
  trained: boolean | null;
  sources: Record<string, 'profile' | 'unestablished'>;
} {
  const records = pet.vaccination_records;
  const vaccinated = Array.isArray(records) && records.length > 0 ? true : null;
  const temperament = String(pet.temperament || '').toLowerCase();
  const behavior = String(pet.behavior_notes || '').toLowerCase();
  const blob = `${temperament} ${behavior}`;
  const social = /\bsocial\b|\bfriendly\b|\bgood with (dogs|pets|people)\b/.test(blob)
    ? true
    : /\baggressive\b|\banxious\b|\bfearful\b/.test(blob)
      ? false
      : null;
  const trained = /\btrained\b|\bobedient\b|\bhouse.?trained\b/.test(blob) ? true : null;
  return {
    vaccinated,
    social,
    trained,
    sources: {
      vaccinated: vaccinated != null ? 'profile' : 'unestablished',
      social: social != null ? 'profile' : 'unestablished',
      trained: trained != null ? 'profile' : 'unestablished',
    },
  };
}

export function petSnapshot(pet: Record<string, unknown>) {
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    age_years: pet.age_years,
    age_months: pet.age_months,
    date_of_birth: pet.date_of_birth,
    temperament: pet.temperament,
    behavior_notes: pet.behavior_notes,
    vaccination_records: pet.vaccination_records,
  };
}
