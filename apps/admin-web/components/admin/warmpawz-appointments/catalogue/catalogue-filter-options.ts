export const PLATFORM_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },  { value: 'approved', label: 'Approved' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Inactive' },
] as const;

export const PUBLISH_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All approved vendors' },
  { value: 'not_in_catalogue', label: 'Not in catalogue' },
  { value: 'published', label: 'Published only' },
  { value: 'draft', label: 'Draft only' },
] as const;