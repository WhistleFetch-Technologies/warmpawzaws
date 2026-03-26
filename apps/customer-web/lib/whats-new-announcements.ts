/**
 * Shared "What's New" rows: same list on home and /whats-new.
 * Source: /customer/announcements (admin home_announcements) + guaranteed articles row.
 */

export type WhatsNewAnnouncement = {
  id: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  badgeColor?: string;
  icon?: string;
  ctaText?: string;
  ctaLink?: string;
  announcementType?: string;
};

const customerArticlesRow: WhatsNewAnnouncement = {
  id: 'customer-articles',
  title: 'Pet care articles',
  subtitle: 'Tips on pets, pet care, services & vendors',
  badgeText: 'TIPS',
  badgeColor: 'teal',
  announcementType: 'articles',
  ctaLink: 'articles',
};

const fallbackWhatsNew: WhatsNewAnnouncement[] = [
  {
    id: 'ai',
    title: 'AI Pet Assistant',
    subtitle: 'Get instant answers about pet care',
    badgeText: 'NEW',
    badgeColor: 'green',
    icon: '🤖',
    announcementType: 'feature',
  },
  {
    id: 'sos',
    title: 'Emergency Ambulance',
    subtitle: 'Instant location-based dispatch',
    badgeText: 'SOS',
    badgeColor: 'red',
    icon: '📞',
    ctaText: 'SOS ALERT',
    ctaLink: 'ambulance',
    announcementType: 'emergency',
  },
  {
    id: 'premium',
    title: 'WarmPawz Plus',
    subtitle: 'Unlimited services at best prices',
    badgeText: 'PREMIUM',
    badgeColor: 'purple',
    icon: '⭐',
    announcementType: 'premium',
  },
  customerArticlesRow,
];

export function buildWhatsNewAnnouncements(dynamicFromApi: any[]): WhatsNewAnnouncement[] {
  const base =
    Array.isArray(dynamicFromApi) && dynamicFromApi.length > 0 ? dynamicFromApi : fallbackWhatsNew;
  const hasArticles = base.some(
    (a: any) =>
      a.id === 'customer-articles' ||
      a.announcementType === 'articles' ||
      a.ctaLink === 'articles'
  );
  return hasArticles ? base : [...base, customerArticlesRow];
}

type AppRouter = { push: (href: string) => void };

/** Full-page /whats-new navigation (Next routes + home for SPA-only flows). */
export function navigateWhatsNewFromFullPage(router: AppRouter, announcement: WhatsNewAnnouncement, source: 'row' | 'sos'): void {
  if (source === 'sos' || announcement.announcementType === 'emergency') {
    router.push('/');
    return;
  }

  const type = announcement.announcementType || '';
  if (type === 'articles' || announcement.ctaLink === 'articles') {
    router.push('/articles');
    return;
  }
  if (type === 'premium') {
    router.push('/subscriptions');
    return;
  }
  if (type === 'feature' || announcement.id === 'ai') {
    router.push('/chat');
    return;
  }

  const raw = String(announcement.ctaLink || '').trim();
  if (!raw) return;

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    if (typeof window !== 'undefined') window.open(raw, '_blank', 'noopener,noreferrer');
    return;
  }

  if (raw.startsWith('/')) {
    router.push(raw);
    return;
  }

  const slug = raw.replace(/^\//, '');
  const staticRoutes = new Set([
    'shop',
    'cart',
    'promotions',
    'subscriptions',
    'settings',
    'bookings',
    'pets',
    'wallet',
    'rewards',
    'notifications',
    'profile',
    'articles',
  ]);
  if (staticRoutes.has(slug)) {
    router.push(`/${slug}`);
    return;
  }

  router.push('/');
}
