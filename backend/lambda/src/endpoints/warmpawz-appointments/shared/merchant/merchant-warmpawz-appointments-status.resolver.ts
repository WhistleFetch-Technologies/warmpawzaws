import type { PublishStatus } from '../../constants/publish-status';
import { DRAFT, PUBLISHED } from '../../constants/publish-status';

export type WarmpawzAppointmentsStatus = 'Draft' | 'Published' | 'Hidden';

export function resolveWarmpawzAppointmentsStatus(
  publishStatus: PublishStatus,
  customerVisible: boolean,
): WarmpawzAppointmentsStatus {
  if (publishStatus === DRAFT) {
    return 'Draft';
  }

  if (publishStatus === PUBLISHED && customerVisible) {
    return 'Published';
  }

  return 'Hidden';
}
