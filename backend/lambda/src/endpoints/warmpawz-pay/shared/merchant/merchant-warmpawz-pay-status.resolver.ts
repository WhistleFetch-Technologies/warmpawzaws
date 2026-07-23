import type { PublishStatus } from '../../constants/publish-status';
import { DRAFT, PUBLISHED } from '../../constants/publish-status';

export type WarmpawzPayStatus = 'Draft' | 'Published' | 'Hidden';

export function resolveWarmpawzPayStatus(
  publishStatus: PublishStatus,
  customerVisible: boolean,
): WarmpawzPayStatus {
  if (publishStatus === DRAFT) {
    return 'Draft';
  }

  if (publishStatus === PUBLISHED && customerVisible) {
    return 'Published';
  }

  return 'Hidden';
}
