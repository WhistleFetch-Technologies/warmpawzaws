/**
 * Warmpawz Pay vendor catalogue — publish status values (matches DB CHECK constraint).
 */
export const DRAFT = 'draft' as const;
export const PUBLISHED = 'published' as const;

export const PublishStatus = {
  DRAFT,
  PUBLISHED,
} as const;

export type PublishStatus = (typeof PublishStatus)[keyof typeof PublishStatus];
