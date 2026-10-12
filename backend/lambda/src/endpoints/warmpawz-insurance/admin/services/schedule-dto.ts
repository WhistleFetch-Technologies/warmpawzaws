import { describeFrequency, type PayoutScheduleConfig } from '../domain/payout-periods';
import type { PayoutScheduleDTO } from '../dto/insurance-admin.responses';

export function toPayoutScheduleDTO(cfg: PayoutScheduleConfig): PayoutScheduleDTO {
  return {
    frequency: cfg.frequency,
    frequencyLabel: describeFrequency(cfg.frequency),
    anchorDate: cfg.anchorDate,
    dueDaysAfterPeriodEnd: cfg.dueDaysAfterPeriodEnd,
    graceDays: cfg.graceDays,
    reminderDaysBefore: [...cfg.reminderDaysBefore],
  };
}
