/** Commercial AI Copilot — shared types (gateway layer only; engines unchanged). */

export type CommercialAiIntent = 'explain' | 'investigate' | 'refuse';

export type CommercialAiSource = 'documentation' | 'live_runtime' | 'hybrid';

export type CommercialAiSurface = 'marketing' | 'ecommerce' | 'finance' | 'notifications' | 'unknown';

export type CommercialAiDomain = 'SERVICE' | 'ECOMMERCE' | 'unknown';

export type CommercialAiModule =
  | 'promotions'
  | 'coupons'
  | 'policy'
  | 'campaigns'
  | 'analytics'
  | 'settlement'
  | 'finance'
  | 'notifications'
  | 'other';

export type CommercialAiEntityType =
  | 'promotion'
  | 'coupon'
  | 'campaign'
  | 'booking'
  | 'settlement'
  | 'policy'
  | 'order';

export interface CommercialAiEntityContext {
  type: CommercialAiEntityType;
  id: string;
  name?: string;
}

export interface CommercialAiContextPacket {
  surface: CommercialAiSurface;
  discountDomain: CommercialAiDomain;
  module: CommercialAiModule;
  route: string;
  tab?: string;
  filters?: Record<string, string>;
  entity?: CommercialAiEntityContext;
}

export interface CommercialAiChatRequest {
  message: string;
  conversationId?: string;
  context?: Partial<CommercialAiContextPacket>;
}

export interface CommercialAiChatResponse {
  success: boolean;
  conversationId: string;
  response: string;
  intent: CommercialAiIntent;
  source: CommercialAiSource;
  suggestedQuestions: string[];
  toolNames: string[];
  usedBedrock: boolean;
  requestId: string;
  code?: string;
  error?: string;
}
