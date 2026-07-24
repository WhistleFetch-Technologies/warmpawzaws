export const CATALOGUE_CATEGORY_OPTIONS = [
  'All categories',
  'Veterinary',
  'Grooming',
  'Training',
  'Walking',
  'Sitting',
  'Daycare',
  'Ambulance',
  'Other Services',
] as const;

export const PLATFORM_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'approved', label: 'Approved' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Inactive' },
] as const;
