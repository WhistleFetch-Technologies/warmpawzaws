/**
 * Admin section to permission mapping.
 * Used by sidebar and route guard to show/allow only what the user can access.
 */

export const SECTION_PERMISSION: Record<string, string> = {
  analytics: 'admin:analytics:view',
  enterprise: 'admin:enterprise:view',
  vendors: 'admin:vendors:view',
  ecommerce: 'admin:ecommerce:view',
  regions: 'admin:regions:view',
  marketing: 'admin:marketing:view',
  loyalty: 'admin:loyalty:view',
  support: 'admin:support:view',
  catalog: 'admin:catalog:view',
  events: 'admin:events:view',
  content: 'admin:content:view',
  'pet-info': 'admin:pet_info:view',
  finance: 'admin:finance:view',
  roles: 'admin:roles:view',
  reports: 'admin:reports:view',
  'platform-settings': 'admin:platform_settings:view',
};

export function getPermissionForSection(sectionId: string): string | undefined {
  return SECTION_PERMISSION[sectionId];
}
