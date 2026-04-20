/**
 * Vendor chat tool pass: Bedrock router + RDS reads (see ai-vendor-chat-tools-core.ts for parser/tests).
 */

import { query } from '../../database/rds-connection';
import { invokeBedrock } from '../bedrock-client';
import { withRetry } from '../error-recovery';
import {
  VENDOR_TOOL_PASS1_SYSTEM,
  MAX_VENDOR_AGENT_PLANNER_ROUNDS,
  vendorChatMayTriggerDataAgent,
  parseVendorToolRequestsFromCompletion,
  formatVendorToolResultsForPrompt,
  executeVendorToolRequestsWithQuery,
  type VendorToolRequest,
} from './ai-vendor-chat-tools-core';

export {
  VENDOR_CHAT_TOOL_NAMES,
  type VendorChatToolName,
  type VendorToolRequest,
  type VendorBookingRevenueMonthPeriod,
  VENDOR_TOOL_PASS1_SYSTEM,
  MAX_VENDOR_AGENT_PLANNER_ROUNDS,
  vendorChatMayTriggerToolPass,
  vendorChatMayTriggerDataAgent,
  vendorChatMayTriggerBookingRevenueTool,
  parseVendorToolRequestsFromCompletion,
  formatVendorToolResultsForPrompt,
  executeVendorToolRequestsWithQuery,
} from './ai-vendor-chat-tools-core';

export async function executeVendorToolRequests(
  vendorId: string,
  requests: VendorToolRequest[]
): Promise<Record<string, unknown>> {
  return executeVendorToolRequestsWithQuery(vendorId, requests, query);
}

/**
 * Multi-round vendor **data agent**: planner (Bedrock) chooses allowlisted RDS reads;
 * results accumulate and the planner can request more tools (same turn) until it returns
 * empty toolRequests or MAX_VENDOR_AGENT_PLANNER_ROUNDS is reached. Main vendor Bedrock
 * call then interprets TOOL_RESULTS_JSON — it does not execute SQL itself.
 *
 * Set VENDOR_CHAT_DATA_AGENT_ALWAYS=true to run the planner on (almost) every vendor message.
 */
export async function fetchVendorToolAppendixForPrompt(vendorId: string, userMessage: string): Promise<string> {
  if (!vendorId) return '';
  const alwaysAgent =
    String(process.env.VENDOR_CHAT_DATA_AGENT_ALWAYS || '').toLowerCase() === '1' ||
    String(process.env.VENDOR_CHAT_DATA_AGENT_ALWAYS || '').toLowerCase() === 'true';
  if (!alwaysAgent && !vendorChatMayTriggerDataAgent(userMessage)) return '';

  let accumulated: Record<string, unknown> = {};

  for (let round = 0; round < MAX_VENDOR_AGENT_PLANNER_ROUNDS; round++) {
    const plannerUserMessage =
      round === 0
        ? userMessage
        : `${userMessage}\n\nACCUMULATED_TOOL_RESULTS_JSON:\n${JSON.stringify(accumulated)}`;

    let passRaw = '';
    try {
      passRaw = await withRetry(
        () =>
          invokeBedrock(plannerUserMessage, VENDOR_TOOL_PASS1_SYSTEM, {
            maxTokens: 280,
            temperature: 0,
            topP: 0.9,
          }),
        {
          maxAttempts: 2,
          initialDelayMs: 400,
          retryableErrors: ['Bedrock invocation failed', 'ETIMEDOUT', 'ECONNRESET'],
        }
      );
    } catch {
      break;
    }

    const requests = parseVendorToolRequestsFromCompletion(passRaw);
    if (requests.length === 0) break;

    try {
      const batch = await executeVendorToolRequests(vendorId, requests);
      accumulated = { ...accumulated, ...batch };
    } catch {
      break;
    }
  }

  return formatVendorToolResultsForPrompt(accumulated);
}
