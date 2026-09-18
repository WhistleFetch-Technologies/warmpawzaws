/** Build GET /customer/warmpawz-appointments/discovery/by-category with optional customer coords. */
export function buildWapptByCategoryFeedUrl(opts: {
  category: string;
  serviceStyle: string;
  limit: number;
  cursor?: string;
  specialization?: string;
  latitude?: string;
  longitude?: string;
}): string {
  const qs = new URLSearchParams({
    category: opts.category,
    serviceStyle: opts.serviceStyle,
    limit: String(opts.limit),
  });
  if (opts.specialization?.trim()) qs.set('specialization', opts.specialization.trim());
  if (opts.cursor) qs.set('cursor', opts.cursor);
  if (opts.latitude?.trim() && opts.longitude?.trim()) {
    qs.set('latitude', opts.latitude.trim());
    qs.set('longitude', opts.longitude.trim());
  }
  return `/customer/warmpawz-appointments/discovery/by-category?${qs}`;
}
