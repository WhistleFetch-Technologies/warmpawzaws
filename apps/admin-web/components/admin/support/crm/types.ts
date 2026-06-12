export interface BookingSummary {
	serviceName?: string;
	status?: string;
	amount?: number;
	scheduledDate?: string;
}

export interface BookingContextPanel {
	id: string;
	status: string;
	serviceName?: string;
	serviceStyle?: string;
	scheduledDate?: string;
	scheduledTime?: string;
	amount?: number;
	vendorId?: string;
	vendorName?: string;
	vendorPhone?: string;
	paymentStatus?: string;
}

export interface PaymentContextPanel {
	paymentId?: string;
	totalPaid: number;
	walletPaid: number;
	gatewayPaid: number;
	refundedSoFar: number;
	refundableBalance: number;
	paymentMethod?: string;
	razorpayPaymentId?: string;
	paymentStatus?: string;
	hasGatewayPayment: boolean;
}

export interface MealOrderContextPanel {
  id: string;
  orderNumber?: string;
  status: string;
  planTitle?: string;
  totalAmount?: number;
  vendorId?: string;
  vendorName?: string;
  vendorPhone?: string;
  paymentStatus?: string;
  deliveryStatus?: string;
}

export interface MealOrderSummary {
  planTitle?: string;
  orderNumber?: string;
  status?: string;
  amount?: number;
}

export interface Ticket {
	id: string;
	customerId: string;
	customerName?: string;
	customerEmail?: string;
	customerPhone?: string;
	subject: string;
	description: string;
	status:
		| "open"
		| "ai_acknowledged"
		| "awaiting_assignment"
		| "assigned"
		| "in_progress"
		| "waiting_for_customer"
		| "resolved"
		| "closed"
		| "escalated";
	priority: "low" | "medium" | "high" | "urgent";
	source: string;
	createdAt: string;
	lastUpdatedAt?: string;
	messages?: TicketMessage[];
	assignedTo?: string;
	assignedAgent?: string;
	category?: string;
	metadata?: Record<string, unknown>;
	aiConversation?: Array<Record<string, unknown>>;
	ticketType?: "general" | "booking" | "meal_order";
	bookingId?: string;
	mealOrderId?: string;
	vendorId?: string;
	vendorPhone?: string;
	isRefundable?: boolean;
	refundBlockReason?: string;
	bookingSummary?: BookingSummary;
	mealOrderSummary?: MealOrderSummary;
	refundableBalance?: number;
	bookingContext?: BookingContextPanel | null;
	mealOrderContext?: MealOrderContextPanel | null;
	paymentContext?: PaymentContextPanel | null;
	refundRequested?: boolean;
	refundStatus?: string;
}

export interface TicketMessage {
	id: string;
	sender: string;
	content: string;
	timestamp: string;
	role: "agent" | "customer" | "system";
}

export interface TicketActivity {
	id: string;
	eventType: string;
	eventTitle: string;
	eventActorType: string | null;
	createdAt: string;
	eventMetadata: Record<string, unknown>;
}

export interface Agent {
	id: string;
	name: string;
	email?: string;
	specialties?: string[];
	workload?: number;
}

export interface AgentMetrics {
	agentId: string;
	agentName: string;
	totalTickets: number;
	resolved: number;
	resolutionRate: number;
	satisfaction: number;
	avgResponseTime: number;
	avgResolutionTime: number;
}

export interface CRMStats {
	totalTickets: number;
	openTickets: number;
	inProgressTickets: number;
	resolvedTickets: number;
	escalatedTickets: number;
	avgResponseTime: string;
	todayTickets: number;
	pendingRefunds: number;
}

export type QueueView =
	| "all"
	| "unassigned"
	| "assigned_to_me"
	| "booking"
	| "general"
	| "escalated"
	| "refunds";

export type DetailTab = "conversation" | "activity";
