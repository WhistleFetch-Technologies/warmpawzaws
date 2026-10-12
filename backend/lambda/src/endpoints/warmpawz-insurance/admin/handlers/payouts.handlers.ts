import type { Context } from 'hono';
import {
  payoutReceiptSchema,
  payoutRemindSchema,
  payoutScheduleInputSchema,
} from '../dto/insurance-admin.requests';
import { insuranceAdminActorId } from '../middleware/require-insurance-admin-permission.middleware';
import {
  getDefaultPayoutSchedule,
  getPayoutOverview,
  recordPayoutReceipt,
  saveDefaultPayoutSchedule,
  sendPayoutReminder,
} from '../services/insurance-payouts.service';
import { jsonBody, respond } from './respond';

export const getPayoutScheduleHandler = (c: Context) => respond(c, () => getDefaultPayoutSchedule());

export const savePayoutScheduleHandler = (c: Context) =>
  respond(c, async () =>
    saveDefaultPayoutSchedule(payoutScheduleInputSchema.parse(await jsonBody(c)), insuranceAdminActorId(c)),
  );

export const payoutOverviewHandler = (c: Context) => respond(c, () => getPayoutOverview());

export const payoutRemindHandler = (c: Context) =>
  respond(c, async () => sendPayoutReminder(payoutRemindSchema.parse(await jsonBody(c)), insuranceAdminActorId(c)));

export const payoutReceiptHandler = (c: Context) =>
  respond(c, async () => recordPayoutReceipt(payoutReceiptSchema.parse(await jsonBody(c)), insuranceAdminActorId(c)));
