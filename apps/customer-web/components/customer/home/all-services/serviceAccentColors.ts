/** Per-service accent gradients for All Services cards (not used on home). */
export const SERVICE_ACCENT: Record<
  string,
  { gradient: string; ring: string; glow: string }
> = {
  vet: {
    gradient: 'from-blue-500/15 via-blue-400/5 to-white',
    ring: 'ring-blue-200/60',
    glow: 'group-hover:shadow-blue-200/50',
  },
  grooming: {
    gradient: 'from-orange-500/15 via-orange-400/5 to-white',
    ring: 'ring-orange-200/60',
    glow: 'group-hover:shadow-orange-200/50',
  },
  walker: {
    gradient: 'from-emerald-500/15 via-emerald-400/5 to-white',
    ring: 'ring-emerald-200/60',
    glow: 'group-hover:shadow-emerald-200/50',
  },
  boarding: {
    gradient: 'from-indigo-500/15 via-indigo-400/5 to-white',
    ring: 'ring-indigo-200/60',
    glow: 'group-hover:shadow-indigo-200/50',
  },
  training: {
    gradient: 'from-violet-500/15 via-violet-400/5 to-white',
    ring: 'ring-violet-200/60',
    glow: 'group-hover:shadow-violet-200/50',
  },
  nutritionist: {
    gradient: 'from-lime-500/15 via-lime-400/5 to-white',
    ring: 'ring-lime-200/60',
    glow: 'group-hover:shadow-lime-200/50',
  },
  'pet-sitter': {
    gradient: 'from-slate-500/15 via-slate-400/5 to-white',
    ring: 'ring-slate-200/60',
    glow: 'group-hover:shadow-slate-200/50',
  },
  shop: {
    gradient: 'from-pink-500/15 via-pink-400/5 to-white',
    ring: 'ring-pink-200/60',
    glow: 'group-hover:shadow-pink-200/50',
  },
};

export function getServiceAccent(screenOrCategory: string | undefined) {
  const key = String(screenOrCategory || '').toLowerCase();
  return (
    SERVICE_ACCENT[key] ?? {
      gradient: 'from-orange-500/10 via-orange-400/5 to-white',
      ring: 'ring-orange-100/80',
      glow: 'group-hover:shadow-orange-100/60',
    }
  );
}
